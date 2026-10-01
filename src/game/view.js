import * as THREE from 'three';
import { HALF_HEIGHT } from '../core/controller.js';
import { buildCharacter, disposeCharacter } from './character.js';
import { animateCharacter } from './animation.js';

export class GameView {
  constructor(canvas, platforms) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.quality = 'medium';
    this.platforms = platforms;
    this.birthElapsed = 2;
    this.renderer.setClearColor(0xdcebe5);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xdcebe5, 30, 65);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x52635b, 1.8));
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.7);
    sun.position.set(-5, 12, 8);
    this.scene.add(sun);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    for (const p of platforms) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({ color: p.color || 0xa5cc77, roughness: 0.95 }),
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.z = p.angle || 0;
      this.world.add(mesh);
    }
    this.avatar = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xfe8f70, roughness: 0.7 }),
    );
    body.position.y = 0.8;
    this.avatar.add(body);
    for (const x of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x243a37 }),
      );
      eye.position.set(x, 1.13, 0.29);
      this.avatar.add(eye);
    }
    this.scene.add(this.avatar);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({
        color: 0x294b3d,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.target = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.initial = true;
    this.resize();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    const cap = { low: 1, medium: 1.5, high: 2 }[this.quality];
    const budget = { low: 800000, medium: 1500000, high: 3000000 }[this.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, cap, Math.sqrt(budget / (w * h))));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setQuality(quality) {
    this.quality = quality;
    this.resize();
  }
  celebrate() {
    this.birthElapsed = 0;
  }
  preview(drawing) {
    const avatar = buildCharacter(drawing),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(1.3, 1.7, 4);
    camera.lookAt(0, 1, 0);
    this.scene.remove(this.avatar);
    this.scene.add(avatar);
    this.world.visible = false;
    this.shadow.visible = false;
    this.renderer.setSize(320, 320, false);
    this.renderer.render(this.scene, camera);
    const image = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(avatar);
    disposeCharacter(avatar);
    this.scene.add(this.avatar);
    this.world.visible = true;
    this.resize();
    return image;
  }
  setCharacter(drawing) {
    this.scene.remove(this.avatar);
    disposeCharacter(this.avatar);
    this.avatar = buildCharacter(drawing);
    this.scene.add(this.avatar);
  }
  setStage(stage) {
    this.platforms = stage.platforms;
    this.scene.remove(this.world);
    disposeCharacter(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.renderer.setClearColor(stage.sky);
    this.scene.fog.color.setHex(stage.sky);
    this.platformMeshes = [];
    for (const [i, p] of stage.platforms.entries()) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.color || stage.color).multiplyScalar(0.72),
          roughness: 0.95,
        }),
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.z = p.angle || 0;
      this.world.add(mesh);
      this.platformMeshes.push(mesh);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.04, 0.12, p.d + 0.04),
        new THREE.MeshStandardMaterial({ color: p.color || stage.color, roughness: 1 }),
      );
      top.position.set(0, p.h / 2, 0);
      mesh.add(top);
      for (let n = 0; n < 3; n++) {
        const stone = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.2 + n * 0.07, 0),
          new THREE.MeshStandardMaterial({ color: 0xf1db9c }),
        );
        stone.position.set(p.w / 2 - 0.7, p.h / 2 + 0.3, (n - 1) * 0.7);
        mesh.add(stone);
      }
      if (i % 2 === 0) {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.17, 1.2, 5),
          new THREE.MeshStandardMaterial({ color: 0x8d8162 }),
        );
        trunk.position.set(-p.w / 2 + 0.6, p.h / 2 + 0.6, 0);
        const leaves = new THREE.Mesh(
          stage.id <= 2
            ? new THREE.IcosahedronGeometry(0.8, 0)
            : new THREE.BoxGeometry(0.7, 0.2, 0.7),
          new THREE.MeshStandardMaterial({ color: stage.id <= 2 ? 0x668e6c : 0xe6dcc7 }),
        );
        leaves.position.y = 1;
        trunk.add(leaves);
        mesh.add(trunk);
      }
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.1, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd478,
        emissive: 0xc78629,
        emissiveIntensity: 0.3,
      }),
    );
    ring.position.set(stage.goal.x, stage.goal.y + 1.2, stage.goal.z);
    this.world.add(ring);
    this.goalRing = ring;
    this.initial = true;
    if (stage.wind) {
      for (let i = 0; i < 8; i++) {
        const vane = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.8, 4),
          new THREE.MeshStandardMaterial({ color: 0xf9fcf4 }),
        );
        vane.rotation.x = Math.PI / 2;
        vane.position.set((i % 2 ? 1 : -1) * 1.7, 1, -6 - i * 2);
        this.world.add(vane);
      }
    }
    if (stage.water) {
      const w = stage.water;
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(7, w.maxZ - w.minZ),
        new THREE.MeshStandardMaterial({
          color: 0x4cbdcf,
          transparent: true,
          opacity: 0.48,
          roughness: 0.3,
          side: THREE.DoubleSide,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, w.surface, (w.minZ + w.maxZ) / 2);
      this.world.add(water);
    }
    this.hazardMeshes = (stage.hazards || []).map((h) => {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45),
        new THREE.MeshStandardMaterial({
          color: 0xe87f76,
          emissive: 0xa93b47,
          emissiveIntensity: 0.3,
        }),
      );
      mesh.position.set(h.x, h.y, h.z);
      this.world.add(mesh);
      return mesh;
    });
  }
  updateCourse(course) {
    for (const [i, m] of this.platformMeshes.entries()) {
      const start = course.collapseTimes[i],
        p = course.stage.platforms[i];
      m.visible = course.sim.platforms[i].isEnabled();
      m.position.y = p.y + (start === null ? 0 : Math.sin((course.elapsed - start) * 45) * 0.025);
    }
    if (this.goalRing) {
      this.goalRing.rotation.y = Math.sin(course.elapsed) * 0.2;
      this.goalRing.material.color.setHex(course.activated ? 0xffd478 : 0xb09ad9);
    }
    this.hazardMeshes.forEach((h, i) => {
      h.visible = !course.destroyed.has(i);
      h.rotation.y = course.elapsed;
    });
  }
  render(sim, dt) {
    const p = sim.position;
    this.avatar.position.set(p.x, p.y - HALF_HEIGHT, p.z);
    animateCharacter(this.avatar, sim, dt);
    this.birthElapsed = Math.min(2, this.birthElapsed + dt);
    if (this.birthElapsed < 1) {
      const t = this.birthElapsed;
      this.avatar.scale.z *= Math.max(0.03, Math.min(1, t * 2));
      this.avatar.position.y += (1 - t) * (1 - t) * 1.4;
    }
    this.shadow.visible = false;
    let top = -Infinity;
    for (let i = 0; i < this.platforms.length; i++) {
      const ground = this.platforms[i];
      if (this.platformMeshes?.[i]?.visible === false) continue;
      if (Math.abs(p.x - ground.x) < ground.w / 2 && Math.abs(p.z - ground.z) < ground.d / 2)
        top = Math.max(top, ground.y + ground.h / 2);
    }
    if (Number.isFinite(top) && p.y > top) {
      this.shadow.visible = true;
      this.shadow.position.set(p.x, top + 0.085, p.z);
      const size = Math.max(0.4, 1 - (p.y - top - 0.8) * 0.13);
      this.shadow.scale.setScalar(size);
    }
    const speed = Math.hypot(sim.vx, sim.vz);
    if (speed > 0.2) this.avatar.rotation.y = Math.atan2(sim.vx, sim.vz);
    this.cameraTarget.set(p.x, p.y + 7, p.z + 12);
    this.camera.position.lerp(this.cameraTarget, this.initial ? 1 : 1 - Math.exp(-dt * 5));
    this.look.set(p.x, p.y + 0.3, p.z);
    this.camera.lookAt(this.look);
    this.initial = false;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) o.material.dispose();
    });
    this.renderer.dispose();
  }
}
