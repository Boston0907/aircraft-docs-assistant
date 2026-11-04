import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdf } from '../app/js/extract.js';
const f = process.argv[2];
const t0 = Date.now();
const r = await extractPdf(pdfjs, new Uint8Array(fs.readFileSync(f)));
console.error(f, 'pages', r.numPages, 'ms', Date.now() - t0, 'outline', r.outline.length, 'labels', r.pageLabels ? r.pageLabels.slice(0, 5) : null, 'info', JSON.stringify(r.info).slice(0, 200));
fs.writeFileSync(process.argv[3], JSON.stringify(r));
