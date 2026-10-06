import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { STAGES } from '../src/game/stages.js';
before(initPhysics);

function at(c, x, z, extra = 0) {
  c.sim.body.setTranslation({ x, y: c.stage.height(x, z) + 0.82 + extra, z }, true);
}
test('courier cannot start from above or through a wall and reaching the destination alone is not delivery', () => {
  const s = STAGES[1],
    c = new Course(s, { hp: 180 }),
    m = s.missions.find((m) => m.type === 'escort'),
    e = c.field.escorts.get(m.id);
  at(c, e.x, e.z, 15);
  c.field.update(c, true);
  assert.equal(e.started, false);
  at(c, e.x + 1, e.z);
  const lineClear = c.sim.lineClear;
  c.sim.lineClear = () => false;
  c.field.update(c, true);
  assert.equal(e.started, false);
  c.sim.lineClear = lineClear;
  c.field.update(c, true);
  assert.equal(e.started, true);
  assert.equal(c.field.selected, m.id);
  at(c, m.destination.x, m.destination.z);
  for (let i = 0; i < 60; i++) {
    c.elapsed += 1 / 60;
    c.field.update(c, false);
  }
  assert.equal(e.waiting, true);
  assert.equal(c.field.done(m.id), false);
  assert.deepEqual(c.field.target(m.id), e);
  assert.match(c.guidance(), /仲間が待っている/);
  c.dispose();
});
test('water restoration reveals unordered pearls and their real prerequisite protects the boss', () => {
  const s = STAGES[2],
    c = new Course(s, { hp: 180 }),
    pearls = s.runes.filter((r) => r.mission === 'pearls');
  for (const r of pearls) {
    at(c, r.x, r.z);
    c.field.update(c, false);
  }
  assert.equal(c.field.runes.size, 0);
  assert.equal(c.field.ready('pearls'), false);
  at(c, s.boss.x + 2, s.boss.z);
  c.field.update(c, true);
  assert.equal(c.field.bossHP, s.boss.hp);
  assert.match(c.guidance(), /真珠/);
  assert.doesNotMatch(c.guidance(), /星座|巨人/);
  for (const r of s.runes.filter((r) => r.mission === 'sluice')) {
    at(c, r.x, r.z);
    c.field.update(c, true);
  }
  assert.equal(c.field.ready('pearls'), true);
  for (const r of [...pearls].reverse()) {
    at(c, r.x, r.z);
    c.field.update(c, false);
  }
  assert.equal(c.field.done('pearls'), true);
  assert.equal(c.field.bossReady(), true);
  c.dispose();
});
test('city repair needs both urban errands, contains no combat target, and keeps the new reward checkpoint', () => {
  const s = STAGES[3],
    c = new Course(s, { hp: 100 }),
    r = s.runes.find((r) => r.mission === 'clock');
  assert.equal(c.field.enemies.length, 0);
  assert.equal(c.field.bossHP, 0);
  at(c, r.x, r.z);
  c.field.update(c, true);
  assert.equal(c.field.done('clock'), false);
  assert.ok(c.field.combatTargets(c).every((t) => t.key !== 'boss'));
  s.runes.forEach((r, i) => {
    if (r.mission !== 'clock') c.field.runes.add(i);
  });
  c.field.update(c, true);
  assert.equal(c.field.done('clock'), true);
  const reward = s.missions.find((m) => m.id === 'gears').reward;
  at(c, reward.x, reward.z);
  c.field.update(c, false);
  c.retry();
  assert.ok(Math.hypot(c.sim.position.x - reward.x, c.sim.position.z - reward.z) < 0.01);
  assert.equal(c.field.bossAttack, null);
  c.dispose();
});
test('beacon waves require activation, pause their release outside the ring, and finish on the last defeat', () => {
  const s = STAGES[4],
    c = new Course(s, { hp: 180 }),
    m = s.missions.find((m) => m.type === 'defense'),
    d = c.field.defenses.get(m.id);
  assert.ok(c.field.enemies.every((e) => !e.active));
  assert.ok(c.field.combatTargets(c).every((t) => !t.key.startsWith('enemy:')));
  at(c, m.x + 1.5, m.z, 15);
  c.field.update(c, true);
  assert.equal(d.started, false);
  at(c, m.x + 1.5, m.z);
  const lineClear = c.sim.lineClear;
  c.sim.lineClear = () => false;
  c.field.update(c, true);
  assert.equal(d.started, false);
  c.sim.lineClear = lineClear;
  c.field.update(c, true);
  assert.equal(d.started, true);
  assert.equal(c.field.selected, m.id);
  assert.deepEqual(
    c.field.enemies.map((e) => e.active),
    [true, true, false, false, false, false],
  );
  at(c, m.x + m.radius + 1, m.z);
  const elapsed = d.elapsed;
  for (let i = 0; i < 90; i++) {
    c.elapsed += 1 / 60;
    c.field.update(c, false);
  }
  assert.equal(d.elapsed, elapsed);
  assert.match(c.guidance(), /計時停止/);
  at(c, m.x + m.radius + 3, m.z);
  c.field.update(c, false);
  assert.equal(d.started, false);
  assert.equal(d.elapsed, 0);
  assert.equal(d.hp, m.beaconHP);
  assert.equal(d.wave, 0);
  assert.ok(c.field.enemies.every((e) => e.hp === m.enemyHP && !e.active));
  at(c, m.x + 1.5, m.z);
  c.field.update(c, true);
  // Direct HP changes are an isolated rule fixture, not a browser clear. Only
  // currently released attackers are defeated; later waves remain unavailable.
  for (let wave = 1; wave <= 3; wave++) {
    assert.equal(d.wave, wave);
    c.field.enemies
      .filter((e) => e.active && e.hp > 0)
      .forEach((e) => {
        e.hp = 0;
      });
    c.field.update(c, false);
    if (wave < 3) {
      assert.equal(c.field.done(m.id), false);
      assert.ok(d.nextWaveAt > d.elapsed);
      for (let i = 0; i < 80; i++) {
        c.elapsed += 1 / 60;
        c.field.update(c, false);
      }
      assert.equal(c.field.enemies.filter((e) => e.active).length, (wave + 1) * 2);
    } else {
      assert.equal(
        c.field.done(m.id),
        true,
        'last defeat completes immediately without a timer wait',
      );
    }
  }
  c.retry();
  assert.equal(c.field.done(m.id), true, 'a completed defense survives retry');
  for (let i = 0; i < 120; i++) c.step({ x: 1 });
  assert.ok(
    c.sim.position.x > m.reward.x + 5,
    'the emblem respawn is outside the beacon and can leave on foot',
  );
  assert.equal(c.sim.deaths, 0);
  c.dispose();
});
test('relocated gates touch their own ground and field entrances/exits are no longer a shared north spine', () => {
  const fields = STAGES.slice(1);
  assert.equal(new Set(fields.map((s) => `${s.spawn.x},${s.spawn.z}`)).size, 4);
  assert.equal(new Set(fields.map((s) => `${s.goal.x},${s.goal.z}`)).size, 4);
  for (const s of fields)
    assert.ok(Math.abs(s.gate.y - s.gate.h / 2 - s.height(s.gate.x, s.gate.z)) < 1e-6);
});
