import { test, expect } from '@playwright/test';
import { playField } from '../helpers/browser-field.js';
test('wide field missions, boss, emblems and gate work through real keyboard input', async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#adventure').click();
  await page.locator('[data-stage="1"]').click();
  await expect(page.locator('.field-hud')).toBeVisible();
  await expect(page.locator('[data-count]')).toHaveText('0/3');
  await page.locator('[data-mission="ruins"]').click();
  await expect(page.locator('[data-mission="ruins"]')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/field-start.png' });
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator('.field-hud summary')).toBeInViewport();
    await expect(page.locator('#jump')).toBeInViewport();
    await page.screenshot({ path: `test-results/field-${size.width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  // Let resize clear held input before the pilot begins holding movement keys.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await playField(page, true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/field-clear.png' });
});
