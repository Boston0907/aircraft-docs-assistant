import { SearchIndex, highlightChunks } from './search.js';
import { getAllDocs, getAllPassages, getFile, deleteDocument, sha256Hex, storageInfo, requestPersistence } from './store.js';
import { importPdf, PIPELINE_VERSION } from './importer.js';
import { openViewer, initViewer } from './viewer.js';

export const APP_VERSION = '0.1.0';
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
  return n;
};

const S = { docs: [], index: null, labels: new Map(), scope: 'ALL', integrity: [] };
const AIRCRAFT_LABEL = { ALL: 'כל המסמכים', G550: 'G550', GV: 'GV' };

// ---------- load ----------

async function loadAll() {
  const t0 = performance.now();
  const [docs, rows] = await Promise.all([getAllDocs(), getAllPassages()]);
  const byDoc = new Map(rows.map((r) => [r.docId, r.list]));
  S.integrity = [];
  const passages = [];
  for (const d of docs) {
    const list = byDoc.get(d.docId);
    if (!list) { S.integrity.push(`למסמך ${d.shortName} אין אינדקס חיפוש — יש לייבא אותו מחדש.`); continue; }
    if (list.length !== d.passageCount) S.integrity.push(`אי-התאמה במספר הקטעים במסמך ${d.shortName}.`);
    passages.push(...list);
  }
  for (const id of byDoc.keys()) if (!docs.some((d) => d.docId === id)) S.integrity.push(`נמצא אינדקס ללא מסמך (${id}).`);
  S.docs = docs.sort((a, b) => a.shortName.localeCompare(b.shortName));
  S.index = new SearchIndex(docs, passages);
  S.labels = new Map();
  for (const p of passages) S.labels.set(p.d + ':' + p.p, p.lb);
  S.loadMs = Math.round(performance.now() - t0);
  renderScope();
  $('sub').textContent = docs.length
    ? `${docs.length} מסמכים מותקנים · פועל ללא אינטרנט`
    : 'לא הותקנו מסמכים · פועל ללא אינטרנט';
}
const labelOf = (docId, page) => S.labels.get(docId + ':' + page) || null;

function renderScope() {
  const nav = $('scope');
  const kinds = new Set(S.docs.map((d) => d.aircraft).filter((a) => a !== 'ALL'));
  if (kinds.size < 2) { nav.hidden = true; S.scope = 'ALL'; return; }
  try { S.scope = localStorage.getItem('scope') || 'ALL'; } catch { /* storage unavailable */ }
  nav.hidden = false;
  nav.replaceChildren(...['ALL', ...[...kinds].sort()].map((k) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(S.scope === k),
    onclick: () => { S.scope = k; try { localStorage.setItem('scope', k); } catch { /* ignore */ } renderScope(); },
  }, k === 'ALL' ? AIRCRAFT_LABEL.ALL : 'רק ' + k + ' (+ מסמכים משותפים)')));
}

// ---------- chat ----------

function scrollChat() { const c = $('chat'); requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; }); }

function welcome() {
  const examples = ['איפה מוצאים מידע על משאבת דלק?', 'APU generator inoperative', 'שסתום פליטה', 'מה זה ADLS?'];
  const body = el('div', { class: 'bubble welcome' },
    el('h2', {}, 'שלום! אפשר לשאול כאן שאלות על תיעוד המטוס.'),
    el('p', { class: 'summary' }, 'התשובות הן ציטוטים מדויקים מהמסמכים המותקנים, עם שם המסמך, הגרסה, הפרק והעמוד, וכפתור לפתיחת העמוד המקורי. אם המידע לא נמצא — המערכת תגיד זאת במפורש.'),
    el('p', { class: 'small muted' }, 'לעיון בלבד. המערכת אינה מחליפה את המסמכים המאושרים, אינה מאבחנת תקלות ואינה ממליצה על פעולות.'),
    S.docs.length
      ? el('div', { class: 'examples' }, examples.map((q) => el('button', { class: 'chip', type: 'button', onclick: () => ask(q) }, q)))
      : el('div', {}, el('p', { class: 'warn' }, 'עדיין לא הותקנו מסמכים.'), el('button', { class: 'btn primary', type: 'button', onclick: openDocs }, 'הוספת מסמכים')),
  );
  $('chat').append(el('div', { class: 'msg bot' }, body));
  if (S.integrity.length) $('chat').append(el('div', { class: 'msg bot' }, el('div', { class: 'bubble' }, el('div', { class: 'status partial' }, '⚠ בעיית תקינות'), el('ul', {}, S.integrity.map((t) => el('li', {}, t))))));
}

