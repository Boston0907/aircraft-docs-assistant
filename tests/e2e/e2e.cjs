// End-to-end browser test: import → ask → view → offline reload → persistence.
// Run: node tests/e2e/e2e.cjs   (serves app/ on localhost:8765)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.APP_ROOT || path.join(__dirname, '../../app');
const OUT = path.join(__dirname, '../out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8765);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true, locale: 'he-IL' });
  const page = await ctx.newPage();
  const external = [], errors = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:8765') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const step = (s) => console.log('▶', s);

  await page.goto('http://localhost:8765/');
  await page.waitForSelector('.welcome');
  await page.screenshot({ path: `${OUT}/01-empty.png` });

  step('import 2 PDFs');
  await page.click('#docs-btn');
  const t0 = Date.now();
  await page.setInputFiles('#file', ['sources/original/MMEL REV 11.pdf', 'sources/original/MOPP REV 11.pdf'].map((f) => path.join(__dirname, '../..', f)));
  await page.waitForFunction(() => /MOPP REV 11\.pdf: (יובא|שגיאה)/.test(document.getElementById('import-progress').textContent), null, { timeout: 180000 });
  console.log('  import ms', Date.now() - t0);
  console.log('  ' + (await page.textContent('#import-progress')).replace(/\n/g, '\n  '));
  await page.screenshot({ path: `${OUT}/02-docs.png`, fullPage: false });

  step('integrity check');
  await page.click('#verify-btn');
  await page.waitForFunction(() => /תקינים|בעיות/.test(document.getElementById('import-progress').textContent), null, { timeout: 60000 });
  console.log('  ' + await page.textContent('#import-progress'));
  await page.click('#docs-close');

  const ask = async (q, shot) => {
    await page.fill('#q', q);
    await page.press('#q', 'Enter');
    await page.waitForTimeout(300);
    const last = page.locator('.msg.bot').last();
    const status = await last.locator('.status').textContent();
    const refs = await last.locator('.card-head').evaluateAll((els) => els.slice(0, 3).map((e) => e.innerText.replace(/\s+/g, ' ')));
    console.log(`  Q: ${q}\n    → ${status} | ${refs.join(' || ')}`);
    if (shot) await last.screenshot({ path: `${OUT}/${shot}.png` });
  };
  step('questions');
  await ask('איפה מוצאים מידע על משאבת דלק?', '03-answer-he');
  await ask('APU generator inoperative', '04-answer-en');
  await ask('מה עושים אם מסכת חמצן לא עובדת', '05-answer-fault');
  await ask('how to make pizza', '06-notfound');
  await ask('מה המהירות המקסימלית עם גלגלים למטה', '07-partial');
  await ask('ספר לי משהו', null);

  step('open original page');
  await page.locator('.msg.bot').nth(2).locator('.card .btn.primary').first().click();
  await page.waitForFunction(() => /עמוד \d+ מתוך/.test(document.getElementById('viewer-status').textContent), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  console.log('  viewer:', await page.textContent('#viewer-status'), '| highlights:', await page.locator('.term-hl').count(), '| region:', await page.locator('.region-band').count());
  await page.screenshot({ path: `${OUT}/08-viewer.png` });
  await page.click('#viewer-close');

  step('offline + reload (service worker) + persistence');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForSelector('.welcome');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.welcome', { timeout: 15000 });
  console.log('  offline subtitle:', await page.textContent('#sub'));
  await ask('outflow valve', null);
  await page.locator('.msg.bot').last().locator('.card .btn.primary').first().click();
  await page.waitForFunction(() => /עמוד \d+ מתוך/.test(document.getElementById('viewer-status').textContent), null, { timeout: 30000 });
  console.log('  offline viewer:', await page.textContent('#viewer-status'));
  await page.click('#viewer-close');
  const timing = await page.evaluate(() => window.__app.S.loadMs);
  console.log('  index load ms (desktop):', timing);

  console.log('\nexternal requests:', external.length ? external : 'none');
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
