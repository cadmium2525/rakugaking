import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, DT } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { STAR_STAGE } from '../src/game/star-stage.js';

before(initPhysics);

// Isolated rule fixtures position the player or arrange defeated guards below.
// Movement casts, the lantern collider, and terrain are real; this file does not
// substitute for the separate browser test that defeats every wave with ACTION.
function fixture(extraPlatforms = []) {
  const original = STAR_STAGE.missions.find((m) => m.type === 'defense'),
    mission = {
      ...original,
      waveSize: 2,
      waveDelay: 1,
      beaconHP: 100,
      beaconDamage: 12,
      enemyHP: 35,
      enemies: [
        [original.x, original.z - 6.4],
        [original.x, original.z + 6.4],
        [original.x - 6.4, original.z],
        [original.x + 6.4, original.z],
        [original.x - 4.525, original.z - 4.525],
        [original.x + 4.525, original.z + 4.525],
      ],
    },
    stage = {
      ...STAR_STAGE,
      missions: STAR_STAGE.missions.map((m) => (m.id === original.id ? mission : m)),
      enemies: mission.enemies.map(([x, z]) => ({ x, z, hp: 35, mission: mission.id })),
      platforms: [...STAR_STAGE.platforms, ...extraPlatforms],
    },
    course = new Course(stage, { hp: 180 });
  return { course, mission, defense: course.field.defenses.get(mission.id) };
}
function at(course, x, z) {
  course.sim.body.setTranslation({ x, y: course.stage.height(x, z) + 0.82, z }, true);
}
function tick(course, count = 1) {
  for (let frame = 0; frame < count; frame++) {
    course.elapsed += DT;
    course.field.update(course, false);
  }
}
function start(course, mission) {
  at(course, mission.x - 1.5, mission.z);
  course.field.update(course, true);
}
const aliveIndices = (course) =>
  course.field.enemies.flatMap((enemy, index) => (enemy.active && enemy.hp > 0 ? [index] : []));

test('leaving guards unattended physically damages the beacon and resets all attacks when it fails', () => {
  const { course, mission, defense } = fixture();
  try {
    start(course, mission);
    assert.deepEqual(aliveIndices(course), [0, 1]);
    at(course, mission.x + 8, mission.z);
    const playerHP = course.hp,
      originalDistance = Math.hypot(
        course.field.enemies[0].x - mission.x,
        course.field.enemies[0].z - mission.z,
      );
    tick(course, 60);
    assert.ok(
      Math.hypot(course.field.enemies[0].x - mission.x, course.field.enemies[0].z - mission.z) <
        originalDistance - 1,
      'the guards walk toward the beacon while the player stands elsewhere',
    );
    let damaged = false,
      sawWindup = false,
      sawFlash = false;
    for (let frame = 0; frame < 900 && defense.started; frame++) {
      tick(course);
      damaged ||= defense.hp < 100;
      sawWindup ||= course.field.enemies.some((enemy) => enemy.phase === 'windup');
      sawFlash ||= defense.hitUntil > course.elapsed;
    }
    assert.ok(damaged && sawWindup && sawFlash);
    assert.equal(
      course.hp,
      playerHP,
      'the attack damages the beacon rather than the remote player',
    );
    assert.equal(defense.started, false);
    assert.equal(defense.complete, false);
    assert.match(course.notice, /灯が消えた.*再挑戦/);
    assert.deepEqual(course.field.snapshot().defenses[mission.id], {
      started: false,
      elapsed: 0,
      complete: false,
      hp: 100,
      wave: 0,
      nextWaveAt: null,
      hitUntil: 0,
    });
    assert.ok(
      course.field.enemies.every(
        (enemy) =>
          !enemy.active &&
          enemy.hp === 35 &&
          enemy.phase === 'waiting' &&
          enemy.timer === 0 &&
          enemy.strikeUntil === 0,
      ),
      'a later guard cannot carry an old attack into the reset frame',
    );
    tick(course, 120);
    assert.equal(defense.hp, 100);
    assert.deepEqual(aliveIndices(course), []);
  } finally {
    course.dispose();
  }
});

