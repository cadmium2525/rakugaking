import * as THREE from 'three';
import { sanitizeSketch, sketchBounds, inkArea } from '../core/sketch.js';
export function buildSketchCharacter(raw) {
  const drawing = sanitizeSketch(raw),
    root = new THREE.Group(),
    rig = new THREE.Group();
  root.add(rig);
  root.name = 'root';
  const all = drawing.strokes.flatMap((s) => s.points),
    b = sketchBounds(all),
    cx = (b.minX + b.maxX) / 2;
  const bottom = b.maxY + Math.max(0.004, ...drawing.strokes.map((s) => s.width / 2));
  const pieces = [];
  drawing.strokes.forEach((stroke, index) => {
    const points = stroke.points.map(
      (p) => new THREE.Vector3((p.x - cx) * 2.8, (bottom - p.y) * 2.8, 0),
    );
    const pivot = points[0].clone(),
      joint = new THREE.Group();
    joint.position.copy(pivot);
    rig.add(joint);
    let geometry;
    if (stroke.closed && points.length >= 3 && inkArea(stroke) > 0.00001) {
      const shape = new THREE.Shape();
      points.forEach((p, i) =>
        i ? shape.lineTo(p.x - pivot.x, p.y - pivot.y) : shape.moveTo(p.x - pivot.x, p.y - pivot.y),
      );
      shape.closePath();
      for (const loop of stroke.holes || []) {
        const path = new THREE.Path();
        loop.forEach((p, i) => {
          const x = (p.x - cx) * 2.8 - pivot.x,
            y = (bottom - p.y) * 2.8 - pivot.y;
          if (i) path.lineTo(x, y);
          else path.moveTo(x, y);
        });
        path.closePath();
        shape.holes.push(path);
      }
      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: stroke.depth,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 3,
      });
      geometry.translate(0, 0, -stroke.depth + index * 0.008);
    } else if (points.length === 1) {
      geometry = new THREE.SphereGeometry(stroke.width * 1.4, 8, 6);
      geometry.scale(1, 1, stroke.depth / (stroke.width * 2.8));
      geometry.translate(0, 0, index * 0.008 - stroke.depth / 2);
    } else {
      const path = new THREE.CurvePath();
      for (let i = 1; i < points.length; i++)
        path.add(
          new THREE.LineCurve3(points[i - 1].clone().sub(pivot), points[i].clone().sub(pivot)),
        );
      geometry = new THREE.TubeGeometry(
        path,
        Math.min(128, Math.max(4, points.length * 2)),
        stroke.width * 1.4,
        6,
        false,
      );
      geometry.scale(1, 1, stroke.depth / (stroke.width * 2.8));
      geometry.translate(0, 0, index * 0.008 - stroke.depth / 2);
    }
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: stroke.color, roughness: 0.8 }),
    );
    joint.add(mesh);
    joint.name = `stroke-${index}`;
    pieces.push({ joint, role: stroke.role, index });
  });
  root.userData = {
    sketch: true,
    rig,
    pieces,
    phase: 0,
    land: 0,
    wasGrounded: true,
    state: 'Idle',
  };
  return root;
}
