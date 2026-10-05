import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bossPattern, bossAttackHits } from '../src/core/boss-pattern.js';
const boss = { x: 0, y: 0, z: 0, radius: 7 };
test('wind fan sweeps its locked direction, leaving sides safe, then opens for a combo', () => {
  const first = bossPattern(2, 2.71, 0, boss),
    last = bossPattern(2, 3.2, 0, boss);
  const point = (angle) => ({ x: Math.sin(angle) * 5, y: 0.8, z: Math.cos(angle) * 5 });
  assert.ok(bossAttackHits(first, boss, point(first.sweep)));
  assert.ok(!bossAttackHits(first, boss, point(last.sweep)));
  assert.ok(bossAttackHits(last, boss, point(last.sweep)));
  assert.ok(!bossAttackHits(last, boss, point(Math.PI)));
  assert.equal(bossPattern(2, 3.5).phase, 'rest');
});
test('water ring strikes only at the travelling edge and an airborne body clears it', () => {
  const early = bossPattern(3, 3.1),
    late = bossPattern(3, 3.6);
  assert.ok(!bossAttackHits(early, boss, { x: 6, y: 0.8, z: 0 }));
  assert.ok(bossAttackHits(late, boss, { x: 6, y: 0.8, z: 0 }));
  assert.ok(!bossAttackHits(late, boss, { x: 6, y: 2, z: 0 }));
  assert.ok(!bossAttackHits(late, boss, { x: 2, y: 0.8, z: 0 }));
});
test('clock cross has diagonal escape pockets and alternates its orientation', () => {
  const first = bossPattern(4, 3.1),
    second = bossPattern(4, 10.1);
  assert.ok(bossAttackHits(first, boss, { x: 5, y: 0.8, z: 0 }));
  assert.ok(!bossAttackHits(first, boss, { x: 3, y: 0.8, z: 3 }));
  assert.ok(bossAttackHits(second, boss, { x: 3, y: 0.8, z: 3 }));
  assert.ok(!bossAttackHits(second, boss, { x: 5, y: 0.8, z: 0 }));
});
test('final giant retains two separate strikes and a long opening', () => {
  assert.equal(bossPattern(5, 2.9).phase, 'slam');
  assert.equal(bossPattern(5, 3.7).phase, 'windup');
  assert.equal(bossPattern(5, 4.9).phase, 'slam');
  assert.equal(bossPattern(5, 5.2).phase, 'rest');
});
