import { test, expect } from '@playwright/test';

async function holdSave(page) {
  await page.evaluate(() => {
    window.__saveLockReady = false;
    void navigator.locks.request(
      'rakuga-save',
      () =>
        new Promise((resolve) => {
          window.__saveLockReady = true;
          window.__releaseSave = resolve;
        }),
    );
  });
  await page.waitForFunction(() => window.__saveLockReady);
}
async function savedNames(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('rakuga-db', 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db.transaction('saves').objectStore('saves').get('main');
          read.onsuccess = () => {
            db.close();
            resolve(
              read.result.characters.map((c) => ({
                name: c.name,
                strokes: c.drawing.strokes?.length,
              })),
            );
          };
        };
      }),
  );
}

test('native Escape during a captured selection drag permits a complete new stroke after reopening', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('blank');
  const canvas = page.getByLabel('ラクガキキャンバス'),
    rect = await canvas.boundingBox(),
    point = (x, y) => [rect.x + rect.width * x, rect.y + rect.height * y];
  await page.mouse.move(...point(0.25, 0.4));
  await page.mouse.down();
  await page.mouse.move(...point(0.65, 0.4), { steps: 8 });
  await page.mouse.up();
  await page.locator('[data-tool="select"]').click();
  await page.mouse.move(...point(0.5, 0.4));
  await page.mouse.down();
  await page.mouse.move(...point(0.55, 0.45), { steps: 3 });
  await expect(page.locator('[data-selection]')).toContainText('選択中');
  await page.locator('.editor').evaluate((dialog) => {
    window.__editorClosed = false;
    dialog.addEventListener(
      'close',
      () => {
        window.__editorClosed = true;
      },
      { once: true },
    );
  });
  await page.keyboard.press('Escape');
  // Keep the mouse held until native close has run. Releasing it before that
  // event masks the stale-drag bug by finishing the original gesture first.
  await page.waitForFunction(() => window.__editorClosed);
  await page.mouse.up();
  await page.locator('#draw-open').click();
  const reopened = await canvas.boundingBox(),
    nextPoint = (x, y) => [reopened.x + reopened.width * x, reopened.y + reopened.height * y];
  await page.mouse.move(...nextPoint(0.2, 0.2));
  await page.mouse.down();
  await page.mouse.move(...nextPoint(0.4, 0.2), { steps: 6 });
  await page.mouse.up();
  await page.locator('#character-name').fill('Escから復帰');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('この端末に保存しました');
  const drawing = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('rakuga-db', 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db.transaction('saves').objectStore('saves').get('main');
          read.onsuccess = () => {
            const data = read.result;
            db.close();
            resolve(data.characters.find((c) => c.id === data.active).drawing);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(drawing.strokes).toHaveLength(2);
  expect(drawing.strokes[0].points[0].x).toBeCloseTo(0.3, 2);
  expect(drawing.strokes[0].points[0].y).toBeCloseTo(0.45, 2);
  expect(drawing.strokes[1].points.length).toBeGreaterThan(2);
  expect(drawing.strokes[1].points[0]).toEqual({ x: 0.2, y: 0.2 });
  expect(drawing.strokes[1].points.at(-1)).toEqual({ x: 0.4, y: 0.2 });
  expect(errors).toEqual([]);
});

test('completion of an older birth save cannot close an editor reopened for a new draft', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.locator('#character-name').fill('保存待ちの子');
  await holdSave(page);
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('保存しています');
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor')).toBeHidden();
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dog');
  await page.locator('#character-name').fill('新しい犬');
  const draft = await page.locator('.editor canvas').evaluate((canvas) => canvas.toDataURL());
  await page.evaluate(() => window.__releaseSave());
  await expect(page.locator('#save-status')).toContainText('保存しました');
  await expect(page.locator('.editor')).toBeVisible();
  expect(await page.locator('.editor canvas').evaluate((canvas) => canvas.toDataURL())).toBe(draft);
  await expect(page.locator('#character-name')).toHaveValue('新しい犬');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('.editor')).toBeHidden();
  expect((await savedNames(page)).map((c) => c.name)).toEqual([
    'らくがきくん',
    '保存待ちの子',
    '新しい犬',
  ]);
  expect(errors).toEqual([]);
});

test('a new captured stroke in the same editor survives an earlier birth save completing mid-drag', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('blank');
  const canvas = page.getByLabel('ラクガキキャンバス'),
    rect = await canvas.boundingBox(),
    point = (x, y) => [rect.x + rect.width * x, rect.y + rect.height * y];
  await page.mouse.move(...point(0.2, 0.2));
  await page.mouse.down();
  await page.mouse.move(...point(0.4, 0.2), { steps: 6 });
  await page.mouse.up();
  await page.locator('#character-name').fill('最初の線');
  await holdSave(page);
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('保存しています');
  await page.mouse.move(...point(0.2, 0.6));
  await page.mouse.down();
  await page.mouse.move(...point(0.4, 0.6), { steps: 6 });
  await page.evaluate(() => window.__releaseSave());
  await expect(page.locator('#save-status')).toContainText('保存しました');
  await expect(page.locator('.editor')).toBeVisible();
  await page.mouse.move(...point(0.7, 0.6), { steps: 6 });
  await page.mouse.up();
  await page.locator('#character-name').fill('描き足した線');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('.editor')).toBeHidden();
  const characters = await savedNames(page);
  expect(characters.find((c) => c.name === '最初の線').strokes).toBe(1);
  expect(characters.find((c) => c.name === '描き足した線').strokes).toBe(2);
});

test('temporary save-read failure retains the birth draft and retries the same character after recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.locator('#character-name').fill('最初の保存');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('.editor')).toBeHidden();
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dragon');
  await page.locator('#character-name').fill('保存を再試行');
  await page.evaluate(() => {
    window.__originalReadTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (!args[1] || args[1] === 'readonly') throw new Error('Temporary read failure');
      return window.__originalReadTransaction.apply(this, args);
    };
  });
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#editor-feedback')).toContainText('保存の状態を確認できません');
  await expect(page.locator('.editor')).toBeVisible();
  expect(await page.evaluate(() => window.__qa.state().characters)).toBe(3);
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = window.__originalReadTransaction;
  });
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('.editor')).toBeHidden();
  expect((await savedNames(page)).map((c) => c.name)).toEqual([
    'らくがきくん',
    '最初の保存',
    '保存を再試行',
  ]);
});

test('a later settings save confirms a failed birth before a new character is created', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dragon');
  await page.locator('#character-name').fill('保存を待つドラゴン');
  await page.evaluate(() => {
    window.__originalReadTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (!args[1] || args[1] === 'readonly') throw new Error('Temporary read failure');
      return window.__originalReadTransaction.apply(this, args);
    };
  });
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#editor-feedback')).toContainText('保存の状態を確認できません');
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor')).toBeHidden();
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = window.__originalReadTransaction;
  });
  await holdSave(page);
  await page.locator('#pause').click();
  await page.locator('#sound').uncheck();
  await expect(page.locator('#save-status')).toContainText('保存しています');
  await page.locator('#resume').click();
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('dog');
  await page.locator('#character-name').fill('次の犬');
  await page.locator('[data-do="birth"]').click();
  await page.evaluate(() => window.__releaseSave());
  await expect(page.locator('.editor')).toBeHidden();
  expect((await savedNames(page)).map((character) => character.name)).toEqual([
    'らくがきくん',
    '保存を待つドラゴン',
    '次の犬',
  ]);
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  expect(await page.evaluate(() => window.__qa.state().characters)).toBe(3);
  expect(errors).toEqual([]);
});
