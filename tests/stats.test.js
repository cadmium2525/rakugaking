import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats } from '../src/core/stats.js';
import { defaultDrawing, PARTS, COLORS } from '../src/core/drawing.js';
let seed = 127;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
test('1000 deterministic random bodies have bounded finite abilities', () => {
  for (let i = 0; i < 1000; i++) {
    const d = defaultDrawing();
    for (const part of PARTS) {
      const w = 0.02 + random() * 0.9,
        h = 0.02 + random() * 0.9;
      d[part][0].color = COLORS[Math.floor(random() * COLORS.length)];
      d[part][0].points = d[part][0].points.map((p) => ({
        x: 0.5 + (p.x - 0.5) * w * 2,
        y: 0.5 + (p.y - 0.5) * h * 2,
      }));
    }
    const s = calculateStats(d);
    for (const k of ['hp', 'power', 'defense', 'speed', 'jump', 'weight'])
      assert.ok(Number.isFinite(s[k]) && s[k] > 0);
    assert.ok(s.speed >= 4.3 && s.speed <= 7.5);
    assert.ok(s.jump >= 7.5 && s.jump <= 10);
    assert.ok(s.weight >= 0.7 && s.weight <= 2.6);
  }
});
test('large bodies trade speed and jump for HP, defense, and wind resistance', () => {
  const small = defaultDrawing(),
    large = defaultDrawing();
  large.body[0].points = large.body[0].points.map((p) => ({
    x: 0.5 + (p.x - 0.5) * 1.6,
    y: 0.5 + (p.y - 0.5) * 1.6,
  }));
  const a = calculateStats(small),
    b = calculateStats(large);
  assert.ok(
    b.hp > a.hp &&
      b.defense > a.defense &&
      b.weight > a.weight &&
      b.speed < a.speed &&
      b.jump < a.jump,
  );
});
test('color influence is secondary and purple has a bounded bonus', () => {
  const d = defaultDrawing(),
    base = calculateStats(d);
  for (const color of COLORS) {
    for (const part of PARTS) d[part][0].color = color;
    const s = calculateStats(d);
    assert.ok(Math.abs(s.speed - base.speed) <= 0.301);
    assert.ok(Math.abs(s.jump - base.jump) <= 0.351);
    assert.ok(s.luck <= 0.05);
  }
});
