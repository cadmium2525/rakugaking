import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { FIELD_STAGE } from '../../src/game/field-stage.js';
import { cameraMovement } from '../../src/core/camera.js';

test.use({
  viewport: { width: 1280, height: 800 },
});
const directory = 'qa/v6';
const browserErrors = new WeakMap();
const read = (page) => page.evaluate(() => window.__qa.state());
const newestId = (state) => state.combatEvents.at(-1)?.id || 0;

test.beforeEach(async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const errors = [];
  browserErrors.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__qa?.state().grounded);
});
test.afterEach(async ({ page }, info) => {
  const name = info.title.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();
  if (!page.isClosed()) {
    await page.screenshot({ path: `${directory}/${name}-end.png` });
    await writeFile(
      `${directory}/${name}-state.json`,
      JSON.stringify(
        {
          status: info.status,
          state: await page.evaluate(() => window.__qa?.state() || null),
          errors: info.errors.map((e) => e.message),
          browserErrors: browserErrors.get(page),
        },
        null,
        2,
      ),
    );
    await page.close();
  }
});

// Read the public QA snapshot but control movement with actual keyboard input.
// No teleportation, hidden HP edits, injected events or simulation stepping.
async function walk(page, target, threshold = 0.23, maxSteps = 450) {
  const held = new Set();
  try {
    for (let i = 0; i < maxSteps; i++) {
      const s = await read(page),
        p = s.position,
        t = typeof target === 'function' ? target(s) : target,
        dx = t.x - p.x,
        dz = t.z - p.z,
        screen = cameraMovement({ x: dx, z: dz }, -(s.camera?.yaw || 0));
      expect(s.deaths).toBe(0);
      if (Math.hypot(dx, dz) < threshold) return;
      if (
        s.stage === 1 &&
        s.grounded &&
        FIELD_STAGE.platforms.some(
          (p) =>
            p.visible !== false &&
            !p.terrain &&
            Math.abs(s.position.x - p.x) < p.w / 2 + 1.2 &&
            Math.abs(s.position.z - p.z) < p.d / 2 + 1.2 &&
            p.y + p.h / 2 > s.position.y - 0.8 + 0.26,
        )
      )
        await page.keyboard.press('Space');
      for (const [key, on] of [
        ['KeyA', screen.x < -0.13],
        ['KeyD', screen.x > 0.13],
        ['KeyW', screen.z < -0.13],
        ['KeyS', screen.z > 0.13],
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
    throw new Error(
      `Could not walk to ${JSON.stringify(target)}: ${JSON.stringify(await read(page))}`,
    );
  } finally {
    for (const key of held) await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
}
async function eventSince(page, id, type, key) {
  await page.waitForFunction(
    ({ id, type, key }) =>
      window.__qa
        .state()
        .combatEvents.some((e) => e.id > id && e.type === type && (!key || e.key === key)),
    { id, type, key },
    { timeout: 5000 },
  );
  return (await read(page)).combatEvents.find(
    (e) => e.id > id && e.type === type && (!key || e.key === key),
  );
}
async function aimedAttack(page, target) {
  const state = await read(page),
    point = target(state),
    dx = point.x - state.position.x,
    dz = point.z - state.position.z,
    screen = cameraMovement({ x: dx, z: dz }, -(state.camera?.yaw || 0)),
    key = Math.abs(screen.x) > Math.abs(screen.z)
      ? (screen.x < 0 ? 'KeyA' : 'KeyD')
      : screen.z < 0 ? 'KeyW' : 'KeyS',
    facing = cameraMovement({
      x: key === 'KeyA' ? -1 : key === 'KeyD' ? 1 : 0,
      z: key === 'KeyW' ? -1 : key === 'KeyS' ? 1 : 0,
    }, state.camera?.yaw || 0);
  // Last sideways walking corrections can leave an enemy outside the forward
  // assist cone. Turn with normal movement input before attacking that enemy.
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ x, z }) => {
        const facing = window.__qa.state().combat.facing;
        return facing.x * x + facing.z * z >= 0.85;
      },
      facing,
      { timeout: 3000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
  await page.keyboard.press('KeyE');
}
async function frames(page, prefix, offsets = [0, 70, 140]) {
  const evidence = [];
  for (let i = 0; i < offsets.length; i++) {
    if (i) await page.waitForTimeout(offsets[i] - offsets[i - 1]);
    const file = `${directory}/${prefix}-${i}.png`;
    await page.screenshot({ path: file });
    evidence.push({ file, capturedAt: new Date().toISOString(), state: await read(page) });
  }
  await writeFile(`${directory}/${prefix}-frames.json`, JSON.stringify(evidence, null, 2));
}

// CDP captures actual rendered frames without the latency of taking a separate
// full-page screenshot for every frame. This needs no external video encoder.
async function renderedBurst(page, prefix) {
  const cdp = await page.context().newCDPSession(page),
    pending = [],
    evidence = [];
  let count = 0,
    complete;
  const completed = new Promise((resolve) => {
    complete = resolve;
  });
  const listener = (frame) => {
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
    if (count >= 12) return;
    const file = `${directory}/${prefix}-frame-${String(count++).padStart(2, '0')}.jpg`;
    evidence.push({ file, timestamp: frame.metadata.timestamp });
    pending.push(writeFile(file, Buffer.from(frame.data, 'base64')));
    if (count === 12) complete();
  };
  cdp.on('Page.screencastFrame', listener);
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 960,
    maxHeight: 600,
    everyNthFrame: 1,
  });
  return async () => {
    // The software GPU can render fewer than twelve frames during a short
    // finishing blow. Keep the capture running through the recovery as well.
    await Promise.race([completed, page.waitForTimeout(2500)]);
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', listener);
    await Promise.all(pending);
    await writeFile(
      `${directory}/${prefix}-rendered-frames.json`,
      JSON.stringify(evidence, null, 2),
    );
    await cdp.detach();
  };
}

async function homeLayouts(page, prefix) {
  const evidence = [];
  for (const [layout, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['landscape', { width: 844, height: 390 }],
    ['portrait', { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const panel = page.locator('.home-panel');
    await panel.hover();
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(100);
    const intro = await page.locator('.intro').boundingBox(),
      actions = await page.locator('#home-actions').boundingBox();
    expect(
      intro.y + intro.height,
      `${layout}: heading and actions must not overlap`,
    ).toBeLessThanOrEqual(actions.y + 1);
    for (const id of ['draw-open', 'adventure', 'time-attack', 'library-open', 'ranking-open']) {
      const button = page.locator(`#${id}`);
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await button.boundingBox(),
        pane = await panel.boundingBox();
      expect(box.y, `${layout}: ${id} must be visible inside its panel`).toBeGreaterThanOrEqual(
        pane.y - 1,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(pane.y + pane.height + 1);
    }
    const file = `${directory}/${prefix}-${layout}.png`;
    await page.screenshot({ path: file });
    evidence.push({ layout, viewport, intro, actions, file });
  }
  await writeFile(`${directory}/${prefix}-layout.json`, JSON.stringify(evidence, null, 2));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(180);
}

test('action home miss hit buffered combo and hold', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await homeLayouts(page, 'action-home-layout');
  await walk(page, { x: 0, z: 3.5 });
  const empty = await read(page),
    missId = newestId(empty);
  await page.keyboard.press('KeyE');
  await eventSince(page, missId, 'swing');
  await frames(page, 'action-home-miss');
  await page.waitForFunction(() => !window.__qa.state().combat.attacking);
  const missed = await read(page);
  expect(missed.practiceHits).toBe(empty.practiceHits);
  expect(missed.position.z).toBeGreaterThan(2.5);

  await walk(page, { x: 0, z: -1.15 });
  await page.waitForTimeout(1100);
  const first = await read(page),
    firstId = newestId(first);
  // Distinct very short taps may land in adjacent fixed updates. The second
  // tap must stay buffered even when no action=false tick occurs in between.
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    (id) =>
      window.__qa
        .state()
        .combatEvents.some((e) => e.id > id && e.type === 'swing' && e.combo === 2),
    firstId,
  );
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    (id) =>
      window.__qa
        .state()
        .combatEvents.some((e) => e.id > id && e.type === 'swing' && e.combo === 3),
    firstId,
  );
  const finishBurst = await renderedBurst(page, 'action-home-finish');
  await eventSince(page, firstId, 'hit', 'practice');
  await frames(page, 'action-home-finish');
  await finishBurst();
  await page.waitForFunction(() => !window.__qa.state().combat.attacking);
  const combo = await read(page),
    swings = combo.combatEvents.filter((e) => e.id > firstId && e.type === 'swing');
  expect(swings.map((e) => e.combo)).toEqual([1, 2, 3]);
  expect(combo.practiceHits - first.practiceHits).toBe(3);
  expect(
    combo.combatEvents.filter((e) => e.id > firstId && e.type === 'hit').map((e) => e.combo),
  ).toEqual([1, 2, 3]);
  const holdId = newestId(combo);
  await page.keyboard.down('KeyE');
  await eventSince(page, holdId, 'swing');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyE');
  expect(
    (await read(page)).combatEvents.filter((e) => e.id > holdId && e.type === 'swing'),
  ).toHaveLength(1);
  // Walk beyond the dummy while facing north. It is now the closest target but
  // behind the character, so assist must not turn the next attack around.
  await walk(page, { x: 0, z: -3.7 });
  const behind = await read(page),
    behindId = newestId(behind);
  await page.keyboard.press('KeyE');
  const forward = await eventSince(page, behindId, 'swing');
  expect(forward.facing.z).toBeLessThan(-0.9);
  await frames(page, 'action-home-back-target-miss');
  await page.waitForFunction(() => !window.__qa.state().combat.attacking);
  expect((await read(page)).practiceHits).toBe(behind.practiceHits);
  expect(errors).toEqual([]);
  expect(browserErrors.get(page)).toEqual([]);
});

test('action dog dragon air attacks and mobile simultaneous controls', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const kind of ['dog', 'dragon']) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#draw-open').click();
    await page.getByLabel('下絵', { exact: true }).selectOption(kind);
    await page.locator('#character-name').fill(`ACTION-${kind}`);
    await page.locator('[data-do="birth"]').click();
    await expect(page.locator('#save-status')).toContainText('保存しました');
    await page.waitForFunction(() => window.__qa.state().grounded);
    await page.waitForTimeout(1200);
    if (kind === 'dragon') await homeLayouts(page, 'action-birth-layout');
    await walk(page, { x: 0, z: -1.15 });
    const before = await read(page),
      id = newestId(before);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.__qa.state().grounded);
    const airBurst = await renderedBurst(page, `action-${kind}-air`);
    await page.keyboard.press('KeyE');
    const swing = await eventSince(page, id, 'swing');
    expect(swing.airborne).toBe(true);
    const hit = await eventSince(page, id, 'hit', 'practice');
    expect(hit.airborne).toBe(true);
    await frames(page, `action-${kind}-air`);
    await airBurst();
    await page.waitForFunction(
      () => window.__qa.state().grounded && !window.__qa.state().combat.attacking,
    );
    expect((await read(page)).practiceHits).toBe(before.practiceHits + 1);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(180);
  const cdp = await page.context().newCDPSession(page),
    stick = await page.locator('#stick').boundingBox(),
    jump = await page.locator('#jump').boundingBox(),
    action = await page.locator('#action').boundingBox(),
    before = await read(page),
    id = newestId(before),
    touchPoints = [
      { id: 1, x: stick.x + stick.width * 0.65, y: stick.y + stick.height / 2 },
      { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
      { id: 3, x: action.x + action.width / 2, y: action.y + action.height / 2 },
    ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await page.waitForFunction((jumps) => window.__qa.state().jumps > jumps, before.jumps);
  const simultaneous = await eventSince(page, id, 'swing');
  await frames(page, 'action-mobile-simultaneous', [0, 60]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(simultaneous.airborne, 'JUMP + ACTION in the same tick should use the air move').toBe(
    true,
  );
  const moved = await read(page);
  expect(moved.position.x).toBeGreaterThan(before.position.x);
  await page.waitForTimeout(1500);
  expect(
    (await read(page)).combatEvents.filter((e) => e.id > id && e.type === 'swing'),
  ).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(browserErrors.get(page)).toEqual([]);
});

test('action field enemy recoil boss block hit and camera movement', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.locator('#adventure').click();
  await page.locator('[data-stage="1"]').click();
  await page.waitForFunction(() => window.__qa.state().grounded);
  const cameraBefore = await read(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press('KeyQ');
  expect((await read(page)).camera.intentYaw).toBeCloseTo(0.64, 2);
  await page.waitForFunction(() => Math.abs(window.__qa.state().camera.yaw - 0.64) < 0.1);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const cameraAfter = await read(page);
  expect(cameraAfter.position.x).toBeLessThan(cameraBefore.position.x - 0.3);
  expect(cameraAfter.position.z).toBeLessThan(cameraBefore.position.z - 0.3);
  await page.mouse.move(640, 430);
  await page.mouse.down();
  await page.mouse.move(790, 390, { steps: 10 });
  await page.mouse.up();
  expect((await read(page)).camera.intentYaw).toBeLessThan(0);
  await page.waitForFunction(() => window.__qa.state().camera.yaw < 0);
  await page.screenshot({ path: `${directory}/action-camera-orbit.png` });
  await page.keyboard.press('KeyC');
  expect((await read(page)).camera.intentYaw).toBe(0);
  await page.waitForFunction(() => Math.abs(window.__qa.state().camera.yaw) < 0.1);

  await walk(page, { x: -10, z: -6 });
  const index = 1;
  await walk(
    page,
    (s) => ({ x: s.field.enemies[index].x, z: s.field.enemies[index].z + 1.65 }),
    0.35,
  );
  const enemyBefore = await read(page),
    enemyId = newestId(enemyBefore);
  const enemyBurst = await renderedBurst(page, 'action-enemy-impact');
  await aimedAttack(page, (s) => s.field.enemies[index]);
  await eventSince(page, enemyId, 'hit', `enemy:${index}`);
  await frames(page, 'action-enemy-impact');
  await enemyBurst();
  const enemyAfter = await read(page),
    a = enemyBefore.field.enemies[index],
    b = enemyAfter.field.enemies[index];
  expect(b.hp).toBeLessThan(a.hp);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.08);
  for (let i = 0; i < 5 && (await read(page)).field.enemies[index].hp > 0; i++) {
    await walk(
      page,
      (s) => ({ x: s.field.enemies[index].x, z: s.field.enemies[index].z + 1.65 }),
      0.4,
    );
    const defeatBurst = await renderedBurst(page, 'action-enemy-defeat');
    await aimedAttack(page, (s) => s.field.enemies[index]);
    await page.waitForTimeout(450);
    await defeatBurst();
  }
  await eventSince(page, enemyId, 'defeat', `enemy:${index}`);
  await page.screenshot({ path: `${directory}/action-enemy-defeat.png` });

  await walk(page, { x: -5, z: -30 });
  await walk(page, { x: FIELD_STAGE.boss.x + 2.8, z: FIELD_STAGE.boss.z });
  await page.waitForFunction(() =>
    ['guard', 'windup'].includes(window.__qa.state().field.bossPhase),
  );
  const blockedBefore = await read(page),
    blockedId = newestId(blockedBefore);
  const blockBurst = await renderedBurst(page, 'action-boss-block');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  await page.keyboard.up('KeyA');
  await eventSince(page, blockedId, 'block', 'boss');
  await frames(page, 'action-boss-block');
  await blockBurst();
  expect((await read(page)).field.bossHP).toBe(blockedBefore.field.bossHP);
  await page.waitForFunction(() => window.__qa.state().field.bossPhase === 'rest');
  const bossBefore = await read(page),
    bossId = newestId(bossBefore);
  const bossBurst = await renderedBurst(page, 'action-boss-impact');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  await page.keyboard.up('KeyA');
  await eventSince(page, bossId, 'hit', 'boss');
  await frames(page, 'action-boss-impact');
  await bossBurst();
  expect((await read(page)).field.bossHP).toBeLessThan(bossBefore.field.bossHP);
  expect((await read(page)).deaths).toBe(0);
  expect(errors).toEqual([]);
  expect(browserErrors.get(page)).toEqual([]);
});
