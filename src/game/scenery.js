import * as THREE from 'three';

// Repeated scenery is instanced: hundreds of details cost a handful of draw calls.
export function addScenery(world, stage) {
  const groups = new Map(),
    animated = [];
  const add = (kind, color, x, y, z, sx, sy = sx, sz = sx, rotation = 0) => {
    const key = kind + color;
    if (!groups.has(key)) groups.set(key, { kind, color, items: [] });
    groups.get(key).items.push({ x, y, z, sx, sy, sz, rotation });
  };
  const tree = (x, y, z, size = 1) => {
    add('cylinder', 0x81664c, x, y + size, z, 0.25 * size, 2 * size, 0.25 * size);
    add('ico', 0x53866b, x, y + 2.2 * size, z, 1.25 * size, 1.7 * size, 1.25 * size);
    add('ico', 0x86ae73, x - 0.5 * size, y + 3 * size, z, 0.95 * size, 1.2 * size, 0.95 * size);
  };
  for (const [i, p] of stage.platforms.entries()) {
    const y = p.y + p.h / 2;
    if (p.collapse) continue;
    add(
      'cone',
      stage.id === 5 ? 0x73779c : 0x938777,
      p.x,
      y - 3.5,
      p.z,
      p.w * 0.62,
      6,
      p.d * 0.62,
      Math.PI,
    );
    for (let n = 0; n < Math.floor(p.d / 1.6); n++) {
      add(
        'box',
        stage.id === 1 ? 0xc8d7a0 : 0xe0d9c8,
        p.x,
        y + 0.08,
        p.z + (n - (Math.floor(p.d / 1.6) - 1) / 2) * 1.6,
        2.3,
        0.08,
        1.1,
      );
    }
    for (const side of [-1, 1]) {
      const x = p.x + side * (p.w / 2 - 0.8);
      if (stage.id === 1) {
        tree(x, y, p.z - 1, i % 3 === 0 ? 1.3 : 0.8);
        for (let n = 0; n < 5; n++)
          add(
            'ico',
            n % 2 ? 0xffcb79 : 0xf399a2,
            x + (n % 2) * 0.4,
            y + 0.22,
            p.z + 1 + n * 0.45,
            0.18,
            0.25,
            0.18,
          );
      } else {
        add('cylinder', 0xded4bd, x, y + 1.2, p.z, 0.38, 2.4, 0.38);
        add('box', 0xf1e5cf, x, y + 2.4, p.z, 0.9, 0.2, 0.9);
        if (stage.id === 5) add('ico', 0xc5b1ec, x, y + 3, p.z, 0.5, 1, 0.5);
      }
    }
    // Far silhouettes frame the route without posing as walkable ground.
    const side = i % 2 ? 1 : -1;
    if (stage.id === 1) tree(p.x + side * 16, y - 6, p.z, 3.8);
    else if (stage.id === 2) {
      const x = side * 14;
      add('cylinder', 0xd9d6c4, x, y, p.z, 1.6, 9, 1.6);
      add('cone', 0x647f87, x, y + 5.7, p.z, 2.4, 3, 2.4);
      const rotor = new THREE.Group();
      rotor.position.set(x, y + 3, p.z + 1.7);
      for (const angle of [0, Math.PI / 2]) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 7, 0.12),
          new THREE.MeshStandardMaterial({ color: 0xf4ebd1 }),
        );
        blade.rotation.z = angle;
        rotor.add(blade);
      }
      world.add(rotor);
      animated.push(rotor);
    } else {
      add(
        'box',
        stage.id === 4 ? 0xb18472 : 0x7d96ab,
        side * 16,
        y - 2,
        p.z,
        6,
        12 + (i % 3) * 3,
        6,
      );
      add('cone', stage.id === 5 ? 0x655b93 : 0xb0c5c0, side * 16, y + 7, p.z, 5, 5, 5);
    }
    add('ico', 0xf6f2e8, side * 22, y - 8, p.z, 10, 2, 6);
  }
  const g = stage.goal;
  if (stage.id === 1) tree(g.x, g.y, g.z - 8, 4);
  else {
    for (const side of [-1, 1]) {
      add('cylinder', 0xe3d9c6, g.x + side * 4, g.y + 3.5, g.z, 1, 7, 1);
      add('cone', stage.id === 5 ? 0x7460a8 : 0x67868b, g.x + side * 4, g.y + 8, g.z, 2, 3, 2);
    }
    add('box', 0xe3d9c6, g.x, g.y + 6.5, g.z, 9, 1.2, 2);
    add('ico', 0xffd078, g.x, g.y + 8, g.z, 1, 1.6, 0.6);
  }
  const dummy = new THREE.Object3D();
  for (const { kind, color, items } of groups.values()) {
    const geometry =
      kind === 'ico'
        ? new THREE.IcosahedronGeometry(1, 0)
        : kind === 'cone'
          ? new THREE.ConeGeometry(1, 1, 5)
          : kind === 'cylinder'
            ? new THREE.CylinderGeometry(1, 1, 1, 6)
            : new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      items.length,
    );
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.rotation.set(0, 0, item.rotation);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  return animated;
}
