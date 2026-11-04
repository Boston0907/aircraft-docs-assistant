import fs from 'node:fs';
import { SearchIndex } from '../app/js/search.js';
const { docs, passages } = JSON.parse(fs.readFileSync('tests/out/index.json'));
docs.forEach((d) => { d.abbreviations = d.report.abbreviations; });
const t0 = performance.now();
const idx = new SearchIndex(docs, passages);
console.log('index build ms', Math.round(performance.now() - t0), 'terms', idx.post.size);
for (const q of process.argv.slice(2)) {
  const t1 = performance.now();
  const r = idx.search(q);
  console.log(`\n### ${q}  → ${r.status} (${Math.round(performance.now() - t1)}ms) unknownHe=${r.unknownHe} fault=${r.fault}`);
  console.log('   searched:', r.searched.map((s) => `${s.label}[${s.terms.join('/')}]${s.found ? '' : '✗'}`).join(' ; '));
  for (const x of r.results.slice(0, 4)) console.log(`   ${x.score.toFixed(2)} cov=${x.coverage.toFixed(2)} ${x.passage.d} p${x.passage.p} (${x.passage.lb}) ${(x.passage.sec || []).slice(-1)} | ${x.passage.t.replace(/\s+/g, ' ').slice(0, 110)}`);
}
