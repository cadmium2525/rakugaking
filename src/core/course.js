import { Simulation, DT } from './controller.js';
import { FieldMissions } from './field-missions.js';
import { ExpeditionMissions } from './expedition-missions.js';
import { Combat } from './combat.js';
export function windPhase(zone, elapsed) {
  const t = (elapsed + (zone.offset || 0)) % 7;
  return t < 2.5
    ? { name: '強風', force: 7.2, remaining: 2.5 - t }
    : t < 6
      ? { name: '凪', force: 0.35, remaining: 6 - t }
      : { name: '予兆', force: 1.2, remaining: 7 - t };
}
export function insideZone(p, zone) {
  return (
    !!zone &&
    p.z > zone.minZ &&
    p.z < zone.maxZ &&
    Math.abs(p.x - (zone.x || 0)) < (zone.width || 7) / 2 &&
    p.y > (zone.minY ?? -20) &&
    p.y < (zone.maxY ?? 100) &&
    (!zone.radius ||
      Math.hypot(p.x - (zone.x || 0), p.z - (zone.minZ + zone.maxZ) / 2) < zone.radius)
  );
}
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
    this.notice = '';
    this.noticeUntil = 0;
    this.collapseTimes = stage.platforms.map(() => null);
    this.field = stage.expedition
      ? new ExpeditionMissions(stage)
      : stage.field
        ? new FieldMissions(stage)
        : null;
    this.combat = new Combat(stats);
  }
  step(input) {
    if (this.complete) return 'finished';
    this.elapsed += DT;
    this.updatePlatforms();
    this.combat.update(input, DT, {
      position: this.sim.position,
      grounded: this.sim.grounded && !(input.jump && !this.sim.jumpHeld),
      targets: this.field?.combatTargets(this) || [],
    });
    const event = this.sim.step(input, { ...this.environment(), ...this.combat.motion });
    this.combat.position = { ...this.sim.position };
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
        this.notice = '復帰地点を記録';
        this.noticeUntil = this.elapsed + 2;
      }
    }
    for (const [i, item] of (this.stage.collectibles || []).entries()) {
      if (!this.collected.has(i) && Math.hypot(p.x - item.x, p.y - item.y, p.z - item.z) < 1.2) {
        this.collected.add(i);
        this.hp = Math.min(stats.hp || 100, this.hp + 8);
        this.notice = `✦ ${this.collected.size}/${this.stage.collectibles.length} · HP +8`;
        this.noticeUntil = this.elapsed + 1.5;
      }
    }
    const attack = this.combat.attack;
    this.actionHeld = !!input.action;
    if (attack) {
      this.nextAction = this.elapsed + (stats.actionCooldown || 0.6) - (stats.luck || 0) * 0.8;
      if (!this.field && distance < (stats.reach || 1) + 1) {
        const hit = this.combat.hit(
          'seal',
          { ...g, y: g.y + 0.8 },
          { radius: 0.35, interaction: true },
        );
        if (hit) {
          this.sealHP -= hit.damage;
          if (this.sealHP <= 0) this.activated = true;
        }
      }
    }
    for (const [i, h] of (this.stage.hazards || []).entries()) {
      if (this.destroyed.has(i)) continue;
      const d = Math.hypot(p.x - this.hazardPosition(h).x, p.z - h.z, p.y - h.y);
      if (attack && d < (stats.reach || 1) + 0.7) this.destroyed.add(i);
      else if (d < 0.8 && this.elapsed >= this.nextDamage) {
        const damage = Math.max(4, 25 - (stats.defense || 8) * 0.6);
        this.hp -= damage;
        this.combat.hurt(damage);
        this.nextDamage = this.elapsed + 1;
        if (this.hp <= 0) {
          this.sim.deaths++;
          this.retry();
          return 'death';
        }
      }
    }
    if (this.field) {
      this.field.update(this, attack);
      if (this.hp <= 0) {
        this.sim.deaths++;
        this.retry();
        return 'death';
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
    this.combat.reset();
    this.field?.resetCombat();
  }
  retry() {
    this.restore();
    this.sim.reset();
  }
  environment() {
    const p = this.sim.position,
      w = (this.stage.winds || [this.stage.wind]).find((w) => insideZone(p, w)),
      water = (this.stage.waters || [this.stage.water]).find((w) => insideZone(p, w));
    return {
      windZ: w
        ? windPhase(w, this.elapsed).force * (w.effect && this.field?.done(w.effect) ? 0.08 : 1)
        : 0,
      water:
        !!water &&
        p.y - 0.8 < water.surface + 0.08 &&
        !(water.effect && this.field?.done(water.effect)),
    };
  }
  guidance() {
    if (this.field) return this.field.guidance(this);
    const p = this.sim.position;
    const tile = this.stage.platforms.find(
      (tile, i) =>
        this.collapseTimes[i] !== null &&
        Math.abs(p.x - tile.x) < tile.w / 2 &&
        Math.abs(p.z - tile.z) < tile.d / 2 &&
        Math.abs(p.y - 0.8 - tile.y - tile.h / 2) < 0.3,
    );
    if (tile) {
      const i = this.stage.platforms.indexOf(tile);
      return `崩壊まで ${Math.max(0, tile.collapse - this.elapsed + this.collapseTimes[i]).toFixed(1)}秒 · 次の足場へ！`;
    }
    const w = (this.stage.winds || []).find(
      (w) =>
        Math.abs(p.x - (w.x || 0)) < (w.width || 7) / 2 + 2 && p.z > w.minZ && p.z < w.maxZ + 4,
    );
    if (w) {
      const phase = windPhase(w, this.elapsed);
      return `${phase.name} · ${phase.remaining.toFixed(1)}秒で${phase.name === '強風' ? '凪' : phase.name === '凪' ? '予兆' : '強風'} / 橋の端で待てます`;
    }
    const sign = (this.stage.signs || []).find(
      (sign) => Math.hypot(p.x - sign.x, p.z - sign.z) < 7,
    );
    if (sign) return sign.text;
    return this.elapsed < this.noticeUntil ? this.notice : '';
  }
  dispose() {
    this.sim.dispose();
  }
  hazardPosition(h) {
    return { ...h, x: h.x + Math.sin(this.elapsed * (h.speed || 1)) * (h.travel || 0) };
  }
}
