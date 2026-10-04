import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course, insideZone, windPhase } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
before(initPhysics);
test('collapse countdown is never hidden by a collectible notification', () => {
  const stage = STAGES[3],
    p = stage.platforms[1];
  const c = new Course(
    { ...stage, spawn: { x: p.x, y: p.y + p.h / 2 + 0.82, z: p.z } },
    { hp: 100 },
  );
  for (let i = 0; i < 10; i++) c.step({});
  c.notice = 'HP +8';
  c.noticeUntil = 100;
  assert.match(c.guidance(), /崩壊まで/);
  c.dispose();
});
test('wind/water stay in their visible volumes and wind has a useful calm window', () => {
  const wind = STAGES[1].winds[0];
  const center = (wind.minZ + wind.maxZ) / 2;
  assert.ok(insideZone({ x: wind.x, y: 1, z: center }, wind));
  assert.ok(!insideZone({ x: wind.x + wind.width, y: 1, z: center }, wind));
  assert.ok(!insideZone({ x: wind.x, y: wind.maxY + 1, z: center }, wind));
  assert.equal(windPhase(wind, 4).name, '凪');
  assert.equal(windPhase(wind, 6.5).name, '予兆');
  assert.ok(windPhase(wind, 1).force > windPhase(wind, 4).force * 10);
  const c = new Course(STAGES[2], { hp: 100 }),
    water = STAGES[2].waters[0],
    z = (water.minZ + water.maxZ) / 2;
  c.sim.body.setTranslation({ x: water.x, y: 0.8, z }, true);
  assert.ok(c.environment().water);
  c.sim.body.setTranslation({ x: water.x + water.width, y: 0.8, z }, true);
  assert.ok(!c.environment().water);
  c.sim.body.setTranslation({ x: water.x, y: 4, z }, true);
  assert.ok(!c.environment().water);
  c.dispose();
});
test('every checkpoint center is outside enemy and boss attack areas', () => {
  for (const stage of STAGES)
    for (const index of stage.checkpoints) {
      const p = stage.platforms[index];
      for (const h of stage.enemies || []) assert.ok(Math.hypot(p.x - h.x, p.z - h.z) > 3);
      assert.ok(Math.hypot(p.x - stage.boss.x, p.z - stage.boss.z) > (stage.boss.radius || 6) + 1);
    }
});
