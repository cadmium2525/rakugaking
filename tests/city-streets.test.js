import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initPhysics } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { CITY_STAGE as stage } from '../src/game/city-stage.js';

before(initPhysics);
const streets = stage.paths.map((path) =>
  new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(90),
);
const obstacles = stage.platforms.filter(
  (b) =>
    !b.terrain &&
    !b.boundary &&
    !b.gate &&
    !b.collapse &&
    b.h &&
    b.w &&
    b.d &&
    !(b.h <= 0.35 && b.y + b.h / 2 <= stage.height(b.x, b.z) + 0.25),
);
function rectangle(b, pad = 0) {
  return [
    { x: b.x - b.w / 2 - pad, z: b.z - b.d / 2 - pad },
    { x: b.x + b.w / 2 + pad, z: b.z - b.d / 2 - pad },
    { x: b.x + b.w / 2 + pad, z: b.z + b.d / 2 + pad },
    { x: b.x - b.w / 2 - pad, z: b.z + b.d / 2 + pad },
  ];
}
function polygonsOverlap(a, b) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length],
        axis = { x: -(q.z - p.z), z: q.x - p.x },
        projection = (shape) => shape.map((v) => v.x * axis.x + v.z * axis.z),
        aa = projection(a),
        bb = projection(b);
      if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false;
    }
  return true;
}
function blocksAt(b, points) {
  const heights = points.map((p) => stage.height(p.x, p.z));
  // Ignore a roof safely above the standing body and terrain-level decks that
  // Rapier can step onto. Houses, stall counters, benches and rail posts remain.
  return (
    b.y - b.h / 2 <= Math.max(...heights) + 1.65 && b.y + b.h / 2 > Math.min(...heights) + 0.25
  );
}
test('painted city streets clear standing bodies and their full rendered width between samples', () => {
  const overlaps = [];
  for (const [path, points] of streets.entries()) {
    const sides = points.map((p, i) => {
      const tangent = points[Math.min(i + 1, 90)]
        .clone()
        .sub(points[Math.max(i - 1, 0)])
        .normalize();
      return [-1, 1].map((side) => ({
        x: p.x + tangent.z * 1.7 * side,
        z: p.z - tangent.x * 1.7 * side,
      }));
    });
    for (const [i, p] of points.entries())
      for (const b of obstacles)
        if (
          blocksAt(b, [p]) &&
          Math.abs(p.x - b.x) < b.w / 2 + 0.35 &&
          Math.abs(p.z - b.z) < b.d / 2 + 0.35
        )
          overlaps.push({ path, sample: i, kind: 'body', obstacle: [b.x, b.z] });
    // Test the actual quadrilateral rendered between adjacent samples; checking
    // vertices alone misses a narrow post that falls between them.
    for (let i = 1; i < points.length; i++) {
      const polygon = [sides[i - 1][0], sides[i - 1][1], sides[i][1], sides[i][0]];
      for (const b of obstacles)
        if (blocksAt(b, polygon) && polygonsOverlap(polygon, rectangle(b)))
          overlaps.push({ path, segment: i, kind: 'road', obstacle: [b.x, b.z] });
    }
  }
  assert.deepEqual(overlaps, []);
});

function outsideLockedDoor(p) {
  return (
    Math.abs(p.x - stage.gate.x) > stage.gate.w / 2 + 0.7 ||
    Math.abs(p.z - stage.gate.z) > stage.gate.d / 2 + 0.7
  );
}
test('both bodies and control styles walk every smooth city street on both sides of the sealed door', () => {
  let checked = 0;
  for (const stats of [
    { speed: 4.3, jump: 7.5, weight: 2.6, hp: 1000 },
    { speed: 7.5, jump: 10, weight: 0.7, hp: 1000 },
  ])
    for (const digital of [false, true])
      for (const [path, points] of streets.entries()) {
        const pieces = [];
        let piece = [];
        for (const p of points)
          if (outsideLockedDoor(p)) piece.push(p);
          else if (piece.length) {
            pieces.push(piece);
            piece = [];
          }
        if (piece.length) pieces.push(piece);
        for (const samples of pieces) {
          const first = samples[0],
            course = new Course(
              {
                ...stage,
                spawn: { x: first.x, z: first.z, y: stage.height(first.x, first.z) + 0.82 },
              },
              stats,
            );
          let target = 1;
          for (let frame = 0; frame < 5000 && target < samples.length; frame++) {
            const p = course.sim.position,
              q = samples[target],
              dx = q.x - p.x,
              dz = q.z - p.z;
            if (Math.hypot(dx, dz) < (digital ? 0.65 : 0.4)) {
              target++;
              continue;
            }
            course.step(
              digital
                ? { x: dx > 0.45 ? 1 : dx < -0.45 ? -1 : 0, z: dz > 0.45 ? 1 : dz < -0.45 ? -1 : 0 }
                : { x: dx, z: dz },
            );
          }
          assert.equal(
            target,
            samples.length,
            JSON.stringify({ path, weight: stats.weight, digital, target, p: course.sim.position }),
          );
          assert.equal(course.sim.deaths, 0);
          assert.equal(course.sim.jumps, 0);
          assert.ok(course.sim.platforms[stage.platforms.indexOf(stage.gate)].isEnabled());
          course.dispose();
          checked++;
        }
      }
  // The exit street is checked in two pieces without disabling the gate or
  // granting mission rewards. Separate expedition tests open it by real play.
  assert.equal(checked, (stage.paths.length + 1) * 4);
});
