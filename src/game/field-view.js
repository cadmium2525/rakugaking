import * as THREE from 'three';

export function buildField(world, stage) {
  const batches = new Map();
  const add = (kind, color, x, y, z, sx, sy, sz) => {
    const key = `${kind}-${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, items: [] });
    batches.get(key).items.push([x, y, z, sx, sy, sz]);
  };
  const tree = (x, z, size = 1) => {
    add('cylinder', 0x8b7153, x, size * 1.5, z, size * 0.4, size * 3, size * 0.4);
    add('ico', 0x467b61, x, size * 3.4, z, size * 2, size * 2.1, size * 2);
    add('ico', 0x76a66b, x - size * 0.6, size * 4.3, z, size * 1.7, size * 1.5, size * 1.6);
  };
  const disc = (x, y, z, radius, color) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    world.add(mesh);
    return mesh;
  };
  // A continuous valley floor extends to the mountains, with broad branching paths.
  add('box', 0x7eaa75, 0, -2, -28, 180, 3, 190);
  add('box', 0xd5c698, 0, 0.08, -27, 5, 0.04, 76);
  add('box', 0xd5c698, -12, 0.08, -17, 25, 0.04, 4);
  add('box', 0xd5c698, 9, 0.08, -22, 18, 0.04, 4);
  disc(0, 0.11, 3, 7, 0xe0d5aa);
  disc(-21, 0.11, -18, 10, 0xb0c48a);
  disc(-5, 0.11, -49, 10, 0xc4baa0);
  disc(-5, 0.13, -49, 7, 0xd9cfad);
  for (let i = 0; i < 38; i++) {
    const angle = (i / 38) * Math.PI * 2;
    const x = Math.cos(angle) * 47,
      z = -28 + Math.sin(angle) * 60;
    add('ico', i % 2 ? 0x829782 : 0x98ab8e, x, 3, z, 9, 8 + (i % 5), 9);
    tree(Math.cos(angle) * 36, -28 + Math.sin(angle) * 45, 1 + (i % 3) * 0.2);
  }
  for (const [x, z] of [
    [-29, -12],
    [-29, -26],
    [-14, -26],
    [-12, -9],
    [13, -5],
    [30, -9],
    [32, -40],
    [12, -56],
    [-24, -46],
    [-24, 2],
    [24, 8],
  ])
    tree(x, z, 1.1);
  tree(-5, -59, 2.4);
  // Ruined archways on the east terrace, with plenty of room to walk around them.
  for (const x of [15, 30]) {
    add('box', 0xded9bc, x, 2.4, -34, 1.2, 3.6, 1.2);
    add('box', 0xf0e8cd, x, 4.3, -34, 2, 0.4, 2);
  }
  add('box', 0xded9bc, 22.5, 4.7, -34, 16, 0.6, 1.6);
  for (let i = 0; i < 100; i++) {
    const x = Math.sin(i * 17.3) * 34,
      z = -26 + Math.cos(i * 11.7) * 43;
    if (Math.abs(x) < 5 || stage.missions.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius + 1))
      continue;
    add('ico', i % 3 === 0 ? 0xf1ba80 : 0xeae6b5, x, 0.2, z, 0.16, 0.3, 0.16);
  }
  for (const side of [-1, 1]) {
    add('box', 0xede1bd, side * 3, 3, -65, 1.5, 6, 2);
    add('ico', 0xf4ca70, side * 3, 6.3, -65, 1, 0.7, 1);
  }
  add('box', 0xede1bd, 0, 6, -65, 7.5, 0.8, 2);
  const dummy = new THREE.Object3D();
  for (const { kind, color, items } of batches.values()) {
    const geo =
      kind === 'ico'
        ? new THREE.IcosahedronGeometry(1, 0)
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
    update(course) {
      const f = course.field,
        p = course.sim.position;
      enemies.forEach(({ root, body }, i) => {
        const e = f.enemies[i];
        root.visible = e.hp > 0;
        root.position.set(e.x, 0, e.z);
        root.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        body.material.color.setHex(
          e.hitUntil > course.elapsed ? 0xffffff : e.phase === 'windup' ? 0xef5947 : 0xc87853,
        );
        root.scale.setScalar(e.phase === 'windup' ? 1.13 : 1);
      });
      boss.root.visible = f.bossHP > 0;
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
      attackRing.visible = f.attackFlash > 0;
      attackRing.position.set(p.x, p.y - 0.55, p.z);
      attackRing.scale.setScalar(1 + (0.2 - f.attackFlash) * 5);
    },
  };
}
