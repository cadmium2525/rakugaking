import { DT } from './controller.js';
import { FieldMissions } from './field-missions.js';
import { bossPattern, bossAttackHits, bossAdvice } from './boss-pattern.js';
export class ExpeditionMissions extends FieldMissions {
  constructor(stage) {
    super(stage);
    this.selected = stage.missions[0].id;
    this.chains = new Map();
  }
  mission(id) {
    return this.stage.missions.find((m) => m.id === id);
  }
  nodes(id) {
    return this.stage.runes.filter((r) => r.mission === id);
  }
  done(id) {
    const m = this.mission(id);
    if (!m) return false;
    if (m.type === 'boss') return this.bossHP <= 0;
    if (m.type === 'combat')
      return this.enemies.filter((e) => e.mission === id).every((e) => e.hp <= 0);
    return this.stage.runes.every((r, i) => r.mission !== id || this.runes.has(i));
  }
  progress(id) {
    const m = this.mission(id);
    if (m.type === 'boss') return `HP ${this.bossHP}/${this.stage.boss.hp}`;
    if (m.type === 'combat') {
      const es = this.enemies.filter((e) => e.mission === id);
      return `${es.filter((e) => e.hp <= 0).length}/${es.length}`;
    }
    const started = this.chains.get(id),
      remaining =
        started !== undefined && m.duration && !this.done(id)
          ? ` · 残り${Math.max(0, m.duration - this.clock + started).toFixed(1)}秒`
          : '';
    return `${this.stage.runes.filter((r, i) => r.mission === id && this.runes.has(i)).length}/${m.nodes.length}${remaining}`;
  }
  target(id) {
    const m = this.mission(id);
    if (!m || this.unlocked) return this.stage.goal;
    if (this.done(id)) return m.reward;
    if (m.type === 'combat')
      return this.enemies.find((e) => e.mission === id && e.hp > 0) || m.reward;
    if (m.type === 'boss') return this.stage.boss;
    return this.stage.runes.find((r, i) => r.mission === id && !this.runes.has(i)) || m.reward;
  }
  bossReady() {
    return (this.stage.boss.requires || []).every((id) => this.done(id));
  }
  update(course, attack) {
    const p = course.sim.position,
      stats = course.sim.stats,
      ground = this.stage.height;
    this.clock = course.elapsed;
    this.attackFlash = Math.max(0, this.attackFlash - DT);
    if (attack) this.attackFlash = 0.2;
    const say = (text) => {
      course.notice = text;
      course.noticeUntil = course.elapsed + 3;
    };
    const hurt = (damage) => this.hurt(course, damage);
    for (const place of this.stage.discoveries || [])
      if (
        !this.discovered.has(place.id) &&
        Math.hypot(p.x - place.x, p.z - place.z) < place.radius
      ) {
        this.discovered.add(place.id);
        say(`探索発見 · ${place.name}`);
      }
    for (const [i, e] of this.enemies.entries()) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z),
        y = ground(e.x, e.z),
        m = this.mission(e.mission);
      const hit = this.hitTarget(
        course,
        attack,
        `enemy:${i}`,
        { x: e.x, y: y + 0.8, z: e.z },
        { radius: 0.8, vertical: 2.3 },
      );
      if (hit) this.applyEnemyHit(course, e, hit, i);
      if (e.hp <= 0) continue;
      if (this.updateEnemyImpact(course, e)) continue;
      e.timer += DT;
      if (e.phase === 'windup') {
        if (e.timer >= 0.95) {
          if (d < 2.4 && p.y < y + 1.5) hurt(20);
          e.strikeUntil = course.elapsed + 0.16;
          e.phase = 'rest';
          e.timer = 0;
        }
      } else if (e.phase === 'rest') {
        if (e.timer > 1.4) e.phase = 'patrol';
      } else if (d < 2.6) {
        e.phase = 'windup';
        e.timer = 0;
      } else if (d < 9 && Math.hypot(p.x - m.x, p.z - m.z) < m.radius) {
        this.moveEnemy(course, e, ((p.x - e.x) / d) * DT * 1.6, ((p.z - e.z) / d) * DT * 1.6);
      }
    }
    for (const m of this.stage.missions)
      if (
        m.duration &&
        !this.done(m.id) &&
        this.chains.has(m.id) &&
        course.elapsed - this.chains.get(m.id) > m.duration
      ) {
        this.stage.runes.forEach((r, i) => {
          if (r.mission === m.id) this.runes.delete(i);
        });
        this.chains.delete(m.id);
        say(`${m.short} · 時間切れ。最初の輪からもう一度！`);
      }
    this.stage.runes.forEach((r, i) => {
      const m = this.mission(r.mission),
        active = m.type === 'relay' || attack;
      if (
        !active ||
        this.runes.has(i) ||
        Math.hypot(p.x - r.x, p.z - r.z) > 2 ||
        Math.abs(p.y - r.y - 0.8) > 1.8
      )
        return;
      if (m.sequence) {
        const expected = this.stage.runes.findIndex(
          (n, j) => n.mission === m.id && !this.runes.has(j),
        );
        if (i !== expected) {
          say(`${m.short} · 光る番号順に${m.type === 'relay' ? '通過' : 'ACTION'}`);
          return;
        }
      }
      if (
        m.type !== 'relay' &&
        !this.hitTarget(
          course,
          attack,
          `rune:${i}`,
          { ...r, y: r.y + 0.8 },
          { radius: 0.7, vertical: 1.8, interaction: true },
        )
      )
        return;
      this.runes.add(i);
      if (m.duration && !this.chains.has(m.id)) this.chains.set(m.id, course.elapsed);
      say(
        `${m.short} ${this.progress(m.id)}${m.effect === 'wind' && this.done(m.id) ? ' · 谷の風が弱まった！' : m.effect === 'drain' && this.done(m.id) ? ' · 水位が下がり、庭の通路が開いた！' : ''}`,
      );
    });
    const b = this.stage.boss,
      distance = Math.hypot(p.x - b.x, p.z - b.z);
    if (this.bossHP > 0 && distance < 13 && this.bossReady()) {
      this.bossTime += DT;
      const previous = this.bossPhase;
      this.bossAttack = bossPattern(this.stage.id, this.bossTime, this.bossAim || 0, b);
      this.bossPhase = this.bossAttack.phase;
      if (this.bossPhase === 'windup' && previous !== 'windup') {
        this.bossAim = Math.atan2(p.x - b.x, p.z - b.z);
        this.bossAttack.aim = this.bossAim;
        this.bossAttack.sweep = this.bossAim;
      }
      if (this.bossPhase !== 'slam') this.slamHit = false;
      if (!this.slamHit && bossAttackHits(this.bossAttack, b, p)) {
        hurt(b.damage || 32);
        this.slamHit = true;
      }
    } else if (this.bossHP > 0) {
      this.bossTime = 0;
      this.bossAttack = null;
      this.bossPhase = this.bossReady() ? 'sleep' : 'shield';
    }
    if (this.bossHP > 0) {
      const hit = this.hitTarget(
        course,
        attack,
        'boss',
        { ...b, y: b.y + 1.2 },
        { radius: 1.9, vertical: 3, blocked: this.bossPhase !== 'rest' },
      );
      if (hit && !hit.blocked) {
        this.bossHP = Math.max(0, this.bossHP - hit.damage);
        this.bossHitUntil = course.elapsed + 0.2;
        if (this.bossHP <= 0) {
          this.bossDefeatedAt = course.elapsed;
          course.combat?.emit('defeat', { key: 'boss', ...b, y: b.y + 1.8, combo: hit.combo || 1 });
        }
      }
    }
    for (const m of this.stage.missions)
      if (
        this.done(m.id) &&
        !this.rewards.has(m.id) &&
        Math.hypot(p.x - m.reward.x, p.z - m.reward.z, p.y - m.reward.y) < 1.8
      ) {
        this.rewards.add(m.id);
        course.hp = stats.hp || 100;
        course.sim.spawn = { x: m.x, y: ground(m.x, m.z) + 1.8, z: m.z };
        say(`紋章を獲得！ ${this.rewards.size}/${this.stage.missions.length} · HP回復`);
        this.selected =
          this.stage.missions.find((next) => !this.rewards.has(next.id))?.id || 'goal';
      }
    course.activated = this.unlocked;
    const gate = this.stage.platforms.findIndex((p) => p.gate);
    course.sim.platforms[gate].setEnabled(!this.unlocked);
  }
  guidance(course) {
    if (this.unlocked) return '3つの紋章が揃った！ 光る門へ';
    const p = course.sim.position,
      b = this.stage.boss;
    const crumble = this.stage.platforms.find(
      (t, i) =>
        t.collapse &&
        course.collapseTimes[i] !== null &&
        Math.abs(p.x - t.x) < t.w / 2 &&
        Math.abs(p.z - t.z) < t.d / 2 &&
        Math.abs(p.y - 0.8 - t.y - t.h / 2) < 0.3,
    );
    if (crumble)
      return `崩壊まで ${Math.max(0, crumble.collapse - course.elapsed + course.collapseTimes[this.stage.platforms.indexOf(crumble)]).toFixed(1)}秒 · 通り抜けよう！`;
    const relay = this.stage.missions.find(
      (m) => m.duration && this.chains.has(m.id) && !this.done(m.id),
    );
    if (relay) {
      const next = this.stage.runes.find((r, i) => r.mission === relay.id && !this.runes.has(i));
      return `${relay.short} ${this.progress(relay.id)} · 次は${(next?.index || 0) + 1}番の輪`;
    }
    if (Math.hypot(p.x - b.x, p.z - b.z) < 13 && this.bossHP > 0)
      return this.bossReady()
        ? `${b.name} HP ${this.bossHP}/${b.hp} · ${this.bossPhase === 'rest' ? '緑に光る今！ 近づいて3連撃' : bossAdvice(this.bossAttack?.kind)}`
        : '巨人の盾が作動中 · 星座と守衛のミッションを先に達成しよう';
    if (course.noticeUntil > course.elapsed) return course.notice;
    const ledge = this.stage.platforms.find(
      (t) =>
        t.visible !== false &&
        !t.terrain &&
        Math.abs(p.x - t.x) < t.w / 2 + 1.2 &&
        Math.abs(p.z - t.z) < t.d / 2 + 1.2 &&
        t.y + t.h / 2 > p.y - 0.8 + 0.26,
    );
    if (ledge) return '橋の段差はJUMPで登れる · 橋の前後からも渡れます';
    const m = this.mission(this.selected);
    return `${this.rewards.size}/3 紋章 · ${m ? (this.done(m.id) ? `${m.short}の光る紋章を拾おう` : m.name) : 'ミッションを選ぼう'}${m?.type === 'relay' ? ' · 光の輪を順に通ろう' : m?.sequence ? ' · 光る番号順にACTION' : ' · 近くでACTION'}`;
  }
}
