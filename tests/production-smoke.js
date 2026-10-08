import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { freshSave } from '../src/core/save.js';
import { STAGES } from '../src/game/stages.js';

// Serve the actual dist under a repository subpath, with no SPA fallback.
const root = resolve('dist');
let updateRelease = 0;
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
      body = Buffer.from(
        body
          .toString()
          .replace("const VERSION = '", `const VERSION = '${'next-'.repeat(updateRelease)}`),
      );
      if (updateRelease === 1) {
        // Hold only this test worker after the real update request. This lets
        // the page enter editing before activation without timing-based sleeps.
        body = Buffer.from(
          body.toString().replace(
            'await self.skipWaiting();',
            `await new Promise((done) => {
              const allow = (message) => {
                if (message.data?.type !== 'QA_ALLOW_ACTIVATION') return;
                self.removeEventListener('message', allow);
                done();
              };
              self.addEventListener('message', allow);
              event.source?.postMessage({ type: 'QA_ACTIVATION_PENDING' });
            });
            await self.skipWaiting();`,
          ),
        );
      }
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
  const fixture = freshSave();
  fixture.player.cleared = [1, 2, 3, 4];
  fixture.player.exp = 1200;
  await context.addInitScript((data) => {
    if (!localStorage.getItem('rakuga.save'))
      localStorage.setItem('rakuga.save', JSON.stringify(data));
  }, fixture);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
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
  await page.locator('#adventure').click();
  await page.locator('[data-stage="1"]').click();
  await page.locator('.field-hud').waitFor({ state: 'visible' });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'test-results/production-field.png' });
  await page.locator('#pause').click();
  await page.locator('#home').click();
  // Prior-clear fixture only unlocks selection; movement uses the shipped public controls.
  for (const stage of STAGES.filter((s) => s.expedition)) {
    await page.locator('#adventure').click();
    await page.locator(`[data-stage="${stage.id}"]`).click();
    await page.locator('.field-hud').waitFor({ state: 'visible' });
    // Short landscape screens keep the map folded while its guidance remains visible.
    await page.locator(`[data-mission="${stage.missions[0].id}"]`).waitFor({ state: 'attached' });
    assert.ok(await page.locator('.field-hud summary').isVisible());
    assert.match(await page.locator('.stage-label').textContent(), new RegExp(`0${stage.id}`));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await page.screenshot({ path: `test-results/production-stage-${stage.id}.png` });
    await page.locator('#pause').click();
    await page.locator('#home').click();
  }
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
    updateRelease = 1;
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
    await page.locator('#update-notice').waitFor({ state: 'visible' });
    // A visible update cannot replace a running adventure.
    await page.locator('#adventure').click();
    await page.locator('[data-stage="1"]').click();
    assert.equal(await page.locator('#update-notice').isVisible(), false);
    assert.ok(
      await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting),
    );
    await page.locator('#pause').click();
    await page.locator('#home').click();
    assert.equal(await page.locator('#update-notice').isVisible(), true);
    // An editing tab must also be protected from another tab's explicit update.
    await page.evaluate(() => {
      window.restoreSaving = () => {
        IDBDatabase.prototype.transaction = window.originalTransaction;
        Storage.prototype.setItem = window.originalSetItem;
      };
      window.originalTransaction = IDBDatabase.prototype.transaction;
      window.originalSetItem = Storage.prototype.setItem;
      IDBDatabase.prototype.transaction = function (...args) {
        if (args[1] === 'readwrite') throw new Error('test storage failure');
        return window.originalTransaction.apply(this, args);
      };
      Storage.prototype.setItem = () => {
        throw new Error('test quota');
      };
    });
    await page.locator('#update-notice button').click();
    await page.waitForFunction(() =>
      document.querySelector('#update-notice').textContent.includes('保存できませんでした'),
    );
    assert.ok(
      await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting),
    );
    await page.evaluate(() => window.restoreSaving());
    const other = await context.newPage();
    await other.goto(`http://127.0.0.1:${server.address().port}/rakuga/`);
    await other.waitForFunction(() =>
      /ON GROUND|IN THE AIR/.test(document.querySelector('#status')?.textContent),
    );
    await other.locator('#draw-open').click();
    await page.locator('#update-notice button').click();
    await page.waitForFunction(() =>
      document.querySelector('#update-notice').textContent.includes('ほかのゲームのタブ'),
    );
    assert.ok(await other.locator('.editor').isVisible());
    assert.ok(
      await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting),
    );
    await other.close();
    // Start safely, then enter editing while activation is pending. A completed
    // update must keep the draft alive and wait for another explicit save/reload.
    await page.locator('#pause').click();
    await page.locator('#sound').uncheck();
    await page.locator('#resume').click();
    await page.evaluate(() => {
      window.activationCount = 0;
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'QA_ACTIVATION_PENDING') window.activationPending = true;
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.activationCount++;
      });
    });
    await page.locator('#update-notice button').click();
    await page.waitForFunction(() => window.activationPending);
    await page.locator('#draw-open').click();
    await page.getByLabel('下絵', { exact: true }).selectOption('blank');
    const canvas = page.getByLabel('ラクガキキャンバス'),
      bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.6, {
      steps: 12,
    });
    await page.mouse.up();
    const draftPixels = await canvas.evaluate((element) => element.toDataURL());
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).waiting.postMessage({
        type: 'QA_ALLOW_ACTIVATION',
      }),
    );
    await page.waitForFunction(() => window.activationCount === 1);
    assert.ok(await page.locator('.editor').isVisible());
    assert.equal(await canvas.evaluate((element) => element.toDataURL()), draftPixels);
    assert.match(await page.locator('#update-notice').textContent(), /更新を用意しました/);
    await page.locator('#character-name').fill('更新競合テスト');
    await page.getByRole('button', { name: '誕生させる ✦', exact: true }).click();
    await page.locator('.editor').waitFor({ state: 'hidden' });
    await Promise.all([page.waitForEvent('load'), page.locator('#update-notice button').click()]);
    await page.waitForFunction(() =>
      /ON GROUND|IN THE AIR/.test(document.querySelector('#status')?.textContent),
    );
    assert.equal(await page.locator('#sound').isChecked(), false);
    await page.locator('#library-open').click();
    assert.match(await page.locator('.library').textContent(), /らくがき/);
    assert.match(await page.locator('.library').textContent(), /更新競合テスト/);
    // The earlier quota failure deliberately selected fallback storage. Check
    // the saved stroke itself as well as the reloaded character's visible name.
    const recovered = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('rakuga.save')).characters.find(
        (character) => character.name === '更新競合テスト',
      ),
    );
    assert.equal(recovered.drawing.kind, 'sketch');
    assert.equal(recovered.drawing.strokes.length, 1);
    assert.ok(recovered.drawing.strokes[0].points.length > 2);
    await page.keyboard.press('Escape');
    // A later update also supports the original all-tabs-closed lifecycle.
    updateRelease = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await page.waitForFunction(
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
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
    `PASS: production boot of all five fields, icons, installability, offline reload/birth${process.env.SMOKE_URL ? '' : ', safe update lifecycle'}, no page/request errors`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
