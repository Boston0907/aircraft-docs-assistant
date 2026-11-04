// Desktop harness: runs the exact same extraction + passage code the iPad app runs.
// Usage: node tools/build-index.mjs <pdf>... --out tests/out/index.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdf } from '../app/js/extract.js';
import { identifyDocument, buildPassages } from '../app/js/passages.js';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : 'tests/out/index.json';
const docs = [], passages = [];
for (const f of args) {
  const buf = fs.readFileSync(f);
  const t0 = Date.now();
  const ex = await extractPdf(pdfjs, new Uint8Array(buf));
  const t1 = Date.now();
  const first = ex.pages.slice(0, 5).map((p) => p.lines.map((l) => l.segs.map((s) => s.s).join(' ')).join('\n')).join('\n');
  const ident = identifyDocument(path.basename(f), ex.info, first);
  const { passages: ps, report } = buildPassages(ex, ident);
  const t2 = Date.now();
  docs.push({ ...ident, filename: path.basename(f), size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), numPages: ex.numPages, report, timings: { extractMs: t1 - t0, passagesMs: t2 - t1 } });
  passages.push(...ps);
  const { abbreviations, ...rep } = report;
  console.log(ident.docId, ident.revision, ident.revisionSources, JSON.stringify(rep), 'abbr:', Object.keys(abbreviations).length, `extract ${t1 - t0}ms passages ${t2 - t1}ms`);
}
fs.writeFileSync(out, JSON.stringify({ docs, passages }));
console.log('passages', passages.length, 'bytes', fs.statSync(out).size);
