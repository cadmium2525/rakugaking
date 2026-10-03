import { expect } from '@playwright/test';
import { fieldControls } from './field-driver.js';
export async function playField(page, screenshots = false) {
  const held = new Set(),
    captured = new Set();
  for (let i = 0; i < 4500; i++) {
    const state = await page.evaluate(() => window.__qa.state());
    expect(state.deaths, JSON.stringify(state)).toBe(0);
    if (state.complete) break;
    if (screenshots) {
      const label =
        state.field.bossPhase === 'windup'
          ? 'boss-warning'
          : state.field.rewards.length === 3
            ? 'gate-open'
            : null;
      if (label && !captured.has(label)) {
        await page.screenshot({ path: `test-results/field-${label}.png` });
        captured.add(label);
      }
    }
    const input = fieldControls(state, i * 4);
    for (const [key, on] of [
      ['KeyA', input.x < -0.1],
      ['KeyD', input.x > 0.1],
      ['KeyW', input.z < -0.1],
      ['KeyS', input.z > 0.1],
      ['Space', input.jump],
    ]) {
      if (on && !held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      } else if (!on && held.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    }
    if (input.action) await page.keyboard.press('KeyE');
    await page.waitForTimeout(35);
  }
  for (const key of held) await page.keyboard.up(key);
  await expect(page.locator('#result')).toBeVisible();
  const final = await page.evaluate(() => window.__qa.state());
  expect(final.field.rewards).toHaveLength(3);
  expect(final.deaths).toBe(0);
}
