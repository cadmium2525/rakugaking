// Both the renderer and physics sample these exact triangles.
export const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const mound = (x, z, cx, cz, inner, outer) =>
  1 - smooth(inner, outer, Math.hypot(x - cx, z - cz));
export function distanceToPath(x, z, points) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1],
      [bx, bz] = points[i],
      dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return distance;
}
export function icoHull(sx, sy, sz) {
  const t = (1 + Math.sqrt(5)) / 2,
    n = Math.sqrt(1 + t * t),
    out = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      out.push(
        (a / n) * sx,
        ((b * t) / n) * sy,
        0,
        0,
        (a / n) * sy,
        ((b * t) / n) * sz,
        ((b * t) / n) * sx,
        0,
        (a / n) * sz,
      );
  return new Float32Array(out);
}
export function coneHull(sx, h, sz) {
  const v = [0, h / 2, 0];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    v.push(Math.sin(a) * sx, -h / 2, Math.cos(a) * sz);
  }
  return new Float32Array(v);
}
export function makeTerrain(height) {
  const t = {
    x: 0,
    y: 0,
    z: 0,
    w: 156,
    d: 148,
    h: 0,
    terrain: true,
    visible: false,
    minX: -78,
    minZ: -106,
    step: 2,
    columns: 78,
    rows: 74,
  };
  const vertices = [],
    indices = [];
  for (let z = 0; z <= t.rows; z++)
    for (let x = 0; x <= t.columns; x++) {
      const px = t.minX + x * t.step,
        pz = t.minZ + z * t.step;
      vertices.push(px, height(px, pz), pz);
    }
  for (let z = 0; z < t.rows; z++)
    for (let x = 0; x < t.columns; x++) {
      const a = z * (t.columns + 1) + x,
        c = a + t.columns + 1;
      indices.push(a, c, a + 1, a + 1, c, c + 1);
    }
  t.vertices = new Float32Array(vertices);
  t.indices = new Uint32Array(indices);
  t.height = (x, z) => {
    const gx = Math.max(0, Math.min(t.columns - 0.0001, (x - t.minX) / t.step)),
      gz = Math.max(0, Math.min(t.rows - 0.0001, (z - t.minZ) / t.step)),
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      tx = gx - ix,
      tz = gz - iz,
      a = iz * (t.columns + 1) + ix,
      c = a + t.columns + 1,
      y = (i) => t.vertices[i * 3 + 1];
    return tx + tz <= 1
      ? y(a) + (y(a + 1) - y(a)) * tx + (y(c) - y(a)) * tz
      : y(c + 1) + (y(c) - y(c + 1)) * (1 - tx) + (y(a + 1) - y(c + 1)) * (1 - tz);
  };
  return t;
}
export function finishExpedition(stage, rawHeight) {
  const terrain = makeTerrain(rawHeight);
  stage.height = terrain.height;
  stage.landscapeHeight = rawHeight;
  stage.cameraHint = { distance: 16, height: 9, lookAhead: 8, fogNear: 85, fogFar: 230 };
  stage.platforms = [terrain, ...(stage.platforms || [])];
  const ground = (x, z) => stage.height(x, z);
  for (const water of stage.waters || [])
    if (water.effect) {
      let minimum = Infinity;
      for (let i = 0; i < terrain.vertices.length; i += 3) {
        const x = terrain.vertices[i],
          y = terrain.vertices[i + 1],
          z = terrain.vertices[i + 2];
        if (
          z >= water.minZ &&
          z <= water.maxZ &&
          Math.abs(x - (water.x || 0)) <= water.width / 2 &&
          (!water.radius ||
            Math.hypot(x - water.x, z - (water.minZ + water.maxZ) / 2) <= water.radius + 2)
        )
          minimum = Math.min(minimum, y);
      }
      water.drainedSurface = minimum - 0.3;
    }
  for (const s of stage.solids || [])
    stage.platforms.push({ ...s, y: ground(s.x, s.z) + s.h / 2, visible: false });
  for (const o of stage.overlooks || []) {
    stage.discoveries.push({ id: `lookout-${o.x}`, ...o, radius: 4 });
    for (const side of [-1, 1])
      stage.platforms.push({
        x: o.x + side * 4,
        y: ground(o.x + side * 4, o.z + 3) + 1.8,
        z: o.z + 3,
        w: 0.3,
        h: 3.6,
        d: 0.3,
        cameraBlock: false,
        visible: false,
      });
  }
  const start = stage.spawn || { x: 0, z: 10 },
    finish = stage.goal || { x: 0, z: -78 };
  stage.spawn = { ...start, y: start.y ?? ground(start.x, start.z) + 1.8 };
  stage.goal = { ...finish, y: finish.y ?? ground(finish.x, finish.z) };
  const gateInput = stage.gate || {};
  stage.gate = {
    x: stage.goal.x,
    y: stage.goal.y + 2.5,
    z: stage.goal.z + 3,
    w: 5,
    h: 5,
    d: 0.6,
    gate: true,
    visible: false,
    ...gateInput,
  };
  stage.gate.y = gateInput.y ?? ground(stage.gate.x, stage.gate.z) + stage.gate.h / 2;
  stage.platforms.push(stage.gate);
  stage.platforms.push(
    ...[-1, 1].map((side) => ({
      x: stage.gate.x + side * 3.5,
      z: stage.gate.z,
      y: ground(stage.gate.x + side * 3.5, stage.gate.z) + 3,
      w: 1.8,
      h: 6,
      d: 2,
      visible: false,
    })),
    {
      x: stage.gate.x,
      y: ground(stage.gate.x, stage.gate.z) + 6,
      z: stage.gate.z,
      w: 9,
      h: 0.9,
      d: 2,
      visible: false,
    },
  );
  // The mesh continues beyond thin, physical rails; their open gaps preserve
  // the distant horizon rather than surrounding every field with a solid wall.
  // This irregular perimeter lies outside the original 144 x 136 m field,
  // while leaving a strip of real terrain beyond every collider.
  stage.boundaryPath = [
    [-74, -102],
    [-46, -104],
    [-18, -102],
    [14, -104],
    [43, -101.5],
    [74, -102],
    [76, -79],
    [73.2, -52],
    [75.5, -24],
    [73, 6],
    [75.5, 26],
    [74, 38],
    [48, 40],
    [20, 37.5],
    [-10, 40],
    [-39, 38],
    [-66, 40],
    [-74, 38],
    [-76, 15],
    [-73.5, -11],
    [-76, -38],
    [-73.5, -64],
    [-76, -84],
  ].map(([x, z], i) => [
    Math.abs(x) >= 73 ? x + Math.sign(x) * 0.35 * (1 + Math.sin(i * 1.7 + stage.id)) : x,
    z < -100
      ? z - 0.2 * (1 + Math.sin(i * 0.9 + stage.id))
      : z > 36
        ? z + 0.2 * (1 + Math.sin(i * 0.9 + stage.id))
        : z,
  ]);
  stage.mapBounds = {
    minX: Math.min(...stage.boundaryPath.map(([x]) => x)),
    maxX: Math.max(...stage.boundaryPath.map(([x]) => x)),
    minZ: Math.min(...stage.boundaryPath.map(([, z]) => z)),
    maxZ: Math.max(...stage.boundaryPath.map(([, z]) => z)),
  };
  stage.boundaries = [];
  for (let i = 0; i < stage.boundaryPath.length; i++) {
    const [ax, az] = stage.boundaryPath[i],
      [bx, bz] = stage.boundaryPath[(i + 1) % stage.boundaryPath.length],
      dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz),
      count = Math.ceil(length / 0.9),
      nx = dz / length,
      nz = -dx / length;
    // Real square slats have gaps smaller than the capsule, even at bends.
    // The horizontal rails sit behind them and cannot be used as stairs.
    for (let n = 0; n < count; n++) {
      const x = ax + (dx * n) / count,
        z = az + (dz * n) / count;
      stage.boundaries.push({
        x,
        z,
        y: ground(x, z) + 1.75,
        w: 0.35,
        h: 3.5,
        d: 0.35,
        boundary: true,
        visible: false,
        cameraBlock: false,
      });
    }
    const spans = Math.ceil(length / 2);
    for (let n = 0; n < spans; n++) {
      const t = (n + 0.5) / spans,
        x = ax + dx * t + nx * 0.25,
        z = az + dz * t + nz * 0.25,
        groundY = Math.min(
          ground(ax + (dx * n) / spans, az + (dz * n) / spans),
          ground(ax + (dx * (n + 1)) / spans, az + (dz * (n + 1)) / spans),
        );
      for (const lift of [0.6, 1.8, 3.3])
        stage.boundaries.push({
          x,
          z,
          y: groundY + lift,
          w: length / spans + 0.12,
          h: 0.18,
          d: 0.16,
          rotation: -Math.atan2(dz, dx),
          boundary: true,
          rail: true,
          visible: false,
          cameraBlock: false,
        });
    }
  }
  // Rails sit behind the solid slats, beyond the capsule's possible contact.
  stage.platforms.push(...stage.boundaries.filter((p) => !p.rail));
  stage.checkpoints = [];
  for (const [x, z] of stage.rests || [[0, -38]]) {
    const top = ground(x, z) + 0.08;
    stage.checkpoints.push(stage.platforms.length);
    stage.platforms.push({ x, z, y: top - 0.15, w: 5, d: 5, h: 0.3, color: stage.stone });
  }
  stage.missions.forEach((m) => {
    const reward = m.reward || { x: m.x, z: m.z };
    m.reward = { ...reward, y: reward.y ?? ground(reward.x, reward.z) + 1.1 };
  });
  stage.runes = stage.missions.flatMap((m) =>
    (m.nodes || []).map(([x, z], index) => ({ x, z, y: ground(x, z), mission: m.id, index })),
  );
  stage.enemies = stage.missions.flatMap((m) =>
    (m.enemies || []).map(([x, z]) => ({ x, z, hp: m.enemyHP || 35, mission: m.id })),
  );
  stage.boss.y = ground(stage.boss.x, stage.boss.z);
  stage.boss.name ||= stage.missions.find((m) => m.type === 'boss')?.short || '時計の機構';
  stage.collectibles = (stage.stars || []).map(([x, z]) => {
    const top = stage.platforms
      .filter(
        (p) =>
          !p.terrain &&
          p.visible !== false &&
          Math.abs(x - p.x) < p.w / 2 &&
          Math.abs(z - p.z) < p.d / 2,
      )
      .reduce((y, p) => Math.max(y, p.y + p.h / 2), ground(x, z));
    return { x, z, y: top + 1.1 };
  });
  return Object.assign(stage, {
    field: true,
    expedition: true,
    routeLength: 1,
    sidePaths: [],
    routes: [],
    signs: [],
    hazards: [],
    requiresAction: true,
  });
}
