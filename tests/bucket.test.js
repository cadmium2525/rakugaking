import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketFill } from '../src/core/bucket.js';
import { sanitizeSketch, validSketch, hitStroke } from '../src/core/sketch.js';
import { buildCharacter, disposeCharacter } from '../src/game/character.js';
const style = { color: '#ff33aa', width: 0.004, depth: 0.2, role: 'body' };
const square = (a = 0.2, b = 0.8) => ({
  points: [
    [a, a],
    [b, a],
    [b, b],
    [a, b],
    [a, a],
  ].map(([x, y]) => ({ x, y })),
  color: '#171e29',
  width: 0.02,
  depth: 0.2,
  closed: false,
  role: 'body',
});
test('bucket fills a closed pen loop without altering the pen, and persists as valid 3D geometry', () => {
  const pen = square(),
    d = { kind: 'sketch', version: 1, strokes: [pen] };
  assert.equal(bucketFill(d, { x: 0.5, y: 0.5 }, style), 'filled');
  assert.equal(d.strokes[1], pen);
  assert.equal(d.strokes[1].closed, false);
  assert.ok(hitStroke(d.strokes[0], { x: 0.5, y: 0.5 }, 0));
  const saved = sanitizeSketch(d);
  assert.ok(validSketch(saved));
  const root = buildCharacter(saved);
  root.traverse((o) => {
    if (o.geometry) assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));
  });
  disposeCharacter(root);
});
test('open boundary and blank paper never flood the background', () => {
  for (const strokes of [[], [{ ...square(), points: square().points.slice(0, 4) }]]) {
    const d = { strokes },
      before = structuredClone(d);
    assert.equal(bucketFill(d, { x: 0.5, y: 0.5 }, style), 'open');
    assert.deepEqual(d, before);
  }
});
test('bucket handles a boundary assembled from multiple pen strokes', () => {
  const loop = square(),
    strokes = loop.points.slice(0, 4).map((p, i) => ({ ...loop, points: [p, loop.points[i + 1]] }));
  const d = { strokes };
  assert.equal(bucketFill(d, { x: 0.5, y: 0.5 }, style), 'filled');
  assert.equal(d.strokes.length, 5);
});
test('inner boundary remains a hole in a filled ring, including after save and extrusion', () => {
  const d = { kind: 'sketch', version: 1, strokes: [square(), square(0.4, 0.6)] };
  assert.equal(bucketFill(d, { x: 0.3, y: 0.3 }, style), 'filled');
  assert.equal(d.strokes[0].holes.length, 1);
  const saved = sanitizeSketch(d);
  assert.ok(validSketch(saved));
  assert.equal(hitStroke(saved.strokes[0], { x: 0.5, y: 0.5 }, 0), false);
  const root = buildCharacter(saved);
  const m = root.userData.pieces[0].joint.children[0];
  // No front triangle centroid covers the central hole.
  const a = m.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i += 9) {
    if (Math.abs(a[i + 2] - a[i + 5]) > 0.001 || Math.abs(a[i + 2] - a[i + 8]) > 0.001) continue;
    const x = (a[i] + a[i + 3] + a[i + 6]) / 3 / 2.8 + saved.strokes[0].points[0].x;
    const y = -(a[i + 1] + a[i + 4] + a[i + 7]) / 3 / 2.8 + saved.strokes[0].points[0].y;
    assert.ok(x <= 0.4 || x >= 0.6 || y <= 0.4 || y >= 0.6);
  }
  disposeCharacter(root);
});
test('existing face recolors without adding geometry, even at the stroke limit', () => {
  const d = { strokes: Array.from({ length: 96 }, () => ({ ...square(), closed: true })) };
  assert.equal(bucketFill(d, { x: 0.5, y: 0.5 }, style), 'painted');
  assert.equal(d.strokes.length, 96);
  assert.equal(bucketFill(d, { x: 0.5, y: 0.5 }, style), 'same');
});
