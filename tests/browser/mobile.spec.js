import { test, expect } from '@playwright/test';
test.use({ deviceScaleFactor: 3 });
test('specified portrait and landscape sizes support drawing, preview, and all home actions', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__qa?.state().calls > 0);
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [393, 852],
    [430, 932],
    [667, 375],
    [844, 390],
    [852, 393],
    [932, 430],
  ]) {
    await page.setViewportSize({ width, height });
    for (const id of ['draw-open', 'adventure', 'library-open', 'ranking-open'])
      await expect(page.locator(`#${id}`)).toBeInViewport();
    await page.locator('#library-open').click();
    await expect(page.locator('.library')).toBeVisible();
    await page.locator('[data-close-library]').click();
    await page.locator('#draw-open').click();
    const canvas = page.getByLabel('ラクガキキャンバス');
    const b = await canvas.boundingBox();
    expect(Math.abs(b.width - b.height)).toBeLessThan(2);
    await page.locator('[data-do="preview"]').click();
    await expect(page.getByAltText('ラクガキの3Dプレビュー')).toBeVisible();
    await page.locator('[data-do="back-to-drawing"]').click();
    for (const button of await page.locator('.swatches button').all()) {
      const rect = await button.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/editor-${width}x${height}.png`, scale: 'css' });
    await page.getByLabel('エディタを閉じる').click();
    await page.screenshot({ path: `test-results/home-${width}x${height}.png`, scale: 'css' });
  }
  expect(errors).toEqual([]);
});
test('quality resolution is capped, persists, and preview geometry is disposed', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__qa);
  const baseline = await page.evaluate(() => window.__qa.state().geometries);
  await page.locator('#draw-open').click();
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-do="preview"]').click();
    await page.locator('[data-do="back-to-drawing"]').click();
  }
  await page.getByLabel('エディタを閉じる').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__qa.state().geometries)).toBeLessThanOrEqual(
    baseline + 2,
  );
  await page.getByLabel('一時停止').click();
  await page.locator('#quality').selectOption('low');
  await expect(page.locator('#save-status')).toContainText('保存しました');
  const resolution = await page.evaluate(() => window.__qa.state().resolution);
  expect(resolution.width * resolution.height).toBeLessThanOrEqual(801000);
  await page.reload();
  await page.waitForFunction(() => window.__qa);
  expect(await page.evaluate(() => window.__qa.state().quality)).toBe('low');
  const s = await page.evaluate(() => window.__qa.state());
  expect(s.calls).toBeLessThan(120);
  expect(s.triangles).toBeLessThan(30000);
});
