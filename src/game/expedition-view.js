import * as THREE from 'three';
export function buildExpedition(world, stage) {
  const height = stage.height,
    batches = new Map(),
    animated = [];
  const add = (kind, color, x, y, z, sx, sy, sz, rotation = 0) => {
    const key = `${kind}-${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, items: [] });
    batches.get(key).items.push([x, y, z, sx, sy, sz, rotation]);
  };
  const geometry = (kind) =>
    kind === 'ico'
      ? new THREE.IcosahedronGeometry(1, 0)
      : kind === 'cone'
        ? new THREE.ConeGeometry(1, 1, 8)
        : kind === 'cylinder'
          ? new THREE.CylinderGeometry(0.75, 1, 1, 10)
          : kind === 'ring'
            ? new THREE.TorusGeometry(1, 0.06, 6, 32)
            : new THREE.BoxGeometry(1, 1, 1);
  const mesh = (kind, color, parent = world) => {
    const m = new THREE.Mesh(
      geometry(kind),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    parent.add(m);
    return m;
  };
  const disc = (x, z, r, color) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, height(x, z) + 0.06, z);
    world.add(m);
    return m;
  };
  const label = (text, color, x, y, z) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#243e4dee';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 96, 18);
    ctx.fill();
    ctx.fillStyle = `#${color.toString(16)}`;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 59);
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true }),
    );
    m.position.set(x, y, z);
    m.scale.set(4.8, 1.8, 1);
    world.add(m);
    return m;
  };
  const data = stage.platforms[0],
    geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const colors = new Float32Array(data.vertices.length),
    base = new THREE.Color(stage.color),
    rocky = new THREE.Color(stage.stone);
  for (let i = 0; i < data.vertices.length; i += 3) {
    const x = data.vertices[i],
      y = data.vertices[i + 1],
      z = data.vertices[i + 2],
      c = base.clone().lerp(rocky, Math.max(0, Math.min(0.65, (y - 2) / 15)));
    c.multiplyScalar(0.94 + 0.06 * Math.sin(x * 0.4 + z * 0.3));
    c.toArray(colors, i);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  world.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    ),
  );
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: stage.color, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -5, -32);
  world.add(floor);
  for (const nodes of stage.paths) {
    const curve = new THREE.CatmullRomCurve3(nodes.map(([x, z]) => new THREE.Vector3(x, 0, z))),
      pts = curve.getPoints(90),
      v = [],
      indices = [];
    pts.forEach((p, i) => {
      const d = pts[Math.min(i + 1, 90)]
        .clone()
        .sub(pts[Math.max(0, i - 1)])
        .normalize();
      for (let k = 0; k < 9; k++) {
        const side = (k - 4) / 4;
        const x = p.x + d.z * 1.7 * side,
          z = p.z - d.x * 1.7 * side;
        v.push(x, height(x, z) + 0.1, z);
      }
      if (i < 90) {
        for (let k = 0; k < 8; k++) {
          const a = i * 9 + k;
          indices.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    world.add(
      new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: stage.id === 5 ? 0xa8a1c6 : stage.id === 4 ? 0xd0b496 : 0xd8c7a4,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }
  const tower = (x, z, h = 10, color = stage.stone) => {
    const y = height(x, z);
    add('cylinder', color, x, y + h / 2, z, 2, h, 2);
    for (const k of [1, 3, 5]) add('box', 0x536574, x, y + k, z + 0.1, 1, 0.45, 4.1);
    add('cone', stage.accent, x, y + h + 1.3, z, 3, 2.6, 3);
  };
  const arch = (x, z, width = 8, h = 7) => {
    for (const side of [-1, 1])
      add(
        'box',
        stage.stone,
        x + (side * width) / 2,
        height(x + (side * width) / 2, z) + h / 2,
        z,
        1.8,
        h,
        2,
      );
    add('box', stage.stone, x, height(x, z) + h, z, width + 2, 0.9, 2);
  };
  const mill = (x, z, index) => {
    const y = height(x, z);
    tower(x, z, 9, 0xd9cfb4);
    const rotor = new THREE.Group();
    rotor.position.set(x, y + 7, z + 2);
    world.add(rotor);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Group();
      blade.rotation.z = (k * Math.PI) / 2;
      rotor.add(blade);
      const rail = mesh('box', 0x886541, blade);
      rail.position.y = 2.7;
      rail.scale.set(0.22, 6, 0.25);
      const sail = mesh('box', 0xf0e5c8, blade);
      sail.position.set(0.65, 3.2, 0);
      sail.scale.set(1.1, 3.9, 0.12);
    }
    const hub = mesh('ico', 0xe2b563, rotor);
    hub.scale.setScalar(0.55);
    animated.push({ kind: 'mill', root: rotor, index });
  };
  // Background cliff masses are staggered, leaving the destination silhouette readable.
  for (let i = 0; i < 23; i++) {
    const side = i % 2 ? -1 : 1,
      x = side * (55 + (i % 4) * 7),
      z = 17 - Math.floor(i / 2) * 11,
      y = 7 + (i % 5) * 2;
    add(
      'ico',
      i % 3 ? stage.stone : stage.color,
      x,
      y,
      z,
      9 + (i % 4),
      14 + (i % 5) * 2,
      12,
      i * 0.3,
    );
    if (stage.id === 2) {
      add('ico', 0xf5f5ea, x, y + 12, z, 8, 1.6, 4);
      add('ico', 0xf5f5ea, x + 7, y + 12, z, 6, 1, 3);
    }
  }
  if (stage.id === 2) {
    stage.mills.forEach(([x, z], i) => mill(x, z, i));
    arch(-28, -38, 9, 8);
    // A bridge spans the sunken canyon; walking around either end is also possible.
    for (let i = 0; i < 16; i++)
      add('box', i % 2 ? 0x967754 : 0xad8c60, 0, 0.47, -44 + i * 0.8, 6, 0.16, 0.73);
    for (const side of [-1, 1])
      for (const z of [-44, -40, -36, -32]) {
        add('box', 0x765d48, side * 2.8, 1.1, z, 0.18, 1.7, 0.18);
        add('box', 0xb89c76, side * 2.8, 1.75, z + 1.5, 0.12, 0.12, 3);
      }
    for (const [x, z] of [
      [31, -36],
      [35, -46],
      [17, -49],
    ]) {
      const y = height(x, z);
      add('box', 0x9b795d, x, y + 1.1, z, 3.4, 2.2, 3.2);
      add('cone', 0x647f90, x, y + 3, z, 3, 2, 3);
      add('box', 0x384858, x, y + 0.8, z + 1.7, 1.2, 1.6, 0.1);
    }
    tower(0, -82, 20, 0xe8dec3);
    add('ring', 0xf6d386, 0, height(0, -82) + 17, -82, 4, 4, 4);
    for (let i = 0; i < 120; i++) {
      const x = -37 + (i % 12) * 1.1,
        z = -6 - Math.floor(i / 12) * 1.3,
        y = height(x, z);
      add('cone', i % 3 ? 0xdabc63 : 0xbfa256, x, y + 0.6, z, 0.11, 1.2, 0.11);
    }
  }
  if (stage.id === 3) {
    // A raised aqueduct, with walkable ground under its open spans.
    for (const z of [-13, -26, -39]) {
      const y = height(-38, z);
      add('box', stage.stone, -38, y + 4, z, 2.2, 8, 2.2);
      add('box', 0x96bebb, -38, y + 8.2, z - 5.5, 2.5, 0.8, 13);
      add('box', 0x3f919f, -38, y + 8.7, z - 5.5, 1.5, 0.12, 13);
    }
    for (const [x, z] of [
      [-26, -16],
      [-21, -26],
      [-33, -33],
    ]) {
      const y = height(x, z);
      add('box', 0x78a8ae, x, y + 0.9, z, 1.5, 1.8, 0.7);
      add('ring', 0xe7c578, x, y + 1.4, z + 0.5, 0.65, 0.65, 0.65);
    }
    for (const side of [-1, 1])
      for (const z of [-66, -73, -82]) {
        const x = side * 8,
          y = height(x, z);
        add('cylinder', stage.stone, x, y + 4.5, z, 0.7, 9, 0.7);
        add('box', 0xe5e8d7, x, y + 9, z, 2, 0.55, 2);
      }
    add('box', 0xadd3cf, 0, height(0, -78) + 9.4, -77, 18, 0.8, 18);
    add('ico', 0x6fbbc9, 0, height(0, -78) + 12.4, -77, 7, 3, 7);
    add('cone', 0xf3d49a, 0, height(0, -78) + 16, -77, 1.1, 2.2, 1.1);
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4,
        x = 25 + Math.cos(a) * (10 + (i % 4)),
        z = -27 + Math.sin(a) * (10 + (i % 4)),
        y = height(x, z);
      const lily = disc(x, z, 0.75, 0x4e8b78);
      lily.position.y = Math.max(0.85, y + 0.1);
      const flower = mesh('ico', i % 2 ? 0xf0d4b6 : 0xd798c0);
      flower.position.set(x, lily.position.y + 0.16, z);
      flower.scale.set(0.28, 0.18, 0.28);
      animated.push({ kind: 'lotus', root: lily, flower, ground: y + 0.1 });
    }
    for (const [x, z] of [
      [-16, -5],
      [36, -6],
      [-30, -49],
      [21, -53],
    ]) {
      const y = height(x, z);
      add('cylinder', 0x5c8b7f, x, y + 2.5, z, 0.25, 5, 0.25);
      add('ico', 0x508f87, x, y + 5, z, 3, 1.4, 3);
    }
  }
  const clock = (x, y, z, r) => {
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(r, 32),
      new THREE.MeshStandardMaterial({ color: 0xf3deb1, roughness: 1 }),
    );
    face.position.set(x, y, z);
    world.add(face);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      add(
        'box',
        0x75564b,
        x + Math.sin(a) * r * 0.8,
        y + Math.cos(a) * r * 0.8,
        z + 0.02,
        r * 0.08,
        r * 0.15,
        0.04,
      );
    }
    const hands = new THREE.Group();
    hands.position.set(x, y, z + 0.08);
    world.add(hands);
    for (const [len, rotation] of [
      [r * 0.65, 0],
      [r * 0.45, 2],
    ]) {
      const hand = mesh('box', 0x69566a, hands);
      hand.position.set((Math.sin(rotation) * len) / 2, (Math.cos(rotation) * len) / 2, 0);
      hand.rotation.z = -rotation;
      hand.scale.set(r * 0.07, len, 0.06);
    }
    animated.push({ kind: 'clock', root: hands });
  };
  if (stage.id === 4) {
    for (const [x, z, h] of stage.houses) {
      const y = height(x, z);
      add('box', x < 0 ? 0xb58c75 : 0xa88071, x, y + h / 2, z, 6, h, 5);
      add('box', 0x985f54, x, y + h + 0.3, z, 7, 0.6, 6);
      for (const side of [-1, 1]) {
        add('box', 0xf2d49f, x + side * 1.6, y + h * 0.65, z + 2.54, 1, 0.95, 0.08);
        add('box', stage.stone, x + side * 2.7, y + h / 2, z + 2.58, 0.25, h, 0.15);
      }
      add('box', 0x625355, x, y + 1, z + 2.56, 1.3, 2, 0.08);
    }
    tower(-15, -76, 22, stage.stone);
    clock(-15, height(-15, -76) + 18, -73.9, 1.65);
    for (const [x, z] of [
      [-30, -7],
      [-34, -40],
      [31, -18],
      [31, -43],
      [-19, -54],
      [14, -54],
    ]) {
      const y = height(x, z);
      add('cylinder', 0x6b6260, x, y + 1.8, z, 0.13, 3.6, 0.13);
      add('ico', 0xf4d49a, x, y + 3.6, z, 0.35, 0.5, 0.35);
    }
    for (const [x, z] of [
      [-25, -3],
      [30, -12],
      [30, -42],
    ]) {
      const y = height(x, z);
      add('box', 0x8d6c58, x, y + 0.5, z, 3, 1, 1.7);
      add('box', 0xe5be85, x, y + 2.2, z, 4, 0.2, 2.8);
      for (const side of [-1, 1]) add('box', 0x9b7860, x + side * 1.4, y + 1.4, z, 0.14, 2.2, 0.14);
    }
    // The optional broken street has a visible trench and a recoverable lower floor.
    for (const side of [-1, 1])
      for (const z of [-34, -38, -42])
        add('box', stage.stone, side * 4, height(side * 4, z) + 0.25, z, 1.5, 0.5, 2.5);
  }
  const waterMeshes = (stage.waters || []).map((w) => {
    const m = new THREE.Mesh(
      w.radius
        ? new THREE.CircleGeometry(w.radius, 64)
        : new THREE.PlaneGeometry(w.width, w.maxZ - w.minZ),
      new THREE.MeshStandardMaterial({
        color: 0x459aac,
        transparent: true,
        opacity: 0.56,
        roughness: 0.22,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(w.x || 0, w.surface, (w.minZ + w.maxZ) / 2);
    world.add(m);
    return { m, w };
  });
  if (stage.id === 5) {
    for (const side of [-1, 1]) {
      const x = side * 13,
        z = -78,
        y = height(x, z);
      add('cylinder', stage.stone, x, y + 8, z, 3, 16, 3);
      add('cone', 0x7c81b0, x, y + 19.5, z, 4, 7, 4);
      for (const k of [3, 8, 13]) add('box', 0xe9d295, x, y + k, z + 2.8, 1, 0.8, 0.16);
    }
    const y = height(0, -78);
    add('box', stage.stone, 0, y + 10.4, -80, 20, 0.8, 12);
    add('ico', 0x8e98ca, 0, y + 13, -80, 6, 2.5, 4.5);
    tower(-36, -24, 10, 0x9da6c7);
    add('ring', 0xf1d493, -36, height(-36, -24) + 9, -24, 3, 3, 3);
    for (const [x, z] of [
      [-34, -8],
      [36, -6],
      [-27, -52],
      [28, -63],
    ]) {
      const y = height(x, z);
      add('ico', 0xaabade, x, y + 1.8, z, 1.1, 3.2, 1.1);
      add('ico', 0xded5ea, x + 0.5, y + 1.1, z + 0.5, 0.7, 1.6, 0.7);
    }
    const moon = mesh('ico', 0xffedc8);
    moon.position.set(-42, 40, -79);
    moon.scale.setScalar(7);
    moon.material.emissive.setHex(0xffe6b4);
    moon.material.emissiveIntensity = 0.7;
    for (let i = 0; i < 50; i++) {
      const x = Math.sin(i * 12.3) * 85,
        z = -65 + Math.cos(i * 7.7) * 65;
      add('ico', 0xf5e7be, x, 25 + (i % 11) * 2, z, 0.16, 0.16, 0.16);
    }
    const positions = stage.runes.map((r) => new THREE.Vector3(r.x, r.y + 1.2, r.z));
    for (let i = 1; i < positions.length; i++) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([positions[i - 1], positions[i]]),
        new THREE.LineBasicMaterial({ color: 0xd9cbfa, transparent: true, opacity: 0.8 }),
      );
      world.add(line);
      animated.push({ kind: 'constellation', root: line, index: i });
    }
  }
  for (const m of stage.missions) {
    disc(m.x, m.z, m.radius * 0.78, stage.id === 5 ? 0x8583ab : 0xb9b89a);
    label(m.short, m.color, m.x, height(m.x, m.z) + 5, m.z - 4);
  }
  for (let i = 0; i < 230; i++) {
    const x = Math.sin(i * 19.3) * 40,
      z = -30 + Math.cos(i * 13.7) * 47;
    if (Math.hypot(x - stage.spawn.x, z - stage.spawn.z) < 16 || (Math.abs(x) < 7 && z > 0))
      continue;
    if (
      stage.missions.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius) ||
      stage.paths.some((path) => path.some(([px, pz]) => Math.hypot(x - px, z - pz) < 5))
    )
      continue;
    const y = height(x, z);
    add('ico', stage.stone, x, y + 0.25, z, 0.4, 0.3, 0.5);
    if (i % 4 === 0 && stage.id !== 4) {
      add('cylinder', 0x68734e, x, y + 1.3, z, 0.18, 2.6, 0.18);
      add('cone', stage.id === 5 ? 0x8a88b4 : 0x608367, x, y + 3, z, 1.2, 3, 1.2);
    } else add('cone', stage.id === 2 ? 0xc0b566 : stage.color, x, y + 0.23, z, 0.15, 0.45, 0.15);
  }
  const gate = stage.gate;
  arch(gate.x, gate.z, 7, 6);
  const veil = mesh('box', 0xad9ade);
  veil.position.set(gate.x, gate.y, gate.z);
  veil.scale.set(5, 5, 0.12);
  veil.material.transparent = true;
  veil.material.opacity = 0.5;
  const seals = stage.missions.map((m, i) => {
    const gem = mesh('ico', m.color);
    gem.position.set(gate.x + (i - 1) * 1.5, gate.y + 3.6, gate.z + 0.8);
    gem.scale.setScalar(0.45);
    return gem;
  });
  const dummy = new THREE.Object3D();
  for (const { kind, color, items } of batches.values()) {
    const inst = new THREE.InstancedMesh(
      geometry(kind),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      items.length,
    );
    items.forEach(([x, y, z, sx, sy, sz, r], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, r, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.computeBoundingSphere();
    world.add(inst);
  }
  const enemy = (big = false) => {
    const root = new THREE.Group();
    world.add(root);
    const body = mesh(
      (stage.id === 3 || stage.id === 5) && big ? 'ico' : 'cylinder',
      big ? 0x586b85 : 0xb77865,
      root,
    );
    body.position.y = big ? 1.9 : 0.8;
    body.scale.set(big ? 1.5 : 0.6, big ? 2.6 : 1.1, big ? 1.5 : 0.6);
    const head = mesh('ico', big ? 0xb4c7d2 : 0xd2b992, root);
    head.position.y = big ? 3.5 : 1.6;
    head.scale.setScalar(big ? 0.9 : 0.4);
    for (const side of [-1, 1]) {
      const arm = mesh('box', stage.stone, root);
      arm.position.set(side * (big ? 1.9 : 0.7), big ? 1.8 : 0.8, 0);
      arm.scale.set(big ? 0.7 : 0.25, big ? 2 : 0.8, big ? 0.8 : 0.3);
      const eye = mesh('box', 0xffe6a5, root);
      eye.position.set(side * (big ? 0.3 : 0.15), big ? 3.6 : 1.65, big ? 0.8 : 0.38);
      eye.scale.set(big ? 0.2 : 0.09, 0.12, 0.09);
    }
    if (big && stage.id === 3)
      for (const side of [-1, 1]) {
        const neck = mesh('cylinder', 0x66a3b5, root);
        neck.position.set(side * 1.1, 3, 0);
        neck.scale.set(0.45, 2, 0.45);
        neck.rotation.z = side * -0.3;
        const head = mesh('ico', 0xa5d5d6, root);
        head.position.set(side * 1.6, 4.3, 0);
        head.scale.set(0.65, 0.75, 0.9);
      }
    return { root, body };
  };
  const enemies = stage.enemies.map(() => enemy()),
    boss = enemy(true);
  if (stage.id === 4) {
    const face = mesh('ring', 0xf0d7a0, boss.root);
    face.position.set(0, 3.5, 0.85);
    face.scale.setScalar(0.8);
    const pendulum = mesh('box', 0xe2be7b, boss.root);
    pendulum.position.set(0, 1.4, 1.15);
    pendulum.scale.set(0.15, 1.9, 0.14);
    animated.push({ kind: 'pendulum', root: pendulum });
  }
  if (stage.id === 5) {
    const halo = mesh('ring', 0xefde9f, boss.root);
    halo.position.set(0, 3.5, -0.5);
    halo.scale.setScalar(2.3);
    animated.push({ kind: 'halo', root: halo });
    for (const side of [-1, 1]) {
      const spike = mesh('ico', 0xbdd8ee, boss.root);
      spike.position.set(side * 1.7, 4.2, 0);
      spike.scale.set(0.3, 1.2, 0.3);
    }
  }
  boss.root.position.set(stage.boss.x, stage.boss.y, stage.boss.z);
  const warning = new THREE.Mesh(
    new THREE.RingGeometry(0.1, stage.boss.radius || 6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff5945,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  warning.rotation.x = -Math.PI / 2;
  warning.position.set(stage.boss.x, stage.boss.y + 0.12, stage.boss.z);
  world.add(warning);
  const shield = stage.boss.requires ? mesh('ico', 0x9bcde9) : null;
  if (shield) {
    shield.position.set(stage.boss.x, stage.boss.y + 3, stage.boss.z);
    shield.scale.set(4.4, 5, 4.4);
    shield.material.transparent = true;
    shield.material.opacity = 0.28;
    shield.material.depthWrite = false;
    shield.material.emissive.setHex(0x5c8fae);
    shield.material.emissiveIntensity = 0.5;
  }
  const runes = stage.runes.map((r) => {
    const m = stage.missions.find((m) => m.id === r.mission),
      root = new THREE.Group();
    root.position.set(r.x, r.y, r.z);
    world.add(root);
    const pedestal = mesh('cylinder', stage.stone, root);
    pedestal.position.y = 0.3;
    pedestal.scale.set(0.8, 0.6, 0.8);
    const gem = mesh('ico', m.color, root);
    gem.position.y = 1.2;
    gem.scale.setScalar(0.55);
    const halo = mesh('ring', m.color, root);
    halo.position.y = 1.3;
    halo.scale.setScalar(1.1);
    const tag = label(
      `${r.index + 1} ${m.type === 'relay' ? '通過' : 'ACTION'}`,
      m.color,
      r.x,
      r.y + 3,
      r.z,
    );
    return { root, gem, halo, tag };
  });
  const rewards = stage.missions.map((m) => {
    const gem = mesh('ico', m.color);
    gem.scale.setScalar(0.9);
    gem.material.emissive.setHex(m.color);
    gem.material.emissiveIntensity = 0.5;
    gem.position.set(m.reward.x, m.reward.y, m.reward.z);
    return gem;
  });
  const attackRing = mesh('ring', 0xffedba);
  attackRing.rotation.x = -Math.PI / 2;
  return {
    update(course) {
      const f = course.field,
        p = course.sim.position,
        t = course.elapsed;
      waterMeshes.forEach(({ m, w }) => {
        const level = w.effect && f.done(w.effect) ? w.drainedSurface : w.surface;
        m.position.y = THREE.MathUtils.lerp(m.position.y, level, 0.03);
      });
      animated.forEach((a) => {
        if (a.kind === 'mill' && f.runes.has(a.index)) a.root.rotation.z = t * 0.65;
        if (a.kind === 'clock' && f.bossHP <= 0) {
          a.started ??= t;
          a.root.rotation.z = -(t - a.started) * 0.07;
        }
        if (a.kind === 'constellation')
          a.root.visible = f.runes.has(a.index - 1) && f.runes.has(a.index);
        if (a.kind === 'halo') a.root.rotation.y = t * 0.6;
        if (a.kind === 'pendulum') a.root.rotation.z = Math.sin(t * 3) * 0.4;
        if (a.kind === 'lotus') {
          const level = f.done('sluice') ? stage.waters[0].drainedSurface + 0.05 : 0.85;
          a.root.position.y = THREE.MathUtils.lerp(
            a.root.position.y,
            Math.max(a.ground, level),
            0.03,
          );
          a.flower.position.y = a.root.position.y + 0.16;
        }
      });
      enemies.forEach(({ root, body }, i) => {
        const e = f.enemies[i];
        root.visible = e.hp > 0;
        root.position.set(e.x, height(e.x, e.z), e.z);
        root.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        body.material.color.setHex(
          e.hitUntil > t ? 0xffffff : e.phase === 'windup' ? 0xef5947 : 0xb77865,
        );
      });
      boss.root.visible = f.bossHP > 0;
      boss.root.rotation.y = Math.atan2(p.x - stage.boss.x, p.z - stage.boss.z);
      const size = stage.id === 5 ? 1.6 : 1;
      boss.root.scale.set(size, size * (f.bossPhase === 'rest' ? 0.78 : 1), size);
      boss.body.material.color.setHex(
        f.bossPhase === 'rest' ? 0x72c598 : f.bossPhase === 'windup' ? 0xef7763 : 0x586b85,
      );
      warning.visible = f.bossHP > 0 && (f.bossPhase === 'windup' || f.bossPhase === 'slam');
      warning.material.opacity = f.bossPhase === 'slam' ? 0.65 : 0.23 + Math.sin(t * 15) * 0.07;
      if (shield) {
        shield.visible = f.bossHP > 0 && !f.bossReady();
        shield.rotation.y = t * 0.2;
      }
      runes.forEach((r, i) => {
        const active = f.runes.has(i);
        r.gem.rotation.y = t;
        r.gem.material.color.setHex(
          active ? 0x80ffcb : stage.missions.find((m) => m.id === stage.runes[i].mission).color,
        );
        r.halo.rotation.y = t * 0.5;
        const node = stage.runes[i],
          m = stage.missions.find((m) => m.id === node.mission),
          next = stage.runes.findIndex((n, j) => n.mission === m.id && !f.runes.has(j));
        r.halo.material.emissive.setHex(m.sequence && i === next ? 0x95ffe1 : 0);
        r.halo.material.emissiveIntensity = 0.8;
        r.tag.visible = !active;
        r.root.visible =
          stage.missions.find((m) => m.id === stage.runes[i].mission).type !== 'relay' || !active;
      });
      rewards.forEach((r, i) => {
        const m = stage.missions[i];
        r.visible = f.done(m.id) && !f.rewards.has(m.id);
        r.rotation.y = t;
        r.position.y = m.reward.y + Math.sin(t * 2) * 0.15;
        seals[i].material.emissive.setHex(f.rewards.has(m.id) ? m.color : 0);
        seals[i].material.emissiveIntensity = 0.8;
      });
      veil.visible = !course.activated;
      attackRing.visible = f.attackFlash > 0;
      attackRing.position.set(p.x, p.y - 0.55, p.z);
      attackRing.scale.setScalar(1 + (0.2 - f.attackFlash) * 5);
    },
  };
}
