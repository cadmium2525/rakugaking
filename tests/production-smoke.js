import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Serve the actual dist under a repository subpath, with no SPA fallback.
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, pathname.slice('/rakuga/'.length) || 'index.html');
  if (!pathname.startsWith('/rakuga/') || !file.startsWith(root + sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
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
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => errors.push(request.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}/rakuga/`);
  await page.locator('#draw-open').click();
  await page.getByRole('button', { name: '誕生させる ✦', exact: true }).click();
  await page.locator('.editor').waitFor({ state: 'hidden' });
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'test-results/production.png' });
  assert.equal(await page.evaluate(() => typeof window.__qa), 'undefined');
  assert.deepEqual(errors, []);
  console.log(
    'PASS: production subpath assets, WASM boot, character birth, no QA global, no request/page errors',
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
