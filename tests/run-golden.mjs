// Golden question set. Usage: node tests/run-golden.mjs [tests/out/index.json]
import fs from 'node:fs';
import { SearchIndex } from '../app/js/search.js';
const { docs, passages } = JSON.parse(fs.readFileSync(process.argv[2] || 'tests/out/index.json'));
docs.forEach((d) => { d.abbreviations = d.report.abbreviations; });
const idx = new SearchIndex(docs, passages);
const cases = JSON.parse(fs.readFileSync(new URL('./golden.json', import.meta.url)));
const shortOf = (id) => docs.find((d) => d.docId === id).shortName;
const match = (r, e) => (!e.doc || shortOf(r.passage.d) === e.doc) && (!e.page || r.passage.p === e.page) &&
  (!e.label || new RegExp(e.label).test(r.passage.lb || '')) && (!e.text || new RegExp(e.text, 'i').test(r.passage.t.replace(/\s+/g, ' ')));
let pass = 0; const times = [];
for (const c of cases) {
  const t0 = performance.now();
  const r = idx.search(c.q);
  times.push(performance.now() - t0);
  const why = [];
  if (r.status !== c.status) why.push(`status ${r.status} ≠ ${c.status}`);
  if (c.top1 && !(r.results[0] && match(r.results[0], c.top1))) why.push('top1 mismatch');
  if (c.top3 && !r.results.slice(0, 3).some((x) => match(x, c.top3))) why.push('top3 mismatch');
  if (c.docs) for (const d of c.docs) if (!r.results.slice(0, 5).some((x) => shortOf(x.passage.d) === d)) why.push(`no ${d} in top5`);
  if (c.onlyDoc && r.results.some((x) => shortOf(x.passage.d) !== c.onlyDoc)) why.push('doc filter leaked');
  if (c.minResults && r.results.length < c.minResults) why.push('too few results');
  const ok = !why.length; if (ok) pass++;
  const top = r.results[0] ? `${shortOf(r.results[0].passage.d)} p${r.results[0].passage.p} (${r.results[0].passage.lb})` : '—';
  console.log(`${ok ? '✓' : '✕'} [${c.cat}] ${c.q} → ${r.status} · ${top}${why.length ? '   ← ' + why.join('; ') : ''}`);
}
times.sort((a, b) => a - b);
console.log(`\n${pass}/${cases.length} passed · search time median ${times[times.length >> 1].toFixed(1)} ms, max ${times[times.length - 1].toFixed(1)} ms (desktop)`);
process.exit(pass === cases.length ? 0 : 1);
