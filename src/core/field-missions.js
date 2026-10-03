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
    }));
    this.runes = new Set();
    this.rewards = new Set();
    this.bossHP = stage.boss.hp;
    this.bossTime = 0;
    this.bossPhase = 'sleep';
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
    this.enemies.forEach((e) => {
      e.x = e.homeX;
      e.z = e.homeZ;
      e.timer = 0;
      e.phase = 'patrol';
    });
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
    const hurt = (damage) => {
      if (course.elapsed < course.nextDamage) return;
      course.hp -= Math.max(4, damage - (stats.defense || 8) * 0.4);
      course.nextDamage = course.elapsed + 1.2;
    };
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (attack && d < (stats.reach || 1) + 1.5 && p.y < 3.3) {
        e.hp -= stats.power || 20;
        e.hitUntil = course.elapsed + 0.18;
      }
      if (e.hp <= 0) continue;
      e.timer += DT;
      if (e.phase === 'windup') {
        if (e.timer >= 0.9) {
          if (d < 2.4 && p.y < 1.5) hurt(19);
          e.phase = 'rest';
          e.timer = 0;
        }
      } else if (e.phase === 'rest') {
        if (e.timer > 1.4) e.phase = 'patrol';
      } else if (d < 2.6) {
        e.phase = 'windup';
        e.timer = 0;
      } else if (d < 8 && Math.hypot(p.x + 21, p.z + 18) < 11) {
        e.x += ((p.x - e.x) / d) * DT * 1.6;
        e.z += ((p.z - e.z) / d) * DT * 1.6;
      }
    }
    this.stage.runes.forEach((r, i) => {
      if (attack && Math.hypot(p.x - r.x, p.z - r.z) < 2.4 && Math.abs(p.y - r.y - 0.8) < 1.5)
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
      if (attack && this.bossPhase === 'rest' && distance < (stats.reach || 1) + 2.6 && p.y < 3.8) {
        this.bossHP = Math.max(0, this.bossHP - (stats.power || 20));
      }
    } else if (this.bossHP > 0) {
      this.bossTime = 0;
      this.bossPhase = 'sleep';
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
      enemies: this.enemies.map((e) => ({ x: e.x, z: e.z, hp: e.hp })),
      bossHP: this.bossHP,
      bossPhase: this.bossPhase,
      selected: this.selected,
    };
  }
}
