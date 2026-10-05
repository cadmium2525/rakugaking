import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/core/combat.js';
import { DT, Simulation, initPhysics } from '../src/core/controller.js';
import { FieldMissions } from '../src/core/field-missions.js';
import { ExpeditionMissions } from '../src/core/expedition-missions.js';
import { buildCharacter, disposeCharacter } from '../src/game/character.js';
import { animateCharacter } from '../src/game/animation.js';
import { defaultDrawing } from '../src/core/drawing.js';
import { sketchTemplate } from '../src/core/sketch.js';
import { Input } from '../src/ui/input.js';

before(initPhysics);
const position = { x: 0, y: 0.82, z: 0 },
  context = { position, grounded: true, targets: [] },
  stats = { power: 20, reach: 1, defense: 12, hp: 100 };
const tick = (c, frames = 1, input = {}, state = context) => {
  for (let i = 0; i < frames; i++) c.update(input, DT, state);
};

test('a brief tap has a visible windup and exactly one hit per target through the strike', () => {
  const c = new Combat(stats),
    target = { x: 0, y: 0.82, z: -1.8 };
  tick(c, 1, { action: true });
  assert.equal(c.snapshot().phase, 'windup');
  assert.equal(c.hit('enemy', target), null);
  let total = 0,
    hits = 0;
  for (let i = 0; i < 60; i++) {
    tick(c);
    const hit = c.hit('enemy', target);
    if (hit) {
      total += hit.damage;
      hits++;
    }
  }
  assert.equal(total, 20);
  assert.equal(hits, 1);
  assert.equal(c.events.filter((e) => e.type === 'swing').length, 1);
  assert.equal(c.events.filter((e) => e.type === 'hit').length, 1);
  assert.equal(c.snapshot().attacking, false);
});

test('short taps during recovery are buffered into a three hit combo with a stronger finish', () => {
  const c = new Combat(stats),
    target = { x: 0, y: 0.82, z: -1.8 },
    damages = [];
  for (let i = 0; i < 160; i++) {
    tick(c, 1, { action: [0, 8, 34].includes(i) });
    const hit = c.hit('enemy', target);
    if (hit) damages.push(hit.damage);
  }
  assert.deepEqual(
    c.events.filter((e) => e.type === 'swing').map((e) => e.combo),
    [1, 2, 3],
  );
  assert.deepEqual(damages, [20, 22, 33]);
  const finish = c.events.find((e) => e.type === 'hit' && e.combo === 3);
  assert.ok(finish.time > 0.8);
});

test('holding ACTION does not auto attack and an expired combo starts at the first move', () => {
  const c = new Combat(stats);
  tick(c, 180, { action: true });
  assert.equal(c.events.filter((e) => e.type === 'swing').length, 1);
  tick(c);
  tick(c, 1, { action: true });
  assert.equal(c.snapshot().combo, 1);
  assert.equal(c.events.filter((e) => e.type === 'swing').length, 2);
});

