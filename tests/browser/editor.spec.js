import { test, expect } from '@playwright/test';
test('drawing editor handles strokes, single points, erase, undo, redo and mirror', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#draw-open').click();
  const canvas = page.getByLabel('ラクガキキャンバス'),
    r = await canvas.boundingBox();
  await page.getByRole('button', { name: 'パーツ消去', exact: true }).click();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.7, { steps: 15 });
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.7, { steps: 15 });
  await page.mouse.up();
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.getByRole('button', { name: '↶ 戻す', exact: true }).click();
  await page.getByRole('button', { name: '↷ 進む', exact: true }).click();
  await page.getByRole('button', { name: '左うで', exact: true }).click();
  await page.getByRole('button', { name: '左右コピー', exact: true }).click();
  await page.getByRole('button', { name: '消しゴム', exact: true }).click();
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.screenshot({ path: 'test-results/editor.png' });
  expect(errors).toEqual([]);
  await page.getByLabel('エディタを閉じる').click();
  await expect(page.locator('.editor')).not.toBeVisible();
});
test('birth generates a playable 3D character', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#draw-open').click();
  await page.getByRole('button', { name: '誕生させる ✦', exact: true }).click();
  await expect(page.locator('.editor')).not.toBeVisible();
  await page.waitForFunction(() => window.__qa.state().grounded);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  expect((await page.evaluate(() => window.__qa.state())).jumps).toBe(1);
  await page.screenshot({ path: 'test-results/birth.png' });
  expect(errors).toEqual([]);
});
