// Extraction result → searchable passages with exact source locations.
// Pure functions: no DOM, no pdf.js. Same code runs on the iPad and in the Node test harness.

const TOP_ZONE = 0.30;     // fraction of page height treated as header zone
const BOTTOM_ZONE = 0.12;  // fraction treated as footer zone
const MAX_PASSAGE = 1400;  // chars
const MIN_PASSAGE = 250;

const segNorm = (s) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
const isChangeBar = (s) => /^[|│]+$/.test(s);

// ---------- document identity ----------

export function identifyDocument(filename, info, firstPagesText) {
  const base = filename.replace(/\.pdf$/i, '').trim();
  const m = base.match(/^(.*?)[\s_-]*REV(?:ISION)?\.?[\s_-]*(\d+[A-Z]?)\b/i);
  const shortName = (m ? m[1] : base).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const revFromName = m ? m[2] : null;
  const counts = {};
  for (const r of firstPagesText.matchAll(/REVISION(?:\s+NO\.?)?\s*:?\s*(\d{1,3})\b/gi)) counts[r[1]] = (counts[r[1]] || 0) + 1;
  const revFromText = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const title = (info?.Title || '').trim() || base;
  const revInTitle = title.match(/Rev(?:ision)?\.?\s*(\d+)/i)?.[1] || null;
  const revision = revFromName || revInTitle || revFromText || null;
  const revisionSources = { filename: revFromName, title: revInTitle, text: revFromText };
  const distinct = new Set(Object.values(revisionSources).filter(Boolean));
  const aircraft = /\bG\s?550\b/i.test(shortName) ? 'G550' : /\bGV\b|\bG-?V\b/i.test(shortName) ? 'GV' : 'ALL';
  return {
    docId: (shortName + (revision ? '_REV' + revision : '')).replace(/[^A-Z0-9]+/g, '_'),
    shortName,
    title,
    revision,
    revisionSources,
    revisionConsistent: distinct.size <= 1,
    aircraft,
  };
}

// ---------- boilerplate (running headers/footers) ----------

// Two rules, both conservative so real content is never dropped:
//  - whole header/footer LINES that repeat (digits normalised), e.g. "REVISION NO. 11  PAGE NO. 25-14";
//  - individual SEGMENTS that repeat verbatim AND contain >= 5 letters, e.g. a column-header word.
// Short tokens such as "22.", "A", "0" are never treated as boilerplate.
function findBoilerplate(pages) {
  const lineFreq = new Map(), segFreq = new Map();
  for (const p of pages) {
    const seenL = new Set(), seenS = new Set();
    for (const l of p.lines) {
      if (!(l.y < p.h * TOP_ZONE || l.y > p.h * (1 - BOTTOM_ZONE))) continue;
      seenL.add(lineKey(l));
      for (const s of l.segs) if ((s.s.match(/[A-Za-z]/g) || []).length >= 5) seenS.add(s.s.trim());
    }
    for (const k of seenL) lineFreq.set(k, (lineFreq.get(k) || 0) + 1);
    for (const k of seenS) segFreq.set(k, (segFreq.get(k) || 0) + 1);
  }
  const min = Math.max(3, Math.ceil(pages.length * 0.2));
  const pick = (m) => new Set([...m].filter(([, c]) => c >= min).map(([k]) => k));
  return { lines: pick(lineFreq), segs: pick(segFreq) };
}
const lineKey = (l) => segNorm(l.segs.map((s) => s.s).join(' '));

// ---------- printed page labels ----------

const LABEL_PATTERNS = [
  { re: /PAGE\s*(?:NO\.?|NUMBER)\s*:?\s*([A-Z]{0,3}-?\d[\dA-Z]*(?:-\d+)*|[IVXLC]{1,7})\b/i, f: (m) => m[1] },
  { re: /\b(\d{2}-\d{2}-\d{2})\s*:\s*(\d+)\s+of\s+\d+/i, f: (m) => `${m[1]}: ${m[2]}` },
  { re: /^(?:Page\s+)?([A-Z]{1,3}-\d{1,4}|\d{1,2}-\d{1,4}(?:-\d{1,4})?|[ivxlc]{1,7}|[IVXLC]{1,7})$/, f: (m) => m[1] },
];