function ask(q) {
  q = q.trim();
  if (!q) return;
  $('chat').append(el('div', { class: 'msg user' }, el('div', { class: 'bubble', dir: 'auto' }, q)));
  if (!S.docs.length) {
    botMessage(el('div', { class: 'status none' }, '✕ אין מסמכים מותקנים'), el('p', {}, 'כדי לחפש יש להוסיף קודם את קובצי ה-PDF דרך "📚 מסמכים".'));
    return;
  }
  const t0 = performance.now();
  const r = S.index.search(q, { aircraft: S.scope, limit: 20 });
  r.ms = Math.round(performance.now() - t0);
  renderAnswer(r);
}

function botMessage(...kids) {
  const m = el('div', { class: 'msg bot' }, el('div', { class: 'bubble' }, ...kids));
  $('chat').append(m);
  scrollChat();
  return m;
}

const docOf = (id) => S.index.docs.get(id);
const sectionText = (p) => {
  const parts = [...(p.sec || []).slice(-2)];
  if (p.hd && !parts.some((s) => s.toLowerCase().includes(p.hd.toLowerCase().slice(0, 12)))) parts.push(p.hd);
  return parts.join(' › ');
};
const shorten = (t, n) => (t && t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t || null);
const pageRef = (p) => (p.lb ? `עמ' ${p.lb} · ` : '') + `עמוד ${p.p} בקובץ`;

function renderAnswer(r) {
  const kids = [];
  const STATUS = {
    found: ['found', '✓ נמצא בתיעוד'],
    partial: ['partial', '⚠ לא ניתן לקבוע בוודאות מהתיעוד'],
    notFound: ['none', '✕ לא נמצא בתיעוד המותקן'],
    unrecognized: ['none', '✕ לא זוהו מונחים לחיפוש'],
    empty: ['none', '✕ לא זוהו מונחים לחיפוש'],
  };
  const [cls, label] = STATUS[r.status];
  kids.push(el('div', { class: 'status ' + cls }, label));
  kids.push(el('div', { class: 'sys-label' }, 'סיכום המערכת (נוסח אוטומטי — אינו ציטוט):'));
  kids.push(summary(r));
  kids.push(searchedLine(r));
  if (r.fault && r.results.length) kids.push(el('div', { class: 'safety' }, 'המערכת מציגה קטעים מהתיעוד בלבד. היא אינה מאבחנת תקלות ואינה ממליצה על פעולה — יש לפעול לפי המסמכים המאושרים ונהלי היחידה.'));

  const list = el('div', {});
  const SHOW = 5;
  r.results.slice(0, SHOW).forEach((x) => list.append(card(x)));
  kids.push(list);
  if (r.results.length > SHOW) {
    const more = el('button', { class: 'btn link more', type: 'button' }, `הצג עוד ${r.results.length - SHOW} תוצאות`);
    more.onclick = () => { r.results.slice(SHOW).forEach((x) => list.append(card(x))); more.remove(); };
    kids.push(more);
  }
  botMessage(...kids);
}

