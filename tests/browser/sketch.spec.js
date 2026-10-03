import { test, expect } from '@playwright/test';
async function saved(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('rakuga-db', 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction('saves').objectStore('saves').get('main');
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
}
test('tap bucket fills a pen outline, undoes, recolors, and survives birth and reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('blank');
  const r = await page.getByLabel('ラクガキキャンバス').boundingBox();
  const p = (x, y) => [r.x + r.width * x, r.y + r.height * y];
  await page.mouse.move(...p(0.2, 0.2));
  await page.mouse.down();
  for (const [x, y] of [
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.2, 0.2],
  ])
    await page.mouse.move(...p(x, y), { steps: 10 });
  await page.mouse.up();
  await page.locator('[data-color="#659dcc"]').click();
  await page.locator('[data-tool="bucket"]').click();
  await page.mouse.click(...p(0.5, 0.5));
  await expect(page.locator('#editor-feedback')).toContainText('塗りつぶしました');
  const pixel = () =>
    page
      .locator('.editor canvas')
      .evaluate((c) => Array.from(c.getContext('2d').getImageData(300, 300, 1, 1).data));
  expect(await pixel()).toEqual([101, 157, 204, 255]);
  await page.locator('[data-do="undo"]').click();
  expect((await pixel())[3]).toBe(0);
  await page.locator('[data-do="redo"]').click();
  await page.locator('[data-color="#e55353"]').click();
  await page.mouse.click(...p(0.5, 0.5));
  expect(await pixel()).toEqual([229, 83, 83, 255]);
  await page.screenshot({ path: 'test-results/bucket-filled.png' });
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('保存しました');
  const data = await saved(page),
    d = data.characters.find((c) => c.id === data.active).drawing;
  expect(d.strokes).toHaveLength(2);
  expect(d.strokes[0].closed).toBe(true);
  expect(d.strokes[0].color).toBe('#e55353');
  expect(d.strokes[1].closed).toBe(false);
  await page.reload();
  await page.locator('#draw-open').click();
  expect(await pixel()).toEqual([229, 83, 83, 255]);
});
test('open custom-color stroke stays open after birth and reload; canvas selection transforms it', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByLabel('下絵', { exact: true }).selectOption('blank');
  await expect(page.locator('[data-do="birth"]')).toBeDisabled();
  await page.getByLabel('自由な色').evaluate((el) => {
    el.value = '#19a4d6';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const r = await page.getByLabel('ラクガキキャンバス').boundingBox();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.2, { steps: 12 });
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.8, { steps: 12 });
  await page.mouse.up();
  await page.getByLabel('エディタを閉じる').click();
  await page.locator('#draw-open').click();
  await expect(page.locator('[data-do="birth"]')).toBeEnabled();
  await page.locator('[data-tool="select"]').click();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-do="copy"]')).toBeEnabled();
  await page.locator('[data-do="copy"]').click();
  await page.locator('[data-do="flip"]').click();
  await page.locator('[data-do="delete"]').click();
  await page.locator('#character-name').fill('自由な線');
  await page.locator('[data-do="birth"]').click();
  await expect(page.locator('#save-status')).toContainText('保存しました');
  let data = await saved(page);
  let drawing = data.characters.find((c) => c.id === data.active).drawing;
  expect(drawing.kind).toBe('sketch');
  expect(drawing.strokes).toHaveLength(1);
  expect(drawing.strokes[0].closed).toBe(false);
  expect(drawing.strokes[0].color).toBe('#19a4d6');
  expect(drawing.strokes[0].points[0].x).toBeCloseTo(0.1, 1);
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  data = await saved(page);
  expect(data.characters.find((c) => c.id === data.active).drawing).toEqual(drawing);
});
test('dog and dragon templates produce distinct saved playable creatures', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const previews = [];
  for (const kind of ['dog', 'dragon']) {
    await page.locator('#draw-open').click();
    await page.getByLabel('下絵', { exact: true }).selectOption(kind);
    await page.waitForTimeout(200);
    previews.push(await page.getByAltText('組み立て中のキャラクター').getAttribute('src'));
    await page.screenshot({ path: `test-results/sketch-${kind}.png` });
    await page.locator('#character-name').fill(kind);
    await page.locator('[data-do="birth"]').click();
    await expect(page.locator('#save-status')).toContainText('保存しました');
    const data = await saved(page),
      d = data.characters.find((c) => c.id === data.active).drawing;
    expect(d.strokes.filter((s) => s.role === (kind === 'dog' ? 'leg' : 'wing'))).toHaveLength(
      kind === 'dog' ? 4 : 2,
    );
    await page.waitForFunction(() => window.__qa.state().grounded);
    const jumps = await page.evaluate(() => window.__qa.state().jumps);
    await page.keyboard.press('Space');
    await page.waitForFunction((n) => window.__qa.state().jumps > n, jumps);
    await page.waitForTimeout(600);
  }
  expect(previews[0]).not.toBe(previews[1]);
  expect(errors).toEqual([]);
});
