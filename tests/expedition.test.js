import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
import { driveField, fieldControls } from './helpers/field-driver.js';
before(initPhysics);
for (const stage of STAGES.filter((s) => s.expedition)) {
  test(`expedition ${stage.id}: digital keyboard movement clears the field`, () => {
    const c = new Course(stage, { speed: 6, jump: 8.5, weight: 1, hp: 100 });
    for (let i = 0; i < 14000 && !c.complete; i++) {
      const a = fieldControls(
        { field: c.field.snapshot(), position: c.sim.position, grounded: c.sim.grounded },
        i,
        stage.missions.map((m) => m.id),
        stage,
      );
      a.x = Math.abs(a.x) > 0.1 ? Math.sign(a.x) : 0;
      a.z = Math.abs(a.z) > 0.1 ? Math.sign(a.z) : 0;
      c.step(a);
    }
    assert.ok(
      c.complete,
      JSON.stringify({ stage: stage.id, p: c.sim.position, f: c.field.snapshot() }),
    );
    assert.equal(c.sim.deaths, 0);
    c.dispose();
  });
  test(`expedition ${stage.id}: alternate mission orders, real collision and reward pickup`, () => {
    const ids = stage.missions.map((m) => m.id),
      orders = stage.boss.requires
        ? [ids, [ids[1], ids[0], ids[2]]]
        : [
            [ids[0], ids[1], ids[2]],
            [ids[1], ids[0], ids[2]],
            [ids[2], ids[1], ids[0]],
          ];
    for (const order of orders) {
      const c = new Course(stage, { speed: 4.3, jump: 7.5, weight: 2.6, hp: 180 });
      driveField(c, 24000, order);
      assert.ok(
        c.complete,
        JSON.stringify({ id: stage.id, order, p: c.sim.position, f: c.field.snapshot() }),
      );
      assert.equal(c.sim.deaths, 0);
      assert.equal(c.field.rewards.size, 3);
      assert.ok(!c.sim.platforms[stage.platforms.findIndex((p) => p.gate)].isEnabled());
      c.dispose();
    }
  });
  test(`expedition ${stage.id}: gate stays sealed and partial mission progress survives retry`, () => {
    const c = new Course(stage, { hp: 100 });
    const gate = stage.platforms.findIndex((p) => p.gate);
    c.sim.body.setTranslation({ ...stage.goal, y: stage.goal.y + 0.82 }, true);
    for (let i = 0; i < 150; i++) c.step({ action: i % 45 === 0 });
    assert.ok(!c.complete);
    assert.ok(c.sim.platforms[gate].isEnabled());
    c.field.runes.add(0);
    c.field.enemies[0] && (c.field.enemies[0].hp = 0);
    c.retry();
    assert.ok(c.field.runes.has(0));
    assert.equal(c.field.rewards.size, 0);
    c.dispose();
  });
}
test('windmill restoration actually reduces the physical wind', () => {
  const s = STAGES[1],
    c = new Course(s, { hp: 100 }),
    w = s.winds[0];
  c.sim.body.setTranslation({ x: w.x, y: 1, z: (w.minZ + w.maxZ) / 2 }, true);
  const before = c.environment().windZ;
  s.runes.forEach((r, i) => c.field.runes.add(i));
  assert.ok(c.environment().windZ < before * 0.1);
  c.dispose();
});
test('wind valley rest can be reached on foot from the canyon bridge', () => {
  const s = STAGES[1],
    c = new Course(
      { ...s, spawn: { x: 0, y: Math.max(0.4, s.height(0, -44)) + 0.82, z: -44 } },
      { speed: 4.3, jump: 7.5, weight: 2.6, hp: 180 },
    );
  const t = s.platforms[s.checkpoints[0]];
  for (let i = 0; i < 900 && c.checkpoint < 0; i++)
    c.step({
      x: Math.max(-1, Math.min(1, t.x - c.sim.position.x)),
      z: Math.max(-1, Math.min(1, t.z - c.sim.position.z)),
    });
  assert.equal(c.checkpoint, s.checkpoints[0]);
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
test('water switches enforce sequence and drain the actual water volume', () => {
  const s = STAGES[2],
    c = new Course(s, { hp: 100 }),
    switches = s.runes.filter((r) => r.mission === 'sluice');
  const at = (r) => {
    c.sim.body.setTranslation({ x: r.x, y: r.y + 0.82, z: r.z }, true);
    c.field.update(c, true);
  };
  at(switches[2]);
  assert.equal(c.field.runes.size, 0);
  for (const r of switches) at(r);
  assert.ok(c.field.done('sluice'));
  c.sim.body.setTranslation({ x: 25, y: 0.8, z: -27 }, true);
  assert.equal(c.environment().water, false);
  for (let i = 0; i < s.platforms[0].vertices.length; i += 3) {
    const v = s.platforms[0].vertices;
    if (Math.hypot(v[i] - 25, v[i + 2] + 27) < 16) assert.ok(s.waters[0].drainedSurface < v[i + 1]);
  }
  c.dispose();
});
test('north-rim jumping cannot pass through the reachable temple roof', () => {
  const s = STAGES[2],
    c = new Course(s, { speed: 6, jump: 8.5, weight: 1, hp: 100 }),
    roof = s.platforms.find((p) => p.w === 18 && p.h === 0.8);
  const points = [
    [15, -76],
    [15, -86],
    [0, -86],
    [0, -82],
  ];
  let index = 0,
    contact = false;
  for (let i = 0; i < 2200; i++) {
    const p = c.sim.position,
      [x, z] = points[index];
    if (Math.hypot(p.x - x, p.z - z) < 0.5 && index < points.length - 1) index++;
    c.step({ x: x - p.x, z: z - p.z, jump: i % 48 === 0 });
    if (
      Math.abs(p.x) < 8.5 &&
      p.z > -85.5 &&
      p.z < -69 &&
      Math.abs(p.y - (roof.y - 0.4 - 0.82)) < 0.05
    )
      contact = true;
    assert.ok(
      !(Math.abs(p.x) < 8.5 && p.z > -85.5 && p.z < -69 && Math.abs(p.y - roof.y) < 0.35),
      'character passed through roof',
    );
  }
  assert.ok(contact);
  for (let i = 0; i < 220; i++) c.step({ x: 1 });
  assert.ok(c.sim.position.x > 10, 'character can leave the underside of the roof');
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
test('aqueduct upper beams block a jumping character approaching from the west rim', () => {
  const s = STAGES[2],
    c = new Course(s, { speed: 7.5, jump: 10, weight: 1, hp: 100 });
  let approach = false,
    blocked = false;
  for (let i = 0; i < 1600; i++) {
    const p = c.sim.position,
      x = approach ? -38 : -44.5,
      z = -20;
    if (!approach && Math.hypot(p.x + 44.5, p.z + 20) < 0.5) approach = true;
    c.step({ x: x - p.x, z: z - p.z, jump: i % 48 === 0 });
    for (const b of s.platforms.filter((p) => p.w === 2.5 && p.h === 0.8))
      if (
        Math.abs(p.z - b.z) < b.d / 2 - 0.35 &&
        p.y + 0.8 > b.y - b.h / 2 &&
        p.y - 0.8 < b.y + b.h / 2
      ) {
        assert.ok(
          p.x <= b.x - b.w / 2 - 0.34 || p.x >= b.x + b.w / 2 + 0.34,
          'capsule penetrated aqueduct beam',
        );
        if (approach) blocked = true;
      }
  }
  assert.ok(blocked);
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
test('city lamp relay expires cleanly and restarts from its first ring', () => {
  const s = STAGES[3],
    c = new Course(s, { hp: 100 }),
    r = s.runes[0];
  c.sim.body.setTranslation({ x: r.x, y: r.y + 0.82, z: r.z }, true);
  c.field.update(c, false);
  assert.ok(c.field.runes.has(0));
  assert.match(c.field.progress('lamps'), /残り/);
  c.elapsed = 4;
  c.field.update(c, false);
  c.noticeUntil = 0;
  assert.match(c.guidance(), /残り.*次は2番/);
  c.elapsed = 31;
  c.sim.body.setTranslation(s.spawn, true);
  c.field.update(c, false);
  assert.equal(c.field.runes.size, 0);
  assert.ok(!c.field.chains.has('lamps'));
  assert.match(c.notice, /時間切れ/);
  c.sim.body.setTranslation({ x: r.x, y: r.y + 0.82, z: r.z }, true);
  c.field.update(c, false);
  assert.ok(c.field.runes.has(0));
  c.dispose();
});
test('final giant is shielded until both prerequisites and has two distinct shockwaves', () => {
  const s = STAGES[4],
    c = new Course(s, { hp: 200, power: 50 }),
    b = s.boss;
  c.sim.body.setTranslation({ x: b.x + 2.8, y: b.y + 0.82, z: b.z }, true);
  for (let i = 0; i < 600; i++) c.step({ action: i % 48 === 0 });
  assert.equal(c.field.bossHP, b.hp);
  assert.equal(c.field.bossPhase, 'shield');
  s.runes.forEach((r, i) => c.field.runes.add(i));
  c.field.enemies.forEach((e) => {
    e.hp = 0;
  });
  let waves = 0,
    previous = '';
  for (let i = 0; i < 570; i++) {
    c.field.update(c, false);
    if (c.field.bossPhase === 'slam' && previous !== 'slam') waves++;
    previous = c.field.bossPhase;
  }
  assert.equal(waves, 2);
  c.dispose();
});
test('optional discoveries and bridge fragments are reachable by a slow heavy body', () => {
  const excursions = [
    {
      id: 2,
      points: [
        [-20, -19],
        [-32, -30],
        [-28, -38],
      ],
      star: 3,
    },
    {
      id: 3,
      points: [
        [25, -27],
        [34, -37],
      ],
      star: 4,
    },
    {
      id: 4,
      points: [
        [-26, -35],
        [-30, -38],
        [-35, -41],
      ],
      star: 1,
    },
    {
      id: 4,
      points: [
        [0, -30],
        [0, -38],
      ],
      star: 4,
    },
    {
      id: 5,
      points: [
        [26, -29],
        [37, -38],
        [37, -48],
        [32, -51],
      ],
      star: 4,
    },
    {
      id: 5,
      points: [
        [0, -30],
        [0, -39],
      ],
      star: 5,
    },
  ];
  for (const e of excursions) {
    const s = STAGES[e.id - 1],
      [x, z] = e.points[0],
      c = new Course(
        { ...s, spawn: { x, y: s.height(x, z) + 0.82, z } },
        { speed: 4.3, jump: 7.5, weight: 2.6, hp: 180 },
      );
    let index = 1;
    for (let i = 0; i < 2200 && !c.collected.has(e.star); i++) {
      const p = c.sim.position,
        [tx, tz] = e.points[index];
      if (Math.hypot(p.x - tx, p.z - tz) < 0.5 && index < e.points.length - 1) index++;
      c.step({ x: tx - p.x, z: tz - p.z, jump: c.sim.grounded && i % 24 === 0 });
    }
    assert.ok(
      c.collected.has(e.star),
      JSON.stringify({ id: e.id, star: e.star, p: c.sim.position }),
    );
    assert.equal(c.sim.deaths, 0);
    c.dispose();
  }
});
test('observatory cone roof has physical contact during a jump from the west rim', () => {
  const s = STAGES[4],
    c = new Course(
      { ...s, spawn: { x: -46, y: s.height(-46, -24) + 0.82, z: -24 } },
      { speed: 7.5, jump: 10, weight: 1, hp: 100 },
    );
  const roof = s.platforms.findIndex((p) => p.x === -36 && p.hull);
  for (let i = 0; i < 10; i++) c.step({});
  let contacts = 0;
  for (let i = 0; i < 240; i++) {
    c.step({ x: 1, jump: i % 48 === 0 });
    for (let j = 0; j < c.sim.controller.numComputedCollisions(); j++)
      if (c.sim.controller.computedCollision(j)?.collider.handle === c.sim.platforms[roof].handle)
        contacts++;
  }
  assert.ok(contacts > 0);
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
