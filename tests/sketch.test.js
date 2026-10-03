import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSketch,
  sketchTemplate,
  validSketch,
  eraseSketch,
  legacyToSketch,
  SKETCH_LIMIT,
} from '../src/core/sketch.js';
import { defaultDrawing } from '../src/core/drawing.js';
import { sanitizeDrawing } from '../src/core/shape.js';
import { buildCharacter, disposeCharacter } from '../src/game/character.js';
import { animateCharacter } from '../src/game/animation.js';
import { calculateStats } from '../src/core/stats.js';
import { freshSave, migrateSave, SAVE_VERSION } from '../src/core/save.js';
import { GAME_VERSION, validateRecord } from '../src/core/ranking.js';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { FIELD_STAGE } from '../src/game/field-stage.js';
import { driveField } from './helpers/field-driver.js';
const ink = {
  color: '#12abef',
  width: 0.02,
  depth: 0.2,
  role: 'tail',
  closed: false,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
  ],
};
test('dog and dragon abilities can complete the mission field with normal input', async () => {
  await initPhysics();
  for (const kind of ['dog', 'dragon']) {
    const c = new Course(FIELD_STAGE, calculateStats(sketchTemplate(kind)));
    driveField(c);
    assert.ok(c.complete, kind);
    assert.equal(c.sim.deaths, 0);
    c.dispose();
  }
});
test('eraser at the stroke limit never deletes unrelated strokes', () => {
  const d = {
    kind: 'sketch',
    strokes: Array.from({ length: SKETCH_LIMIT }, (_, i) => ({
      ...ink,
      points: i
        ? [{ x: 0.05, y: 0.05 }]
        : [
            { x: 0.1, y: 0.5 },
            { x: 0.9, y: 0.5 },
          ],
    })),
  };
  const before = structuredClone(d);
  assert.equal(eraseSketch(d, { x: 0.5, y: 0.5 }), false);
  assert.deepEqual(d, before);
});
test('open strokes retain endpoints, arbitrary colors, role and relative canvas positions', () => {
  const d = sanitizeDrawing({ kind: 'sketch', strokes: [ink] });
  assert.equal(d.strokes[0].closed, false);
  assert.equal(d.strokes[0].color, '#12abef');
  assert.deepEqual(d.strokes[0].points, ink.points);
  assert.deepEqual(sanitizeSketch(d), d);
  const root = buildCharacter(d);
  const mesh = root.getObjectByProperty('type', 'Mesh'),
    array = mesh.geometry.attributes.position.array;
  // No diagonal return segment or polygon across the empty center of this L.
  for (let i = 0; i < array.length; i += 3)
    assert.ok(Math.hypot(array[i] - 0.84, array[i + 1] + 0.84) > 0.35);
  disposeCharacter(root);
});
test('eraser splits a long open line without closing the remaining pieces', () => {
  const d = {
    kind: 'sketch',
    strokes: [
      {
        ...ink,
        points: [
          { x: 0.1, y: 0.5 },
          { x: 0.9, y: 0.5 },
        ],
      },
    ],
  };
  eraseSketch(d, { x: 0.5, y: 0.5 });
  assert.equal(d.strokes.length, 2);
  assert.ok(d.strokes.every((s) => !s.closed));
  assert.ok(d.strokes[0].points.at(-1).x < 0.47);
  assert.ok(d.strokes[1].points[0].x > 0.53);
});
test('dog and dragon keep nonhuman layouts and animate finite geometry', () => {
  for (const kind of ['human', 'dog', 'dragon']) {
    const d = sketchTemplate(kind),
      root = buildCharacter(d);
    assert.ok(validSketch(d));
    assert.equal(root.userData.pieces.length, d.strokes.length);
    if (kind === 'dog') assert.equal(d.strokes.filter((s) => s.role === 'leg').length, 4);
    if (kind === 'dragon') assert.equal(d.strokes.filter((s) => s.role === 'wing').length, 2);
    for (let i = 0; i < 360; i++) {
      animateCharacter(root, { vx: 6, vz: 0, vy: i % 2 ? 5 : -5, grounded: i % 90 < 60 }, 1 / 60);
      root.updateMatrixWorld();
      root.traverse((o) => {
        assert.ok(o.matrixWorld.elements.every(Number.isFinite));
      });
    }
    root.traverse((o) => {
      if (o.geometry)
        assert.ok(
          [...o.geometry.attributes.position.array].every(
            (x) => Number.isFinite(x) && Math.abs(x) < 4,
          ),
        );
    });
    disposeCharacter(root);
  }
});
test('blank sketches stay blank and old characters only convert when explicitly edited', () => {
  assert.equal(sanitizeSketch({}).strokes.length, 0);
  assert.equal(buildCharacter(sketchTemplate('blank')).userData.pieces.length, 0);
  const old = defaultDrawing(),
    before = structuredClone(old);
  const converted = legacyToSketch(sanitizeDrawing(old));
  assert.ok(validSketch(converted));
  assert.deepEqual(old, before);
  assert.ok(!sanitizeDrawing(old).kind);
});
test('sketch save and ranking preserve freeform data and reject forged shape or abilities', () => {
  const d = sketchTemplate('dragon');
  d.strokes[0].color = '#123abc';
  const raw = freshSave();
  raw.characters[0].drawing = d;
  const saved = migrateSave(raw).data;
  assert.equal(saved.version, SAVE_VERSION);
  assert.deepEqual(saved.characters[0].drawing, d);
  const record = {
    version: GAME_VERSION,
    player: 'QA',
    character: '竜',
    level: 1,
    stats: calculateStats(d),
    drawing: d,
    splits: [30, 30, 30, 30, 30],
    total: 150,
    valid: true,
  };
  assert.deepEqual(validateRecord(record), []);
  assert.ok(validateRecord({ ...record, stats: { ...record.stats, speed: 99 } }).length);
  assert.ok(
    validateRecord({
      ...record,
      drawing: { ...d, strokes: [{ ...ink, points: [{ x: NaN, y: 0 }] }] },
    }).length,
  );
});
test('malformed and maximal drawings remain bounded without inventing humanoid parts', () => {
  const d = sanitizeSketch({
    strokes: Array.from({ length: 120 }, (_, i) => ({
      ...ink,
      color: 'bad',
      points: Array.from({ length: 300 }, (_, j) => ({ x: j / 299, y: 0.5 + Math.sin(j) * 0.2 })),
      role: i % 2 ? 'wing' : 'tail',
    })),
  });
  assert.equal(d.strokes.length, SKETCH_LIMIT);
  assert.ok(validSketch(d));
  assert.ok(JSON.stringify(d).length < 500000);
  const stats = calculateStats(d);
  for (const k of ['hp', 'power', 'defense', 'speed', 'jump', 'weight'])
    assert.ok(Number.isFinite(stats[k]));
  const root = buildCharacter(d);
  let vertices = 0;
  root.traverse((o) => {
    if (o.geometry) vertices += o.geometry.attributes.position.count;
  });
  assert.ok(vertices < 150000);
  disposeCharacter(root);
});
