// Full-screen original-page viewer (pdf.js). Opens the authoritative PDF at the referenced page,
// marks the quoted region and the matched words. The PDF itself is never modified.
import { pdfjs, PDF_OPTS } from './importer.js';
import { getFile } from './store.js';
import { stem } from './search.js';

let current = { docId: null, pdf: null };
let state = null;
const $ = (id) => document.getElementById(id);

export async function openViewer({ doc, page, region, terms = [], labelOf }) {
  const el = $('viewer');
  el.hidden = false;
  document.body.classList.add('no-scroll');
  $('viewer-title').textContent = `${doc.shortName}${doc.revision ? ' · גרסה ' + doc.revision : ''}`;
  $('viewer-status').textContent = 'טוען מסמך…';
  try {
    if (current.docId !== doc.docId) {
      if (current.pdf) await current.pdf.destroy();
      current = { docId: null, pdf: null };
      const blob = await getFile(doc.docId);
      if (!blob) throw new Error('הקובץ המקורי לא נמצא במכשיר');
      const data = new Uint8Array(await blob.arrayBuffer());
      current.pdf = await pdfjs.getDocument({ data, isEvalSupported: false, ...PDF_OPTS }).promise;
      current.docId = doc.docId;
    }
    state = { doc, page, region, terms, labelOf, zoom: 1, firstPage: page };
    await render();
  } catch (e) {
    $('viewer-status').textContent = 'שגיאה בפתיחת המסמך: ' + e.message;
  }
}

export function closeViewer() {
  $('viewer').hidden = true;
  document.body.classList.remove('no-scroll');
  $('viewer-canvas-wrap').innerHTML = '';
}

export function initViewer() {
  $('viewer-close').onclick = closeViewer;
  $('viewer-prev').onclick = () => go(-1);
  $('viewer-next').onclick = () => go(1);
  $('viewer-zoom-in').onclick = () => { state.zoom = Math.min(3, state.zoom * 1.25); render(); };
  $('viewer-zoom-out').onclick = () => { state.zoom = Math.max(0.6, state.zoom / 1.25); render(); };
  document.addEventListener('keydown', (e) => { if (!$('viewer').hidden && e.key === 'Escape') closeViewer(); });
}

function go(d) {
  if (!state || !current.pdf) return;
  const n = state.page + d;
  if (n < 1 || n > current.pdf.numPages) return;
  state.page = n;
  render();
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const pdf = current.pdf;
  const page = await pdf.getPage(state.page);
  const wrap = $('viewer-canvas-wrap');
  const avail = Math.max(320, $('viewer-scroll').clientWidth - 24);
  const base = page.getViewport({ scale: 1 });
  const scale = (avail / base.width) * state.zoom;
  const vp = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width * dpr);
  canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = vp.width + 'px';
  canvas.style.height = vp.height + 'px';
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
  if (seq !== renderSeq) return;

  const holder = document.createElement('div');
  holder.className = 'page-holder';
  holder.style.width = vp.width + 'px';
  holder.style.height = vp.height + 'px';
  holder.appendChild(canvas);

  const onRefPage = state.page === state.firstPage;
  let regionTop = null;
  if (onRefPage && state.region) {
    const band = document.createElement('div');
    band.className = 'region-band';
    const top = Math.max(0, state.region[0] * vp.height - 6);
    band.style.top = top + 'px';
    band.style.height = Math.max(16, (state.region[1] - state.region[0]) * vp.height + 12) + 'px';
    holder.appendChild(band);
    regionTop = top;
  }
  if (state.terms.length) {
    const tc = await page.getTextContent();
    const set = new Set(state.terms);
    for (const it of tc.items) {
      if (!it.str) continue;
      const tx = pdfjs.Util.transform(vp.transform, it.transform);
      const fh = Math.hypot(tx[2], tx[3]);
      const w = it.width * scale;
      for (const m of it.str.matchAll(/[A-Za-z0-9]+(?:[-/.][A-Za-z0-9]+)*/g)) {
        const word = m[0].toLowerCase();
        if (!(set.has(word) || set.has(stem(word)))) continue;
        const hl = document.createElement('div');
        hl.className = 'term-hl';
        hl.style.left = tx[4] + (w * m.index) / it.str.length + 'px';
        hl.style.top = tx[5] - fh + 'px';
        hl.style.width = Math.max(6, (w * m[0].length) / it.str.length) + 'px';
        hl.style.height = fh * 1.15 + 'px';
        holder.appendChild(hl);
      }
    }
  }
  wrap.innerHTML = '';
  wrap.appendChild(holder);
  page.cleanup();
  const label = state.labelOf?.(state.doc.docId, state.page);
  $('viewer-status').textContent = `${label ? 'עמוד מודפס ' + label + ' · ' : ''}עמוד ${state.page} מתוך ${pdf.numPages} בקובץ${onRefPage ? '' : ' (לא העמוד שצוטט)'}`;
  $('viewer-prev').disabled = state.page <= 1;
  $('viewer-next').disabled = state.page >= pdf.numPages;
  const sc = $('viewer-scroll');
  sc.scrollTop = regionTop !== null ? Math.max(0, regionTop - 80) : 0;
}
