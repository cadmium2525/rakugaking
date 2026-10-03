import { describeDrawing, area, clamp } from './shape.js';
import { COLORS } from './drawing.js';
import { sanitizeSketch, inkArea, sketchBounds } from './sketch.js';
export function calculateStats(raw) {
  if (raw?.kind === 'sketch') return sketchStats(raw);
  const { parts: p, drawing } = describeDrawing(raw);
  const arms = (p.armLeft.area + p.armRight.area) / 2,
    legs = (p.legLeft.height + p.legRight.height) / 2;
  const volume =
    p.body.area * 0.32 +
    p.head.area * 0.3 +
    (p.armLeft.area + p.armRight.area + p.legLeft.area + p.legRight.area) * 0.2;
  const weight = clamp(0.65 + volume * 2.8, 0.7, 2.6);
  const colors = Object.fromEntries(COLORS.map((c) => [c, 0]));
  let total = 0;
  for (const strokes of Object.values(drawing))
    for (const s of strokes) {
      const a = area(s.points);
      colors[s.color] += a;
      total += a;
    }
  for (const c of COLORS) colors[c] /= total || 1;
  const stats = {
    hp: Math.round(70 + p.body.area * 100 + weight * 10),
    power: Math.round(10 + arms * 35 + colors[COLORS[0]] * 2),
    defense: Math.round(6 + p.body.area * 18 + weight * 3 + colors[COLORS[1]] * 1.5),
    speed: clamp(
      6.4 + (legs - 0.6) * 1.4 - (weight - 1) * 1.25 + colors[COLORS[2]] * 0.3,
      4.3,
      7.5,
    ),
    jump: clamp(8.8 + (legs - 0.6) * 1.5 - (weight - 1) * 0.6 + colors[COLORS[3]] * 0.35, 7.5, 10),
    weight,
    reach: clamp(0.8 + (p.armLeft.height + p.armRight.height) * 0.45, 0.8, 1.7),
    actionCooldown: 0.35 + arms * 0.5 + (p.armLeft.height + p.armRight.height) * 0.12,
    luck: colors[COLORS[4]] * 0.05,
  };
  return {
    ...stats,
    analysis: {
      volume,
      bodyArea: p.body.area,
      legLength: legs,
      armArea: arms,
      colors,
      centerOfMass: (p.body.area + p.head.area * 1.6) / Math.max(0.01, p.body.area + p.head.area),
    },
  };
}
function sketchStats(raw) {
  const d = sanitizeSketch(raw),
    b = sketchBounds(d.strokes.flatMap((s) => s.points));
  const coverage = clamp(
    d.strokes.reduce((n, s) => n + inkArea(s), 0),
    0.02,
    1,
  );
  const volume = clamp(
    d.strokes.reduce((n, s) => n + inkArea(s) * (s.depth / 0.3), 0),
    0.02,
    1,
  );
  const weight = clamp(0.7 + volume * 1.9, 0.7, 2.6);
  const height = clamp(b.maxY - b.minY, 0.05, 1),
    width = clamp(b.maxX - b.minX, 0.05, 1);
  return {
    hp: Math.round(75 + coverage * 90 + weight * 10),
    power: Math.round(12 + width * 16 + volume * 10),
    defense: Math.round(6 + volume * 18 + weight * 3),
    speed: clamp(6.8 - (weight - 1) * 1.1, 4.3, 7.5),
    jump: clamp(8.8 + height * 0.6 - (weight - 1) * 0.65, 7.5, 10),
    weight,
    reach: clamp(0.8 + width * 0.8, 0.8, 1.7),
    actionCooldown: 0.48 + volume * 0.3,
    luck: 0,
    analysis: {
      volume,
      bodyArea: coverage,
      legLength: height,
      armArea: width,
      colors: {},
      centerOfMass: 1,
    },
  };
}
export function statRows(stats) {
  return [
    ['HP', Math.round(stats.hp)],
    ['POWER', Math.round(stats.power)],
    ['DEFENSE', Math.round(stats.defense)],
    ['SPEED', stats.speed.toFixed(1)],
    ['JUMP', stats.jump.toFixed(1)],
    ['WEIGHT', stats.weight.toFixed(2)],
  ];
}
