import { finishExpedition, smooth, mound, icoHull, coneHull } from './expedition-terrain.js';
export const STAR_STAGE = finishExpedition(
  {
    id: 5,
    name: '星座の庭と天空の巨人',
    subtitle: '星の仕掛けを解き、二重の衝撃波を越えて天空城へ。',
    theme: 'CELESTIAL CROWN',
    color: 0x8891af,
    stone: 0xc1c8e0,
    sky: 0xa8b4d6,
    accent: 0xe9d28e,
    hint: '星座を番号順にACTION、守衛4体を撃破すると巨人の盾が消える。二連続の赤い衝撃波の後に攻撃。',
    zones: ['星座の観測庭', '月の守衛広場', '巨人の玉座'],
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
        type: 'combat',
        name: '月の守衛を4体倒す',
        short: '月の守衛',
        x: 26,
        z: -29,
        radius: 12,
        color: 0xf0dba3,
        enemyHP: 50,
        enemies: [
          [23, -22],
          [31, -27],
          [25, -36],
          [17, -30],
        ],
      },
      {
        id: 'boss',
        type: 'boss',
        name: '天空の巨人を倒す',
        short: '天空の巨人',
        x: 5,
        z: -61,
        radius: 13,
        color: 0xb3d6f1,
      },
    ],
    boss: {
      x: 5,
      z: -61,
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
    ],
    platforms: [{ x: 0, y: 0.2, z: -39, w: 5, h: 0.4, d: 9, collapse: 2.8, color: 0x9b90ba }],
    paths: [
      [
        [0, 10],
        [-10, -2],
        [-23, -15],
        [-31, -27],
        [-18, -37],
        [-9, -23],
        [-23, -24],
      ],
      [
        [0, 3],
        [12, -3],
        [23, -22],
        [26, -29],
        [20, -46],
        [5, -61],
        [0, -78],
      ],
      [
        [0, -6],
        [0, -25],
        [0, -47],
        [5, -61],
      ],
    ],
    discoveries: [
      { id: 'moonpool', name: '月映しの泉', x: 32, z: -51, radius: 4 },
      { id: 'observatory', name: '星読みの小塔', x: -34, z: -23, radius: 3 },
    ],
    stars: [
      [-11, -3],
      [-34, -23],
      [34, -13],
      [-34, -42],
      [32, -51],
      [0, -39],
      [-16, -52],
      [19, -67],
      [0, -71],
    ],
  },
  (x, z) => {
    const rim =
      11 * Math.max(smooth(40, 48, Math.abs(x)), smooth(16, 24, z), 1 - smooth(-88, -80, z));
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -23, -24, 14, 23),
      mound(x, z, 26, -29, 14, 23),
      mound(x, z, 5, -61, 13, 19),
      mound(x, z, 0, -47, 5, 12),
    );
    return (
      rim +
      1.8 * (1 - flat) -
      2 * mound(x, z, 32, -51, 4, 10) -
      1.8 * (1 - smooth(2, 6, Math.abs(z + 39))) * (1 - smooth(5, 10, Math.abs(x))) +
      3 * mound(x, z, 0, -78, 6, 17)
    );
  },
);
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
