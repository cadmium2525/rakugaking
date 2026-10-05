import * as THREE from 'three';
const material = () =>
  new THREE.MeshBasicMaterial({
    color: 0xff654a,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
export class BossTelegraph {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    const fan = (angle) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 1, 48, 1, -Math.PI / 2 - angle / 2, angle),
        material(),
      );
      mesh.rotation.x = -Math.PI / 2;
      this.root.add(mesh);
      return mesh;
    };
    this.fan = fan(2.44);
    this.blade = fan(0.62);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 1, 64), material());
    this.ring.rotation.x = -Math.PI / 2;
    this.root.add(this.ring);
    this.cross = new THREE.Group();
    this.root.add(this.cross);
    for (const side of [0, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), material());
      mesh.rotation.y = (side * Math.PI) / 2;
      this.cross.add(mesh);
    }
  }
  update(course) {
    const a = course.field?.bossAttack,
      b = course.stage?.boss;
    this.root.visible =
      !!a && a.kind !== 'double' && course.field.bossHP > 0 && ['windup', 'slam'].includes(a.phase);
    if (!this.root.visible) return;
    const striking = a.phase === 'slam';
    this.root.position.set(b.x, b.y + 0.14, b.z);
    this.fan.visible = a.kind === 'fan' && !striking;
    this.blade.visible = a.kind === 'fan' && striking;
    for (const mesh of [this.fan, this.blade]) {
      mesh.scale.setScalar(a.radius);
      mesh.rotation.z = striking ? a.sweep : a.aim;
      mesh.material.opacity = striking ? 0.65 : 0.26;
    }
    this.ring.visible = a.kind === 'wave';
    if (this.ring.visible) {
      const inner = striking ? Math.max(0.05, a.wave - 0.75) : 0.05,
        outer = striking ? Math.max(0.06, Math.min(a.radius, a.wave + 0.75)) : a.radius,
        positions = this.ring.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const angle = ((i % 65) / 64) * Math.PI * 2,
          radius = i < 65 ? inner : outer;
        positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      }
      positions.needsUpdate = true;
      this.ring.geometry.computeBoundingSphere();
      this.ring.material.color.setHex(striking ? 0x8ee9ff : 0xff654a);
      this.ring.material.opacity = striking ? 0.85 : 0.17;
    }
    this.cross.visible = a.kind === 'cross';
    this.cross.rotation.y = a.rotation;
    for (const mesh of this.cross.children) {
      mesh.scale.set(a.radius * 2, 1, 2.1);
      mesh.material.opacity = striking ? 0.7 : 0.3;
    }
  }
}
