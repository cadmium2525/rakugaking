import * as THREE from 'three';
import { BossTelegraph } from './boss-telegraph.js';

const COLORS = [0xfff2bd, 0x91efff, 0xffb45d];
const tint = (hex, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

export class CombatView {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.bossWarning = new BossTelegraph(this.root);
    this.lastEvent = 0;
    this.impulse = 0;
    this.time = 0;
    this.source = null;
    this.sweep = new THREE.Group();
    this.root.add(this.sweep);
    this.arcs = [1, 2, 3, 4].map((combo, i) => {
      const full = combo === 4,
        mesh = new THREE.Mesh(
          new THREE.RingGeometry(
            0.7,
            full ? 1 : 1.12,
            40,
            1,
            full ? 0 : -Math.PI / 2 - 1.12,
            full ? Math.PI * 2 : 2.24,
          ),
          tint(COLORS[Math.min(i, 2)]),
        );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.sweep.add(mesh);
      return mesh;
    });
    this.streaks = [0, 1, 2].map((i) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.96, 1, 32, 1, -Math.PI * 0.83, 1.7),
        tint(0xffffff),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = i * 0.16;
      this.sweep.add(mesh);
      return mesh;
    });
    this.particles = Array.from({ length: 80 }, () => ({
      life: 0,
      x: 0,
      y: -1000,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    const positions = new Float32Array(this.particles.length * 3),
      colors = new Float32Array(positions.length),
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.16,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.root.add(this.points);
    this.texts = Array.from({ length: 12 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      sprite.scale.set(1.8, 0.67, 1);
      sprite.visible = false;
      this.root.add(sprite);
      return { canvas, sprite, life: 0 };
    });
    this.rings = Array.from({ length: 5 }, () => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.83, 1, 40), tint(0xffc67c));
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      return { mesh, life: 0 };
    });
  }
  reset() {
    this.bossWarning.root.visible = false;
    this.source = null;
    this.lastEvent = 0;
    this.impulse = 0;
    this.particles.forEach((p) => {
      p.life = 0;
    });
    this.texts.forEach((t) => {
      t.life = 0;
      t.sprite.visible = false;
    });
    this.rings.forEach((r) => {
      r.life = 0;
      r.mesh.visible = false;
    });
    this.sweep.visible = false;
  }
  burst(event, amount = 12, color = 0xffd67b) {
    for (let i = 0; i < amount; i++) {
      const p = this.particles.find((p) => p.life <= 0) || this.particles[i],
        a = i * 2.39996 + event.id * 0.73,
        speed = event.type === 'defeat' ? 4 : 2.3;
      Object.assign(p, {
        x: event.x,
        y: event.y,
        z: event.z,
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        vy: 1.2 + (i % 4) * 0.8,
        life: event.type === 'defeat' ? 0.65 : 0.32,
        color,
      });
    }
  }
  text(event, value, color) {
    const t = this.texts.find((t) => t.life <= 0) || this.texts[0],
      ctx = t.canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 96);
    ctx.font = '900 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#263747';
    ctx.strokeText(value, 128, 48, 245);
    ctx.fillStyle = color;
    ctx.fillText(value, 128, 48, 245);
    t.sprite.material.map.needsUpdate = true;
    t.sprite.position.set(event.x, event.y + 0.7, event.z);
    t.sprite.material.opacity = 1;
    t.sprite.visible = true;
    t.life = 0.72;
  }
  ring(x, y, z, radius, color = 0xffc67c) {
    const r = this.rings.find((r) => r.life <= 0) || this.rings[0];
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.setHex(color);
    r.radius = radius;
    r.life = 0.36;
  }
  event(event) {
    if (event.type === 'hit') {
      this.burst(event, event.combo === 3 ? 18 : 10, COLORS[event.combo - 1] || COLORS[0]);
      this.text(event, String(event.damage), event.combo === 3 ? '#ffd275' : '#fff8d6');
      this.impulse = Math.max(this.impulse, event.combo === 3 ? 0.09 : 0.035);
      if (event.combo === 3) this.ring(event.x, event.y - 0.6, event.z, 2.1);
    } else if (event.type === 'block') {
      this.burst(event, 8, 0x9fd6ff);
      this.text(event, '防御', '#9fd6ff');
      this.impulse = Math.max(this.impulse, 0.025);
    } else if (event.type === 'defeat') {
      this.burst(event, event.key === 'boss' ? 30 : 18, 0xffde8b);
      this.ring(event.x, event.y - 0.6, event.z, event.key === 'boss' ? 4 : 1.4, 0xffebad);
      if (event.key === 'boss') this.text(event, '撃破!', '#ffd275');
    } else if (event.type === 'hurt') {
      this.burst(event, 10, 0xff756d);
      this.text(event, `−${Math.round(event.damage)}`, '#ff9990');
      this.impulse = Math.max(this.impulse, 0.12);
    } else if (event.type === 'switch') {
      this.burst(event, 14, 0x88ffe0);
      this.ring(event.x, event.y - 0.6, event.z, 1.4, 0x88ffe0);
    }
  }
  update(context, dt = 1 / 60, fieldView = null) {
    const combat = context.combat;
    this.time += dt;
    this.impulse *= Math.exp(-dt * 16);
    if (!combat) {
      this.sweep.visible = false;
      return;
    }
    if (this.source !== combat) {
      this.reset();
      this.source = combat;
      this.lastEvent = (combat.events[0]?.id || 1) - 1;
    }
    for (const event of combat.events)
      if (event.id > this.lastEvent) {
        this.event(event);
        this.lastEvent = event.id;
      }
    const state = combat.snapshot(),
      p = context.sim.position,
      strike = Math.max(
        0,
        Math.min(1, (state.elapsed - state.windup) / Math.max(0.01, state.active)),
      ),
      tail = Math.max(0, 1 - (state.elapsed - state.windup - state.active) / 0.12);
    this.sweep.visible = state.attacking && state.elapsed > 0.035 && tail > 0;
    this.sweep.position.set(p.x, p.y - 0.08, p.z);
    this.sweep.rotation.y = Math.atan2(state.facing.x, state.facing.z);
    const reach = state.reach + (state.combo === 3 ? 0.25 : 0);
    this.sweep.scale.set(reach, 1, reach);
    this.arcs.forEach((arc, i) => {
      arc.visible = i === (state.airborne ? 3 : state.combo - 1);
      arc.material.opacity = state.phase === 'windup' ? 0.14 : Math.min(0.85, tail * 0.85);
      arc.rotation.z = state.airborne
        ? this.time * 9
        : state.combo === 3
          ? 0
          : (state.combo === 2 ? -1 : 1) * (-0.8 + strike * 1.6);
      arc.scale.setScalar(0.8 + strike * 0.25);
    });
    this.streaks.forEach((line, i) => {
      line.visible = state.phase === 'strike';
      line.rotation.z = (state.combo === 2 ? -1 : 1) * (-0.65 + strike * 1.5) + i * 0.15;
      line.material.opacity = Math.max(0, (1 - strike) * 0.6);
      line.scale.setScalar(0.8 + i * 0.06);
    });
    const positions = this.points.geometry.attributes.position,
      colors = this.points.geometry.attributes.color,
      color = new THREE.Color();
    this.particles.forEach((particle, i) => {
      particle.life -= dt;
      if (particle.life > 0) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z += particle.vz * dt;
        particle.vy -= dt * 9;
        positions.setXYZ(i, particle.x, particle.y, particle.z);
        color.setHex(particle.color).multiplyScalar(Math.min(1, particle.life * 5));
        colors.setXYZ(i, color.r, color.g, color.b);
      } else positions.setXYZ(i, 0, -1000, 0);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    this.texts.forEach((t) => {
      t.life -= dt;
      t.sprite.visible = t.life > 0;
      if (t.life > 0) {
        t.sprite.position.y += dt * 1.2;
        t.sprite.material.opacity = Math.min(1, t.life * 3);
      }
    });
    this.rings.forEach((r) => {
      r.life -= dt;
      r.mesh.visible = r.life > 0;
      if (r.life > 0) {
        r.mesh.scale.setScalar(r.radius * (1.12 - r.life * 0.8));
        r.mesh.material.opacity = r.life * 1.7;
      }
    });
    this.bossWarning.update(context);
    if (fieldView && context.field) this.enemyPoses(context, fieldView);
  }
  enemyPoses(course, view) {
    const f = course.field,
      time = course.elapsed;
    view.enemies?.forEach(({ root, body }, i) => {
      const e = f.enemies[i],
        windup = e.phase === 'windup' ? Math.min(1, e.timer / 0.9) : 0,
        striking = Math.max(0, ((e.strikeUntil || 0) - time) / 0.16),
        stagger = Math.max(0, ((e.stunUntil || 0) - time) / 0.65);
      if (e.hp <= 0) {
        const fade = Math.max(0, Math.min(1, (time - (e.defeatedAt ?? -Infinity)) / 0.45));
        root.rotation.x = -fade * 1.7;
        root.rotation.z = fade * 0.35;
        root.scale.setScalar(Math.max(0.001, 1 - fade));
        return;
      }
      root.rotation.x = -windup * 0.32 + striking * 0.5 - stagger * 0.35;
      root.rotation.z = stagger * Math.sin(time * 30) * 0.18;
      root.scale.set(1 + windup * 0.08, 1 - windup * 0.1 + stagger * 0.12, 1 + windup * 0.08);
      body.material.emissive?.setHex(e.hitUntil > time ? 0x777044 : 0);
      if (striking > 0) {
        root.position.x += Math.sin(root.rotation.y) * striking * 0.28;
        root.position.z += Math.cos(root.rotation.y) * striking * 0.28;
      }
    });
    if (!view.boss) return;
    const { root, body } = view.boss,
      state = (root.userData.combatPose ||= { phase: '', since: time });
    if (f.bossHP <= 0) {
      const fade = Math.max(0, Math.min(1, (time - (f.bossDefeatedAt ?? -Infinity)) / 0.7));
      root.rotation.x = -fade * 1.4;
      root.rotation.z = fade * 0.3;
      root.scale.setScalar((course.stage.id === 5 ? 1.6 : 1) * Math.max(0.001, 1 - fade));
      return;
    }
    if (state.phase !== f.bossPhase) {
      if (f.bossPhase === 'slam' && (!f.bossAttack || f.bossAttack.kind === 'double')) {
        const b = course.stage.boss;
        this.ring(b.x, (b.y || 0) + 0.12, b.z, b.radius || 6, 0xff7059);
      }
      state.phase = f.bossPhase;
      state.since = time;
    }
    const windup = f.bossPhase === 'windup' ? Math.min(1, (time - state.since) / 0.9) : 0,
      slam = f.bossPhase === 'slam' ? 1 : 0,
      size = course.stage.id === 5 ? 1.6 : 1;
    root.rotation.x = -windup * 0.38 + slam * 0.62;
    root.rotation.z = f.bossHitUntil > time ? Math.sin(time * 40) * 0.06 : 0;
    root.scale.set(
      size * (1 + windup * 0.06),
      size * (f.bossPhase === 'rest' ? 0.78 : 1 - slam * 0.2),
      size,
    );
    body.material.emissive?.setHex(f.bossHitUntil > time ? 0x80713e : 0);
  }
  cameraOffset() {
    return {
      x: Math.sin(this.time * 89) * this.impulse,
      y: Math.cos(this.time * 73) * this.impulse * 0.6,
    };
  }
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
  }
}