function summary(r) {
  const installed = S.docs.map((d) => d.shortName).join(', ');
  const box = el('div', { class: 'summary' });
  if (r.status === 'found' || r.status === 'partial') {
    const seen = new Set();
    const top = [];
    for (const x of r.results) {
      const p = x.passage;
      const key = p.d + '|' + sectionText(p) + '|' + (p.item || '');
      if (seen.has(key) || (x.passage.f?.includes('toc') && r.results.length > 1)) continue;
      seen.add(key);
      top.push(x);
      if (top.length >= 3) break;
    }
    const docs = new Set(r.results.map((x) => x.passage.d));
    if (r.status === 'found') box.append(`נמצאו ${r.results.length >= 20 ? 'יותר מ-20' : r.results.length} קטעים רלוונטיים ב-${docs.size === 1 ? 'מסמך אחד' : docs.size + ' מסמכים'}. המקומות העיקריים:`);
    else {
      const miss = r.searched.filter((s) => !s.found).map((s) => s.label);
      box.append(miss.length
        ? `לא נמצאה התאמה לכל חלקי השאלה — "${miss.join('", "')}" לא נמצא/ו בתיעוד המותקן. מוצגות התאמות חלקיות בלבד, וייתכן שהן אינן עונות על השאלה:`
        : 'לא נמצא קטע אחד שמכסה את כל חלקי השאלה. מוצגות התאמות חלקיות בלבד, וייתכן שהן אינן עונות על השאלה:');
    }
    box.append(el('ul', {}, top.map((x) => {
      const p = x.passage; const d = docOf(p.d);
      const where = [(p.sec || []).slice(-1)[0], shorten(p.item, 70)].filter(Boolean).join(' · ') || shorten(p.hd, 70) || '';
      return el('li', {}, el('strong', {}, d.shortName), ' — ', el('span', { class: 'pref' }, pageRef(p)),
        where ? el('div', { class: 'where', dir: 'ltr' }, where) : null);
    })));
    return box;
  }
  if (r.status === 'notFound') {
    box.append(`לא נמצא מידע על כך בתיעוד המותקן (${installed}). ייתכן שהנושא מופיע במסמך שאינו מותקן או בניסוח אחר. אפשר לנסות מונח טכני באנגלית, כפי שהוא כתוב בספר.`);
  } else {
    box.append('לא זיהיתי בשאלה מונח טכני שאפשר לחפש. ');
    if (r.unknownHe.length) box.append(`המילים "${r.unknownHe.join('", "')}" אינן במילון העברי-אנגלי של המערכת. `);
    box.append('נסה לכתוב את המונח באנגלית, למשל: fuel pump, APU, outflow valve.');
  }
  return box;
}

function searchedLine(r) {
  const line = el('div', { class: 'searched' });
  if (!r.searched?.length && !r.unknownHe.length) return line;
  if (r.searched?.length) {
    line.append('חיפשתי: ');
    r.searched.forEach((s, i) => {
      if (i) line.append(' ; ');
      const terms = s.terms.slice(0, 4).join(' / ');
      const txt = s.src === 'he' ? `${s.label} ← ${terms}` : terms;
      line.append(el('span', { class: 'term' + (s.found ? '' : ' miss'), dir: 'auto' }, txt));
    });
  }
  if (r.unknownHe.length && r.searched?.length) line.append(el('div', {}, `מילים שלא זוהו: ${r.unknownHe.join(', ')}`));
  if (r.docIds?.size) line.append(el('div', {}, `החיפוש הוגבל ל: ${[...r.docIds].map((id) => docOf(id)?.shortName).join(', ')}`));
  const hint = r.aircraftHint?.size === 1 ? [...r.aircraftHint][0] : (S.scope !== 'ALL' ? S.scope : null);
  if (hint) line.append(el('div', {}, `דגם: ${hint} (כולל מסמכים משותפים לשני הדגמים)`));
  line.append(el('div', { class: 'small' }, `זמן חיפוש: ${r.ms} מ"ש`));
  return line;
}

function highlighted(text, terms) {
  return highlightChunks(text, terms).map((c) => (c.hit ? el('mark', {}, c.s) : c.s));
}

