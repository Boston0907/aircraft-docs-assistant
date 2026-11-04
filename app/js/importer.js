// On-device import: PDF from the Files app → hash → text extraction → passages → atomic store.
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';
import { extractPdf } from './extract.js';
import { identifyDocument, buildPassages } from './passages.js';
import { putDocument, sha256Hex } from './store.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
export const PDF_OPTS = {
  cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
  cMapPacked: true,
  standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
};
export { pdfjs };

export const PIPELINE_VERSION = 'p1';

// Returns { status: 'imported'|'duplicate'|'cancelled', doc }
export async function importPdf(file, existingDocs, { onProgress, confirm }) {
  onProgress?.({ stage: 'hash', file: file.name });
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const dup = existingDocs.find((d) => d.sha256 === sha256);
  if (dup) return { status: 'duplicate', doc: dup };

  const ex = await extractPdf(pdfjs, new Uint8Array(buf.slice(0)), {
    ...PDF_OPTS,
    onProgress: (n, total) => onProgress?.({ stage: 'extract', file: file.name, n, total }),
  });
  const first = ex.pages.slice(0, 5).map((p) => p.lines.map((l) => l.segs.map((s) => s.s).join(' ')).join('\n')).join('\n');
  const ident = identifyDocument(file.name, ex.info, first);

  // Revision control: never silently mix revisions of the same document.
  const sameDoc = existingDocs.filter((d) => d.shortName === ident.shortName);
  let replaceIds = [];
  if (sameDoc.length) {
    const ok = await confirm({ kind: 'replace', ident, old: sameDoc });
    if (!ok) return { status: 'cancelled' };
    replaceIds = sameDoc.map((d) => d.docId);
  }
  if (!ident.revisionConsistent) {
    const ok = await confirm({ kind: 'revMismatch', ident });
    if (!ok) return { status: 'cancelled' };
  }
  onProgress?.({ stage: 'index', file: file.name });
  const { passages, report } = buildPassages(ex, ident);
  const doc = {
    ...ident,
    filename: file.name,
    size: file.size,
    sha256,
    numPages: ex.numPages,
    importedAt: new Date().toISOString(),
    pipeline: PIPELINE_VERSION,
    passageCount: passages.length,
    abbreviations: report.abbreviations,
    report: { ...report, abbreviations: Object.keys(report.abbreviations).length },
  };
  onProgress?.({ stage: 'save', file: file.name });
  await putDocument(doc, new Blob([buf], { type: 'application/pdf' }), passages, replaceIds);
  return { status: 'imported', doc, replaced: sameDoc };
}
