import { expect } from '@playwright/test';
import { fieldControls } from './field-driver.js';
import { STAGES } from '../../src/game/stages.js';
import { cameraMovement } from '../../src/core/camera.js';
import { mkdir, writeFile } from 'node:fs/promises';
export const viewControls = (input, state) => cameraMovement(input, -(state.camera?.yaw || 0));
export async function playField(page, screenshots = false, order) {
  const held = new Set(),
    captured = new Set(),
    trace = [];
  let previousInput;
  for (let i = 0; i < 4500; i++) {
    const state = await page.evaluate(() => ({
      ...window.__qa.state(),
      hp: document.querySelector('#health')?.value,
    }));
    trace.push({ state, input: previousInput, held: [...held] });
    if (trace.length > 80) trace.shift();
    if (state.deaths) {
      await mkdir('qa/v7/field-failures', { recursive: true });
      await writeFile(
        `qa/v7/field-failures/stage-${state.stage}-${Date.now()}.json`,
        JSON.stringify(trace, null, 2),
      );
    }
    if (i % 400 === 0)
      console.log(
        'Field pilot',
        JSON.stringify({
          stage: state.stage,
          position: state.position,
          elapsed: state.field,
          calls: state.calls,
          triangles: state.triangles,
        }),
      );
    expect(state.deaths, JSON.stringify(state)).toBe(0);
    if (state.complete) break;
    if (screenshots) {
      const story = [
        [
          'courier-follow',
          state.field.escorts?.rescue?.started && !state.field.escorts.rescue.arrived,
        ],
        ['courier-arrival', state.field.escorts?.rescue?.arrived],
        ['defense-start', state.field.defenses?.sentinels?.started],
        [
          'defense-last-wave',
          state.field.enemies?.every((e) => e.active) && state.field.defenses?.sentinels?.started,
        ],
        ['defense-success', state.field.defenses?.sentinels?.complete],
        ['clock-repaired', state.stage === 4 && state.field.runes.includes(8)],
      ];
      for (const [label, visible] of story)
        if (visible && !captured.has(label)) {
          const path = `test-results/expedition/${typeof screenshots === 'string' ? screenshots : `stage-${state.stage}`}-${label}`;
          await page.screenshot({ path: `${path}.png` });
          await writeFile(`${path}.json`, JSON.stringify({ state, input: previousInput }, null, 2));
          captured.add(label);
        }
      const label =
        state.stage === 4 &&
        state.field.runes.length > 0 &&
        state.field.runes.length < 4 &&
        !captured.has('timer-active')
          ? 'timer-active'
          : state.stage === 3 &&
              [0, 1, 2].every((i) => state.field.runes.includes(i)) &&
              !captured.has('water-drained')
            ? 'water-drained'
            : state.field.bossPhase === 'windup'
              ? 'boss-warning'
              : state.field.rewards.length === 3
                ? 'gate-open'
                : null;
      if (label && !captured.has(label)) {
        await page.screenshot({
          path:
            typeof screenshots === 'string'
              ? `test-results/expedition/${screenshots}-${label}.png`
              : `test-results/field-${label}.png`,
        });
        captured.add(label);
        if (label === 'timer-active')
          await expect(page.locator('#objective')).toContainText('残り');
      }
    }
    const stage = STAGES.find((s) => s.id === state.stage);
    let input = fieldControls(state, i * 4, order || stage.missions.map((m) => m.id), stage);
    if (state.stage === 3 && typeof screenshots === 'string') {
      const drained = [0, 1, 2].every((i) => state.field.runes.includes(i)),
        dx = 25 - state.position.x,
        dz = -27 - state.position.z,
        d = Math.hypot(dx, dz);
      if (!drained && !captured.has('water-before'))
        input = { x: dx / Math.max(1, d), z: dz / Math.max(1, d), jump: false, action: false };
      if (!drained && d < 2 && !captured.has('water-before')) {
        await page.screenshot({
          path: `test-results/expedition/${screenshots}-water-before.png`,
        });
        captured.add('water-before');
      }
      if (drained && !captured.has('water-after')) {
        input = { x: dx / Math.max(1, d), z: dz / Math.max(1, d), jump: false, action: false };
        if (d < 2) {
          await page.screenshot({
            path: `test-results/expedition/${screenshots}-water-after.png`,
          });
          captured.add('water-after');
        }
      }
    }
    input = viewControls(input, state);
    previousInput = { ...input };
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
  const final = await page.evaluate(() => window.__qa.state());
  await expect(page.locator('#result'), JSON.stringify(final)).toBeVisible();
  expect(final.field.rewards).toHaveLength(3);
  expect(final.deaths).toBe(0);
}