function pageLabel(p) {
  const zoneSegs = [];
  const bottom = p.lines.filter((l) => l.y > p.h * (1 - BOTTOM_ZONE));
  const top = p.lines.filter((l) => l.y < p.h * TOP_ZONE);
  const tidy = (t) => t.replace(/\s*[-–]\s*(?=\d)/g, '-').trim();
  for (const l of [...bottom.reverse(), ...top]) for (const s of l.segs) zoneSegs.push(tidy(s.s));
  const lineTexts = [...bottom, ...top].map((l) => tidy(l.segs.map((s) => s.s).join(' ')));
  for (const pat of LABEL_PATTERNS.slice(0, 2)) {
    for (const t of [...zoneSegs, ...lineTexts]) {
      const m = t.match(pat.re);
      if (m) return pat.f(m);
    }
  }
  for (const t of zoneSegs) {
    const m = t.trim().match(LABEL_PATTERNS[2].re);
    if (m) return m[1];
  }
  return null;
}

// ---------- sections from the PDF outline (bookmarks) ----------

// Outline entries arrive flattened in document order with depths; rebuild the tree and, for a
// page, descend into the child whose page range [own page .. last descendant page] contains it.
function sectionResolver(outline, docTitle) {
  const root = { children: [] };
  const stack = [root];
  for (const e of outline) {
    if (e.depth === 0 && e.page === 1 && docTitle && similar(e.title, docTitle) && !outline.some((x) => x.depth > 0)) continue;
    const node = { title: e.title, page: e.page, children: [] };
    while (stack.length > e.depth + 1) stack.pop();
    (stack[stack.length - 1] || root).children.push(node);
    stack.push(node);
  }
  const span = (n) => { n.min = n.page; n.max = n.page; for (const c of n.children) { span(c); n.min = Math.min(n.min, c.min); n.max = Math.max(n.max, c.max); } };
  root.children.forEach(span);
  return (pageNo) => {
    const path = [];
    let level = root.children;
    while (level && level.length) {
      const inRange = level.filter((c) => c.min <= pageNo && pageNo <= c.max);
      const cand = inRange.length ? inRange : level.filter((c) => c.page <= pageNo);
      if (!cand.length) break;
      const best = cand.reduce((a, b) => (b.page >= a.page ? b : a));
      if (!(docTitle && similar(best.title, docTitle))) path.push(best.title);
      level = best.children;
    }
    return path;
  };
}
const similar = (a, b) => a.toLowerCase().replace(/\W/g, '').slice(0, 12) === b.toLowerCase().replace(/\W/g, '').slice(0, 12);

// Headings found in the text itself (used when there is no outline, and for finer granularity).
const HEADING_RES = [
  /^\d{2}-\d{2}-\d{2}\s*:\s*\S.{2,80}$/,                 // AFM style "00-20-50: Abbreviations"
  /^(?:ATA\s+)?\d{1,2}\.\s+(?:[A-Z][A-Za-z/&-]*|and|of|or|&)(?:[\s/]+(?:[A-Z][A-Za-z/&-]*|and|of|or|&)){0,4}$/,   // "25. Equipment/Furnishings", "21. AIR CONDITIONING"
  /^(?:CHAPTER|Chapter|SECTION|Section)\s+[\dIVX]+(?::|\s|$)[^.()]{0,60}$/,
];
const looksLikeHeading = (t) => HEADING_RES.some((re) => re.test(t));

// ---------- column (table) detection ----------

function detectColumns(lines, pageW) {
  if (lines.length < 6) return null;
  const multi = lines.filter((l) => l.segs.length >= 2).length;
  if (multi / lines.length < 0.12) return null;
  const W = Math.ceil(pageW) + 2;
  const cov = new Uint16Array(W);
  let minX = W, maxX = 0;
  for (const l of lines) for (const s of l.segs) {
    const a = Math.max(0, s.x), b = Math.min(W - 1, s.x + Math.max(s.w, 1));
    for (let x = a; x <= b; x++) cov[x]++;
    minX = Math.min(minX, a); maxX = Math.max(maxX, b);
  }
  const tol = Math.max(1, Math.floor(lines.length * 0.03));
  const seps = [];
  let runStart = -1;
  for (let x = minX; x <= maxX + 1; x++) {
    const empty = x <= maxX && cov[x] <= tol;
    if (empty && runStart < 0) runStart = x;
    if (!empty && runStart >= 0) {
      if (x - runStart >= 4 && runStart > minX) seps.push((runStart + x) / 2);
      runStart = -1;
    }
  }
  if (seps.length < 1) return null;
  const bounds = [minX, ...seps, maxX + 1];
  const cols = [];
  for (let i = 0; i < bounds.length - 1; i++) cols.push([bounds[i], bounds[i + 1]]);
  // Two wide columns = two-column prose, not a table.
  const wide = cols.filter(([a, b]) => b - a > (maxX - minX) * 0.3).length;
  const kind = cols.length === 2 && wide === 2 && multi / lines.length >= 0.3 ? 'prose2' : cols.length >= 3 ? 'table' : null;
  return kind ? { kind, seps } : null;
}

