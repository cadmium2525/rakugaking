import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, initPhysics } from '../src/core/controller.js';
import { STAGES } from '../src/game/stages.js';
before(initPhysics);
test('actual city stall blocks a melee line and a knocked enemy cannot enter its solid volume', () => {
  const stage = STAGES[3],
    sim = new Simulation(stage.platforms, stage.spawn),
    y = stage.height(30, -12) + 0.8,
    a = { x: 30, y, z: -10.8 },
    b = { x: 30, y, z: -13.2 };
  assert.equal(sim.lineClear(a, b), false);
  assert.equal(sim.lineClear({ ...a, x: 27 }, { ...b, x: 27 }), true);
  const moved = sim.moveActor({ x: 30, y, z: -9 }, { x: 0, z: -6 });
  assert.ok(moved.z > -10.5, JSON.stringify(moved));
  assert.ok(moved.z < -9);
  sim.dispose();
});
test('disabled barriers stop blocking attacks while the ground never pins a walking enemy', () => {
  const stage = STAGES[1],
    sim = new Simulation(stage.platforms, stage.spawn),
    gate = stage.gate,
    a = { x: gate.x, y: gate.y, z: gate.z + 1 },
    b = { x: gate.x, y: gate.y, z: gate.z - 1 };
  assert.equal(sim.lineClear(a, b), false);
  sim.platforms[stage.platforms.findIndex((p) => p.gate)].setEnabled(false);
  sim.world.step();
  assert.equal(sim.lineClear(a, b), true);
  const p = { x: 22, y: stage.height(22, -40) + 0.9, z: -40 },
    moved = sim.moveActor(p, { x: 0.1, z: 0 });
  assert.ok(moved.x > p.x + 0.09, JSON.stringify(moved));
  sim.dispose();
});
