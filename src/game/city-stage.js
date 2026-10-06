import { finishExpedition, smooth, mound, icoHull } from './expedition-terrain.js';
export const CITY_STAGE = finishExpedition(
  {
    id: 4,
    name: '夕映えの街の時計修理',
    subtitle: '灯火を駆け抜け、街じゅうの歯車で時計を直そう。',
    theme: 'AMBER CITADEL',
    color: 0xb9957e,
    stone: 0xd9bea0,
    sky: 0xedcbb5,
    accent: 0xcc785d,
    hint: '灯火の輪を30秒以内に巡り、通り・丘・市場・公園の歯車を集める。時計塔の足元でACTIONすると時計が動き、東の街門が開く。',
    zones: ['西の灯火街', '街じゅうの歯車探し', '時計塔の修理場'],
    spawn: { x: -52, z: 10 },
    goal: { x: 58, z: 22 },
    gate: { x: 58, z: 18 },
    clockTower: { x: -15, z: -76 },
    terrainColor(x, y, z) {
      if (x > 40 || z > 17) return y > 3 ? 0x91a571 : 0x82a071;
      if (x < -41) return 0xb8b083;
      return x > 5 && z < -13 ? 0xbd9f86 : 0xad967d;
    },
    overlooks: [
      { x: -54, z: -29, name: '丘の街の見晴らし', color: 0xf0c98b },
      { x: 53, z: -42, name: '夕映えの噴水公園', color: 0xd4ddb2 },
    ],
    park: {
      fountain: { x: 61, z: -50 },
      benches: [
        [49, -40],
        [60, -46],
      ],
      beds: [
        [47, -35, 3.6, 4],
        [67, -46, 3.6, 5],
      ],
      trees: [
        [46, -33],
        [67, -28],
        [66, -57],
      ],
    },
    missions: [
      {
        id: 'lamps',
        type: 'relay',
        sequence: true,
        duration: 30,
        name: '30秒以内に4つの灯火を巡る',
        short: '灯火の巡回',
        x: -26,
        z: -23,
        radius: 11,
        color: 0xf2c078,
        nodes: [
          [-28, -13],
          [-33, -25],
          [-24, -35],
          [-15, -22],
        ],
      },
      {
        id: 'gears',
        type: 'collect',
        name: '街じゅうに散った歯車を4つ集める',
        short: '街じゅうの歯車',
        x: 24,
        z: -33,
        radius: 12,
        color: 0xd99b88,
        reward: { x: -12, z: -67 },
        nodes: [
          [4, 5],
          [-50, -45],
          [24, -33],
          [53, -42],
        ],
      },
      {
        id: 'clock',
        type: 'repair',
        requires: ['lamps', 'gears'],
        name: '歯車を組み込んで時計塔を修理する',
        short: '時計塔の修理',
        x: -15,
        z: -70,
        radius: 6,
        color: 0xe5c98f,
        nodes: [[-15, -70]],
        reward: { x: -15, z: -67 },
      },
    ],
    boss: { x: -15, z: -76, name: '修理を待つ時計塔', hp: 1, radius: 7.5, disabled: true },
    winds: [],
    waters: [],
    rests: [[0, -47]],
    houses: [
      [-37, -10, 5],
      [-38, -27, 7],
      [-37, -45, 5],
      [37, -12, 6],
      [37, -29, 7],
      [36, -47, 5],
      [-19, -1, 4],
      [21, -5, 5],
      [10, -39, 4],
      [-57, -15, 4],
      [-61, -37, 5],
      [-58, -51, 4],
    ],
    solids: [
      ...[
        [-37, -10, 5],
        [-38, -27, 7],
        [-37, -45, 5],
        [37, -12, 6],
        [37, -29, 7],
        [36, -47, 5],
        [-19, -1, 4],
        [21, -5, 5],
        [10, -39, 4],
        [-57, -15, 4],
        [-61, -37, 5],
        [-58, -51, 4],
      ].map(([x, z, h]) => ({ x, z, w: 6, h, d: 5 })),
      { x: -15, z: -76, w: 5, h: 22, d: 5 },
      { x: -19, z: -69, w: 0.8, h: 1.8, d: 0.8 },
      { x: -15, z: -72.8, w: 4, h: 3.6, d: 0.35 },
    ],
    platforms: [{ x: 0, y: 0.2, z: -38, w: 6, h: 0.4, d: 8, collapse: 2.3, color: 0xb78368 }],
    paths: [
      [
        [-52, 10],
        [-43, 7],
        [-30, 6],
        [-16, 6],
        [4, 5],
        [14, 4],
        [28, 3],
        [45, 1],
        [58, 3],
        [58, 22],
      ],
      [
        [-30, 6],
        [-29, -4],
        [-28, -13],
        [-33, -25],
        [-24, -35],
        [-15, -22],
        [-10, -29],
        [9, -26],
        [24, -33],
        [24, -44],
        [19, -54],
      ],
      [
        [4, 5],
        [0, -6],
        [0, -27],
        [-10, -31],
        [-11, -39],
        [-8, -47],
        [0, -47],
        [-4, -60],
        [-12, -67],
        [-15, -70],
      ],
      [
        [-43, 7],
        [-46, -4],
        [-48, -12],
        [-54, -29],
        [-50, -45],
        [-44, -54],
        [-32, -56],
        [-25, -64],
        [-15, -65],
        [-15, -70],
      ],
      [
        [28, 3],
        [27, -4],
        [26, -8],
        [26, -17],
        [24, -25],
        [24, -33],
      ],
      [
        [-15, -70],
        [-12, -67],
        [-10, -62],
        [-4, -60],
        [19, -54],
        [26, -54],
        [35, -55],
        [43, -51],
        [53, -42],
        [57, -30],
        [48, -18],
        [45, 1],
      ],
      [
        [53, -42],
        [54.5, -44],
        [55.5, -46],
        [56.4, -49],
      ],
      [
        [53, -42],
        [60, -41],
        [66, -40],
        [64, -32],
        [57, -30],
      ],
    ],
    discoveries: [
      { id: 'alley', name: '夕焼けの小路', x: -35, z: -42, radius: 3 },
      { id: 'bridge', name: '崩れかけた近道', x: 0, z: -38, radius: 4 },
      { id: 'fountain', name: '夕映えの噴水公園', x: 57, z: -49, radius: 4 },
    ],
    stars: [
      [-20, -3],
      [-35, -42],
      [32, -20],
      [33, -46],
      [0, -38],
      [-19, -45],
      [19, -54],
      [-22, -67],
      [0, -71],
      [-54, -29],
      [-44, -7],
      [53, -42],
      [57, -30],
    ],
  },
  (x, z) => {
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -26, -23, 14, 22),
      mound(x, z, 24, -33, 14, 22),
      mound(x, z, -9, -59, 12, 18),
      mound(x, z, -15, -70, 7, 13),
      mound(x, z, -52, 10, 7, 15),
      mound(x, z, 58, 22, 7, 15),
      mound(x, z, 0, -47, 5, 12),
    );
    const elevation =
      1.5 * (1 - flat) -
      2 * (1 - smooth(2, 7, Math.abs(z + 38))) * (1 - smooth(7, 12, Math.abs(x))) +
      3 * mound(x, z, 0, -78, 6, 17) +
      6.5 * mound(x, z, -54, -29, 7, 27) +
      4 * mound(x, z, 53, -42, 8, 29) +
      2 * mound(x, z, 14, 23, 8, 26);
    const terrace = mound(x, z, 61, -50, 4, 7);
    return elevation * (1 - terrace) + 5.25 * terrace;
  },
);
// Each obstacle is defined once and rendered from this same geometry.
CITY_STAGE.park.solids = [];
const parkBox = (x, z, lift, w, h, d, color) => {
  const p = {
    x,
    z,
    y: CITY_STAGE.height(x, z) + lift,
    w,
    h,
    d,
    color,
    visible: false,
    cameraBlock: false,
  };
  CITY_STAGE.park.solids.push(p);
  CITY_STAGE.platforms.push(p);
};
const fountain = CITY_STAGE.park.fountain;
fountain.y = CITY_STAGE.height(fountain.x, fountain.z);
for (const side of [-1, 1]) {
  parkBox(fountain.x + side * 2.65, fountain.z, 0.32, 0.5, 0.64, 5.8, 0xd9bea0);
  parkBox(fountain.x, fountain.z + side * 2.65, 0.32, 4.8, 0.64, 0.5, 0xd9bea0);
}
parkBox(fountain.x, fountain.z, 0.9, 0.75, 1.8, 0.75, 0xd9bea0);
parkBox(fountain.x, fountain.z, 1.8, 2, 0.22, 2, 0xd9bea0);
for (const [x, z] of CITY_STAGE.park.benches) {
  parkBox(x, z, 0.64, 3.4, 0.24, 1.1, 0x8d6c58);
  parkBox(x, z - 0.46, 1.04, 3.4, 0.8, 0.18, 0x8d6c58);
  for (const side of [-1, 1]) parkBox(x + side * 1.2, z, 0.26, 0.22, 0.52, 0.85, 0x625355);
}
for (const bed of CITY_STAGE.park.beds) {
  const [x, z, w, d] = bed,
    heights = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => CITY_STAGE.height(x + (sx * w) / 2, z + (sz * d) / 2)),
    ),
    bottom = Math.min(...heights) - 0.04,
    top = Math.max(...heights) + 0.16;
  parkBox(x, z, (bottom + top) / 2 - CITY_STAGE.height(x, z), w, top - bottom, d, 0x8d6c58);
  bed.push(top);
}
for (const [x, z] of CITY_STAGE.park.trees) {
  parkBox(x, z, 1.5, 0.5, 3, 0.5, 0x81664c);
  const p = {
    x,
    z,
    y: CITY_STAGE.height(x, z) + 4.1,
    w: 4.4,
    h: 3.2,
    d: 4.4,
    hull: icoHull(2.2, 1.6, 2.2),
    kind: 'ico',
    color: 0x608367,
    visible: false,
    cameraBlock: false,
  };
  CITY_STAGE.park.solids.push(p);
  CITY_STAGE.platforms.push(p);
}
for (const [x, z, h] of CITY_STAGE.houses)
  CITY_STAGE.platforms.push({
    x,
    z,
    y: CITY_STAGE.height(x, z) + h + 0.3,
    w: 7,
    h: 0.6,
    d: 6,
    visible: false,
  });
for (const [x, z] of [
  [-25, -3],
  [30, -12],
  [30, -42],
])
  CITY_STAGE.platforms.push(
    { x, z, y: CITY_STAGE.height(x, z) + 0.5, w: 3, h: 1, d: 1.7, visible: false },
    { x, z, y: CITY_STAGE.height(x, z) + 2.2, w: 4, h: 0.2, d: 2.8, visible: false },
  );
