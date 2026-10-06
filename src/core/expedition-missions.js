import { DT } from './controller.js';
import { insideZone, windPhase } from './course.js';
import { FieldMissions } from './field-missions.js';
import { bossPattern, bossAttackHits, bossAdvice } from './boss-pattern.js';
export class ExpeditionMissions extends FieldMissions {
  constructor(stage) {
    super(stage);
    this.selected = stage.missions[0].id;
    this.chains = new Map();
    this.escorts = new Map();
    this.defenses = new Map();
    for (const m of stage.missions) {
      if (m.type === 'escort')
        this.escorts.set(m.id, {
          x: m.nodes[0][0],
          z: m.nodes[0][1],
          started: false,
          arrived: false,
          trail: [],
        });
      if (m.type === 'defense') {
        this.defenses.set(m.id, {
          started: false,
          elapsed: 0,
          complete: false,
          hp: m.beaconHP || 100,
          wave: 0,
          nextWaveAt: null,
          hitUntil: 0,
        });
        this.enemies
          .filter((e) => e.mission === m.id)
          .forEach((e) => {
            e.active = false;
            e.phase = 'waiting';
          });
      }
    }
    if (stage.boss.disabled) this.bossHP = 0;
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
    if (m.type === 'escort') return this.escorts.get(id).arrived;
    if (m.type === 'defense') return this.defenses.get(id).complete;
    if (m.type === 'boss') return this.bossHP <= 0;
    if (m.type === 'combat')
      return this.enemies.filter((e) => e.mission === id).every((e) => e.hp <= 0);
    return this.stage.runes.every((r, i) => r.mission !== id || this.runes.has(i));
  }
  progress(id) {
    const m = this.mission(id);
    if (!this.ready(id))
      return `${(m.requires || []).map((r) => this.mission(r).short).join('・')}を先に`;
    if (m.type === 'escort') {
      const e = this.escorts.get(id);
      return e.arrived
        ? '到着'
        : e.started
          ? `同行中 · 目的地まで${Math.round(Math.hypot(e.x - m.destination.x, e.z - m.destination.z))}m`
          : '近くでACTION';
    }
    if (m.type === 'defense') {
      const d = this.defenses.get(id);
      const remaining = this.enemies.filter((e) => e.mission === id && e.active && e.hp > 0).length,
        delay =
          d.nextWaveAt === null
            ? ''
            : ` · 次波まで${Math.max(0, d.nextWaveAt - d.elapsed).toFixed(1)}秒`;
      return d.complete
        ? '防衛成功'
        : d.started
          ? `第${d.wave}/${this.defenseWaveCount(m)}波 · 灯台${d.hp}/${m.beaconHP || 100} · 敵${remaining}${delay}`
          : `灯台${m.beaconHP || 100}/${m.beaconHP || 100} · 中央でACTION`;
    }
    if (m.type === 'boss') return `HP ${this.bossHP}/${this.stage.boss.hp}`;
    if (m.type === 'combat') {
      const es = this.enemies.filter((e) => e.mission === id);
      return `${es.filter((e) => e.hp <= 0).length}/${es.length}`;
    }
    const started = this.chains.get(id),
      remaining =
        started !== undefined && m.type === 'relay' && m.duration && !this.done(id)
          ? ` · 残り${Math.max(0, m.duration - this.clock + started).toFixed(1)}秒`
          : '';
    return `${this.stage.runes.filter((r, i) => r.mission === id && this.runes.has(i)).length}/${m.nodes.length}${remaining}`;
  }
  target(id) {
    const m = this.mission(id);
    if (!m || this.unlocked) return this.stage.goal;
    if (this.done(id)) return m.reward;
    if (!this.ready(id)) return this.target((m.requires || []).find((r) => !this.done(r)));
    if (m.type === 'escort') {
      const e = this.escorts.get(id);
      return !e.started || e.waiting ? e : m.destination;
    }
    if (m.type === 'defense') return m;
    if (m.type === 'combat')
      return this.enemies.find((e) => e.mission === id && e.hp > 0) || m.reward;
    if (m.type === 'boss') return this.stage.boss;
    return this.stage.runes.find((r, i) => r.mission === id && !this.runes.has(i)) || m.reward;
  }
  bossReady() {
    if (this.stage.boss.disabled) return false;
    return (this.stage.boss.requires || []).every((id) => this.done(id));
  }
  ready(id) {
    return (this.mission(id)?.requires || []).every((r) => this.done(r));
  }
  combatTargets(course) {
    const targets = super.combatTargets(course).filter((t) => {
      if (t.key === 'boss') return !this.stage.boss.disabled;
      if (t.key.startsWith('enemy:')) return this.enemies[Number(t.key.slice(6))].active !== false;
      if (t.key.startsWith('rune:')) {
        const r = this.stage.runes[Number(t.key.slice(5))],
          m = this.mission(r.mission);
        return this.ready(m.id) && m.type !== 'collect';
      }
      return true;
    });
    for (const m of this.stage.missions)
      if (m.type === 'defense' && !this.defenses.get(m.id).started && this.ready(m.id))
        targets.push({
          key: `defense:${m.id}`,
          ...this.defenseTarget(m, course.sim.position),
          radius: 0.7,
        });
    return targets;
  }
  defenseTarget(m, p) {
    const dx = p.x - m.x,
      dz = p.z - m.z,
      d = Math.hypot(dx, dz) || 1;
    return {
      x: m.x + (dx / d) * 0.55,
      y: this.stage.height(m.x, m.z) + 0.9,
      z: m.z + (dz / d) * 0.55,
    };
  }
  resetDefense(m) {
    const d = this.defenses.get(m.id);
    if (d.complete) return;
    Object.assign(d, {
      started: false,
      elapsed: 0,
      complete: false,
      hp: m.beaconHP || 100,
      wave: 0,
      nextWaveAt: null,
      hitUntil: 0,
    });
    for (const e of this.enemies.filter((e) => e.mission === m.id))
      Object.assign(e, {
        x: e.homeX,
        z: e.homeZ,
        hp: m.enemyHP || 35,
        active: false,
        phase: 'waiting',
        timer: 0,
        stunUntil: 0,
        hitUntil: 0,
        strikeUntil: 0,
        knockVX: 0,
        knockVZ: 0,
        defeatedAt: -Infinity,
      });
  }
  defenseWaveCount(m) {
    return Math.ceil(this.enemies.filter((e) => e.mission === m.id).length / (m.waveSize || 2));
  }
  startDefenseWave(m) {
    const d = this.defenses.get(m.id),
      size = m.waveSize || 2;
    d.wave++;
    d.nextWaveAt = null;
    this.enemies
      .filter((e) => e.mission === m.id)
      .forEach((e, index) => {
        if (Math.floor(index / size) + 1 === d.wave) {
          e.active = true;
          e.phase = 'patrol';
          e.timer = 0;
        }
      });
  }
  updateDefenseWaves(course, say) {
    for (const m of this.stage.missions) {
      if (m.type !== 'defense') continue;
      const d = this.defenses.get(m.id);
      if (!d.started || d.complete) continue;
      if (this.enemies.some((e) => e.mission === m.id && e.active && e.hp > 0)) continue;
      if (d.wave >= this.defenseWaveCount(m)) {
        d.complete = true;
        d.nextWaveAt = null;
        say('月の灯を守り切った！ 巨人の盾が弱まった');
      } else if (d.nextWaveAt === null) {
        d.nextWaveAt = d.elapsed + (m.waveDelay ?? 1);
      } else if (d.elapsed + 1e-8 >= d.nextWaveAt) {
        this.startDefenseWave(m);
        say(`第${d.wave}波！ 灯台へ向かう守衛を迎撃しよう`);
      }
    }
  }
  resetCombat() {
    super.resetCombat();
    for (const m of this.stage.missions)
      if (m.type === 'defense' && !this.done(m.id)) this.resetDefense(m);
  }
  updateIdentities(course, attack, say) {
    const p = course.sim.position;
    for (const m of this.stage.missions) {
      if (m.type === 'escort' && this.ready(m.id)) {
        const e = this.escorts.get(m.id),
          distance = Math.hypot(p.x - e.x, p.z - e.z);
        e.waiting = e.started && !e.arrived && distance > 9;
        if (
          !e.started &&
          distance < 2.5 &&
          this.hitTarget(
            course,
            attack,
            `escort:${m.id}`,
            { ...e, y: this.stage.height(e.x, e.z) + 0.8 },
            { radius: 0.7, vertical: 1.8, interaction: true },
          )
        ) {
          e.started = true;
          this.selected = m.id;
          this.stage.runes.forEach((r, i) => {
            if (r.mission === m.id) this.runes.add(i);
          });
          say('風便の仲間が同行！ 9m以内で道を案内しよう');
        }
        if (e.started && !e.arrived && distance <= 9) {
          const last = e.trail.at(-1);
          if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.4)
            e.trail.push({ x: p.x, y: p.y, z: p.z });
          if (e.trail.length > 300) e.trail.shift();
          while (e.trail.length > 1 && Math.hypot(e.x - e.trail[0].x, e.z - e.trail[0].z) < 0.18)
            e.trail.shift();
          const target = e.trail[0] || p,
            dx = target.x - e.x,
            dz = target.z - e.z,
            d = Math.hypot(dx, dz),
            step = Math.min(d, 4.8 * DT),
            wind = (this.stage.winds || []).find((w) =>
              insideZone({ ...e, y: this.stage.height(e.x, e.z) + 0.9 }, w),
            ),
            push =
              wind && !(wind.effect && this.done(wind.effect))
                ? windPhase(wind, course.elapsed).force * DT * 0.35
                : 0;
          if (distance > 1.5 || e.trail.length > 1) {
            const motion = {
                x: d > 0 ? (dx / d) * step : 0,
                z: (d > 0 ? (dz / d) * step : 0) + push,
                courier: true,
                avoidSide: e.avoidSide,
              },
              y = Math.max(this.stage.height(e.x, e.z) + 0.8, target.y ?? p.y),
              next = course.sim.moveActor({ ...e, y }, motion);
            Object.assign(e, next);
            e.y = y;
          }
          if (Math.hypot(e.x - m.destination.x, e.z - m.destination.z) < 2.8) {
            e.arrived = true;
            say('風便の仲間が風見台に到着！ 紋章を受け取ろう');
          }
        }
      }
      if (m.type === 'defense' && this.ready(m.id)) {
        const d = this.defenses.get(m.id),
          distance = Math.hypot(p.x - m.x, p.z - m.z);
        if (d.complete) continue;
        if (
          !d.started &&
          distance < 2.5 &&
          this.hitTarget(course, attack, `defense:${m.id}`, this.defenseTarget(m, p), {
            radius: 0.7,
            vertical: 1.8,
            interaction: true,
          })
        ) {
          d.started = true;
          this.selected = m.id;
          this.startDefenseWave(m);
          say(`月の灯を守ろう！ ${this.defenseWaveCount(m)}波の守衛を迎撃`);
        }
        if (d.started) {
          if (distance > m.radius + 2) {
            this.resetDefense(m);
            say('防衛範囲を離れた · 中央でACTIONして再挑戦');
          } else {
            if (distance <= m.radius) d.elapsed += DT;
          }
        }
      }
    }
  }
  snapshot() {
    return {
      ...super.snapshot(),
      enemies: this.enemies.map((e) => ({
        x: e.x,
        z: e.z,
        hp: e.hp,
        phase: e.phase,
        active: e.active !== false,
      })),
      escorts: Object.fromEntries(
        [...this.escorts].map(([id, e]) => [
          id,
          { x: e.x, z: e.z, started: e.started, arrived: e.arrived, waiting: e.waiting },
        ]),
      ),
      defenses: Object.fromEntries([...this.defenses].map(([id, d]) => [id, { ...d }])),
    };
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
    this.updateIdentities(course, attack, say);
    for (const place of this.stage.discoveries || [])
      if (
        !this.discovered.has(place.id) &&
        Math.hypot(p.x - place.x, p.z - place.z) < place.radius
      ) {
        this.discovered.add(place.id);
        say(`探索発見 · ${place.name}`);
      }
    for (const [i, e] of this.enemies.entries()) {
      if (e.hp <= 0 || e.active === false) continue;
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
      if (m.type === 'defense') {
        const defense = this.defenses.get(m.id),
          distance = Math.hypot(e.x - m.x, e.z - m.z);
        if (e.phase === 'windup') {
          if (e.timer >= 0.95) {
            const target = this.defenseTarget(m, e);
            if (distance < 2.4 && course.sim.lineClear({ x: e.x, y: y + 0.8, z: e.z }, target)) {
              defense.hp = Math.max(0, defense.hp - (m.beaconDamage || 12));
              defense.hitUntil = course.elapsed + 0.25;
              if (defense.hp <= 0) {
                this.resetDefense(m);
                say('灯台の灯が消えた · 中央でACTIONして再挑戦');
                // A failed defense resets every guard. Stop this frame's enemy
                // loop so the newly waiting guards cannot attack or move again.
                break;
              }
            }
            e.strikeUntil = course.elapsed + 0.16;
            e.phase = 'rest';
            e.timer = 0;
          }
        } else if (e.phase === 'rest') {
          if (e.timer > 1.4) e.phase = 'patrol';
        } else if (distance < 2.35) {
          e.phase = 'windup';
          e.timer = 0;
        } else if (distance > 0) {
          this.moveEnemy(
            course,
            e,
            ((m.x - e.x) / distance) * DT * 1.6,
            ((m.z - e.z) / distance) * DT * 1.6,
          );
        }
        continue;
      }
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
      } else if (
        d < (m.type === 'defense' ? 20 : 9) &&
        Math.hypot(p.x - m.x, p.z - m.z) < m.radius + 1
      ) {
        this.moveEnemy(course, e, ((p.x - e.x) / d) * DT * 1.6, ((p.z - e.z) / d) * DT * 1.6);
      }
    }
    this.updateDefenseWaves(course, say);
    for (const m of this.stage.missions)
      if (
        m.type === 'relay' &&
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
        active = m.type === 'relay' || m.type === 'collect' || attack;
      if (
        m.type === 'escort' ||
        !this.ready(m.id) ||
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
        m.type !== 'collect' &&
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
        course.sim.spawn = {
          x: m.reward.x,
          y: ground(m.reward.x, m.reward.z) + 1.8,
          z: m.reward.z,
        };
        say(`紋章を獲得！ ${this.rewards.size}/${this.stage.missions.length} · HP回復`);
        this.selected =
          this.stage.missions.find((next) => !this.rewards.has(next.id))?.id || 'goal';
      }
    course.activated = this.unlocked;
    const gate = this.stage.platforms.findIndex((p) => p.gate);
    course.sim.platforms[gate].setEnabled(!this.unlocked);
  }
  guidance(course) {
    if (this.unlocked) return '3つの紋章が揃った！ 光る出口の門へ';
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
    const defense = this.stage.missions.find(
      (m) => m.type === 'defense' && this.defenses.get(m.id).started && !this.done(m.id),
    );
    if (defense) {
      const distance = Math.hypot(p.x - defense.x, p.z - defense.z);
      return `${defense.short} ${this.progress(defense.id)} · ${distance > defense.radius ? '範囲外で計時停止 · 灯台は攻撃され続ける · 光の輪へ戻ろう' : '光の範囲で灯台を狙う敵を迎撃'} / ${defense.radius + 2}mを超えると再挑戦`;
    }
    const escort = this.stage.missions.find(
      (m) => m.type === 'escort' && this.escorts.get(m.id).started && !this.done(m.id),
    );
    if (escort) {
      const e = this.escorts.get(escort.id),
        distance = Math.round(Math.hypot(p.x - e.x, p.z - e.z));
      return e.waiting
        ? `仲間が待っている · ${distance}m離れています。9m以内へ戻ろう`
        : `${escort.short} · 仲間まで${distance}m / 9m以内で案内 · 風車の復旧で峡谷の風が弱まる`;
    }
    if (Math.hypot(p.x - b.x, p.z - b.z) < 13 && this.bossHP > 0)
      return this.bossReady()
        ? `${b.name} HP ${this.bossHP}/${b.hp} · ${this.bossPhase === 'rest' ? '緑に光る今！ 近づいて3連撃' : bossAdvice(this.bossAttack?.kind)}`
        : `${b.name}は封印中 · ${(b.requires || [])
            .filter((id) => !this.done(id))
            .map((id) => this.mission(id).short)
            .join('・')}を先に達成しよう`;
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
    if (m && !this.ready(m.id)) return `${m.short} · ${this.progress(m.id)}`;
    return `${this.rewards.size}/3 紋章 · ${m ? (this.done(m.id) ? `${m.short}の光る紋章を拾おう` : m.name) : 'ミッションを選ぼう'}${m?.type === 'collect' ? ' · 順不同で拾える' : m?.type === 'relay' ? ' · 光の輪を順に通ろう' : m?.sequence ? ' · 光る番号順にACTION' : ' · 近くでACTION'}`;
  }
}
