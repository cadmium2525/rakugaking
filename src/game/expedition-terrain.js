// Both the renderer and physics sample these exact triangles.
export const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const mound = (x, z, cx, cz, inner, outer) =>
  1 - smooth(inner, outer, Math.hypot(x - cx, z - cz));
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
    w: 96,
    d: 112,
    h: 0,
    terrain: true,
    visible: false,
    minX: -48,
    minZ: -88,
    step: 2,
    columns: 48,
    rows: 56,
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
  stage.spawn = { x: 0, y: ground(0, 10) + 1.8, z: 10 };
  stage.goal = { x: 0, y: ground(0, -78), z: -78 };
  stage.gate = {
    x: 0,
    y: stage.goal.y + 2.5,
    z: -75,
    w: 5,
    h: 5,
    d: 0.6,
    gate: true,
    visible: false,
  };
  stage.platforms.push(stage.gate);
  stage.platforms.push(
    ...[-1, 1].map((side) => ({
      x: side * 3.5,
      z: stage.gate.z,
      y: ground(side * 3.5, stage.gate.z) + 3,
      w: 1.8,
      h: 6,
      d: 2,
      visible: false,
    })),
  );
  // Raised boundary slopes are backed by collision, including at the four corners.
  stage.platforms.push(
    ...[-1, 1].map((s) => ({ x: s * 48, y: 8, z: -32, w: 2, h: 24, d: 114, visible: false })),
    ...[-88, 24].map((z) => ({ x: 0, y: 8, z, w: 96, h: 24, d: 2, visible: false })),
  );
  stage.checkpoints = [];
  for (const [x, z] of stage.rests || [[0, -38]]) {
    const top = ground(x, z) + 0.08;
    stage.checkpoints.push(stage.platforms.length);
    stage.platforms.push({ x, z, y: top - 0.15, w: 5, d: 5, h: 0.3, color: stage.stone });
  }
  stage.missions.forEach((m) => {
    m.reward = { x: m.x, z: m.z, y: ground(m.x, m.z) + 1.1 };
  });
  stage.runes = stage.missions.flatMap((m) =>
    (m.nodes || []).map(([x, z], index) => ({ x, z, y: ground(x, z), mission: m.id, index })),
  );
  stage.enemies = stage.missions.flatMap((m) =>
    (m.enemies || []).map(([x, z]) => ({ x, z, hp: m.enemyHP || 35, mission: m.id })),
  );
  stage.boss.y = ground(stage.boss.x, stage.boss.z);
  stage.boss.name ||= stage.missions.find((m) => m.type === 'boss').short;
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
