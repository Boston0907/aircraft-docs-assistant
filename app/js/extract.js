// PDF → page-aware lines. Runs identically in the browser (iPad) and in Node (tests).
// `pdfjs` is the pdf.js module, injected so this file has no environment-specific imports.

export async function extractPdf(pdfjs, data, { onProgress, ...docOpts } = {}) {
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0, ...docOpts });
  const doc = await task.promise;
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const pageLabels = await doc.getPageLabels().catch(() => null);
    const outline = await flattenOutline(doc).catch(() => []);
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      pages.push({ n, w: vp.width, h: vp.height, lines: buildLines(pdfjs, tc.items, vp) });
      page.cleanup();
      if (onProgress && (n % 5 === 0 || n === doc.numPages)) await onProgress(n, doc.numPages);
    }
    return {
      numPages: doc.numPages,
      info: meta?.info || {},
      pageLabels,
      outline,
      pages,
    };
  } finally {
    await doc.destroy();
  }
}

// Group text items into visual lines (top-down). Each line keeps its horizontal segments
// (runs of text separated by a wide gap) so that table columns can be recovered later.
export function buildLines(pdfjs, items, vp) {
  const glyphs = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const tx = pdfjs.Util.transform(vp.transform, it.transform);
    const h = Math.hypot(tx[2], tx[3]) || 8;
    glyphs.push({ s: it.str, x: tx[4], y: tx[5], h, w: it.width * (vp.scale || 1) });
  }
  glyphs.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const g of glyphs) {
    const row = rows.length ? rows[rows.length - 1] : null;
    if (row && Math.abs(g.y - row.y) <= Math.max(2, 0.45 * Math.min(g.h, row.h))) row.items.push(g);
    else rows.push({ y: g.y, h: g.h, items: [g] });
  }
  const out = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    const segs = [];
    let cur = null;
    for (const g of r.items) {
      const gap = cur ? g.x - (cur.x + cur.w) : 0;
      if (cur && gap < 0.8 * g.h) {
        if (gap > 0.15 * g.h && !cur.s.endsWith(' ') && !g.s.startsWith(' ')) cur.s += ' ';
        cur.s += g.s;
        cur.w = Math.max(cur.w, g.x + g.w - cur.x);
      } else {
        cur = { x: g.x, w: g.w, s: g.s };
        segs.push(cur);
      }
    }
    const clean = segs
      .map((sg) => ({ x: Math.round(sg.x), w: Math.round(sg.w), s: sg.s.replace(/\s+/g, ' ').trim() }))
      .filter((sg) => sg.s);
    if (clean.length) out.push({ y: Math.round(r.y), h: Math.round(r.h * 10) / 10, segs: clean });
  }
  return out;
}

async function flattenOutline(doc) {
  const out = [];
  const root = await doc.getOutline();
  if (!root) return out;
  async function walk(nodes, depth) {
    for (const n of nodes) {
      let page = null;
      try {
        let dest = n.dest;
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) {
          page = typeof dest[0] === 'number' ? dest[0] + 1 : (await doc.getPageIndex(dest[0])) + 1;
        }
      } catch { /* unresolved destination: keep title without page */ }
      if (page && n.title && n.title.trim()) out.push({ title: n.title.trim(), page, depth });
      if (n.items?.length) await walk(n.items, depth + 1);
    }
  }
  await walk(root, 0);
  return out;
}
