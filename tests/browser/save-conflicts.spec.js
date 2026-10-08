import { test, expect } from '@playwright/test';
import { freshSave } from '../../src/core/save.js';
import { calculateStats } from '../../src/core/stats.js';
import { APP_VERSION, GAME_VERSION } from '../../src/core/ranking.js';

test.afterEach(async ({ context }, info) => {
  if (info.status === info.expectedStatus) return;
  for (const page of context.pages()) {
    try {
      console.log(
        'Save regression diagnostics:',
        await page.evaluate(() => ({
          status: document.querySelector('#save-status')?.textContent,
          editor: document.querySelector('#editor-feedback')?.textContent,
          editorOpen: document.querySelector('.editor')?.open,
          characters: window.__qa?.state().characters,
        })),
      );
    } catch (error) {
      console.log('Save regression diagnostic failed:', error.message);
    }
  }
});

async function saved(page, key = 'main') {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('rakuga-db', 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db.transaction('saves').objectStore('saves').get(key);
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
    key,
  );
}
async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__qa);
}
async function birth(page, name) {
  await page.locator('#draw-open').click();
  await page.locator('#character-name').fill(name);
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('この端末に保存しました', {
    timeout: 15000,
  });
  await expect(page.locator('.editor')).toBeHidden();
}

test('HTTP LAN-like contexts boot, save a new character and reload with real IndexedDB and no UUID or Web Locks', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // On loopback this removes only the two secure-context APIs. IndexedDB and
  // getRandomValues remain the browser implementations used on HTTP LAN URLs.
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis.navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
  });
  await ready(page);
  const APIs = () =>
    page.evaluate(() => ({
      uuid: typeof crypto.randomUUID,
      locks: typeof navigator.locks,
      indexedDB: typeof indexedDB.open,
      randomValues: typeof crypto.getRandomValues,
    }));
  const expectedAPIs = {
    uuid: 'undefined',
    locks: 'undefined',
    indexedDB: 'function',
    randomValues: 'function',
  };
  expect(await APIs()).toEqual(expectedAPIs);
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dog');
  await page.locator('#character-name').fill('LANのねこ');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('.editor')).toBeHidden();
  await expect(page.locator('#save-status')).toHaveText('この端末に保存しました');
  const before = await saved(page),
    character = before.characters.find((entry) => entry.id === before.active);
  expect(before.characters).toHaveLength(2);
  expect(character.name).toBe('LANのねこ');
  expect(character.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(before.saveId).toMatch(/^[0-9a-f-]{36}$/);
  expect(character.drawing.strokes.length).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  expect(await APIs()).toEqual(expectedAPIs);
  expect(await page.evaluate(() => window.__qa.state().name)).toBe('LANのねこ');
  expect(await page.evaluate(() => window.__qa.state().characters)).toBe(2);
  const after = await saved(page);
  expect(after.active).toBe(before.active);
  expect(after.saveId).toBe(before.saveId);
  expect(after.characters).toEqual(before.characters);
  expect(errors).toEqual([]);
});

test('a stale settings tab cannot erase another tab character and can save after reloading', async ({
  page,
  context,
}) => {
  // Four WebGL boots across two tabs can exceed 30s on CI's software renderer.
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const other = await context.newPage();
  other.on('pageerror', (error) => errors.push(error.message));
  await ready(other);
  await birth(page, 'tab-A');
  await other.locator('#pause').click();
  await other.locator('#sound').uncheck();
  await expect(other.locator('#save-status')).toContainText('上書きを停止');
  expect((await saved(page)).characters.map((character) => character.name)).toContain('tab-A');
  expect((await saved(page)).settings.sound).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  expect(await page.evaluate(() => window.__qa.state().characters)).toBe(2);
  await other.reload();
  await other.waitForFunction(() => window.__qa);
  await other.locator('#pause').click();
  await other.locator('#sound').uncheck();
  await expect(other.locator('#save-status')).toContainText('保存しました');
  const final = await saved(other);
  expect(final.characters).toHaveLength(2);
  expect(final.settings.sound).toBe(false);
  expect(errors).toEqual([]);
  await other.close();
});

