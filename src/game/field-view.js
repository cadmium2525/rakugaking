import * as THREE from 'three';
import { fieldHeight, terrainGeometryData, FIELD_PATHS } from './field-terrain.js';

export function buildField(world, stage) {
  const batches = new Map();
  const add = (kind, color, x, y, z, sx, sy, sz) => {
    const key = `${kind}-${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, items: [] });
    batches.get(key).items.push([x, y, z, sx, sy, sz]);
  };
  const groundMesh = new THREE.BufferGeometry(),
    data = terrainGeometryData();
  groundMesh.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
  groundMesh.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  groundMesh.setIndex(new THREE.BufferAttribute(data.indices, 1));
  groundMesh.computeVertexNormals();
  world.add(
    new THREE.Mesh(
      groundMesh,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    ),
  );
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x8c9f75, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -3, -25);
  world.add(apron);
  const disc = (x, y, z, radius, color, opacity = 1) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    world.add(m);
    return m;
  };
  const path = (nodes, width, color, water = false) => {
    const curve = new THREE.CatmullRomCurve3(nodes.map(([x, z]) => new THREE.Vector3(x, 0, z))),
      pts = curve.getPoints(100),
      verts = [],
      indices = [];
    pts.forEach((p, i) => {
      const dir = pts[Math.min(i + 1, 100)]
        .clone()
        .sub(pts[Math.max(0, i - 1)])
        .normalize();
      const edge = (width * (0.9 + Math.sin(i * 0.7) * 0.07)) / 2;
      for (const side of [-1, 1]) {
        const x = p.x + dir.z * edge * side,
          z = p.z - dir.x * edge * side;
        verts.push(x, water ? -0.6 : fieldHeight(x, z) + 0.045, z);
      }
      if (i < 100) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    world.add(
      new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color,
          roughness: water ? 0.3 : 1,
          side: THREE.DoubleSide,
        }),
      ),
    );
  };
  FIELD_PATHS.forEach((p, i) => path(p, i === 3 ? 2 : 4, 0xc9b887));
  const tree = (x, z, size = 1, fruit = false) => {
    const y = fieldHeight(x, z);
    add('cylinder', 0x775b40, x, y + size * 1.4, z, size * 0.32, size * 2.8, size * 0.32);
    add(
      'ico',
      fruit ? 0x678d47 : 0x347657,
      x,
      y + size * 3,
      z,
      size * 1.7,
      size * 1.35,
      size * 1.6,
    );
    add(
      'ico',
      fruit ? 0x90ad56 : 0x659762,
      x - size * 0.6,
      y + size * 3.4,
      z,
      size * 1.3,
      size * 1.1,
      size * 1.1,
    );
    disc(x, y + 0.065, z, size * 1.6, 0x31573b, 0.15);
    if (fruit)
      for (let i = 0; i < 5; i++)
        add(
          'ico',
          0xee9b55,
          x + Math.sin(i * 2.1) * size * 1.3,
          y + size * (2.4 + 0.25 * (i % 2)),
          z + Math.cos(i * 2.1) * size * 1.1,
          0.23,
          0.27,
          0.23,
        );
  };
  const beam = (a, b, width, color) => {
    const dir = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.65, width, dir.length(), 7),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    mesh.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    world.add(mesh);
  };
  // A skyline beyond the solid valley rim, with clearly separated silhouettes.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2,
      x = Math.cos(a) * 66,
      z = -28 + Math.sin(a) * 79;
    add('cone', i % 2 ? 0x91afa4 : 0x719887, x, 5, z, 14, 18 + (i % 5) * 3, 12);
    if (i % 3 === 0) {
      add('ico', 0xf5f2df, x, 27 + (i % 4), z, 9, 1.5, 3);
      add('ico', 0xf5f2df, x + 6, 27 + (i % 4), z, 6, 1, 2);
    }
  }
  for (const [x, z, size] of [
    [-35, -13, 1.2],
    [-34, 0, 1.4],
    [34, 4, 1.5],
    [33, -41, 1.6],
    [24, -52, 1.5],
    [-24, -59, 1.8],
    [-15, -63, 1.4],
    [13, -62, 1.6],
    [-37, -28, 1.3],
    [37, -18, 1.3],
  ])
    tree(x, z, size);
  for (const [x, z] of [
    [-28, -12],
    [-26, -26],
    [-15, -25],
    [-14, -10],
    [-31, -20],
  ])
    tree(x, z, 0.95, true);
  // Low orchard fences and baskets sit around its edge, leaving combat space.
  for (const [x, z] of [
    [-31, -15],
    [-31, -24],
    [-13, -14],
    [-13, -22],
  ]) {
    const y = fieldHeight(x, z);
    add('cylinder', 0x987649, x, y + 0.65, z, 0.1, 1.3, 0.1);
    add('box', 0xbc975b, x, y + 0.5, z + 1.5, 0.15, 0.16, 3);
    add('ico', 0xe8bb6e, x + 0.7, y + 0.3, z, 0.5, 0.3, 0.5);
  }
  // The brook is visibly recessed into the terrain. The timber bridge is solid.
  path(
    [
      [-12, -32],
      [-6, -32],
      [0, -33],
      [6, -34],
      [13, -34],
    ],
    3.4,
    0x64abb8,
    true,
  );
  for (let i = 0; i < 12; i++)
    add('box', i % 2 ? 0xb69460 : 0xc6a878, 0, 0.47, -37.5 + i * 0.8, 6.1, 0.12, 0.7);
  for (const side of [-1, 1])
    for (const z of [-37, -33, -29]) {
      add('cylinder', 0x755d41, side * 2.8, 1, z, 0.12, 1.8, 0.12);
      add('box', 0x967847, side * 2.8, 1.45, z, 0.13, 0.15, 4);
    }
  // Half of a broken circular temple remains above the east hillside.
  for (let i = 0; i < 9; i++) {
    const angle = -Math.PI * 0.8 + (i / 8) * Math.PI * 1.6,
      x = 23 + Math.cos(angle) * 9,
      z = -25 + Math.sin(angle) * 9,
      y = fieldHeight(x, z),
      h = i % 3 === 0 ? 2.2 : 4.5;
    add('cylinder', 0xbdbb98, x, y + h / 2, z, 0.6, h, 0.6);
    add('box', 0xe1d6b2, x, y + h, z, 1.8, 0.35, 1.8);
    disc(x, y + 0.06, z, 1.2, 0x4c6246, 0.2);
  }
  beam([15, fieldHeight(15, -29) + 4.4, -29], [20, fieldHeight(20, -34) + 4.4, -34], 0.5, 0xd4caab);
  for (const [x, z] of [
    [30, -18],
    [29, -32],
    [16, -30],
  ])
    add('ico', 0xc8c2a0, x, fieldHeight(x, z) + 0.4, z, 1.4, 0.7, 1);
  // A truly large tree: a tapered trunk, branches and walkable space under roots.
  const tx = -12,
    tz = -61;
  add('trunk', 0x79603f, tx, 7, tz, 3.5, 14, 3.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2,
      x = tx + Math.cos(a) * 10,
      z = tz + Math.sin(a) * 7;
    beam([tx, 9 + (i % 3), tz], [x, 15 + (i % 3), z], 0.8, 0x79603f);
    add('ico', i % 2 ? 0x4f8a5e : 0x7ba759, x, 17 + (i % 3), z, 6, 4, 5);
    if (z < -55) beam([tx, 2, tz], [tx + Math.cos(a) * 7, fieldHeight(x, z) + 0.3, z], 1, 0x917347);
  }
  add('ico', 0x81ae62, tx, 20, tz, 7, 4, 6);
  disc(-5, 0.065, -49, 9, 0xa9a783);
  disc(-5, 0.075, -49, 7, 0xcbbb97);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    add('ico', 0x899b77, -5 + Math.cos(a) * 9, 0.35, -49 + Math.sin(a) * 9, 0.7, 0.4, 0.65);
  }
  // A small cave, with an open mouth and a star inside, beside the orchard.
  for (const x of [-34, -28]) add('ico', 0x77867b, x, 1.8, -8, 1.8, 2.3, 2.5);
  add('ico', 0x8e9b88, -31, 4, -8, 4.3, 1.4, 3);
  add('box', 0x687768, -31, 1.6, -10.8, 6, 3.2, 0.6);
  disc(-31, 0.07, -8, 3, 0x31523e, 0.22);
  // A real hillside lookout, reached by the winding west trail.
  const ly = fieldHeight(-29, -41) + 0.45;
  for (const x of [-32, -26]) {
    add('cylinder', 0x775f41, x, ly + 1, -43, 0.14, 2, 0.14);
    add('box', 0xb8995b, x, ly + 1.8, -41, 0.14, 0.16, 4);
  }
  add('box', 0xb8995b, -29, ly + 1.8, -43, 6, 0.16, 0.14);
  add('cylinder', 0x7d6241, -31, ly + 2, -42, 0.16, 4, 0.16);
  add('cone', 0xe6b96c, -31, ly + 4.4, -42, 0.7, 0.6, 0.7);
  // Dense small ground details use instancing, outside important travel space.
  for (let i = 0; i < 420; i++) {
    const x = Math.sin(i * 17.3) * 33,
      z = -26 + Math.cos(i * 11.7) * 42,
      y = fieldHeight(x, z);
    if (stage.missions.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius) || Math.abs(x) < 4)
      continue;
    add('cone', i % 5 === 0 ? 0xe4c371 : 0x77a35c, x, y + 0.18, z, 0.12, 0.35, 0.12);
    if (i % 11 === 0) add('ico', 0xd7c7a1, x, y + 0.1, z, 0.4, 0.2, 0.3);
  }
  // The final gate carries three seals and remains visible beneath the canopy.
  for (const side of [-1, 1]) {
    add('box', 0xd8cda5, side * 3, 2.7, -65, 1.3, 5.4, 1.6);
    add('cone', 0xe8ba61, side * 3, 5.8, -65, 0.85, 1, 0.85);
  }
  add('box', 0xe5d8b2, 0, 5.2, -65, 7.5, 0.65, 1.6);
  const dummy = new THREE.Object3D();
  for (const { kind, color, items } of batches.values()) {
    const geo =
      kind === 'ico'
        ? new THREE.IcosahedronGeometry(1, 0)
        : kind === 'cone'
          ? new THREE.ConeGeometry(1, 1, 7)
          : kind === 'trunk'
            ? new THREE.CylinderGeometry(0.5, 1, 1, 9)
            : kind === 'cylinder'
              ? new THREE.CylinderGeometry(1, 1, 1, 8)
              : new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      items.length,
    );
    items.forEach(([x, y, z, sx, sy, sz], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  const makeEnemy = (boss = false) => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(boss ? 1.65 : 0.7, 1),
      new THREE.MeshStandardMaterial({ color: boss ? 0x786c9a : 0xc87853, roughness: 0.8 }),
    );
    body.position.y = boss ? 1.7 : 0.75;
    root.add(body);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(boss ? 0.16 : 0.08, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9ac }),
      );
      eye.position.set(side * (boss ? 0.5 : 0.23), boss ? 1.9 : 0.86, boss ? 1.48 : 0.62);
      root.add(eye);
    }
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(boss ? 0.8 : 0.35, boss ? 1 : 0.45, 5),
      new THREE.MeshStandardMaterial({ color: boss ? 0xa0b57b : 0xe3be77 }),
    );
    crown.position.y = boss ? 3.55 : 1.5;
    root.add(crown);
    world.add(root);
    return { root, body };
  };
  const enemies = stage.enemies.map(() => makeEnemy());
  const boss = makeEnemy(true);
  boss.root.position.set(stage.boss.x, 0, stage.boss.z);
  const warning = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 6, 64),
    new THREE.MeshBasicMaterial({
      color: 0xee634e,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  warning.rotation.x = -Math.PI / 2;
  warning.position.set(stage.boss.x, 0.18, stage.boss.z);
  world.add(warning);
  const runes = stage.runes.map((r) => {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.65),
      new THREE.MeshStandardMaterial({
        color: 0x738ea2,
        emissive: 0x31547d,
        emissiveIntensity: 0.3,
      }),
    );
    mesh.position.set(r.x, r.y + 0.9, r.z);
    world.add(mesh);
    return mesh;
  });
  const rewards = stage.missions.map((m) => {
    const root = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85),
      new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 0.5 }),
    );
    root.add(gem);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.06, 6, 32),
      new THREE.MeshBasicMaterial({ color: m.color }),
    );
    root.add(halo);
    root.position.set(m.reward.x, m.reward.y, m.reward.z);
    root.visible = false;
    world.add(root);
    return root;
  });
  const gate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 5),
    new THREE.MeshBasicMaterial({
      color: 0xad94ce,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  gate.position.set(0, 2.5, -65);
  world.add(gate);
  const attackRing = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.4, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffebbc,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  attackRing.rotation.x = -Math.PI / 2;
  world.add(attackRing);
  return {
    enemies,
    boss,
    update(course) {
      const f = course.field,
        p = course.sim.position;
      enemies.forEach(({ root, body }, i) => {
        const e = f.enemies[i];
        root.visible = e.hp > 0 || course.elapsed - (e.defeatedAt ?? -Infinity) < 0.45;
        root.position.set(e.x, 0, e.z);
        root.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        body.material.color.setHex(
          e.hitUntil > course.elapsed ? 0xffffff : e.phase === 'windup' ? 0xef5947 : 0xc87853,
        );
        root.scale.setScalar(e.phase === 'windup' ? 1.13 : 1);
      });
      boss.root.visible = f.bossHP > 0 || course.elapsed - (f.bossDefeatedAt ?? -Infinity) < 0.7;
      boss.root.rotation.y = Math.atan2(p.x - stage.boss.x, p.z - stage.boss.z);
      boss.body.material.color.setHex(
        f.bossPhase === 'rest' ? 0x8ab78f : f.bossPhase === 'windup' ? 0xda765a : 0x786c9a,
      );
      boss.root.scale.y = f.bossPhase === 'rest' ? 0.78 : 1;
      warning.visible = f.bossHP > 0 && (f.bossPhase === 'windup' || f.bossPhase === 'slam');
      warning.material.opacity =
        f.bossPhase === 'slam' ? 0.65 : 0.22 + Math.sin(course.elapsed * 15) * 0.07;
      runes.forEach((r, i) => {
        r.material.color.setHex(f.runes.has(i) ? 0x90edcd : 0x738ea2);
        r.rotation.y = course.elapsed * 0.5;
      });
      rewards.forEach((r, i) => {
        const m = stage.missions[i];
        r.visible = f.done(m.id) && !f.rewards.has(m.id);
        r.rotation.y = course.elapsed;
        r.position.y = m.reward.y + Math.sin(course.elapsed * 2) * 0.2;
      });
      gate.visible = !course.activated;
      attackRing.visible = false;
      attackRing.position.set(p.x, p.y - 0.55, p.z);
      attackRing.scale.setScalar(1 + (0.2 - f.attackFlash) * 5);
    },
  };
}