function card(x) {
  const p = x.passage;
  const d = docOf(p.d);
  const head = el('div', { class: 'card-head' },
    el('span', { class: 'doc-badge' }, d.shortName),
    el('span', { class: 'rev' }, d.revision ? `גרסה ${d.revision}` : 'גרסה לא ידועה'),
    el('span', { class: 'page-ref' }, pageRef(p)),
    el('div', { class: 'section', dir: 'auto' }, [sectionText(p)].filter(Boolean).join('') || '—'),
  );
  const quote = el('div', { class: 'quote', dir: 'ltr', lang: 'en' });
  if (p.rows) {
    for (const row of p.rows) {
      const r = el('div', { class: 'trow' });
      row.forEach((cell) => { if (cell) r.append(el('div', { class: 'cell' + (cell.length <= 6 ? ' short' : '') }, ...highlighted(cell, x.terms))); });
      quote.append(r);
    }
  } else quote.append(...highlighted(p.t, x.terms));
  const long = p.t.length > 650 || (p.rows && p.rows.length > 3);
  if (long) quote.classList.add('collapsed');
  const flags = [];
  if (p.f?.includes('table')) flags.push('קטע מטבלה: העמודות שוחזרו אוטומטית מהעמוד. יש לוודא את השיוך בין העמודות מול העמוד המקורי.');
  if (p.f?.includes('lowtext')) flags.push('בעמוד זה מעט טקסט (ייתכן איור או תרשים) — המידע המלא נמצא רק בעמוד המקורי.');
  if (p.f?.includes('toc')) flags.push('זהו עמוד תוכן עניינים — הוא מפנה למקום אחר במסמך.');
  const foot = el('div', { class: 'card-foot' },
    el('button', { class: 'btn primary', type: 'button', onclick: () => openViewer({ doc: d, page: p.p, region: [p.y0, p.y1], terms: x.terms, labelOf }) }, 'פתח את העמוד המקורי'),
  );
  if (long) {
    const b = el('button', { class: 'btn link', type: 'button' }, 'הצג את כל הקטע');
    b.onclick = () => { quote.classList.toggle('collapsed'); b.textContent = quote.classList.contains('collapsed') ? 'הצג את כל הקטע' : 'הצג פחות'; };
    foot.append(b);
  }
  return el('article', { class: 'card' }, head, el('div', { class: 'quote-label' }, 'ציטוט מהמסמך המקורי:'), quote, flags.map((f) => el('div', { class: 'flag' }, '⚠ ' + f)), foot);
}

// ---------- documents panel ----------

function openDocs() { $('docs').hidden = false; renderDocs(); }
function closeDocs() { $('docs').hidden = true; }
const fmtMB = (n) => (n / 1048576).toFixed(1) + ' MB';

