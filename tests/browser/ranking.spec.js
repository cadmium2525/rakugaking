import { test, expect } from '@playwright/test';
test('unconfigured and offline rankings leave the game playable', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('#ranking-open').click();
  await expect(page.locator('.ranking-status')).toContainText('未接続');
  await page.locator('.ranking-close').click();
  await context.setOffline(true);
  await page.locator('#ranking-open').click();
  await expect(page.locator('.ranking-status')).toContainText('オフライン');
  await page.locator('.ranking-close').click();
  await page.locator('#adventure').click();
  await page.locator('[data-stage="1"]').click();
  const startZ = (await page.evaluate(() => window.__qa.state())).position.z;
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => (await page.evaluate(() => window.__qa.state())).position.z)
    .toBeLessThan(startZ - 0.8);
  await page.keyboard.up('KeyW');
  await context.setOffline(false);
});
