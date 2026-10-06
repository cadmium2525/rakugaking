import {
  finishExpedition,
  smooth,
  mound,
  icoHull,
  coneHull,
  distanceToPath,
} from './expedition-terrain.js';
const causeway = [
  [53, -55],
  [36, -68],
  [25, -77],
  [8, -83],
  [8, -86],
];
export const STAR_STAGE = finishExpedition(
  {
    id: 5,
    name: '星の灯台と天空の巨人',
    subtitle: '星座を結び、月の灯台を守り、尾根の先の天空城へ。',
    theme: 'CELESTIAL CROWN',
    color: 0x8891af,
    stone: 0xc1c8e0,
    sky: 0xa8b4d6,
    accent: 0xe9d28e,
    hint: '星座を番号順にACTION。東の月の灯台をACTIONで起動し、灯台の耐久を守りながら2方向から来る守衛を3波撃退。西の巨人を越え、尾根の回廊から城の奥へ。',
    zones: ['星座の観測庭', '月の灯台の防衛', '西の巨人の玉座'],
    spawn: { x: -57, z: 10 },
    goal: { x: 7, z: -91 },
    gate: { x: 7, z: -87 },
    moonBeacon: { x: 47, z: -32 },
    causeway,
    terrainColor(x, y, z) {
      if (Math.hypot(x - 32, z + 51) < 11) return 0x88aebb;
      if (x < -41) return y > 5 ? 0xc2b9db : 0xaaa4cb;
      if (x > 41) return 0x799ba6;
      return y > 3 ? 0xa6a7c3 : 0x818caa;
    },
    overlooks: [
      { x: -54, z: -24, name: '星読みの展望丘', color: 0xe7d5ff },
      { x: 53, z: -55, name: '月を望む天空庭', color: 0xbde3e5 },
    ],
    missions: [
      {
        id: 'stars',
        type: 'switches',
        sequence: true,
        name: '星座を番号順に4つ結ぶ',
        short: '星座の観測庭',
        x: -23,
        z: -24,
        radius: 12,
        color: 0xd4bbef,
        nodes: [
          [-23, -15],
          [-31, -27],
          [-18, -37],
          [-9, -23],
        ],
      },
      {
        id: 'sentinels',
        type: 'defense',
        name: '3波の襲撃から月の灯台を守る',
        short: '月の灯台の防衛',
        x: 47,
        z: -32,
        radius: 9,
        color: 0xf0dba3,
        enemyHP: 35,
        waveSize: 2,
        waveDelay: 1,
        beaconHP: 100,
        beaconDamage: 12,
        reward: { x: 49, z: -32 },
        enemies: [
          [52, -28],
          [42, -36],
          [42, -28],
          [52, -36],
          [47, -26],
          [47, -38],
        ],
      },
      {
        id: 'boss',
        type: 'boss',
        requires: ['stars', 'sentinels'],
        name: '天空の巨人を倒す',
        short: '天空の巨人',
        x: -26,
        z: -63,
        radius: 13,
        color: 0xb3d6f1,
      },
    ],
    boss: {
      x: -26,
      z: -63,
      hp: 250,
      radius: 8.5,
      pattern: 'double',
      damage: 36,
      requires: ['stars', 'sentinels'],
    },
    winds: [{ x: -18, width: 10, minZ: -41, maxZ: -30, minY: -4, maxY: 8, effect: 'stars' }],
    waters: [
      { x: 32, width: 14, radius: 7, minZ: -58, maxZ: -44, surface: 0.6, minY: -5, maxY: 3 },
    ],
    rests: [[0, -47]],
    solids: [
      ...[-1, 1].map((s) => ({ x: s * 13, z: -78, w: 6, h: 16, d: 6 })),
      { x: -36, z: -24, w: 4, h: 10, d: 4 },
      { x: 47, z: -32, w: 0.7, h: 2, d: 0.7 },
    ],
    platforms: [{ x: 0, y: 0.2, z: -39, w: 5, h: 0.4, d: 9, collapse: 2.8, color: 0x9b90ba }],
    paths: [
      [
        [-57, 10],
        [-45, -7],
        [-23, -15],
        [-31, -27],
        [-18, -37],
        [-9, -23],
        [-23, -24],
      ],
      [
        [-18, -37],
        [-4, -30],
        [10, -26],
        [26, -29],
        [46, -28.5],
        [50, -28.5],
        [57, -36],
        [53, -55],
      ],
      [
        [10, -26],
        [0, -25],
        [0, -47],
        [-16, -52],
        [-26, -63],
      ],
      [
        [-23, -15],
        [-45, -7],
        [-54, -24],
        [-53, -43],
        [-34, -55],
        [-26, -63],
      ],
      [
        [53, -55],
        [36, -68],
        [25, -77],
        [8, -83],
        [8, -86],
        [7, -91],
      ],
      [
        [-18, -37],
        [-34, -55],
        [-26, -63],
        [-6, -66],
        [20, -66],
        [36, -61],
        [36, -68],
        [53, -55],
      ],
    ],
    discoveries: [
      { id: 'moonpool', name: '月映しの泉', x: 32, z: -51, radius: 4 },
      { id: 'observatory', name: '星読みの小塔', x: -34, z: -23, radius: 3 },
      { id: 'causeway', name: '星の尾根の回廊', x: 25, z: -77, radius: 5 },
    ],
    stars: [
      [-11, -3],
      [-34, -23],
      [34, -13],
      [-34, -42],
      [32, -51],
      [0, -39],
      [-16, -52],
      [25, -77],
      [8, -86],
      [-54, -24],
      [-53, -43],
      [53, -55],
      [57, -36],
    ],
  },
  (x, z) => {
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -23, -24, 14, 23),
      mound(x, z, 47, -32, 10, 18),
      mound(x, z, -26, -63, 13, 19),
      mound(x, z, -57, 10, 7, 15),
      mound(x, z, 7, -91, 6, 13),
      mound(x, z, 0, -47, 5, 12),
    );
    return (
      1.8 * (1 - flat) -
      2 * mound(x, z, 32, -51, 4, 10) -
      1.8 * (1 - smooth(2, 6, Math.abs(z + 39))) * (1 - smooth(5, 10, Math.abs(x))) +
      3 * mound(x, z, 0, -78, 6, 17) +
      10 * mound(x, z, -54, -24, 7, 24) +
      5.5 * mound(x, z, 53, -55, 7, 27) +
      2.5 * mound(x, z, 32, 18, 7, 27) +
      3 * (1 - smooth(3, 8, distanceToPath(x, z, causeway)))
    );
  },
);
STAR_STAGE.causewayArches = [
  [36, -68],
  [25, -77],
].map(([x, z]) => {
  const y = Math.max(STAR_STAGE.height(x - 4, z), STAR_STAGE.height(x + 4, z)) + 5;
  for (const side of [-1, 1]) {
    const px = x + side * 4,
      ground = STAR_STAGE.height(px, z),
      h = y - ground;
    STAR_STAGE.platforms.push({ x: px, y: ground + h / 2, z, w: 0.9, h, d: 1.4, visible: false });
  }
  STAR_STAGE.platforms.push({ x, y, z, w: 9, h: 0.55, d: 1.4, visible: false });
  return { x, y, z };
});
const h = STAR_STAGE.height(0, -78);
STAR_STAGE.platforms.push({
  x: -36,
  y: STAR_STAGE.height(-36, -24) + 11.3,
  z: -24,
  w: 6,
  h: 2.6,
  d: 6,
  hull: coneHull(3, 2.6, 3),
  visible: false,
});
STAR_STAGE.platforms.push(
  { x: 0, y: h + 10.4, z: -80, w: 20, h: 0.8, d: 12, visible: false },
  { x: 0, y: h + 13, z: -80, w: 12, h: 5, d: 9, hull: icoHull(6, 2.5, 4.5), visible: false },
);
for (const side of [-1, 1])
  STAR_STAGE.platforms.push({
    x: side * 13,
    y: STAR_STAGE.height(side * 13, -78) + 19.5,
    z: -78,
    w: 8,
    h: 7,
    d: 8,
    hull: coneHull(4, 7, 4),
    visible: false,
  });