async function renderDocs(verify = null) {
  const list = $('doc-list');
  list.replaceChildren();
  if (!S.docs.length) list.append(el('p', { class: 'muted' }, 'אין מסמכים מותקנים. העבר את קובצי ה-PDF לאייפד (USB-C → אפליקציית "קבצים") ולחץ "הוספה / עדכון מסמכים".'));
  for (const d of S.docs) {
    const v = verify?.[d.docId];
    const rep = d.report || {};
    list.append(el('div', { class: 'doc-row' },
      el('h3', {}, d.shortName, ' ', el('span', { class: 'rev' }, d.revision ? `גרסה ${d.revision}` : 'גרסה לא זוהתה')),
      el('div', { class: 'small muted', dir: 'auto' }, d.title),
      el('dl', {},
        el('dt', {}, 'קובץ'), el('dd', { dir: 'ltr', style: 'text-align:right' }, d.filename),
        el('dt', {}, 'עמודים / קטעים'), el('dd', {}, `${d.numPages} / ${d.passageCount}`),
        el('dt', {}, 'גודל'), el('dd', {}, fmtMB(d.size)),
        el('dt', {}, 'בדיקת גרסה'), el('dd', { class: d.revisionConsistent ? 'ok' : 'warn' },
          d.revisionConsistent ? 'שם הקובץ ותוכן המסמך תואמים' : `אי-התאמה: שם קובץ ${d.revisionSources?.filename ?? '—'}, כותרת ${d.revisionSources?.title ?? '—'}, טקסט ${d.revisionSources?.text ?? '—'}`),
        el('dt', {}, 'מספרי עמוד מודפסים'), el('dd', {}, `${rep.labeledPages ?? '?'} מתוך ${d.numPages} עמודים`),
        el('dt', {}, 'עמודים לבדיקה ידנית'), el('dd', { class: rep.lowTextPages?.length ? 'warn' : '' },
          rep.lowTextPages?.length ? `${rep.lowTextPages.length} עמודים עם מעט טקסט (איורים/ריקים/סרוקים): ${rep.lowTextPages.slice(0, 20).join(', ')}${rep.lowTextPages.length > 20 ? '…' : ''}` : 'אין'),
        el('dt', {}, 'טבלאות'), el('dd', {}, `${rep.tablePages ?? 0} עמודי טבלה`),
        el('dt', {}, 'יובא'), el('dd', {}, new Date(d.importedAt).toLocaleString('he-IL')),
        el('dt', {}, 'SHA-256'), el('dd', {}, el('code', {}, d.sha256.slice(0, 16) + '…')),
        v ? el('dt', {}, 'תקינות') : null,
        v ? el('dd', { class: v.ok ? 'ok' : 'bad' }, v.msg) : null,
      ),
      el('div', { class: 'sheet-actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => { closeDocs(); openViewer({ doc: d, page: 1, labelOf }); } }, 'פתח מסמך'),
        el('button', { class: 'btn', type: 'button', onclick: () => removeDoc(d) }, 'הסר'),
      ),
    ));
  }
  const st = await storageInfo();
  $('storage').textContent = `גרסת אפליקציה ${APP_VERSION} · עיבוד ${PIPELINE_VERSION}` +
    (st.usage != null ? ` · נפח בשימוש ${fmtMB(st.usage)}${st.quota ? ' מתוך ' + fmtMB(st.quota) : ''}` : '') +
    (st.persisted === true ? ' · אחסון קבוע ✓' : st.persisted === false ? ' · האחסון אינו מסומן כקבוע (פתח את האפליקציה ממסך הבית)' : '') +
    ` · טעינת אינדקס ${S.loadMs ?? '?'} מ"ש`;
}

async function removeDoc(d) {
  const ok = await confirmDialog('הסרת מסמך', [`להסיר את ${d.shortName} (גרסה ${d.revision ?? '?'}) מהמכשיר?`, 'הקובץ והאינדקס שלו יימחקו מהאפליקציה. הקובץ המקורי באפליקציית "קבצים" לא יושפע.']);
  if (!ok) return;
  await deleteDocument(d.docId);
  await loadAll();
  renderDocs();
}

async function verifyAll() {
  const res = {};
  const prog = $('import-progress');
  prog.hidden = false;
  const rows = await getAllPassages();
  for (const d of S.docs) {
    prog.textContent = `בודק את ${d.shortName}…`;
    const blob = await getFile(d.docId);
    if (!blob) { res[d.docId] = { ok: false, msg: 'הקובץ המקורי חסר' }; continue; }
    const hash = await sha256Hex(await blob.arrayBuffer());
    const pl = rows.find((r) => r.docId === d.docId)?.list;
    const problems = [];
    if (hash !== d.sha256) problems.push('טביעת האצבע (SHA-256) של הקובץ אינה תואמת');
    if (blob.size !== d.size) problems.push('גודל הקובץ שונה');
    if (!pl || pl.length !== d.passageCount) problems.push('האינדקס אינו תואם');
    if (pl && pl.some((p) => p.p < 1 || p.p > d.numPages)) problems.push('הפניות לעמודים שאינם קיימים');
    res[d.docId] = problems.length ? { ok: false, msg: '✕ ' + problems.join('; ') } : { ok: true, msg: '✓ הקובץ והאינדקס תקינים ותואמים' };
  }
  prog.textContent = Object.values(res).every((r) => r.ok) ? `✓ כל ${S.docs.length} המסמכים תקינים.` : '⚠ נמצאו בעיות — ראה פירוט למטה. מומלץ לייבא מחדש את המסמך הבעייתי.';
  renderDocs(res);
}

function exportManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    app: APP_VERSION,
    pipeline: PIPELINE_VERSION,
    documents: S.docs.map((d) => ({ shortName: d.shortName, title: d.title, revision: d.revision, aircraft: d.aircraft, filename: d.filename, size: d.size, sha256: d.sha256, pages: d.numPages, passages: d.passageCount, importedAt: d.importedAt })),
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `manifest-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
}

async function onFiles(files) {
  const prog = $('import-progress');
  prog.hidden = false;
  await requestPersistence();
  const log = [];
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { log.push(`✕ ${f.name}: אינו קובץ PDF`); continue; }
    try {
      const r = await importPdf(f, S.docs, {
        onProgress: (s) => {
          const t = { hash: 'מחשב טביעת אצבע', extract: `מחלץ טקסט — עמוד ${s.n} מתוך ${s.total}`, index: 'בונה אינדקס', save: 'שומר במכשיר' }[s.stage];
          prog.textContent = [...log, `⏳ ${f.name}: ${t}…`].join('\n');
        },
        confirm: ({ kind, ident, old }) => kind === 'replace'
          ? confirmDialog('עדכון גרסה', [
            `${ident.shortName} כבר מותקן (גרסה ${old.map((o) => o.revision ?? '?').join(', ')}).`,
            `להחליף אותו בגרסה ${ident.revision ?? '?'} מהקובץ "${f.name}"?`,
            'הגרסה הקודמת והאינדקס שלה יוסרו, כדי שלא יתערבבו גרסאות.'])
          : confirmDialog('אי-התאמה בגרסה', [
            `מספר הגרסה בשם הקובץ אינו תואם למה שכתוב בתוך המסמך: שם קובץ ${ident.revisionSources.filename ?? '—'}, כותרת ${ident.revisionSources.title ?? '—'}, טקסט ${ident.revisionSources.text ?? '—'}.`,
            'לייבא בכל זאת? הגרסה שתוצג: ' + (ident.revision ?? 'לא ידועה')]),
      });
      if (r.status === 'duplicate') log.push(`= ${f.name}: כבר מותקן (${r.doc.shortName}, גרסה ${r.doc.revision ?? '?'})`);
      else if (r.status === 'cancelled') log.push(`– ${f.name}: בוטל`);
      else log.push(`✓ ${f.name}: יובא — ${r.doc.numPages} עמודים, ${r.doc.passageCount} קטעים`);
      S.docs = await getAllDocs();
    } catch (e) {
      console.error(e);
      log.push(`✕ ${f.name}: שגיאה — ${e.message}`);
    }
    prog.textContent = log.join('\n');
  }
  await loadAll();
  renderDocs();
}

function confirmDialog(title, lines) {
  return new Promise((resolve) => {
    $('confirm-title').textContent = title;
    $('confirm-body').replaceChildren(...lines.map((l) => el('p', { dir: 'auto' }, l)));
    $('confirm').hidden = false;
    const done = (v) => { $('confirm').hidden = true; resolve(v); };
    $('confirm-yes').onclick = () => done(true);
    $('confirm-no').onclick = () => done(false);
  });
}

// ---------- boot ----------

async function main() {
  initViewer();
  $('docs-btn').onclick = openDocs;
  $('docs-close').onclick = closeDocs;
  $('file').onchange = (e) => { const fs = [...e.target.files]; e.target.value = ''; onFiles(fs); };
  $('verify-btn').onclick = verifyAll;
  $('export-btn').onclick = exportManifest;
  const q = $('q');
  $('composer').onsubmit = (e) => { e.preventDefault(); const v = q.value; q.value = ''; autosize(); ask(v); };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });
  const autosize = () => { q.style.height = 'auto'; q.style.height = Math.min(160, q.scrollHeight) + 'px'; };
  q.addEventListener('input', autosize);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  try {
    await loadAll();
  } catch (e) {
    $('chat').append(el('div', { class: 'msg bot' }, el('div', { class: 'bubble' }, el('div', { class: 'status none' }, 'שגיאה בטעינת המסמכים'), el('p', {}, String(e.message || e)))));
    return;
  }
  welcome();
  window.__app = { S, ask }; // test hook
}
main();