test('two distinct short taps between simulation updates stay distinct and buffer the next hit', () => {
  const previousWindow = globalThis.window,
    previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  const button = () =>
    Object.assign(new EventTarget(), {
      firstElementChild: { style: {} },
      setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });
  const input = new Input(button(), button(), button()),
    c = new Combat(stats);
  const key = (type, repeat = false) => {
    const event = new Event(type);
    Object.defineProperties(event, { code: { value: 'KeyE' }, repeat: { value: repeat } });
    globalThis.window.dispatchEvent(event);
  };
  try {
    key('keydown');
    key('keyup');
    key('keydown');
    key('keyup');
    const first = input.read(),
      second = input.read(),
      released = input.read();
    assert.equal(first.actionPressed, true);
    assert.equal(second.actionPressed, true);
    assert.equal(released.actionPressed, false);
    assert.equal(released.action, false);
    c.update(first, DT, context);
    c.update(second, DT, context);
    c.update(released, DT, context);
    tick(c, 90);
    assert.deepEqual(
      c.events.filter((e) => e.type === 'swing').map((e) => e.combo),
      [1, 2],
    );
    key('keydown');
    key('keydown', true);
    assert.equal(input.read().actionPressed, true);
    const held = input.read();
    assert.equal(held.action, true);
    assert.equal(held.actionPressed, false);
    input.clear();
    assert.equal(input.read().actionPressed, false);
  } finally {
    input.dispose();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('ground attacks miss behind, above and beyond reach while nearby auto aim faces a target', () => {
  const c = new Combat(stats);
  tick(c, 1, { action: true });
  tick(c, 7);
  assert.ok(c.attack);
  assert.equal(c.hit('behind', { x: 0, y: 0.82, z: 1.8 }), null);
  assert.equal(c.hit('high', { x: 0, y: 4, z: -1 }), null);
  assert.equal(c.hit('far', { x: 0, y: 0.82, z: -4 }), null);
  assert.ok(c.hit('front', { x: 0, y: 0.82, z: -1.8 }));
  const aimed = new Combat(stats);
  tick(
    aimed,
    1,
    { action: true, x: -1 },
    {
      ...context,
      targets: [{ x: -1.8, y: 0.82, z: 0, radius: 0.65 }],
    },
  );
  tick(aimed, 7);
  assert.ok(aimed.snapshot().facing.x < -0.99);
  assert.ok(aimed.hit('left', { x: -1.8, y: 0.82, z: 0 }));
});

test('forward assist respects movement and never turns toward a closer target behind', () => {
  const targets = [
      { key: 'back', x: 0, y: 0.82, z: 0.6 },
      { key: 'front', x: 0, y: 0.82, z: -2.1 },
    ],
    c = new Combat(stats);
  tick(c, 1, { action: true }, { ...context, targets });
  assert.ok(c.snapshot().facing.z < -0.99);
  tick(c, 7);
  assert.equal(c.hit('back', targets[0]), null);
  assert.ok(c.hit('front', targets[1]));
  const moving = new Combat(stats),
    sideTargets = [
      { x: -0.6, y: 0.82, z: 0 },
      { x: 2.1, y: 0.82, z: 0 },
    ];
  tick(moving, 1, { action: true, x: 1 }, { ...context, targets: sideTargets });
  assert.ok(moving.snapshot().facing.x > 0.99);
});

test('the current strike stays aimed while a buffered strike follows the new movement direction', () => {
  const c = new Combat(stats),
    state = {
      ...context,
      targets: [
        { x: 2, y: 0.82, z: 0 },
        { x: -2, y: 0.82, z: 0 },
      ],
    };
  tick(c, 1, { action: true, x: 1 }, state);
  tick(c, 4, { x: -1 }, state);
  assert.ok(c.snapshot().facing.x > 0.99);
  tick(c, 1, { action: true, x: -1 }, state);
  tick(c, 22, { x: -1 }, state);
  assert.equal(c.snapshot().combo, 2);
  assert.ok(c.snapshot().facing.x < -0.99);
});

test('a side target is hit only when the visible sweep reaches its angle', () => {
  const c = new Combat(stats),
    side = { x: -1.8, y: 0.82, z: 0 };
  tick(c, 1, { action: true });
  tick(c, 7);
  assert.equal(c.hit('side', side), null);
  tick(c, 6);
  assert.ok(c.hit('side', side));
});

test('drawing luck retains a small recovery bonus without changing strike timing', () => {
  const plain = new Combat({ ...stats, actionCooldown: 0.6 }),
    lucky = new Combat({ ...stats, actionCooldown: 0.6, luck: 0.05 });
  tick(plain, 1, { action: true });
  tick(lucky, 1, { action: true });
  assert.ok(lucky.snapshot().duration < plain.snapshot().duration);
  assert.equal(lucky.snapshot().windup, plain.snapshot().windup);
  assert.equal(lucky.snapshot().active, plain.snapshot().active);
});

test('air action hits around the silhouette but cannot damage an enemy far below the jump', () => {
  const c = new Combat(stats),
    air = { ...context, grounded: false };
  tick(c, 1, { action: true }, air);
  tick(c, 6, {}, air);
  assert.equal(c.snapshot().name, '空中スピン');
  assert.equal(c.snapshot().airborne, true);
  assert.equal(c.hit('behind', { x: 0, y: 0.82, z: 1.5 }).damage, 25);
  assert.equal(c.hit('below', { x: 0, y: -4, z: -1 }), null);
  assert.deepEqual(c.motion, {});
});

test('blocked strikes have their own feedback and cannot emit damage or double count', () => {
  const c = new Combat(stats),
    target = { x: 0, y: 1.2, z: -2.8 };
  tick(c, 1, { action: true }, { ...context, targets: [{ ...target, radius: 1.9 }] });
  tick(c, 7);
  assert.equal(c.hit('boss', target, { radius: 1.9, blocked: true }).blocked, true);
  assert.equal(c.hit('boss', target, { radius: 1.9, blocked: true }), null);
  assert.equal(c.events.at(-1).type, 'block');
  assert.equal(c.events.at(-1).damage, 0);
  assert.equal(c.events.filter((e) => e.type === 'hit').length, 0);
});

test('mission hits stagger, physically displace enemies, and emit defeat once', () => {
  const stage = {
      height: () => 0,
      enemies: [{ x: 0, z: -1.5, hp: 35, mission: 'combat' }],
      runes: [],
      boss: { x: 20, y: 0, z: 20, hp: 100 },
      missions: [
        { id: 'combat', type: 'combat', x: 0, z: -2, radius: 10, reward: { x: 20, y: 1, z: -20 } },
      ],
      platforms: [{ gate: true }],
    },
    field = new ExpeditionMissions(stage),
    combat = new Combat(stats),
    course = {
      field,
      combat,
      elapsed: 0,
      hp: 100,
      nextDamage: 0,
      sim: { position: { ...position }, stats, platforms: [{ setEnabled() {} }] },
    };
  for (let i = 0; i < 23; i++) {
    course.elapsed += DT;
    combat.update({ action: i === 0 }, DT, { ...context, targets: field.combatTargets(course) });
    field.update(course, combat.attack);
  }
  assert.equal(field.enemies[0].hp, 15);
  assert.ok(field.enemies[0].z < -1.6);
  assert.ok(course.hp === 100);
  for (let i = 0; i < 50; i++) {
    course.elapsed += DT;
    combat.update({ action: i === 0 }, DT, { ...context, targets: field.combatTargets(course) });
    field.update(course, combat.attack);
  }
  assert.equal(field.enemies[0].hp, 0);
  assert.equal(combat.events.filter((e) => e.type === 'defeat').length, 1);
  assert.equal(combat.events.filter((e) => e.type === 'hit').length, 2);
});

test('all shapes including a dog, dragon and unassigned ink animate every action then return to idle', () => {
  const unassigned = {
    kind: 'sketch',
    strokes: [
      {
        color: '#2277cc',
        width: 0.025,
        depth: 0.2,
        role: 'none',
        closed: false,
        points: [
          { x: 0.25, y: 0.65 },
          { x: 0.7, y: 0.35 },
        ],
      },
    ],
  };
  for (const drawing of [
    defaultDrawing(),
    sketchTemplate('dog'),
    sketchTemplate('dragon'),
    unassigned,
  ]) {
    const root = buildCharacter(drawing),
      c = new Combat(stats),
      states = new Set();
    for (let i = 0; i < 240; i++) {
      const air = i >= 140 && i < 185;
      c.update({ action: [0, 8, 34, 141].includes(i) }, DT, { ...context, grounded: !air });
      animateCharacter(root, { vx: 0, vz: 0, vy: air ? 2 : 0, grounded: !air }, DT, c.snapshot());
      states.add(root.userData.state);
      root.updateMatrixWorld(true);
      root.traverse((o) =>
        assert.ok(o.matrixWorld.elements.every((v) => Number.isFinite(v) && Math.abs(v) < 10)),
      );
    }
    assert.ok(['Attack1', 'Attack2', 'Finish', 'AirAttack', 'Idle'].every((s) => states.has(s)));
    const torso = root.userData.rig || root.userData.joints.body;
    assert.ok(
      Math.abs(torso.rotation.x) + Math.abs(torso.rotation.y) + Math.abs(torso.rotation.z) < 0.001,
    );
    assert.ok(Math.abs(torso.position.z) < 0.001);
    disposeCharacter(root);
  }
});

test('lunging uses collider movement and stops at a wall without passing through it', () => {
  const sim = new Simulation(
      [
        { x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 20 },
        { x: 0, y: 1.2, z: -0.9, w: 4, h: 2.4, d: 0.2 },
      ],
      position,
      stats,
    ),
    c = new Combat(stats),
    target = { x: 0, y: 0.82, z: -3, radius: 0.65 };
  let bursts = 0;
  for (let i = 0; i < 360; i++) {
    c.update({ action: i % 60 === 0 }, DT, {
      position: sim.position,
      grounded: sim.grounded,
      targets: [target],
    });
    if (c.motion.burstZ) bursts++;
    sim.step({}, c.motion);
  }
  assert.ok(bursts > 20);
  assert.ok(sim.position.z < -0.2, JSON.stringify(sim.position));
  assert.ok(sim.position.z > -0.5, JSON.stringify(sim.position));
  assert.equal(sim.deaths, 0);
  sim.dispose();
});

test('retry clears queued attacks, enemy recoil and hurt feedback without erasing completed goals', () => {
  const c = new Combat(stats);
  tick(c, 1, { action: true });
  tick(c);
  tick(c, 1, { action: true });
  c.hurt(20);
  c.reset();
  assert.equal(c.snapshot().attacking, false);
  assert.equal(c.snapshot().buffered, false);
  assert.equal(c.snapshot().hurt, 0);
  assert.equal(c.events.length, 0);
  const field = new FieldMissions({ enemies: [{ x: 2, z: 3, hp: 0 }], boss: { hp: 10 } });
  field.runes.add(0);
  field.rewards.add('orchard');
  field.enemies[0].knockVX = 6;
  field.enemies[0].stunUntil = 3;
  field.resetCombat();
  assert.equal(field.enemies[0].hp, 0);
  assert.equal(field.enemies[0].knockVX, 0);
  assert.equal(field.enemies[0].stunUntil, 0);
  assert.ok(field.rewards.has('orchard'));
  assert.ok(field.runes.has(0));
});
