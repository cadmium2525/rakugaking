import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
import { driveField } from './helpers/field-driver.js';

before(initPhysics);
const builds = [
  { speed: 4.3, jump: 7.5, weight: 2.6, hp: 1000 },
  { speed: 7.5, jump: 10, weight: 0.7, hp: 1000 },
];
const loops = {
  2: [
    [-38, -3],
    [-49, -18],
    [-52, -38],
    [-37, -55],
    [-10, -55],
    [20, -56],
    [42, -61],
    [53, -45],
    [57, -31],
    [42, -9],
    [0, 10],
  ],
  3: [
    [-43, -2],
    [-54, -20],
    [-55, -42],
    [-32, -53],
    [0, -48],
    [32, -55],
    [51, -47],
    [57, -29],
    [44, -7],
    [0, 10],
  ],
  4: [
    [-44, -7],
    [-54, -29],
    [-51, -45],
    [-32, -56],
    [0, -47],
    [36, -53],
    [53, -42],
    [57, -30],
    [48, -18],
    [42, 4],
    [0, 10],
  ],
  5: [
    [-45, -7],
    [-54, -24],
    [-53, -43],
    [-34, -55],
    [-16, -48],
    [15, -47],
    [35, -64],
    [53, -55],
    [57, -36],
    [43, -13],
    [0, 10],
  ],
};
function walk(c, points, limit = 14000, digital = false) {
  let index = 0;
  for (let i = 0; i < limit; i++) {
    const p = c.sim.position,
      [x, z] = points[index];
    if (Math.hypot(x - p.x, z - p.z) < 0.65) {
      if (++index === points.length) return;
      continue;
    }
    const dx = x - p.x,
      dz = z - p.z;
    c.step(
      digital
        ? { x: dx > 0.45 ? 1 : dx < -0.45 ? -1 : 0, z: dz > 0.45 ? 1 : dz < -0.45 ? -1 : 0 }
        : { x: dx, z: dz },
    );
  }
  assert.fail(JSON.stringify({ stage: c.stage.id, waypoint: points[index], p: c.sim.position }));
}
function insideBoundary(path, x, z) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const [ax, az] = path[i],
      [bx, bz] = path[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
test('city fountain park offers walkable detours and solid visible furniture', () => {
  const stage = STAGES[3];
  for (const stats of builds)
    for (const digital of [false, true]) {
      const c = new Course(stage, stats);
      walk(
        c,
        [
          [-30, 4],
          [-42, 3],
          [-48, -6],
          [-54, -29],
          [-51, -45],
          [-32, -56],
          [0, -47],
          [36, -53],
          [53, -42],
          [55, -45],
          [56, -48],
          [57, -49],
        ],
        14000,
        digital,
      );
      for (let i = 0; i < 180; i++) c.step({ x: 1 });
      assert.ok(c.sim.position.x < 58, 'the stone basin really stops the body');
      walk(
        c,
        [
          [57, -43],
          [60, -41],
          [66, -40],
          [64, -32],
          [57, -30],
          [48, -18],
          [42, 4],
          [0, 10],
        ],
        14000,
        digital,
      );
      assert.ok(c.collected.has(11) && c.collected.has(12), 'park walk retains its two HP rewards');
      assert.equal(c.sim.jumps, 0);
      assert.equal(c.sim.deaths, 0);
      c.dispose();
    }
});
test('sky ridge colonnade is walkable, rewards detouring, and cannot bypass the locked goal', () => {
  const stage = STAGES[4];
  for (const stats of builds) {
    const c = new Course(stage, stats);
    walk(c, [[38, 2], [57, -36], [53, -55], ...stage.causeway.slice(1), [0, -78]], 16000);
    assert.ok(
      c.collected.has(7) && c.collected.has(8),
      'ridge detour collects two real HP fragments',
    );
    assert.equal(c.sim.jumps, 0, 'the raised ridge can be crossed on foot');
    assert.equal(c.sim.deaths, 0);
    assert.equal(c.complete, false, 'entering from the north cannot skip the three medals');
    assert.equal(c.activated, false);
    assert.ok(c.sim.platforms[stage.platforms.indexOf(stage.gate)].isEnabled());
    walk(c, [
      [8, -84],
      [8, -69],
      [22, -69],
      [22, -50],
      [0, -47],
    ]);
    driveField(c, 26000);
    assert.ok(
      c.complete,
      'all real missions, reward pickups and final goal still work after the detour',
    );
    assert.equal(c.field.rewards.size, 3);
    assert.equal(c.sim.deaths, 0);
    c.dispose();
  }
});
for (const stage of STAGES.filter((s) => s.expedition)) {
  test(`field ${stage.id}: both bodies walk a full western/eastern loop and collect lookout rewards`, () => {
    for (const stats of builds) {
      const c = new Course(stage, stats);
      walk(c, loops[stage.id]);
      for (let i = 9; i < stage.collectibles.length; i++)
        assert.ok(c.collected.has(i), `stage ${stage.id} missed optional reward ${i}`);
      assert.equal(c.sim.jumps, 0, 'open field loops are walkable without forced jumps');
      assert.equal(c.sim.deaths, 0);
      assert.ok(stage.overlooks.every((o) => stage.height(o.x, o.z) > 3));
      c.dispose();
    }
  });
  test(`field ${stage.id}: a heavy body can cross the southern meadow outside marked roads`, () => {
    const c = new Course(
      { ...stage, spawn: { x: -58, y: stage.height(-58, 4) + 0.82, z: 4 } },
      builds[0],
    );
    walk(c, [[58, 4]], 2600);
    assert.equal(c.sim.jumps, 0);
    assert.equal(c.sim.deaths, 0);
    c.dispose();
  });
  test(`field ${stage.id}: both bodies cannot jump through any perimeter edge or bend`, () => {
    const path = stage.boundaryPath;
    for (const [x, z] of [
      [-72, -100],
      [72, -100],
      [-72, 36],
      [72, 36],
    ])
      assert.ok(insideBoundary(path, x, z), 'the original open field remains inside the fence');
    const probes = path.flatMap(([x, z], i) => {
      const [nx, nz] = path[(i + 1) % path.length];
      return [
        [x, z],
        [(x + nx) / 2, (z + nz) / 2],
      ];
    });
    for (const stats of builds)
      for (const [x, z] of probes) {
        const distance = Math.hypot(x, z + 32),
          dx = x / distance,
          dz = (z + 32) / distance,
          sx = x - dx * 1.5,
          sz = z - dz * 1.5;
        const c = new Course(
          { ...stage, spawn: { x: sx, y: stage.height(sx, sz) + 0.82, z: sz } },
          stats,
        );
        for (let i = 0; i < 180; i++) {
          c.step({ x: dx, z: dz, jump: i % 60 === 0 });
          const p = c.sim.position;
          assert.ok(insideBoundary(path, p.x, p.z), `escaped at ${x},${z}: ${JSON.stringify(p)}`);
          assert.ok(
            p.x > -78 && p.x < 78 && p.z > -106 && p.z < 42,
            'real terrain stays below the body',
          );
        }
        assert.equal(c.sim.deaths, 0);
        c.dispose();
      }
  });
}
