import * as THREE from 'three';
import { describeDrawing, clamp } from '../core/shape.js';
import { PARTS } from '../core/drawing.js';

export function buildCharacter(raw) {
  const { drawing, parts } = describeDrawing(raw);
  const root = new THREE.Group();
  root.name = 'root';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const joints = { body },
    sizes = {};
  for (const p of PARTS) {
    const d = parts[p];
    const limb = p.includes('arm') || p.includes('leg');
    sizes[p] = {
      w: clamp(d.width * (limb ? 0.65 : 1.25), limb ? 0.12 : 0.3, limb ? 0.5 : 0.95),
      h: clamp(d.height * (limb ? 0.8 : 1), limb ? 0.25 : 0.3, limb ? 0.7 : 0.85),
    };
  }
  const legH = Math.max(sizes.legLeft.h, sizes.legRight.h),
    bodyH = sizes.body.h;
  body.position.y = legH + bodyH / 2;
  for (const p of PARTS) {
    const joint = p === 'body' ? body : new THREE.Group();
    joint.name = p;
    joints[p] = joint;
    if (p !== 'body') body.add(joint);
    const s = sizes[p],
      b = parts[p].bounds;
    const arm = p.includes('arm'),
      leg = p.includes('leg'),
      side = p.includes('Left') ? -1 : 1;
    if (p === 'head') joint.position.y = bodyH / 2 + s.h / 2 - 0.04;
    if (arm) joint.position.set(side * (sizes.body.w / 2 + 0.01), bodyH * 0.3, 0);
    if (leg) joint.position.set(side * sizes.body.w * 0.25, -bodyH / 2, 0);
    for (const [index, stroke] of drawing[p].entries()) {
      const shape = new THREE.Shape();
      stroke.points.forEach((v, i) => {
        const x = ((v.x - b.minX) / Math.max(0.01, b.maxX - b.minX) - 0.5) * s.w;
        const y =
          (0.5 - (v.y - b.minY) / Math.max(0.01, b.maxY - b.minY)) * s.h -
          (arm || leg ? s.h / 2 : 0);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      shape.closePath();
      const depth = p === 'body' ? 0.32 : p === 'head' ? 0.3 : 0.2;
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: index === 0 ? depth : 0.015,
        bevelEnabled: index === 0,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.035,
        curveSegments: 4,
      });
      geometry.translate(0, 0, index === 0 ? -depth / 2 : depth / 2 + 0.015 * index);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: stroke.color, roughness: 0.8 }),
      );
      joint.add(mesh);
    }
  }
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x233f38 });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), eyeMaterial);
    eye.position.set((x * sizes.head.w) / 0.6, 0.03, 0.21);
    joints.head.add(eye);
  }
  root.userData = {
    joints,
    sizes,
    baseY: body.position.y,
    phase: 0,
    land: 0,
    wasGrounded: true,
    state: 'Idle',
  };
  return root;
}
export function disposeCharacter(root) {
  const materials = new Set();
  root.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) materials.add(o.material);
  });
  materials.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
}