test('a stale birth retains its editor draft and backs it up without duplicating characters on retry', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const other = await context.newPage();
  other.on('pageerror', (error) => errors.push(error.message));
  await ready(other);
  await other.locator('#draw-open').click();
  await other.getByLabel('下絵', { exact: true }).selectOption('dragon');
  await other.locator('#character-name').fill('未保存のドラゴン');
  const pixels = await other.locator('.editor canvas').evaluate((canvas) => canvas.toDataURL());
  await birth(page, 'tab-A');
  await other.locator('[data-do="birth"]').click();
  await expect(other.locator('#editor-feedback')).toContainText('上書きを停止');
  await expect(other.locator('.editor')).toBeVisible();
  expect(await other.locator('.editor canvas').evaluate((canvas) => canvas.toDataURL())).toBe(
    pixels,
  );
  expect(await other.evaluate(() => window.__qa.state().characters)).toBe(2);
  await other.locator('#character-name').fill('未保存のドラゴン改');
  await other.locator('[data-do="birth"]').click();
  // The earlier warning is already visible. Wait for the current save job's
  // status instead of mistaking that old warning for this backup completing.
  await expect(other.locator('#save-status')).toContainText('上書きを停止');
  expect(await other.evaluate(() => window.__qa.state().characters)).toBe(2);
  const backups = await other.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('rakuga-db', 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db.transaction('saves').objectStore('saves').getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
  );
  expect(backups.some((data) => data.characters.some((c) => c.name === '未保存のドラゴン改'))).toBe(
    true,
  );
  expect((await saved(page)).characters.map((c) => c.name)).toEqual(['らくがきくん', 'tab-A']);
  expect(errors).toEqual([]);
  await other.close();
});

for (const fallback of [false, true]) {
  test(`simultaneous ${fallback ? 'localStorage with native Web Locks' : 'IndexedDB without Web Locks'} saves keep the winner and protect the other branch`, async ({
    page,
  }) => {
    await ready(page);
    const result = await page.evaluate(async (fallback) => {
      const { SaveStore } = await import('/src/core/save.js'),
        options = fallback ? { idb: null } : { locks: null },
        one = new SaveStore(options),
        two = new SaveStore(options),
        first = (await one.load()).data,
        second = (await two.load()).data;
      first.player.exp = 100;
      second.player.exp = 200;
      const messages = await Promise.all([one.save(first), two.save(second)]),
        loser = messages[0].startsWith('この端末に保存しました') ? two : one,
        main = fallback ? JSON.parse(localStorage.getItem('rakuga.save')) : await one.dbRead();
      let backup;
      if (fallback) backup = JSON.parse(localStorage.getItem(`rakuga.save.${loser.conflictKey}`));
      else {
        const db = await loser.open();
        backup = await new Promise((resolve) => {
          const read = db.transaction('saves').objectStore('saves').get(loser.conflictKey);
          read.onsuccess = () => resolve(read.result);
        });
      }
      one.db?.close();
      two.db?.close();
      return {
        messages,
        main: main.player.exp,
        backup: backup.player.exp,
        fallbackMain: localStorage.getItem('rakuga.save'),
      };
    }, fallback);
    expect(
      result.messages.filter((message) => message.startsWith('この端末に保存しました')),
    ).toHaveLength(1);
    expect(result.messages.filter((message) => message.includes('上書きを停止'))).toHaveLength(1);
    expect([result.main, result.backup].sort((a, b) => a - b)).toEqual([100, 200]);
    if (!fallback) expect(result.fallbackMain).toBeNull();
  });
}

test('existing current-ruleset scalar best and angle-bracket names survive save and reload in the patch', async ({
  page,
}) => {
  const raw = freshSave(),
    drawing = raw.characters[0].drawing;
  delete raw.bestRecord;
  delete raw.bestVersion;
  raw.characters[0].name = '<ねこ>';
  raw.best = 100;
  raw.records = Array.from({ length: 20 }, (_, id) => ({
    id: `old-${id}`,
    version: GAME_VERSION,
    character: '<ねこ>',
    level: 1,
    drawing,
    stats: calculateStats(drawing),
    splits: Array(5).fill(30),
    total: 150,
    valid: true,
  }));
  await page.addInitScript((raw) => {
    if (!localStorage.getItem('rakuga.save'))
      localStorage.setItem('rakuga.save', JSON.stringify(raw));
  }, raw);
  await ready(page);
  await expect(page.locator('#game-version')).toHaveText(`v${APP_VERSION}`);
  expect(await page.evaluate(() => window.__qa.state().best)).toBe(100);
  await page.locator('#pause').click();
  await page.locator('#sound').uncheck();
  await expect(page.locator('#save-status')).toContainText('保存しました');
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  expect(await page.evaluate(() => window.__qa.state().best)).toBe(100);
  expect(await page.evaluate(() => window.__qa.state().records)).toBe(20);
  const data = await saved(page);
  expect(data.records.every((record) => record.character === '<ねこ>')).toBe(true);
  expect(data.bestVersion).toBe(GAME_VERSION);
  expect(data.bestRecord).toBeNull();
});
