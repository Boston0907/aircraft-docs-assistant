// Local lexical retrieval: BM25 over page-bounded passages + controlled query expansion.
// Pure JS, no dependencies, identical in the browser and in Node tests.
import { STOP_EN, STOP_HE, HE_PREFIXES, HE_GLOSSARY, ABBREV, SYNONYMS, FAULT_WORDS_EN, FAULT_WORDS_HE } from './lexicon.js';

const K1 = 1.2, B = 0.75;
const CONTEXT_WEIGHT = 0.6;     // section / heading / item-name tokens
const EXPANSION_WEIGHT = 0.8;   // abbreviation / synonym alternatives
const COMMON_DF = 0.25;         // concepts present in >25% of passages don't count toward coverage

// ---------- text normalisation ----------

export function normalize(s) {
  return (s || '').normalize('NFKC')
    .replace(/[֑-ׇ]/g, '')            // Hebrew niqqud/cantillation
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’‛′]/g, "'").replace(/[“”״]/g, '"').replace(/׳/g, "'");
}

export function stem(w) {
  if (!/^[a-z]+$/.test(w) || w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (!/(ss|us|is)$/.test(w) && w.endsWith('s')) w = w.slice(0, -1);
  for (const suf of ['ing', 'ed']) {
    if (w.endsWith(suf) && w.length > suf.length + 2) {
      w = w.slice(0, -suf.length);
      if (/([^lsz])\1$/.test(w)) w = w.slice(0, -1);
      return w;
    }
  }
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}

const EN_TOKEN = /[a-z0-9]+(?:[-/.][a-z0-9]+)*/g;

// Index-side tokenizer: compound codes ("25-14", "ads-b", "a/p") are kept whole AND split.
export function tokenizeEn(text) {
  const out = [];
  for (const m of normalize(text).toLowerCase().matchAll(EN_TOKEN)) {
    const t = m[0].replace(/\.$/, '');
    if (/[-/.]/.test(t)) {
      out.push(t);
      for (const p of t.split(/[-/.]/)) if (p) out.push(stem(p));
    } else out.push(stem(t));
  }
  return out;
}

const phraseStems = (phrase) => tokenizeEn(phrase).filter((t) => !/[-/.]/.test(t) || !/[a-z]/.test(t) || phrase.includes(t));

// ---------- index ----------

export class SearchIndex {
  constructor(docs, passages) {
    this.docs = new Map(docs.map((d) => [d.docId, d]));
    this.passages = passages;
    this.post = new Map();          // term -> Map(pid -> weighted tf)
    this.len = new Float32Array(passages.length);
    let total = 0;
    passages.forEach((p, pid) => {
      const toks = tokenizeEn(p.t);
      this.len[pid] = toks.length;
      total += toks.length;
      const add = (t, w) => {
        let m = this.post.get(t);
        if (!m) this.post.set(t, (m = new Map()));
        m.set(pid, (m.get(pid) || 0) + w);
      };
      for (const t of toks) add(t, 1);
      const ctx = [...(p.sec || []), p.hd || '', p.item || ''].join(' ');
      for (const t of new Set(tokenizeEn(ctx))) add(t, CONTEXT_WEIGHT);
    });
    this.N = passages.length;
    this.avgdl = total / Math.max(1, this.N);
    this._buildVocab(docs);
  }

  _buildVocab(docs) {
    // abbreviations: built-in + mined from installed documents
    this.abbr = new Map();
    for (const [k, v] of Object.entries(ABBREV)) this.abbr.set(k.toLowerCase(), v.toLowerCase());
    for (const d of docs) for (const [k, v] of Object.entries(d.abbreviations || {})) {
      const key = k.toLowerCase();
      if (!this.abbr.has(key) && key.length >= 2) this.abbr.set(key, v.toLowerCase());
    }
    // phrase -> alternatives
    this.alts = new Map();
    const link = (a, b) => {
      const ka = phraseStems(a).join(' ');
      if (!ka) return;
      if (!this.alts.has(ka)) this.alts.set(ka, new Set([a]));
      if (b) this.alts.get(ka).add(b);
    };
    for (const g of SYNONYMS) for (const a of g) for (const b of g) link(a, b);
    for (const [a, full] of this.abbr) { link(full, a); link(a, full); }
    for (const [, ens] of HE_GLOSSARY) for (const e of ens) link(e, null);
    this.maxPhrase = 4;
    // Hebrew glossary: form -> english list
    this.he = new Map();
    for (const [forms, ens] of HE_GLOSSARY) for (const f of forms.split('|')) this.he.set(normalize(f).trim(), ens);
    // document tags usable in a question ("AFM", "MMEL", "G550"...)
    this.docTags = new Map();
    for (const d of docs) for (const w of d.shortName.toLowerCase().split(/\s+/)) {
      if (!this.docTags.has(w)) this.docTags.set(w, new Set());
      this.docTags.get(w).add(d.docId);
    }
  }

  idf(t) {
    const df = this.post.get(t)?.size || 0;
    return Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
  }

  // ---------- query analysis ----------

  analyze(query) {
    const q = normalize(query);
    const raw = q.match(/[א-ת"']+|[A-Za-z0-9]+(?:[-/.][A-Za-z0-9]+)*/g) || [];
    const toks = raw.map((r) => ({ raw: r.replace(/^["']+|["']+$/g, ''), he: /[א-ת]/.test(r) })).filter((t) => t.raw);
    const concepts = [], unknownHe = [], docIds = new Set(), aircraftHint = new Set();
    for (let i = 0; i < toks.length;) {
      const t = toks[i];
      if (t.he) {
        const m = this._matchHebrew(toks, i);
        if (m) { concepts.push({ label: m.label, src: 'he', alts: m.ens.map((e, k) => ({ phrase: e, terms: phraseStems(e), w: k === 0 ? 1 : EXPANSION_WEIGHT })) }); i += m.n; continue; }
        if (!STOP_HE.has(t.raw) && !STOP_HE.has(stripHePrefix(t.raw)) && t.raw.length > 1) unknownHe.push(t.raw);
        i++; continue;
      }
      const low = t.raw.toLowerCase();
      if (/^(g-?550|gv|g-?v|gv-?sp)$/.test(low)) { aircraftHint.add(low.includes('550') || low === 'gv-sp' ? 'G550' : 'GV'); i++; continue; }
      if (['afm', 'aom', 'mmel', 'mopp', 'pth'].includes(low) && this.docTags.has(low)) {
        for (const id of this.docTags.get(low)) docIds.add(id);
        i++; continue;
      }
      // longest known English phrase starting here
      let matched = false;
      for (let n = Math.min(this.maxPhrase, toks.length - i); n >= 1 && !matched; n--) {
        const span = toks.slice(i, i + n);
        if (span.some((s) => s.he)) continue;
        const phrase = span.map((s) => s.raw.toLowerCase()).join(' ');
        const key = phraseStems(phrase).join(' ');
        const isAbbr = n === 1 && this.abbr.has(low) && (!STOP_EN.has(low) || t.raw === t.raw.toUpperCase());
        if ((n > 1 || isAbbr) && (this.alts.has(key) || isAbbr)) {
          const set = new Set([phrase, ...(this.alts.get(key) || [])]);
          if (isAbbr) set.add(this.abbr.get(low));
          concepts.push({ label: phrase, src: 'en', alts: [...set].map((e, k) => ({ phrase: e, terms: phraseStems(e), w: k === 0 ? 1 : EXPANSION_WEIGHT })) });
          i += n; matched = true;
        }
      }
      if (matched) continue;
      if (STOP_EN.has(low) || low.length < 2 && !/\d/.test(low)) { i++; continue; }
      const key = stem(low);
      const set = new Set([low, ...(this.alts.get(key) || [])]);
      const terms = /[-/.]/.test(low) ? [low] : [key];
      concepts.push({ label: t.raw, src: 'en', alts: [...set].map((e, k) => ({ phrase: e, terms: k === 0 ? terms : phraseStems(e), w: k === 0 ? 1 : EXPANSION_WEIGHT })) });
      i++;
    }
    for (const c of concepts) c.alts = c.alts.filter((a) => a.terms.length);
    const fault = FAULT_WORDS_EN.test(q) || FAULT_WORDS_HE.test(q);
    return { concepts: concepts.filter((c) => c.alts.length), unknownHe, docIds, aircraftHint, fault };
  }

  _matchHebrew(toks, i) {
    for (let n = Math.min(4, toks.length - i); n >= 1; n--) {
      const span = toks.slice(i, i + n);
      if (!span.every((s) => s.he)) continue;
      for (const first of heVariants(span[0].raw, true)) {
        const lastForms = n > 1 ? heVariants(span[n - 1].raw, false) : [null];
        for (const last of lastForms) {
          const words = span.map((s) => s.raw);
          words[0] = first;
          if (n > 1) words[n - 1] = last;
          const key = words.join(' ');
          if (this.he.has(key)) return { n, label: span.map((s) => s.raw).join(' '), ens: this.he.get(key) };
        }
      }
    }
    return null;
  }

  // ---------- search ----------

  search(query, { aircraft = 'ALL', limit = 20 } = {}) {
    const a = this.analyze(query);
    const allowed = (pid) => {
      const p = this.passages[pid];
      const d = this.docs.get(p.d);
      if (a.docIds.size && !a.docIds.has(p.d)) return false;
      const scope = a.aircraftHint.size === 1 ? [...a.aircraftHint][0] : aircraft;
      return scope === 'ALL' || d.aircraft === 'ALL' || d.aircraft === scope;
    };
    const res = { ...a, status: 'notFound', results: [], searched: [] };
    if (!a.concepts.length) { res.status = a.unknownHe.length ? 'unrecognized' : 'empty'; return res; }

    const acc = new Map();   // pid -> {score, concepts:Set, terms:Set}
    const counted = [];
    a.concepts.forEach((c, ci) => {
      const hits = new Map(); // pid -> {s, terms}
      for (const alt of c.alts) {
        const lists = alt.terms.map((t) => this.post.get(t));
        if (lists.some((l) => !l)) continue;
        lists.sort((x, y) => x.size - y.size);
        for (const [pid] of lists[0]) {
          if (!lists.every((l) => l.has(pid)) || !allowed(pid)) continue;
          let s = 0;
          for (const t of alt.terms) {
            const tf = this.post.get(t).get(pid);
            s += this.idf(t) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * this.len[pid] / this.avgdl));
          }
          s = alt.w * s / Math.sqrt(alt.terms.length);
          const prev = hits.get(pid);
          if (!prev || s > prev.s) hits.set(pid, { s, terms: alt.terms, phrase: alt.phrase });
        }
      }
      c.df = hits.size;
      c.common = hits.size > COMMON_DF * this.N;
      if (!c.common) counted.push(ci);
      for (const [pid, h] of hits) {
        let r = acc.get(pid);
        if (!r) acc.set(pid, (r = { score: 0, concepts: new Set(), terms: new Set(), phrases: [] }));
        r.score += h.s;
        r.concepts.add(ci);
        h.terms.forEach((t) => r.terms.add(t));
        if (h.phrase.includes(' ')) r.phrases.push(h.phrase);
      }
    });
    res.searched = a.concepts.map((c) => ({ label: c.label, src: c.src, terms: [...new Set(c.alts.map((x) => x.phrase))], found: c.df > 0 }));
    const denom = counted.length || a.concepts.length;
    const countSet = counted.length ? new Set(counted) : null;
    let ranked = [];
    for (const [pid, r] of acc) {
      const got = [...r.concepts].filter((ci) => !countSet || countSet.has(ci)).length;
      const coverage = got / denom;
      const ps = this.passages[pid];
      let penalty = 1;
      if (ps.f?.includes('toc')) penalty *= 0.45;          // tables of contents point elsewhere
      if (ps.t.length < 80) penalty *= 0.6;                // fragments with little content
      ranked.push({ pid, coverage, base: r.score, score: penalty * r.score * (0.2 + 0.8 * coverage * coverage), terms: r.terms, phrases: r.phrases });
    }
    ranked.sort((x, y) => y.score - x.score);
    // adjacency bonus on the head of the list: query words / alternative phrases appearing together
    const head = ranked.slice(0, 80);
    const adj = adjacencyPatterns(a.concepts);
    for (const r of head) {
      const text = this.passages[r.pid].t.toLowerCase();
      let bonus = 1;
      for (const re of adj) if (re.test(text)) bonus *= 1.25;
      for (const ph of r.phrases) if (phraseRegex(ph).test(text)) bonus *= 1.1;
      r.score *= Math.min(bonus, 2);
    }
    head.sort((x, y) => y.score - x.score);
    ranked = head.concat(ranked.slice(80));
    // at most 2 passages per page
    const perPage = new Map();
    for (const r of ranked) {
      const p = this.passages[r.pid];
      const k = p.d + ':' + p.p;
      const n = perPage.get(k) || 0;
      if (n >= 2) continue;
      perPage.set(k, n + 1);
      res.results.push({ passage: p, score: r.score, coverage: r.coverage, terms: [...r.terms] });
      if (res.results.length >= limit) break;
    }
    if (!res.results.length) res.status = 'notFound';
    else {
      // Confidence is judged on real content only (not tables of contents), and never "found"
      // when part of the user's Hebrew wording could not be interpreted at all.
      const content = res.results.find((r) => !r.passage.f?.includes('toc'));
      const best = content ? content.coverage : 0;
      const complete = best >= 0.999;
      res.status = complete && !a.unknownHe.length ? 'found' : 'partial';
      // drop weak tail when we do have complete matches
      if (res.status === 'found') res.results = res.results.filter((r) => r.coverage >= Math.min(best, 0.5));
      if (content && res.results[0] !== content) res.results = [content, ...res.results.filter((r) => r !== content)];
    }
    return res;
  }
}

function stripHePrefix(w) {
  for (const p of HE_PREFIXES) if (w.startsWith(p) && w.length - p.length >= 2) return w.slice(p.length);
  return w;
}

const FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
function heVariants(w, allowPrefix) {
  const out = new Set([w]);
  const bases = [w];
  if (allowPrefix) for (const p of HE_PREFIXES) if (w.startsWith(p) && w.length - p.length >= 2) bases.push(w.slice(p.length));
  for (const b of bases) {
    out.add(b);
    for (const suf of ['ים', 'ות', 'ה', 'ת']) {
      if (b.endsWith(suf) && b.length - suf.length >= 2) {
        let s = b.slice(0, -suf.length);
        const last = s[s.length - 1];
        out.add(s); if (FINAL[last]) out.add(s.slice(0, -1) + FINAL[last]);
        if (suf === 'ות') out.add(s + 'ה');
      }
    }
  }
  return [...out];
}

function phraseRegex(phrase) {
  const words = phrase.toLowerCase().split(/[\s]+/).filter(Boolean).map((w) => stem(w).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  return new RegExp('\\b' + words.join('\\w*[\\W_]+') + '\\w*');
}

function adjacencyPatterns(concepts) {
  const out = [];
  for (let i = 0; i + 1 < concepts.length; i++) {
    const a = concepts[i], b = concepts[i + 1];
    if (a.src !== 'en' || b.src !== 'en') continue;
    out.push(phraseRegex(a.alts[0].phrase + ' ' + b.alts[0].phrase));
  }
  return out;
}

// For the UI: split text into chunks, marking words whose stem matched the query.
export function highlightChunks(text, terms) {
  const set = new Set(terms);
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/[A-Za-z0-9]+(?:[-/.][A-Za-z0-9]+)*/g)) {
    const w = m[0].toLowerCase().replace(/\.$/, '');
    const hit = set.has(w) || set.has(stem(w)) || (/[-/.]/.test(w) && w.split(/[-/.]/).some((p) => p.length > 2 && set.has(stem(p))));
    if (!hit) continue;
    if (m.index > last) out.push({ s: text.slice(last, m.index) });
    out.push({ s: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}
