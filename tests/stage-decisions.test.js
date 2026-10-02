import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course, insideZone, windPhase } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
before(initPhysics);
function traverse(stage, route, stats, alternative = true) {
  const indexes = alternative
    ? [route.from, ...route.indices, route.to]
    : Array.from({ length: route.to - route.from + 1 }, (_, i) => route.from + i);
  const first = stage.platforms[indexes[0]],
    c = new Course(
      { ...stage, spawn: { x: first.x, y: first.y + first.h / 2 + 0.82, z: first.z } },
      stats,
    );
  let cursor = 1,
    wet = 0,
    wind = 0;
  for (let frame = 0; frame < 3600 && cursor < indexes.length; frame++) {
    const p = c.sim.position,
      current = stage.platforms[indexes[cursor - 1]],
      target = stage.platforms[indexes[cursor]];
    const dx = target.x - p.x,
      dz = target.z - p.z,
      len = Math.hypot(dx, dz);
    if (len < 0.65 && c.sim.grounded) {
      cursor++;
      continue;
    }
    const ux = dx / (len || 1),
      uz = dz / (len || 1);
    const edge = Math.min(
      Math.abs(ux) > 0.01
        ? (current.w / 2 - Math.sign(ux) * (p.x - current.x)) / Math.abs(ux)
        : Infinity,
      Math.abs(uz) > 0.01
        ? (current.d / 2 - Math.sign(uz) * (p.z - current.z)) / Math.abs(uz)
        : Infinity,
    );
    const entering = Math.max(Math.abs(dx) - target.w / 2, Math.abs(dz) - target.d / 2) < 1;
    const env = c.environment();
    wet += env.water ? 1 : 0;
    wind += env.windZ > 0 ? 1 : 0;
    c.step({
      x: Math.max(-1, Math.min(1, dx)),
      z: Math.max(-1, Math.min(1, dz)),
      jump: c.sim.grounded && (edge < 1 || (entering && target.y > current.y + 0.25)),
      action: frame % 20 === 0,
    });
    if (c.sim.deaths) break;
  }
  const result = { seconds: c.elapsed, wet, wind, stars: c.collected.size };
  assert.equal(
    c.sim.deaths,
    0,
    `${stage.id} ${route.name} fell at ${JSON.stringify(c.sim.position)}`,
  );
  assert.equal(
    cursor,
    indexes.length,
    `${stage.id} ${route.name} stuck at ${JSON.stringify(c.sim.position)}`,
  );
  c.dispose();
  return result;
}
test('every branch reaches its forward rejoin with light and heavy characters', () => {
  for (const stage of STAGES)
    for (const route of stage.routes || [])
      for (const stats of [
        { speed: 6, jump: 9, weight: 0.8, hp: 100 },
        { speed: 4.3, jump: 7.5, weight: 2.6, hp: 180 },
      ]) {
        const branch = traverse(stage, route, stats),
          main = traverse(stage, route, stats, false);
        if (stage.id === 2) {
          assert.equal(branch.wind, 0);
          assert.ok(main.wind > 0);
        }
        if (stage.id === 3) {
          assert.equal(branch.wet, 0);
          assert.ok(main.wet > 0);
          if (stats.weight < 1) assert.ok(main.seconds < branch.seconds);
          else assert.ok(branch.seconds < main.seconds);
        }
        assert.ok(branch.stars > 0);
        console.log(JSON.stringify({ stage: stage.id, weight: stats.weight, main, branch }));
      }
});
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
  assert.ok(insideZone({ x: wind.x, y: 1, z: -10 }, wind));
  assert.ok(!insideZone({ x: wind.x + wind.width, y: 1, z: -10 }, wind));
  assert.ok(!insideZone({ x: wind.x, y: wind.maxY + 1, z: -10 }, wind));
  assert.equal(windPhase(wind, 4).name, '凪');
  assert.equal(windPhase(wind, 6.5).name, '予兆');
  assert.ok(windPhase(wind, 1).force > windPhase(wind, 4).force * 10);
  const c = new Course(STAGES[2], { hp: 100 });
  c.sim.body.setTranslation({ x: 0, y: 0.8, z: -12 }, true);
  assert.ok(c.environment().water);
  c.sim.body.setTranslation({ x: 9, y: 0.8, z: -12 }, true);
  assert.ok(!c.environment().water);
  c.sim.body.setTranslation({ x: 0, y: 3, z: -12 }, true);
  assert.ok(!c.environment().water);
  c.dispose();
});
test('every checkpoint center is outside every guardian sweep', () => {
  for (const stage of STAGES)
    for (const index of stage.checkpoints) {
      const p = stage.platforms[index];
      for (const h of stage.hazards || [])
        assert.ok(Math.abs(p.z - h.z) > 1.5, `stage ${stage.id} checkpoint ${index}`);
    }
});
