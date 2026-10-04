import { FIELD_PATHS } from '../game/field-terrain.js';
export class FieldHUD {
  constructor() {
    this.root = document.createElement('aside');
    this.root.className = 'field-hud';
    this.root.hidden = true;
    this.root.innerHTML =
      '<details open><summary>紋章 <span data-count>0/3</span> · 地図</summary><div class="field-hud-content"><canvas width="200" height="180" aria-label="北が上のフィールド地図"></canvas><div data-missions></div><p>ミッションを選ぶと目的地を強調</p></div></details><p class="field-bearing" aria-label="目的地の方向と距離"></p>';
    document.body.append(this.root);
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mission]');
      if (button && this.course) this.course.field.selected = button.dataset.mission;
    });
  }
  update(course) {
    this.course = course;
    this.root.hidden = !course?.field || course.complete;
    if (this.root.hidden) return;
    const f = course.field,
      stage = course.stage;
    const portrait = innerWidth < 600 && innerHeight > innerWidth;
    if (portrait !== this.portrait) {
      this.root.querySelector('details').open = !portrait;
      this.portrait = portrait;
    }
    const selected = stage.missions.find((m) => m.id === f.selected);
    const target = f.target
      ? f.target(f.selected)
      : f.unlocked
        ? stage.goal
        : selected?.reward || stage.missions[0].reward;
    const dx = target.x - course.sim.position.x,
      dz = target.z - course.sim.position.z;
    const direction = (Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8;
    this.root.querySelector('.field-bearing').textContent =
      `${['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][direction]} ${f.unlocked ? '北の門' : selected?.short || stage.missions[0].short} · ${Math.round(Math.hypot(dx, dz))}m`;
    const holder = this.root.querySelector('[data-missions]');
    if (this.stageId !== stage.id) {
      this.stageId = stage.id;
      holder.replaceChildren();
      for (const m of stage.missions) {
        const button = document.createElement('button');
        button.dataset.mission = m.id;
        holder.append(button);
      }
    }
    this.root.querySelector('[data-count]').textContent = `${f.rewards.size}/3`;
    for (const [i, button] of [...holder.children].entries()) {
      const m = stage.missions[i];
      const progress = f.progress
        ? f.progress(m.id)
        : m.id === 'orchard'
          ? `${f.enemies.filter((e) => e.hp <= 0).length}/3`
          : m.id === 'ruins'
            ? `${f.runes.size}/3`
            : `HP ${f.bossHP}`;
      button.textContent = `${i + 1} ${m.short} · ${f.rewards.has(m.id) ? '紋章獲得 ✓' : f.done(m.id) ? '紋章を拾う' : progress}`;
      button.setAttribute('aria-pressed', String(f.selected === m.id));
      button.title = m.name;
    }
    const ctx = this.root.querySelector('canvas').getContext('2d');
    const map = (x, z) =>
      stage.expedition ? [100 + x * 1.8, 14 + (z + 88) * 1.38] : [100 + x * 2, 15 + (z + 78) * 1.5];
    ctx.fillStyle = stage.expedition ? `#${stage.color.toString(16)}` : '#d4dfb4';
    ctx.fillRect(0, 0, 200, 180);
    for (const water of stage.waters || [])
      if (stage.expedition) {
        const [x, y] = map(water.x || 0, (water.minZ + water.maxZ) / 2);
        ctx.fillStyle = water.effect && f.done(water.effect) ? '#abc1a2' : '#5ab8ce';
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          (water.width || 7) * 0.9,
          (water.maxZ - water.minZ) * 0.69,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    ctx.strokeStyle = '#f3ebce';
    ctx.lineWidth = 5;
    if (!stage.expedition) {
      ctx.strokeStyle = '#7caeb1';
      ctx.beginPath();
      ctx.moveTo(...map(-12, -32));
      ctx.lineTo(...map(13, -34));
      ctx.stroke();
    }
    ctx.strokeStyle = '#f3ebce';
    ctx.beginPath();
    for (const path of stage.paths || FIELD_PATHS)
      path.forEach(([x, z], i) => (i ? ctx.lineTo(...map(x, z)) : ctx.moveTo(...map(x, z))));
    ctx.stroke();
    for (const place of stage.discoveries || []) {
      const [x, y] = map(place.x, place.z);
      ctx.fillStyle = course.field.discovered.has(place.id) ? '#d69b35' : '#65795a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', x, y);
    }
    ctx.fillStyle = '#355c4a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N ↑', 6, 13);
    stage.missions.forEach((m, i) => {
      const [x, y] = map(m.x, m.z);
      ctx.beginPath();
      ctx.arc(x, y, f.selected === m.id ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = f.rewards.has(m.id) ? '#619b77' : `#${m.color.toString(16)}`;
      ctx.fill();
      if (f.selected === m.id) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = '#243f35';
      ctx.textAlign = 'center';
      ctx.fillText(f.rewards.has(m.id) ? '✓' : String(i + 1), x, y + 4);
    });
    for (const [i, r] of (stage.runes || []).entries())
      if (stage.expedition && !f.runes.has(i)) {
        const [x, y] = map(r.x, r.z);
        ctx.fillStyle = '#fff4c4';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    const [gx, gy] = map(stage.goal.x, stage.goal.z);
    ctx.fillStyle = f.unlocked ? '#d99b38' : '#85649d';
    ctx.fillRect(gx - 7, gy - 4, 14, 8);
    ctx.fillStyle = '#355c4a';
    ctx.textAlign = 'left';
    ctx.fillText(f.unlocked ? '門 OPEN' : '門 LOCK', gx + 11, gy + 4);
    const [px, py] = map(course.sim.position.x, course.sim.position.z);
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#31564b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
