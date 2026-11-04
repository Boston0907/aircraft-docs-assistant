// Independent check of EVERY indexed passage against poppler's pdftotext (a different PDF engine):
//  - page number exists in the PDF
//  - printed page label actually appears on that page
//  - the passage's words are found on that page (≥ 97% of tokens)
// Usage: node tests/validate-sources.mjs tests/out/index.json sources/original
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const [idxFile = 'tests/out/index.json', srcDir = 'sources/original'] = process.argv.slice(2);
const { docs, passages } = JSON.parse(fs.readFileSync(idxFile));
const tok = (s) => (s.toLowerCase().normalize('NFKC').replace(/[‐-―−]/g, '-').match(/[a-z0-9]+/g) || []);
let fail = 0, checked = 0, weakest = [];
for (const d of docs) {
  const file = path.join(srcDir, d.filename);
  const pages = execFileSync('pdftotext', ['-layout', file, '-'], { maxBuffer: 1 << 28 }).toString().split('\f');
  if (pages.length - 1 !== d.numPages && pages.length !== d.numPages) { console.log(`✕ ${d.docId}: page count ${d.numPages} vs poppler ${pages.length - 1}`); fail++; }
  const pageTok = pages.map((t) => new Set(tok(t)));
  const pageFlat = pages.map((t) => t.replace(/\s+/g, '').toLowerCase());
  for (const p of passages.filter((x) => x.d === d.docId)) {
    checked++;
    if (p.p < 1 || p.p > d.numPages) { console.log(`✕ ${p.id}: page ${p.p} out of range`); fail++; continue; }
    const set = pageTok[p.p - 1];
    const words = tok(p.t);
    const hit = words.filter((w) => set.has(w)).length / Math.max(1, words.length);
    if (hit < 0.97) { console.log(`✕ ${p.id} p${p.p}: only ${(hit * 100).toFixed(1)}% of words found on page`); fail++; }
    weakest.push([hit, p.id]);
    if (p.lb) {
      const lab = p.lb.replace(/\s+/g, '').toLowerCase().replace(/^(.*?):(\d+)$/, '$1');
      if (!pageFlat[p.p - 1].includes(lab)) { console.log(`✕ ${p.id} p${p.p}: label "${p.lb}" not on page`); fail++; }
    }
  }
}
weakest.sort((a, b) => a[0] - b[0]);
console.log(`checked ${checked} passages in ${docs.length} documents; failures: ${fail}; lowest word match: ${(weakest[0][0] * 100).toFixed(1)}% (${weakest[0][1]})`);
process.exit(fail ? 1 : 0);
