import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { FIELD_STAGE as stage } from '../src/game/field-stage.js';
import { driveField } from './helpers/field-driver.js';
import { fieldHeight } from '../src/game/field-terrain.js';
before(initPhysics);
const stats = { speed: 6, jump: 8.5, weight: 1, hp: 100, power: 20, defense: 12 };
test('west hillside and cave reward are reached through movement and jumping without teleportation', () => {
  for (const route of [
    [
      [0, -8],
      [-21, -18],
      [-25, -29],
      [-29, -36],
      [-29, -41],
    ],
    [
      [-18, 0],
      [-31, -3],
      [-31, -8],
    ],
  ]) {
    const c = new Course(stage, { ...stats, speed: 4.3, jump: 7.5, weight: 2.6 });
    let cursor = 0;
    for (let i = 0; i < 6000 && cursor < route.length; i++) {
      const [x, z] = route[cursor],
        p = c.sim.position,
        dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz);
      if (d < 0.45 && c.sim.grounded) {
        cursor++;
        continue;
      }
      c.step({
        x: dx / (d || 1),
        z: dz / (d || 1),
        jump: c.sim.grounded && cursor === route.length - 1 && z === -41 && d < 5,
      });
    }
    assert.equal(cursor, route.length, JSON.stringify(c.sim.position));
    assert.equal(c.sim.deaths, 0);
    const target = route.at(-1);
    assert.ok(c.sim.position.y > fieldHeight(...target) + 0.6);
    assert.ok(c.collected.has(target[1] === -41 ? 6 : 7));
    assert.ok(c.field.discovered.has(target[1] === -41 ? 'lookout' : 'cave'));
    c.dispose();
  }
});
test('sealed gate blocks walking until all emblems have been collected', () => {
  const c = new Course({ ...stage, spawn: { x: 0, y: 0.82, z: -61 } }, stats);
  for (let i = 0; i < 100; i++) c.step({ z: -1 });
  assert.ok(c.sim.position.z > -65);
  c.field.rewards = new Set(['orchard', 'ruins', 'boss']);
  for (let i = 0; i < 100 && !c.complete; i++) c.step({ z: -1 });
  assert.ok(c.complete);
  c.dispose();
});
test('ruin stone steps reward is attainable with the slow heavy build using movement and jump', () => {
  const c = new Course(stage, { ...stats, speed: 4.3, jump: 7.5, weight: 2.6 });
  const route = [
    [0, -8],
    [13, -15],
    [27, -20],
    [31, -23],
    [31, -27],
  ];
  let cursor = 0;
  for (let i = 0; i < 6000 && !c.collected.has(8); i++) {
    const [x, z] = route[cursor],
      p = c.sim.position,
      dx = x - p.x,
      dz = z - p.z,
      d = Math.hypot(dx, dz);
    if (cursor < route.length - 1 && d < 0.5 && c.sim.grounded) {
      cursor++;
      continue;
    }
    c.step({
      x: dx / (d || 1),
      z: dz / (d || 1),
      jump: cursor === route.length - 1 && c.sim.grounded,
    });
  }
  assert.ok(c.collected.has(8), JSON.stringify(c.sim.position));
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
test('field gate cannot be opened by reaching it or repeatedly attacking it', () => {
  const c = new Course({ ...stage, spawn: { x: 0, y: 0.82, z: -65 } }, stats);
  for (let i = 0; i < 300; i++) c.step({ action: i % 48 === 0 });
  assert.equal(c.complete, false);
  assert.equal(c.activated, false);
  assert.equal(c.field.rewards.size, 0);
  c.dispose();
});
test('missions require pickup, survive retry, and can be completed in any order', () => {
  const c = new Course(stage, stats);
  c.field.runes = new Set([0, 1, 2]);
  c.step({});
  assert.equal(c.field.done('ruins'), true);
  assert.equal(c.field.rewards.size, 0);
  const r = stage.missions[1].reward;
  c.sim.body.setTranslation(r, true);
  c.step({});
  assert.ok(c.field.rewards.has('ruins'));
  assert.equal(c.activated, false);
  c.field.enemies.forEach((e) => (e.hp = 0));
  c.field.bossHP = 0;
  c.retry();
  assert.equal(c.field.bossHP, 0);
  assert.equal(c.field.runes.size, 3);
  assert.ok(c.field.rewards.has('ruins'));
  for (const i of [2, 0]) {
    c.sim.body.setTranslation(stage.missions[i].reward, true);
    c.step({});
  }
  assert.equal(c.activated, true);
  c.dispose();
});
test('boss shield, recovery window, telegraph and jump avoidance are functional', () => {
  for (const height of [0.82, 2.2]) {
    const c = new Course(
      { ...stage, spawn: { x: stage.boss.x + 2.8, y: height, z: stage.boss.z } },
      stats,
    );
    c.step({ action: true });
    assert.equal(c.field.bossHP, 150);
    c.field.bossTime = 3.2;
    c.field.slamHit = false;
    c.field.update(c, false);
    assert.equal(c.hp < 100, height < 1.6);
    c.field.bossTime = 4;
    c.field.update(c, true);
    assert.equal(c.field.bossHP, 130);
    c.dispose();
  }
});
test('continuous field is traversable and all missions unlock the actual goal with normal input', () => {
  const c = new Course(stage, stats);
  driveField(c);
  assert.ok(c.complete, JSON.stringify({ p: c.sim.position, field: c.field.snapshot() }));
  assert.equal(c.sim.deaths, 0);
  assert.equal(c.field.rewards.size, 3);
  c.dispose();
});
test('all six mission orders are achievable using movement and action input', () => {
  for (const first of ['orchard', 'ruins', 'boss']) {
    const rest = ['orchard', 'ruins', 'boss'].filter((id) => id !== first);
    for (const tail of [rest, [...rest].reverse()]) {
      const c = new Course(stage, stats),
        order = [first, ...tail];
      driveField(c, 24000, order);
      assert.ok(
        c.complete,
        JSON.stringify({ order, state: c.field.snapshot(), position: c.sim.position }),
      );
      assert.equal(c.sim.deaths, 0);
      c.dispose();
    }
  }
});
