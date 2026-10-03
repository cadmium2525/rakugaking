import { test, expect } from '@playwright/test';
test('assembled model changes while drawing and stays visible beside the canvas', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#draw-open').click();
  const model = page.getByAltText('組み立て中のキャラクター');
  await expect(model).toBeVisible();
  await expect(model).toHaveAttribute('src', /^data:image/);
  const before = await model.getAttribute('src');
  await page.getByLabel('下絵', { exact: true }).selectOption('blank');
  const r = await page.getByLabel('ラクガキキャンバス').boundingBox();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.3, { steps: 8 });
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.9, { steps: 8 });
  await expect.poll(() => model.getAttribute('src')).not.toBe(before);
  await page.mouse.up();
  const front = await model.getAttribute('src');
  await page.getByRole('button', { name: '横', exact: true }).click();
  await expect.poll(() => model.getAttribute('src')).not.toBe(front);
  for (const [width, height] of [
    [390, 844],
    [667, 375],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(model).toBeInViewport();
    await expect(page.getByLabel('ラクガキキャンバス')).toBeInViewport();
    const paper = await page.getByLabel('ラクガキキャンバス').boundingBox();
    expect(paper.y).toBeGreaterThanOrEqual(0);
    expect(paper.y + paper.height).toBeLessThanOrEqual(height);
  }
});
