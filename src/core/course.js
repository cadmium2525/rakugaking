import { Simulation, DT } from './controller.js';
export class Course {
  constructor(stage, stats) {
    this.stage = stage;
    this.sim = new Simulation(stage.platforms, stage.spawn, stats);
    this.elapsed = 0;
    this.complete = false;
    this.activated = !stage.requiresAction;
    this.sealHP = stage.sealHP || 1;
    this.actionHeld = false;
    this.nextAction = 0;
    this.nextDamage = 0;
    this.destroyed = new Set();
    this.collected = new Set();
    this.checkpoint = -1;
    this.hp = stats.hp || 100;
    this.collapseTimes = stage.platforms.map(() => null);
  }
  step(input) {
    if (this.complete) return 'finished';
    this.elapsed += DT;
    this.updatePlatforms();
    const event = this.sim.step(input, this.environment());
    if (event === 'death') this.restore();
    const p = this.sim.position,
      g = this.stage.goal,
      stats = this.sim.stats;
    const distance = Math.hypot(p.x - g.x, p.z - g.z);
    for (const index of this.stage.checkpoints || []) {
      const tile = this.stage.platforms[index];
      if (
        index > this.checkpoint &&
        this.sim.grounded &&
        Math.abs(p.x - tile.x) < tile.w / 2 &&
        Math.abs(p.z - tile.z) < tile.d / 2 &&
        Math.abs(p.y - tile.y - tile.h / 2 - 0.8) < 0.3
      ) {
        this.checkpoint = index;
        this.sim.spawn = { x: tile.x, y: tile.y + tile.h / 2 + 1, z: tile.z };
      }
    }
    for (const [i, item] of (this.stage.collectibles || []).entries()) {
      if (Math.hypot(p.x - item.x, p.y - item.y, p.z - item.z) < 1.2) this.collected.add(i);
    }
    const attack = input.action && !this.actionHeld && this.elapsed >= this.nextAction;
    this.actionHeld = !!input.action;
    if (attack) {
      this.nextAction = this.elapsed + (stats.actionCooldown || 0.6) - (stats.luck || 0) * 0.8;
      if (distance < (stats.reach || 1) + 1) {
        this.sealHP -= stats.power || 20;
        if (this.sealHP <= 0) this.activated = true;
      }
    }
    for (const [i, h] of (this.stage.hazards || []).entries()) {
      if (this.destroyed.has(i)) continue;
      const d = Math.hypot(p.x - this.hazardPosition(h).x, p.z - h.z, p.y - h.y);
      if (attack && d < (stats.reach || 1) + 0.7) this.destroyed.add(i);
      else if (d < 0.8 && this.elapsed >= this.nextDamage) {
        this.hp -= Math.max(4, 25 - (stats.defense || 8) * 0.6);
        this.nextDamage = this.elapsed + 1;
        if (this.hp <= 0) {
          this.sim.deaths++;
          this.retry();
          return 'death';
        }
      }
    }
    if (distance < 1.1 && Math.abs(p.y - (g.y + 0.8)) < 1.2 && this.activated) {
      this.complete = true;
      return 'complete';
    }
    return event;
  }
  updatePlatforms() {
    const p = this.sim.position;
    for (const [i, t] of this.stage.platforms.entries()) {
      if (!t.collapse) continue;
      if (
        this.collapseTimes[i] === null &&
        this.sim.grounded &&
        Math.abs(p.x - t.x) < t.w / 2 &&
        Math.abs(p.z - t.z) < t.d / 2 &&
        Math.abs(p.y - 0.8 - t.y - t.h / 2) < 0.15
      )
        this.collapseTimes[i] = this.elapsed;
      if (this.collapseTimes[i] !== null && this.elapsed - this.collapseTimes[i] > t.collapse)
        this.sim.platforms[i].setEnabled(false);
    }
  }
  restore() {
    this.hp = this.sim.stats.hp || 100;
    this.collapseTimes.fill(null);
    this.sim.platforms.forEach((p) => p.setEnabled(true));
    this.destroyed.clear();
  }
  retry() {
    this.restore();
    this.sim.reset();
  }
  environment() {
    const p = this.sim.position,
      w = (this.stage.winds || [this.stage.wind]).find((w) => w && p.z > w.minZ && p.z < w.maxZ),
      water = (this.stage.waters || [this.stage.water]).find(
        (w) => w && p.z > w.minZ && p.z < w.maxZ,
      );
    return {
      windZ: w && p.z > w.minZ && p.z < w.maxZ ? 5.7 + Math.sin(this.elapsed * 1.4) * 2.5 : 0,
      water: !!water && p.z > water.minZ && p.z < water.maxZ && p.y < water.surface + 1.2,
    };
  }
  dispose() {
    this.sim.dispose();
  }
  hazardPosition(h) {
    return { ...h, x: h.x + Math.sin(this.elapsed * (h.speed || 1)) * (h.travel || 0) };
  }
}
