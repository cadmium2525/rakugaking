import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Serve the actual dist under a repository subpath, with no SPA fallback.
const root = resolve('dist');
let updateRelease = false;
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, pathname.slice('/rakuga/'.length) || 'index.html');
  if (!pathname.startsWith('/rakuga/') || !file.startsWith(root + sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    let body = await readFile(file);
    if (updateRelease && file.endsWith('sw.js')) {
      body = Buffer.from(body.toString().replace("const VERSION = '", "const VERSION = 'next-"));
    }
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.wasm': 'application/wasm',
      }[extname(file)] || 'application/octet-stream',
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({
    channel: process.env.CI ? undefined : 'msedge',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => errors.push(request.url()));
  await page.goto(process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/rakuga/`);
  await page.waitForFunction(
    () => /ON GROUND|IN THE AIR/.test(document.querySelector('#status')?.textContent),
    null,
    { timeout: 60000 },
  );
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dog');
  await page.waitForFunction(() =>
    document.querySelector('.assembly img')?.src.startsWith('data:'),
  );
  await page.getByRole('button', { name: '誕生させる ✦', exact: true }).click();
  await page.locator('.editor').waitFor({ state: 'hidden' });
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'test-results/production.png' });
  assert.equal(await page.evaluate(() => typeof window.__qa), 'undefined');
  const manifest = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('link[rel="manifest"]').href);
    return response.json();
  });
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    assert.equal(size, icon.sizes);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Check the manifest is recognized by Chromium's installability machinery.
  const cdp = await page.context().newCDPSession(page);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(
    installability.installabilityErrors.filter((error) => error.errorId !== 'in-incognito'),
    [],
  );
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() =>
    /ON GROUND|IN THE AIR/.test(document.querySelector('#status')?.textContent),
  );
  await page.locator('#draw-open').click();
  await page.getByRole('button', { name: '誕生させる ✦', exact: true }).click();
  await page.locator('.editor').waitFor({ state: 'hidden' });
  await page.context().setOffline(false);
  if (!process.env.SMOKE_URL) {
    await page.evaluate(() => caches.open('unrelated-app'));
    updateRelease = true;
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await page.waitForFunction(
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    );
    assert.equal(
      await page.evaluate(
        async () => (await caches.keys()).filter((key) => key.startsWith('rakuga:')).length,
      ),
      2,
    );
    // The running page keeps its controller until all its tabs are closed.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(`http://127.0.0.1:${server.address().port}/rakuga/`);
    await reopened.waitForFunction(
      async () => (await caches.keys()).filter((key) => key.startsWith('rakuga:')).length === 1,
    );
    assert.ok(await reopened.evaluate(async () => (await caches.keys()).includes('unrelated-app')));
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: production boot, icons, installability, offline reload/birth, safe update lifecycle, no page/request errors',
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
