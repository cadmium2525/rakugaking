import { test, expect } from '@playwright/test';
import { STAGES } from '../../src/game/stages.js';
import { freshSave } from '../../src/core/save.js';
import { playField, viewControls } from '../helpers/browser-field.js';
import { fieldControls } from '../helpers/field-driver.js';
for (const stage of STAGES.filter((s) => s.expedition))
  test(`expedition ${stage.id}: reviewed field clears with keyboard input`, async ({ page }) => {
    test.setTimeout(360000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const save = freshSave();
    save.player.cleared = Array.from({ length: stage.id - 1 }, (_, i) => i + 1);
    save.player.exp = 1500;
    await page.addInitScript(
      (data) => localStorage.setItem('rakuga.save', JSON.stringify(data)),
      save,
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.locator('#adventure').click();
    await page.locator(`[data-stage="${stage.id}"]`).click();
    await expect(page.locator('.field-hud')).toBeVisible();
    await expect(page.locator(`[data-mission="${stage.missions[0].id}"]`)).toContainText(
      stage.missions[0].short,
    );
    await page.screenshot({ path: `test-results/expedition/stage-${stage.id}-start.png` });
    for (const size of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await page.screenshot({
        path: `test-results/expedition/stage-${stage.id}-${size.width}.png`,
      });
      const box = await page.locator('.field-bearing').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await playField(
      page,
      `stage-${stage.id}`,
      stage.id === 3 ? ['pearls', 'sluice', 'boss'] : undefined,
    );
    await page.screenshot({ path: `test-results/expedition/stage-${stage.id}-clear.png` });
    expect(errors).toEqual([]);
  });
test('city timer stays visible with the portrait mission map folded', async ({ page }) => {
  test.setTimeout(90000);
  const stage = STAGES[3],
    save = freshSave();
  save.player.cleared = [1, 2, 3];
  save.player.exp = 1500;
  await page.addInitScript(
    (data) => localStorage.setItem('rakuga.save', JSON.stringify(data)),
    save,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#adventure').click();
  await page.locator('[data-stage="4"]').click();
  const held = new Set();
  let started = false;
  for (let i = 0; i < 900; i++) {
    const state = await page.evaluate(() => window.__qa.state());
    if (state.field.runes.length) {
      started = true;
      break;
    }
    const input = viewControls(fieldControls(state, i, ['lamps', 'guards', 'boss'], stage), state);
    for (const [key, on] of [
      ['KeyA', input.x < -0.1],
      ['KeyD', input.x > 0.1],
      ['KeyW', input.z < -0.1],
      ['KeyS', input.z > 0.1],
    ]) {
      if (on && !held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      } else if (!on && held.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    }
    await page.waitForTimeout(35);
  }
  for (const key of held) await page.keyboard.up(key);
  expect(started).toBe(true);
  await expect(page.locator('.field-hud details')).not.toHaveAttribute('open', '');
  await expect(page.locator('#objective')).toContainText('残り');
  await expect(page.locator('#objective')).toContainText('次は2番');
  await page.screenshot({ path: 'test-results/expedition/stage-4-timer-portrait.png' });
});
