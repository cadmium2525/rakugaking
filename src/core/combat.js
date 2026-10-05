const MOVES = [
  { name: '薙ぎ払い', duration: 0.38, windup: 0.09, active: 0.15, damage: 1, force: 3, stun: 0.3 },
  {
    name: '返しの一撃',
    duration: 0.42,
    windup: 0.1,
    active: 0.16,
    damage: 1.1,
    force: 3.6,
    stun: 0.34,
  },
  {
    name: 'フィニッシュ',
    duration: 0.56,
    windup: 0.15,
    active: 0.18,
    damage: 1.65,
    force: 6.5,
    stun: 0.65,
  },
];
const AIR_MOVE = {
  name: '空中スピン',
  duration: 0.5,
  windup: 0.08,
  active: 0.23,
  damage: 1.25,
  force: 4.5,
  stun: 0.45,
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// This state machine is independent of a Course, so the same attack can be used
// in the workshop's practice yard. Movement still goes through the controller.
export class Combat {
  constructor(stats = {}) {
    this.stats = stats;
    this.clock = 0;
    this.eventId = 0;
    this.events = [];
    this.facing = { x: 0, z: -1 };
    this.reset();
  }
  reset() {
    this.held = false;
    this.bufferUntil = -Infinity;
    this.chainUntil = -Infinity;
    this.lastCombo = 0;
    this.swing = null;
    this.targets = [];
    this.position = { x: 0, y: 0.8, z: 0 };
    this.hurtUntil = 0;
    this.events.length = 0;
  }
  emit(type, details = {}) {
    const event = { id: ++this.eventId, type, time: this.clock, ...details };
    this.events.push(event);
    if (this.events.length > 32) this.events.shift();
    return event;
  }
  update(input = {}, dt = 1 / 60, context = {}) {
    this.clock += dt;
    this.position = { ...(context.position || this.position) };
    this.grounded = context.grounded !== false;
    this.targets = context.targets || [];
    const movement = Math.hypot(input.x || 0, input.z || 0);
    if (movement > 0.15) {
      this.facing.x = input.x / movement;
      this.facing.z = input.z / movement;
    }
    if (input.actionPressed || (input.action && !this.held)) this.bufferUntil = this.clock + 0.65;
    this.held = !!input.action;
    if (this.swing) {
      this.swing.elapsed += dt;
      if (this.swing.elapsed >= this.swing.move.duration) {
        this.lastCombo = this.swing.airborne ? 0 : this.swing.combo;
        this.chainUntil = this.clock + 1.05;
        this.swing = null;
      }
    }
    if (!this.swing && this.bufferUntil >= this.clock) this.start();
    return this.attack;
  }
  start() {
    const p = this.position,
      reach = this.stats.reach || 1,
      candidates = this.targets
        .filter((t) => Math.abs((t.y ?? p.y) - p.y) < 3.2)
        .map((t) => {
          const dx = t.x - p.x,
            dz = t.z - p.z,
            distance = Math.hypot(dx, dz);
          return {
            ...t,
            distance,
            alignment: distance > 0.01 ? (dx * this.facing.x + dz * this.facing.z) / distance : 1,
          };
        })
        .filter((t) => t.distance < reach + (t.radius || 0.6) + 2.2 && t.alignment >= 0.45)
        .sort(
          (a, b) => a.distance + (1 - a.alignment) * 0.8 - b.distance - (1 - b.alignment) * 0.8,
        );
    const target = candidates[0];
    if (target && target.distance > 0.01) {
      this.facing.x = (target.x - p.x) / target.distance;
      this.facing.z = (target.z - p.z) / target.distance;
    }
    const airborne = !this.grounded,
      combo =
        !airborne && this.clock <= this.chainUntil && this.lastCombo < 3 ? this.lastCombo + 1 : 1,
      base = airborne ? AIR_MOVE : MOVES[combo - 1],
      // Drawing weight affects recovery a little, without making any build's
      // attack slow enough to lose a buffered tap or miss a boss's opening.
      cooldown = (this.stats.actionCooldown || 0.6) - clamp(this.stats.luck || 0, 0, 0.05) * 0.8,
      cadence = clamp(cooldown / 0.6, 0.88, 1.12),
      move = { ...base, duration: base.duration * cadence };
    this.swing = {
      combo,
      airborne,
      move,
      elapsed: 0,
      hits: new Set(),
      facing: { ...this.facing },
      target: target || null,
    };
    this.bufferUntil = -Infinity;
    this.emit('swing', { ...p, combo, airborne, name: move.name, facing: { ...this.facing } });
  }
  get attack() {
    const s = this.swing;
    return s && s.elapsed >= s.move.windup && s.elapsed < s.move.windup + s.move.active ? s : null;
  }
  get motion() {
    const s = this.swing;
    if (!s || s.airborne || s.elapsed < 0.04 || s.elapsed > s.move.windup + s.move.active)
      return {};
    const p = this.position,
      stop = (s.target?.radius || 0.65) + 0.75;
    if (s.target && Math.hypot(s.target.x - p.x, s.target.z - p.z) < stop) return {};
    // Less than 0.7 m per strike, with no vertical impulse or teleportation.
    const force = s.combo === 3 ? 3.1 : 2.2;
    return { burstX: s.facing.x * force, burstZ: s.facing.z * force };
  }
  hit(key, target, { radius = 0.65, vertical = 2.5, blocked = false, interaction = false } = {}) {
    const s = this.attack;
    if (!s || s.hits.has(key)) return null;
    const p = this.position,
      dx = target.x - p.x,
      dz = target.z - p.z,
      distance = Math.hypot(dx, dz),
      reach = (this.stats.reach || 1) + 0.7 + radius + (s.combo === 3 ? 0.25 : 0);
    if (distance > reach || Math.abs((target.y ?? p.y) - p.y) > vertical) return null;
    const progress = clamp((s.elapsed - s.move.windup) / s.move.active, 0, 1),
      sweep = s.combo === 3 ? 0 : (s.combo === 2 ? -1 : 1) * (-0.8 + progress * 1.6),
      angle = Math.atan2(s.facing.x, s.facing.z) + sweep,
      dot = distance > 0.01 ? (dx * Math.sin(angle) + dz * Math.cos(angle)) / distance : 1;
    // The visible crescent is 2.24 radians wide and sweeps with this same angle.
    // A side target is hit when the strike reaches it, rather than at windup.
    if (!s.airborne && dot < Math.cos(1.12)) return null;
    s.hits.add(key);
    const hit = {
      damage: Math.max(1, Math.round((this.stats.power || 20) * s.move.damage)),
      force: s.move.force,
      stun: s.move.stun,
      dx: distance > 0.01 ? dx / distance : s.facing.x,
      dz: distance > 0.01 ? dz / distance : s.facing.z,
      combo: s.combo,
      airborne: s.airborne,
      blocked,
    };
    this.emit(blocked ? 'block' : interaction ? 'switch' : 'hit', {
      key,
      x: target.x,
      y: target.y ?? p.y,
      z: target.z,
      damage: blocked || interaction ? 0 : hit.damage,
      combo: s.combo,
      airborne: s.airborne,
      facing: { x: hit.dx, z: hit.dz },
    });
    return hit;
  }
  hurt(damage, position = this.position) {
    this.hurtUntil = this.clock + 0.28;
    this.emit('hurt', { ...position, damage });
  }
  snapshot() {
    const s = this.swing;
    return {
      attacking: !!s,
      combo: s?.combo || 0,
      airborne: s?.airborne || false,
      name: s?.move.name || '',
      elapsed: s?.elapsed || 0,
      duration: s?.move.duration || 1,
      windup: s?.move.windup || 0,
      active: s?.move.active || 0,
      phase: !s
        ? 'idle'
        : s.elapsed < s.move.windup
          ? 'windup'
          : this.attack
            ? 'strike'
            : 'recover',
      facing: { ...(s?.facing || this.facing) },
      reach: (this.stats.reach || 1) + 0.7,
      buffered: this.bufferUntil >= this.clock,
      hurt: Math.max(0, this.hurtUntil - this.clock) / 0.28,
    };
  }
}
