import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
import { driveField } from './helpers/field-driver.js';
before(initPhysics);
const builds = {
  STANDARD: { speed: 6, jump: 8.5, weight: 1, hp: 100 },
  HEAVY: { speed: 4.3, jump: 7.5, weight: 2.6, hp: 180 },
  SPEED: { speed: 7.5, jump: 8, weight: 0.8, hp: 90 },
  JUMP: { speed: 5.5, jump: 10, weight: 1, hp: 110 },
  POWER: { speed: 5, jump: 8, weight: 1.8, hp: 130 },
  EXTREME: { speed: 4.3, jump: 7.5, weight: 0.7, hp: 80 },
};
export function drive(course) {
  if (course.field) return driveField(course);
  let index = 0;
  for (let frame = 0; frame < 12000 && !course.complete; frame++) {
    const p = course.sim.position,
      tiles = course.stage.platforms.slice(0, course.stage.routeLength);
    while (
      index < tiles.length - 1 &&
      p.z < tiles[index + 1].z + tiles[index + 1].d / 2 - 0.5 &&
      course.sim.grounded
    )
      index++;
    const current = tiles[index],
      target = tiles[Math.min(index + 1, tiles.length - 1)];
    const nearEdge = p.z - current.z + current.d / 2 < 1;
    course.step({
      x: Math.max(-0.6, Math.min(0.6, (target.x - p.x) * 0.8)),
      z: index === tiles.length - 1 && p.z < course.stage.goal.z + 0.7 ? 0 : -1,
      jump: nearEdge && index < tiles.length - 1 && course.sim.grounded,
      action: frame % 12 === 0,
    });
    if (course.sim.deaths) index = 0;
  }
  return { time: course.elapsed, deaths: course.sim.deaths };
}
for (const stage of STAGES)
  test(`stage ${stage.id}: all six builds reach goal twice`, () => {
    const report = [];
    for (const [name, stats] of Object.entries(builds))
      for (let run = 0; run < 2; run++) {
        const c = new Course(stage, stats),
          result = drive(c);
        assert.ok(c.complete, `${name} failed at ${JSON.stringify(c.sim.position)}`);
        assert.equal(result.deaths, 0, `${name} fell`);
        report.push({ name, ...result });
        c.dispose();
      }
    console.log(JSON.stringify({ stage: stage.id, runs: report }));
  });
test('returning from result never emits another clear reward event', () => {
  const c = new Course(STAGES[0], builds.STANDARD);
  drive(c);
  for (let i = 0; i < 120; i++) assert.notEqual(c.step({}), 'complete');
  c.dispose();
});

test('checkpoint survives a fall and collected fragments cannot be counted twice', () => {
  const stage = STAGES[1],
    index = stage.checkpoints[0],
    p = stage.platforms[index];
  const c = new Course(
    { ...stage, spawn: { x: p.x, y: p.y + p.h / 2 + 0.82, z: p.z } },
    builds.STANDARD,
  );
  for (let i = 0; i < 10; i++) c.step({});
  assert.equal(c.checkpoint, index);
  const spawn = { ...c.sim.spawn };
  c.sim.body.setTranslation({ x: 0, y: -15, z: 0 }, true);
  c.step({});
  assert.ok(Math.abs(c.sim.position.z - spawn.z) < 0.1);
  const item = stage.collectibles[0];
  c.sim.body.setTranslation(item, true);
  c.step({});
  const count = c.collected.size;
  c.step({});
  assert.equal(c.collected.size, count);
  assert.ok(count > 0);
  c.dispose();
});
test('collapsing platforms remove collision and retry restores it', () => {
  const original = STAGES.find((s) => s.id === 4);
  if (!original) return;
  const t = original.platforms[1];
  const stage = { ...original, spawn: { x: t.x, y: t.y + t.h / 2 + 0.82, z: t.z } };
  const c = new Course(stage, builds.STANDARD);
  for (let i = 0; i < 180; i++) c.step({});
  assert.equal(c.sim.platforms[1].isEnabled(), false);
  c.retry();
  assert.equal(c.sim.platforms[1].isEnabled(), true);
  assert.ok(c.collapseTimes.every((t) => t === null));
  assert.ok(c.elapsed > 0);
  c.dispose();
});
test('power opens seals with fewer actions; defense reduces hazard damage', () => {
  const tower = {
    field: false,
    requiresAction: true,
    platforms: [{ x: 0, y: -1, z: 0, w: 20, h: 2, d: 20 }],
    goal: { x: 0, y: 0, z: 0 },
    spawn: { x: 0, y: 0.82, z: 0 },
    hazards: [{ x: 0, y: 0.82, z: 0 }],
    checkpoints: [],
    collectibles: [],
  };
  for (const power of [10, 50]) {
    const c = new Course(
      {
        ...tower,
        sealHP: 55,
        hazards: [],
        spawn: { x: tower.goal.x, y: tower.goal.y + 0.82, z: tower.goal.z },
      },
      { ...builds.STANDARD, power },
    );
    for (let i = 0; i < 2; i++) {
      c.step({ action: true });
      for (let n = 0; n < 45; n++) c.step({});
    }
    assert.equal(c.complete, power === 50);
    c.dispose();
  }
  const losses = [];
  for (const defense of [5, 25]) {
    const c = new Course(
      { ...tower, spawn: { ...tower.hazards[0] } },
      { ...builds.STANDARD, defense },
    );
    c.step({});
    losses.push(100 - c.hp);
    c.dispose();
  }
  assert.ok(losses[0] > losses[1]);
});
