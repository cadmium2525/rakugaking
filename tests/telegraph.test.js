import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossTelegraph } from '../src/game/boss-telegraph.js';
import { bossPattern, bossAttackHits } from '../src/core/boss-pattern.js';

const boss = { x: 3, y: 2, z: -4, radius: 7 };
function fixture(pattern) {
  const view = new BossTelegraph(new THREE.Group()),
    course = { stage: { boss }, field: { bossHP: 100, bossAttack: pattern } };
  view.update(course);
  return { view, course };
}
function covered(view, meshes, player) {
  view.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(player.x, boss.y + 10, player.z),
    new THREE.Vector3(0, -1, 0),
  );
  return (
    view.root.visible &&
    ray.intersectObjects(
      meshes.filter((m) => m.visible),
      false,
    ).length > 0
  );
}
function point(angle, distance) {
  return {
    x: boss.x + Math.sin(angle) * distance,
    y: boss.y + 0.8,
    z: boss.z + Math.cos(angle) * distance,
  };
}
function dispose(view) {
  view.root.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
}

test('wind blade world geometry matches the damage angle at arbitrary locked directions', () => {
  for (const aim of [-1.13, 0.83, 2.3]) {
    const { view, course } = fixture(bossPattern(2, 2.71, aim, boss));
    for (const time of [2.71, 2.93, 3.22]) {
      const pattern = bossPattern(2, time, aim, boss);
      course.field.bossAttack = pattern;
      view.update(course);
      for (const offset of [-0.8, -0.2, 0, 0.2, 0.8]) {
        const player = point(pattern.sweep + offset, 5);
        assert.equal(
          covered(view, [view.blade], player),
          bossAttackHits(pattern, boss, player),
          JSON.stringify({ time, aim, offset }),
        );
      }
    }
    dispose(view);
  }
});

test('windup fan warns the entire area the moving blade can reach', () => {
  const aim = 0.63,
    { view } = fixture(bossPattern(2, 2.2, aim, boss));
  for (const time of [2.7001, 2.85, 3.05, 3.2499]) {
    const pattern = bossPattern(2, time, aim, boss);
    for (const offset of [-0.29, 0, 0.29]) {
      const player = point(pattern.sweep + offset, 5);
      assert.ok(bossAttackHits(pattern, boss, player));
      assert.ok(
        covered(view, [view.fan], player),
        JSON.stringify({ time, aim, offset, angle: pattern.sweep + offset }),
      );
    }
  }
  dispose(view);
});

test('water ring world geometry follows the same travelling edge as damage', () => {
  const { view, course } = fixture(bossPattern(3, 3.1, 0, boss));
  for (const time of [3.1, 3.4, 3.9]) {
    const pattern = bossPattern(3, time, 0, boss);
    course.field.bossAttack = pattern;
    view.update(course);
    for (const angle of [0, 0.83, 1.5, 2.4])
      for (const offset of [-1.2, -0.5, 0, 0.5, 1.2]) {
        const player = point(angle, Math.max(0.1, pattern.wave + offset));
        assert.equal(
          covered(view, [view.ring], player),
          bossAttackHits(pattern, boss, player),
          JSON.stringify({ time, angle, offset }),
        );
      }
  }
  dispose(view);
});

test('clock cross world bars and safe pockets match both standard and arbitrary rotation', () => {
  const { view, course } = fixture(bossPattern(4, 3.1, 0, boss));
  for (const rotation of [0, Math.PI / 4, 0.37]) {
    const pattern = { ...bossPattern(4, 3.1, 0, boss), rotation };
    course.field.bossAttack = pattern;
    view.update(course);
    for (const x of [-4, -2, 0, 2, 4])
      for (const z of [-4, -2, 0, 2, 4]) {
        const player = { x: boss.x + x, y: boss.y + 0.8, z: boss.z + z };
        assert.equal(
          covered(view, view.cross.children, player),
          bossAttackHits(pattern, boss, player),
          JSON.stringify({ rotation, x, z }),
        );
      }
  }
  dispose(view);
});

test('a defeated or resting boss shows no damaging telegraph', () => {
  const { view, course } = fixture(bossPattern(3, 3.1, 0, boss));
  assert.ok(view.root.visible);
  course.field.bossHP = 0;
  view.update(course);
  assert.equal(view.root.visible, false);
  course.field.bossHP = 100;
  course.field.bossAttack = bossPattern(3, 4.3, 0, boss);
  view.update(course);
  assert.equal(view.root.visible, false);
  dispose(view);
});
