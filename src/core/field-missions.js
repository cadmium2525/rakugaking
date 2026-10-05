import { DT } from './controller.js';

export class FieldMissions {
  constructor(stage) {
    this.stage = stage;
    this.enemies = stage.enemies.map((e) => ({
      ...e,
      homeX: e.x,
      homeZ: e.z,
      timer: 0,
      phase: 'patrol',
      stunUntil: 0,
      knockVX: 0,
      knockVZ: 0,
    }));
    this.runes = new Set();
    this.rewards = new Set();
    this.bossHP = stage.boss.hp;
    this.bossTime = 0;
    this.bossPhase = 'sleep';
    this.bossAttack = null;
    this.slamHit = false;
    this.selected = 'orchard';
    this.attackFlash = 0;
    this.discovered = new Set();
  }
  done(id) {
    return id === 'orchard'
      ? this.enemies.every((e) => e.hp <= 0)
      : id === 'ruins'
        ? this.runes.size === 3
        : this.bossHP <= 0;
  }
  get unlocked() {
    return this.rewards.size === this.stage.missions.length;
  }
  resetCombat() {
    // Completed objectives and collected emblems survive a retry.
    if (this.bossHP > 0) this.bossHP = this.stage.boss.hp;
    this.bossTime = 0;
    this.bossPhase = 'sleep';
    this.bossAttack = null;
    this.enemies.forEach((e) => {
      e.x = e.homeX;
      e.z = e.homeZ;
      e.timer = 0;
      e.phase = 'patrol';
      e.stunUntil = 0;
      e.knockVX = 0;
      e.knockVZ = 0;
    });
  }
  combatTargets(course) {
    const height = this.stage.height || (() => 0),
      p = course.sim.position;
    return [
      ...this.enemies.flatMap((e, i) =>
        e.hp > 0
          ? [{ key: `enemy:${i}`, x: e.x, y: height(e.x, e.z) + 0.8, z: e.z, radius: 0.65 }]
          : [],
      ),
      ...this.stage.runes.flatMap((r, i) =>
        !this.runes.has(i) && this.mission?.(r.mission)?.type !== 'relay'
          ? [{ key: `rune:${i}`, x: r.x, y: r.y + 0.8, z: r.z, radius: 0.7 }]
          : [],
      ),
      ...(this.bossHP > 0
        ? [{ key: 'boss', ...this.stage.boss, y: (this.stage.boss.y || 0) + 1.2, radius: 1.9 }]
        : []),
    ].filter((t) => Math.hypot(t.x - p.x, t.z - p.z) < 7);
  }
  hitTarget(course, attack, key, target, options = {}) {
    if (!attack) return null;
    if (course.sim.lineClear && !course.sim.lineClear(course.sim.position, target)) return null;
    if (typeof attack === 'object') return course.combat?.hit(key, target, options) || null;
    // Keep the mission's explicit boolean command API for isolated rule checks;
    // the game supplies the Combat strike object with timing and hit ownership.
    const p = course.sim.position;
    if (
      Math.hypot(p.x - target.x, p.z - target.z) >
        (course.sim.stats.reach || 1) + 0.7 + (options.radius || 0.65) ||
      Math.abs(p.y - (target.y ?? p.y)) > (options.vertical || 2.5)
    )
      return null;
    return {
      damage: course.sim.stats.power || 20,
      dx: 0,
      dz: 0,
      force: 0,
      stun: 0.3,
      blocked: options.blocked,
    };
  }
  applyEnemyHit(course, e, hit, index) {
    e.hp = Math.max(0, e.hp - hit.damage);
    e.hitUntil = course.elapsed + 0.2;
    e.stunUntil = course.elapsed + hit.stun;
    e.knockVX = hit.dx * hit.force;
    e.knockVZ = hit.dz * hit.force;
    e.phase = 'stagger';
    e.timer = 0;
    if (e.hp <= 0) {
      e.defeatedAt = course.elapsed;
      course.combat?.emit('defeat', {
        key: `enemy:${index}`,
        x: e.x,
        y: (this.stage.height?.(e.x, e.z) || 0) + 0.8,
        z: e.z,
        combo: hit.combo || 1,
      });
    }
  }
  updateEnemyImpact(course, e) {
    const mission = this.stage.missions.find((m) => m.id === e.mission) || this.stage.missions[0];
    this.moveEnemy(course, e, e.knockVX * DT, e.knockVZ * DT);
    e.knockVX *= Math.exp(-DT * 6);
    e.knockVZ *= Math.exp(-DT * 6);
    const distance = Math.hypot(e.x - mission.x, e.z - mission.z),
      limit = Math.max(2, mission.radius - 0.8);
    if (distance > limit) {
      e.x = mission.x + ((e.x - mission.x) / distance) * limit;
      e.z = mission.z + ((e.z - mission.z) / distance) * limit;
    }
    if (e.phase === 'stagger') {
      if (course.elapsed >= e.stunUntil) {
        e.phase = 'rest';
        e.timer = 0.65;
      }
      return true;
    }
    return false;
  }
  hurt(course, damage) {
    if (course.elapsed < course.nextDamage) return;
    const amount = Math.max(4, damage - (course.sim.stats.defense || 8) * 0.4);
    course.hp -= amount;
    course.nextDamage = course.elapsed + 1.2;
    course.combat?.hurt(amount, course.sim.position);
  }
  moveEnemy(course, e, x, z) {
    const height = this.stage.height?.(e.x, e.z) || 0;
    const next = course.sim.moveActor?.({ x: e.x, y: height + 0.9, z: e.z }, { x, z });
    if (next) Object.assign(e, next);
    else {
      e.x += x;
      e.z += z;
    }
  }
  update(course, attack) {
    const p = course.sim.position,
      stats = course.sim.stats;
    this.attackFlash = Math.max(0, this.attackFlash - DT);
    for (const place of this.stage.discoveries || []) {
      if (
        !this.discovered.has(place.id) &&
        Math.hypot(p.x - place.x, p.z - place.z) < place.radius
      ) {
        this.discovered.add(place.id);
        course.notice = `探索発見 · ${place.name}`;
        course.noticeUntil = course.elapsed + 3;
      }
    }
    if (attack) this.attackFlash = 0.2;
    const hurt = (damage) => this.hurt(course, damage);
    for (const [i, e] of this.enemies.entries()) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      const hit = this.hitTarget(
        course,
        attack,
        `enemy:${i}`,
        { x: e.x, y: 0.8, z: e.z },
        { radius: 0.8 },
      );
      if (hit) this.applyEnemyHit(course, e, hit, i);
      if (e.hp <= 0) continue;
      if (this.updateEnemyImpact(course, e)) continue;
      e.timer += DT;
      if (e.phase === 'windup') {
        if (e.timer >= 0.9) {
          if (d < 2.4 && p.y < 1.5) hurt(19);
          e.strikeUntil = course.elapsed + 0.16;
          e.phase = 'rest';
          e.timer = 0;
        }
      } else if (e.phase === 'rest') {
        if (e.timer > 1.4) e.phase = 'patrol';
      } else if (d < 2.6) {
        e.phase = 'windup';
        e.timer = 0;
      } else if (d < 8 && Math.hypot(p.x + 21, p.z + 18) < 11) {
        this.moveEnemy(course, e, ((p.x - e.x) / d) * DT * 1.6, ((p.z - e.z) / d) * DT * 1.6);
      }
    }
    this.stage.runes.forEach((r, i) => {
      if (
        !this.runes.has(i) &&
        this.hitTarget(
          course,
          attack,
          `rune:${i}`,
          { ...r, y: r.y + 0.8 },
          { radius: 0.7, vertical: 1.5, interaction: true },
        )
      )
        this.runes.add(i);
    });
    const b = this.stage.boss,
      distance = Math.hypot(p.x - b.x, p.z - b.z);
    if (this.bossHP > 0 && distance < 12) {
      this.bossTime += DT;
      const t = this.bossTime % 6.5;
      this.bossPhase = t < 2 ? 'guard' : t < 3.2 ? 'windup' : t < 3.5 ? 'slam' : 'rest';
      if (this.bossPhase !== 'slam') this.slamHit = false;
      if (this.bossPhase === 'slam' && !this.slamHit) {
        if (distance < 6 && p.y < 1.6) hurt(32);
        this.slamHit = true;
      }
    } else if (this.bossHP > 0) {
      this.bossTime = 0;
      this.bossPhase = 'sleep';
    }
    if (this.bossHP > 0) {
      const hit = this.hitTarget(
        course,
        attack,
        'boss',
        { ...b, y: 1.2 },
        { radius: 1.9, vertical: 3, blocked: this.bossPhase !== 'rest' },
      );
      if (hit && !hit.blocked) {
        this.bossHP = Math.max(0, this.bossHP - hit.damage);
        this.bossHitUntil = course.elapsed + 0.2;
        if (this.bossHP <= 0) {
          this.bossDefeatedAt = course.elapsed;
          course.combat?.emit('defeat', { key: 'boss', ...b, y: 1.8, combo: hit.combo || 1 });
        }
      }
    }
    for (const m of this.stage.missions) {
      if (
        this.done(m.id) &&
        !this.rewards.has(m.id) &&
        Math.hypot(p.x - m.reward.x, p.z - m.reward.z, p.y - m.reward.y) < 1.8
      ) {
        this.rewards.add(m.id);
        course.hp = stats.hp || 100;
        course.sim.spawn = { x: 0, y: 1.8, z: -12 };
        course.notice = `紋章を獲得！ ${this.rewards.size}/3 · HP回復`;
        course.noticeUntil = course.elapsed + 3;
        this.selected =
          this.stage.missions.find((next) => !this.rewards.has(next.id))?.id || 'goal';
      }
    }
    course.activated = this.unlocked;
    const gate = this.stage.platforms.findIndex((p) => p.gate);
    if (gate >= 0) course.sim.platforms[gate].setEnabled(!course.activated);
  }
  guidance(course) {
    if (this.unlocked) return '3つの紋章が揃った！ 北の光る門へ';
    const p = course.sim.position,
      b = this.stage.boss;
    if (Math.hypot(p.x, p.z + 65) < 8)
      return `門は封印中 · あと ${3 - this.rewards.size} 個の紋章が必要`;
    if (Math.hypot(p.x - b.x, p.z - b.z) < 12 && this.bossHP > 0) {
      return `大樹の番人 HP ${this.bossHP}/${b.hp} · ${this.bossPhase === 'rest' ? '今がチャンス！ 近づいてACTION' : this.bossPhase === 'windup' || this.bossPhase === 'slam' ? '赤い円の外へ！ ジャンプでも回避' : '衝撃波の後に攻撃しよう'}`;
    }
    if (course.noticeUntil > course.elapsed) return course.notice;
    const m = this.stage.missions.find((m) => m.id === this.selected);
    if (m && this.done(m.id)) return `${m.short}の光る紋章を拾おう`;
    if (Math.hypot(p.x - 22, p.z + 24) < 15 && this.runes.size < 3)
      return `古代遺跡 ${this.runes.size}/3 · JUMPで段差を登り、石碑の近くでACTION`;
    return `${this.rewards.size}/3 紋章 · ${m?.name || 'ミッションを選ぼう'} · ACTIONで攻撃・起動`;
  }
  snapshot() {
    return {
      rewards: [...this.rewards],
      runes: [...this.runes],
      enemies: this.enemies.map((e) => ({ x: e.x, z: e.z, hp: e.hp, phase: e.phase })),
      bossHP: this.bossHP,
      bossPhase: this.bossPhase,
      bossAttack: this.bossAttack ? { ...this.bossAttack } : null,
      selected: this.selected,
    };
  }
}
