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

test('online ranking works without localStorage access and reuses its in-memory anonymous ID', async ({
  page,
}) => {
  const errors = [];
  let sessions = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url() === 'http://127.0.0.1:8787/session') sessions++;
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage denied', 'SecurityError');
      },
    });
  });
  await page.route('**/ranking-config.json', (route) =>
    route.fulfill({ json: { endpoint: 'http://127.0.0.1:8787' } }),
  );
  await page.goto('/');
  for (let index = 0; index < 2; index++) {
    await page.locator('#ranking-open').click();
    await expect(page.locator('.ranking-status')).toContainText(
      'まだ登録された自分の記録はありません',
    );
    await page.locator('.ranking-close').click();
  }
  expect(sessions).toBe(1);
  expect(errors).toEqual([]);
});