const colOf = (x, seps) => { let c = 0; while (c < seps.length && x >= seps[c]) c++; return c; };

// ---------- main ----------

export function buildPassages(ex, ident) {
  const boiler = findBoilerplate(ex.pages);
  const sectionOf = sectionResolver(ex.outline || [], ident.title);
  const labelsFromPdf = Array.isArray(ex.pageLabels) && ex.pageLabels.some((l, i) => l && l !== String(i + 1)) ? ex.pageLabels : null;

  const passages = [];
  const report = { pages: ex.pages.length, lowTextPages: [], tablePages: 0, labeledPages: 0, hasOutline: (ex.outline || []).length > 0, passages: 0 };
  let lastHeading = null;
  let lastTop = null;

  for (const p of ex.pages) {
    const label = labelsFromPdf ? labelsFromPdf[p.n - 1] : pageLabel(p);
    if (label) report.labeledPages++;
    const section = sectionOf(p.n);
    if (section[0] !== lastTop) { lastHeading = null; lastTop = section[0]; }
    // Content = non-boilerplate, non-change-bar segments.
    const lines = [];
    for (const l of p.lines) {
      const zone = l.y < p.h * TOP_ZONE || l.y > p.h * (1 - BOTTOM_ZONE);
      if (zone && boiler.lines.has(lineKey(l))) continue;
      if (zone && l.segs.length === 1 && /^(PAGE\s*(NO\.?|NUMBER)\s*:?\s*)?[A-Z]{0,3}\s*[-–]?\s*[\dIVXLC]+(\s*[-–]\s*\d+)*$/i.test(l.segs[0].s.trim())) continue;
      const segs = l.segs.filter((s) => !isChangeBar(s.s) && !(zone && boiler.segs.has(s.s.trim())));
      if (segs.length) lines.push({ ...l, segs });
    }
    const chars = lines.reduce((a, l) => a + l.segs.reduce((b, s) => b + s.s.length, 0), 0);
    if (chars < 100) report.lowTextPages.push(p.n);
    if (!lines.length) continue;

    const toc = /contents/i.test(section.join(' ')) || lines.filter((l) => /\.{6,}/.test(l.segs.map((s) => s.s).join(' '))).length > lines.length * 0.3;
    const base = { d: ident.docId, p: p.n, lb: label, sec: section };
    const extra = toc ? ['toc'] : [];
    const cols = detectColumns(lines, p.w);
    if (cols?.kind === 'table') {
      report.tablePages++;
      // single-segment heading lines (e.g. "32. Landing Gear") become context, not passages
      const body = [];
      for (const l of lines) {
        const txt = l.segs.map((s) => s.s).join(' ');
        if (l.segs.length === 1 && looksLikeHeading(txt) && l.y < p.h * 0.45) lastHeading = txt;
        else body.push(l);
      }
      for (const blk of tableBlocks(body, cols.seps)) {
        const item = blk.rows[0]?.slice(0, 2).filter(Boolean).join(' ') || null;
        pushPassage(passages, { ...base, hd: lastHeading, item, rows: blk.rows, y0: blk.y0 / p.h, y1: blk.y1 / p.h, f: ['table', ...extra] });
      }
    } else {
      let flow = lines;
      if (cols?.kind === 'prose2') {
        flow = [0, 1].flatMap((c) => lines
          .map((l) => ({ ...l, segs: l.segs.filter((s) => colOf(s.x, cols.seps) === c) }))
          .filter((l) => l.segs.length));
      }
      for (const chunk of proseChunks(flow)) {
        if (chunk.heading) lastHeading = chunk.heading;
        pushPassage(passages, { ...base, hd: chunk.heading || lastHeading, t: chunk.text, y0: chunk.y0 / p.h, y1: chunk.y1 / p.h, f: [...(chars < 100 ? ['lowtext'] : []), ...extra] });
      }
    }
  }
  passages.forEach((ps, i) => { ps.id = `${ident.docId}:${i}`; });
  report.passages = passages.length;
  report.abbreviations = mineAbbreviations(ex.pages, sectionOf);
  return { passages, report };
}

function pushPassage(list, ps) {
  if (ps.rows) ps.t = ps.rows.map((r) => r.filter(Boolean).join(' | ')).join('\n');
  ps.t = ps.t.trim();
  if (!ps.t) return;
  ps.y0 = Math.round(ps.y0 * 1000) / 1000;
  ps.y1 = Math.round(ps.y1 * 1000) / 1000;
  list.push(ps);
}