test('an uncleared wave cannot advance, its one-second transition pauses outside the light, and the final kill completes immediately', () => {
  const { course, mission, defense } = fixture();
  try {
    start(course, mission);
    course.field.enemies[0].hp = 0;
    tick(course, 120);
    assert.equal(defense.wave, 1);
    assert.equal(defense.nextWaveAt, null);
    assert.deepEqual(aliveIndices(course), [1]);
    course.field.enemies[1].hp = 0;
    tick(course);
    assert.equal(defense.wave, 1);
    assert.equal(defense.nextWaveAt, defense.elapsed + 1);
    assert.match(course.field.progress(mission.id), /第1\/3波.*次波まで1.0秒/);
    at(course, mission.x + mission.radius + 1, mission.z);
    const paused = defense.elapsed;
    tick(course, 120);
    assert.equal(defense.elapsed, paused);
    assert.equal(defense.wave, 1);
    assert.match(course.guidance(), /計時停止/);
    at(course, mission.x - 1.5, mission.z);
    tick(course, 59);
    assert.equal(defense.wave, 1);
    tick(course);
    assert.equal(defense.wave, 2);
    assert.deepEqual(aliveIndices(course), [2, 3]);
    course.field.enemies[2].hp = 0;
    course.field.enemies[3].hp = 0;
    tick(course);
    tick(course, 60);
    assert.equal(defense.wave, 3);
    assert.deepEqual(aliveIndices(course), [4, 5]);
    assert.equal(defense.complete, false);
    course.field.enemies[4].hp = 0;
    course.field.enemies[5].hp = 0;
    tick(course);
    assert.equal(defense.complete, true, 'the final defeat requires no survival-time wait');
    assert.equal(defense.nextWaveAt, null);
    assert.ok(defense.elapsed < 5, `a fixed 20-second wait survived: ${defense.elapsed}`);
    const completed = { ...defense };
    course.retry();
    assert.deepEqual(defense, completed, 'completed defense state survives retry');
    course.field.resetDefense(mission);
    assert.deepEqual(defense, completed, 'an already completed defense cannot be reset');
  } finally {
    course.dispose();
  }
});

test('abandoning or retrying an unfinished wave resets beacon damage, wave delay, impacts and every guard', () => {
  const { course, mission, defense } = fixture();
  try {
    start(course, mission);
    Object.assign(defense, { hp: 64, nextWaveAt: 8, hitUntil: 100 });
    Object.assign(course.field.enemies[0], { hp: 5, stunUntil: 20, strikeUntil: 30, knockVX: 8 });
    at(course, mission.x + mission.radius + 2.1, mission.z);
    tick(course);
    assert.equal(defense.started, false);
    assert.equal(defense.hp, 100);
    assert.equal(defense.wave, 0);
    assert.equal(defense.nextWaveAt, null);
    assert.equal(defense.hitUntil, 0);
    assert.ok(
      course.field.enemies.every(
        (enemy) =>
          !enemy.active &&
          enemy.hp === 35 &&
          enemy.timer === 0 &&
          enemy.stunUntil === 0 &&
          enemy.strikeUntil === 0 &&
          enemy.knockVX === 0,
      ),
    );
    start(course, mission);
    assert.equal(defense.wave, 1);
    assert.deepEqual(aliveIndices(course), [0, 1]);
    defense.hp = 76;
    course.retry();
    assert.equal(defense.hp, 100);
    assert.equal(defense.started, false);
    assert.equal(defense.wave, 0);
    assert.deepEqual(aliveIndices(course), []);
  } finally {
    course.dispose();
  }
});

test('a real wall blocks the guard attack against the beacon even within its damage radius', () => {
  const m = STAR_STAGE.missions.find((mission) => mission.type === 'defense'),
    wall = {
      x: m.x + 1.2,
      y: STAR_STAGE.height(m.x + 1.2, m.z) + 1,
      z: m.z,
      w: 0.25,
      h: 2,
      d: 2,
    },
    { course, mission, defense } = fixture([wall]);
  try {
    start(course, mission);
    const guard = course.field.enemies[0];
    Object.assign(guard, { x: m.x + 2.2, z: m.z, phase: 'windup', timer: 0.94 });
    course.field.enemies[1].active = false;
    const point = course.field.defenseTarget(mission, guard);
    assert.equal(
      course.sim.lineClear(
        { x: guard.x, y: course.stage.height(guard.x, guard.z) + 0.8, z: guard.z },
        point,
      ),
      false,
    );
    tick(course, 240);
    assert.equal(defense.hp, 100, 'beacon attacks cannot pass through a solid wall');
    assert.equal(defense.started, true);
  } finally {
    course.dispose();
  }
});
