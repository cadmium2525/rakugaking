import { finishExpedition, smooth, mound, icoHull } from './expedition-terrain.js';
export const CITY_STAGE = finishExpedition(
  {
    id: 4,
    name: '夕映えの街と忘れられた時計塔',
    subtitle: '街に灯りを戻し、止まった時計を動かそう。',
    theme: 'AMBER CITADEL',
    color: 0xb9957e,
    stone: 0xd9bea0,
    sky: 0xedcbb5,
    accent: 0xcc785d,
    hint: '灯火の輪を30秒以内に4つ巡る。広場の守衛を倒し、時計の番人に挑戦。ひび割れた近道はJUMPで。',
    zones: ['西の灯火街', '東の市場広場', '時計塔の庭'],
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
        id: 'guards',
        type: 'combat',
        name: '市場広場の守衛を4体倒す',
        short: '市場の守衛',
        x: 24,
        z: -33,
        radius: 12,
        color: 0xd99b88,
        enemyHP: 40,
        enemies: [
          [22, -23],
          [29, -27],
          [26, -38],
          [18, -35],
        ],
      },
      {
        id: 'boss',
        type: 'boss',
        name: '時計の番人を倒す',
        short: '時計の番人',
        x: -9,
        z: -59,
        radius: 12,
        color: 0xe5c98f,
      },
    ],
    boss: { x: -9, z: -59, hp: 210, radius: 7.5, cycle: 6.5, damage: 35 },
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
    ],
    platforms: [{ x: 0, y: 0.2, z: -38, w: 6, h: 0.4, d: 8, collapse: 2.3, color: 0xb78368 }],
    paths: [
      [
        [0, 10],
        [-1, 0],
        [-20, -6],
        [-28, -13],
        [-33, -25],
        [-24, -35],
        [-15, -22],
        [-26, -23],
      ],
      [
        [0, 0],
        [22, -7],
        [24, -18],
        [24, -33],
        [20, -47],
        [-9, -59],
      ],
      [
        [0, 0],
        [0, -27],
        [0, -47],
        [-9, -59],
        [0, -78],
      ],
      [
        [-28, -13],
        [-27, -4],
        [-42, 3],
        [-48, -6],
        [-54, -29],
        [-51, -45],
        [-32, -56],
        [-9, -59],
      ],
      [
        [24, -18],
        [48, -18],
        [57, -30],
        [53, -42],
        [36, -53],
        [19, -54],
      ],
      [
        [-24, -35],
        [-10, -29],
        [9, -26],
        [24, -33],
      ],
      [
        [53, -42],
        [55, -45],
        [56, -48],
        [57, -49],
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