// Table: split into item blocks (start when the first column has text after a vertical gap),
// then into sub-rows, and read each column top-down inside a sub-row.
function tableBlocks(lines, seps) {
  const ncol = seps.length + 1;
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i].y - lines[i - 1].y);
  const med = median(gaps) || 12;
  const blocks = [];
  let blk = null, row = null, prevY = null;
  for (const l of lines) {
    const byCol = Array.from({ length: ncol }, () => []);
    for (const s of l.segs) byCol[colOf(s.x + 1, seps)].push(s.s);
    const gap = prevY === null ? Infinity : l.y - prevY;
    const newBlock = byCol[0].length && (gap > med * 1.3 || /^(\d{1,3}\.|\*{3}|\d{1,2}\))\s/.test(byCol[0][0]));
    if (!blk || newBlock) {
      blk = { rows: [], y0: l.y - l.h, y1: l.y };
      blocks.push(blk);
      row = null;
    }
    if (!row || (gap > med * 1.3 && !newBlock)) {
      row = Array.from({ length: ncol }, () => []);
      blk.rows.push(row);
    }
    byCol.forEach((parts, c) => row[c].push(...parts));
    blk.y1 = l.y;
    prevY = l.y;
  }
  for (const b of blocks) b.rows = b.rows.map((r) => r.map((parts) => joinWrapped(parts)));
  // Merge tiny blocks (e.g. stray column fragments) into the previous one.
  const merged = [];
  for (const b of blocks) {
    const len = b.rows.flat().join('').length;
    if (merged.length && len < 40) { const last = merged[merged.length - 1]; last.rows.push(...b.rows); last.y1 = b.y1; }
    else merged.push(b);
  }
  return merged;
}

const joinWrapped = (parts) => parts.join(' ').replace(/(\w)- (\w)/g, '$1-$2').replace(/\s+/g, ' ').trim();

function proseChunks(lines) {
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i].y - lines[i - 1].y);
  const med = median(gaps.filter((g) => g > 0)) || 12;
  const paras = [];
  let cur = null, prevY = null;
  for (const l of lines) {
    const text = l.segs.map((s) => s.s).join('   ');
    const heading = looksLikeHeading(text);
    const gap = prevY === null ? Infinity : l.y - prevY;
    if (!cur || heading || gap > med * 1.5 || gap < 0) {
      cur = { lines: [], y0: l.y - l.h, y1: l.y, heading: heading ? text : null };
      paras.push(cur);
    }
    cur.lines.push(text);
    cur.y1 = l.y;
    prevY = l.y;
  }
  const chunks = [];
  let ch = null;
  for (const para of paras) {
    const text = para.lines.join('\n');
    if (ch && (para.heading || ch.text.length + text.length > MAX_PASSAGE) && ch.text.length >= MIN_PASSAGE) ch = null;
    if (!ch) { ch = { text: '', y0: para.y0, y1: para.y1, heading: para.heading }; chunks.push(ch); }
    if (text.length > MAX_PASSAGE * 1.3) {
      // very long paragraph: split by lines
      for (const ln of para.lines) {
        if (ch.text.length + ln.length > MAX_PASSAGE) { ch = { text: '', y0: para.y0, y1: para.y1, heading: null }; chunks.push(ch); }
        ch.text += (ch.text ? '\n' : '') + ln;
      }
    } else {
      ch.text += (ch.text ? '\n\n' : '') + text;
    }
    ch.y1 = para.y1;
  }
  return chunks.filter((c) => c.text.trim());
}

// Abbreviation lists inside the documents ("APU   Auxiliary Power Unit").
export function mineAbbreviations(pages, sectionOf) {
  const pairs = {};
  for (const p of pages) {
    const sec = (sectionOf(p.n) || []).join(' ').toLowerCase();
    const pageText = p.lines.slice(0, 12).map((l) => l.segs.map((s) => s.s).join(' ')).join(' ').toLowerCase();
    if (!/abbreviation|acronym/.test(sec + ' ' + pageText)) continue;
    for (const l of p.lines) {
      const parts = l.segs.map((s) => s.s);
      for (let i = 0; i < parts.length; i++) {
        let abbr = null, def = null;
        const one = parts[i].match(/^([A-Z][A-Z0-9/&-]{1,9})\s+([A-Z][A-Za-z][A-Za-z ,/()'’-]{2,70})$/);
        if (one) { abbr = one[1]; def = one[2]; }
        else if (/^[A-Z][A-Z0-9/&-]{1,9}$/.test(parts[i]) && parts[i + 1] && /^[A-Z][a-z]/.test(parts[i + 1])) { abbr = parts[i]; def = parts[i + 1]; i++; }
        if (abbr && def && def.split(' ').length <= 8 && /[a-z]/.test(def) && def[0].toUpperCase() === abbr[0]) pairs[abbr] = def.replace(/\s+/g, ' ').trim();
      }
    }
  }
  return pairs;
}

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
