const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hill = (x, z, cx, cz, inner, outer) => 1 - smooth(inner, outer, Math.hypot(x - cx, z - cz));
function height(x, z) {
  const east = 3.4 * hill(x, z, 22, -25, 7, 23);
  const west = 4.8 * hill(x, z, -29, -41, 5, 25);
  const rim =
    11 * Math.max(smooth(32, 40, Math.abs(x)), smooth(15, 22, z), 1 - smooth(-78, -71, z));
  const flat = Math.max(
    hill(x, z, -21, -18, 10, 22),
    hill(x, z, -5, -49, 12, 16),
    hill(x, z, 0, 8, 7, 12),
    hill(x, z, 0, -66, 8, 13),
  );
  const rolling = (0.35 + 0.3 * Math.sin(x * 0.19) * Math.cos(z * 0.16)) * (1 - flat);
  const river =
    1.6 *
    (1 - smooth(1, 4, Math.abs(z + 33 + Math.sin(x * 0.16)))) *
    (1 - smooth(10, 17, Math.abs(x)));
  return (east + west + rolling) * (1 - flat) + rim - river;
}
export const FIELD_TERRAIN = {
  x: 0,
  y: 0,
  z: 0,
  w: 80,
  d: 100,
  h: 0,
  terrain: true,
  visible: false,
  step: 2,
  minX: -40,
  minZ: -78,
  columns: 40,
  rows: 50,
};
const vertices = [],
  indices = [];
for (let z = 0; z <= 50; z++)
  for (let x = 0; x <= 40; x++)
    vertices.push(-40 + x * 2, height(-40 + x * 2, -78 + z * 2), -78 + z * 2);
for (let z = 0; z < 50; z++)
  for (let x = 0; x < 40; x++) {
    const a = z * 41 + x,
      b = a + 1,
      c = a + 41,
      d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
FIELD_TERRAIN.vertices = new Float32Array(vertices);
FIELD_TERRAIN.indices = new Uint32Array(indices);

// Sample the same triangles used by Rapier and Three, including the diagonal.
export function fieldHeight(x, z) {
  const gx = Math.max(0, Math.min(39.9999, (x + 40) / 2)),
    gz = Math.max(0, Math.min(49.9999, (z + 78) / 2));
  const ix = Math.floor(gx),
    iz = Math.floor(gz),
    tx = gx - ix,
    tz = gz - iz,
    a = iz * 41 + ix;
  const y = (i) => FIELD_TERRAIN.vertices[i * 3 + 1];
  return tx + tz <= 1
    ? y(a) + (y(a + 1) - y(a)) * tx + (y(a + 41) - y(a)) * tz
    : y(a + 42) + (y(a + 41) - y(a + 42)) * (1 - tx) + (y(a + 1) - y(a + 42)) * (1 - tz);
}
export const FIELD_PATHS = [
  [
    [0, 8],
    [0, -2],
    [-5, -9],
    [-15, -14],
    [-21, -18],
  ],
  [
    [-3, -8],
    [5, -11],
    [13, -15],
    [21, -21],
    [24, -28],
  ],
  [
    [0, -7],
    [1, -19],
    [0, -28],
    [0, -37],
    [-5, -44],
    [-5, -49],
    [0, -59],
    [0, -68],
  ],
  [
    [-18, -23],
    [-25, -29],
    [-29, -36],
    [-29, -41],
  ],
];

export function terrainGeometryData() {
  const colors = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i],
      y = vertices[i + 1],
      z = vertices[i + 2];
    const stone = y > 4.5,
      ruins = Math.hypot(x - 22, z + 25) < 10;
    const color = stone ? [0.43, 0.51, 0.44] : ruins ? [0.66, 0.66, 0.47] : [0.38, 0.57, 0.32];
    const variation = 0.92 + Math.sin(x * 1.3 + z * 0.7) * 0.06;
    colors.push(...color.map((v) => v * variation));
  }
  return {
    vertices: FIELD_TERRAIN.vertices,
    indices: FIELD_TERRAIN.indices,
    colors: new Float32Array(colors),
  };
}
