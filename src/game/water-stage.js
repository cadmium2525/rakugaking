import { finishExpedition, smooth, mound, icoHull } from './expedition-terrain.js';
export const WATER_STAGE = finishExpedition(
  {
    id: 3,
    name: '青の水庭と潮騒の神殿',
    subtitle: '水門を開き、沈んだ庭の光を取り戻す。',
    theme: 'TIDAL SANCTUARY',
    color: 0x79aaa1,
    stone: 0xcadbd2,
    sky: 0xc4e3e8,
    accent: 0x72bac9,
    hint: '水門は1→2→3の順にACTION。水位が下がる。庭の光の輪を巡り、潮の守護獣を倒して神殿へ。',
    zones: ['水門と大水道', '沈んだ蓮の庭', '潮騒の神殿'],
    terrainColor(x, y, z) {
      if (Math.hypot(x - 25, z + 27) < 18) return y < 0 ? 0x9aae83 : 0xb8cda2;
      if (x > 41) return 0xc9d6b0;
      return y > 4 ? 0x87b29a : 0x67a690;
    },
    overlooks: [
      { x: -54, z: -20, name: '水道丘の見晴らし', color: 0xbde0cc },
      { x: 51, z: -47, name: '海へ続く水庭', color: 0x93d4dc },
    ],
    missions: [
      {
        id: 'sluice',
        type: 'switches',
        sequence: true,
        effect: 'drain',
        name: '水門を番号順に3つ開く',
        short: '水門の謎',
        x: -25,
        z: -24,
        radius: 11,
        color: 0x84d1e0,
        nodes: [
          [-23, -15],
          [-18, -25],
          [-30, -32],
        ],
      },
      {
        id: 'pearls',
        type: 'relay',
        sequence: true,
        name: '沈んだ庭の光の輪を4つ巡る',
        short: '蓮の水庭',
        x: 25,
        z: -27,
        radius: 13,
        color: 0xe8c69c,
        nodes: [
          [22, -17],
          [31, -24],
          [27, -34],
          [17, -30],
        ],
      },
      {
        id: 'boss',
        type: 'boss',
        name: '潮の守護獣を倒す',
        short: '潮の守護獣',
        x: 0,
        z: -61,
        radius: 12,
        color: 0x94cbd9,
      },
    ],
    boss: { x: 0, z: -61, hp: 190, radius: 7, damage: 33 },
    winds: [],
    waters: [
      {
        x: 25,
        width: 32,
        radius: 16,
        minZ: -43,
        maxZ: -11,
        surface: 0.8,
        minY: -5,
        maxY: 3,
        effect: 'sluice',
      },
      ...Array.from({ length: 11 }, (_, i) => {
        const x = -32 + i * 4,
          z = -34 + Math.sin(x * 0.06) * 3;
        return {
          x,
          width: 4.2,
          minZ: z - 1.65,
          maxZ: z + 1.65,
          surface: 0.45,
          minY: -5,
          maxY: 3,
          effect: 'sluice',
        };
      }),
    ],
    platforms: [{ x: 0, y: 1.35, z: -34, w: 7, h: 0.4, d: 9, color: 0xcadbd2 }],
    rests: [[0, -48]],
    paths: [
      [
        [0, 10],
        [-9, -4],
        [-23, -15],
        [-25, -24],
        [-30, -32],
        [-23, -45],
        [0, -61],
      ],
      [
        [0, 4],
        [12, -4],
        [22, -17],
        [31, -24],
        [27, -34],
        [17, -30],
        [10, -45],
        [0, -61],
        [0, -78],
      ],
      [
        [0, -8],
        [0, -30],
        [0, -48],
        [0, -61],
      ],
      [
        [-23, -15],
        [-46, -6],
        [-54, -20],
        [-55, -42],
        [-38, -53],
        [0, -61],
      ],
      [
        [22, -17],
        [46, -13],
        [57, -29],
        [51, -47],
        [30, -57],
        [0, -61],
      ],
      [
        [-30, -32],
        [-12, -37],
        [2, -37],
        [17, -30],
      ],
    ],
    solids: [
      ...[-13, -26, -39].map((z) => ({ x: -38, z, w: 2.2, h: 8, d: 2.2 })),
      ...[-1, 1].flatMap((s) =>
        [-66, -73, -82].map((z) => ({ x: s * 8, z, w: 1.4, h: 9, d: 1.4 })),
      ),
    ],
    discoveries: [
      { id: 'aqueduct', name: '大水道の見晴らし', x: -36, z: -41, radius: 4 },
      { id: 'lotus', name: '蓮の中庭', x: 34, z: -37, radius: 4 },
    ],
    stars: [
      [-9, -5],
      [-33, -10],
      [-10, -24],
      [-36, -41],
      [34, -37],
      [9, -44],
      [-22, -51],
      [18, -55],
      [0, -71],
      [-54, -20],
      [-55, -42],
      [51, -47],
      [57, -29],
    ],
  },
  (x, z) => {
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -25, -24, 12, 20),
      mound(x, z, 0, -61, 12, 19),
      mound(x, z, 0, -48, 4, 10),
    );
    return (
      (1.4 + 0.5 * Math.sin(x * 0.12) * Math.cos(z * 0.1)) * (1 - flat) -
      2.2 * mound(x, z, 25, -27, 9, 19) +
      3 * mound(x, z, 0, -78, 7, 17) +
      9.5 * mound(x, z, -55, -20, 7, 26) +
      2.5 * mound(x, z, 51, -47, 7, 25) +
      10 * mound(x, z, 0, -96, 4, 17) -
      1.35 *
        (1 - smooth(1, 3, Math.abs(z + 34 - Math.sin(x * 0.06) * 3))) *
        smooth(-39, -34, x) *
        (1 - smooth(7, 12, x))
    );
  },
);
const roofHeight = WATER_STAGE.height(0, -78);
WATER_STAGE.platforms.push(
  { x: 0, y: roofHeight + 9.4, z: -77, w: 18, h: 0.8, d: 18, visible: false },
  {
    x: 0,
    y: roofHeight + 12.4,
    z: -77,
    w: 14,
    h: 6,
    d: 14,
    hull: icoHull(7, 3, 7),
    visible: false,
  },
);
WATER_STAGE.aqueductDeck =
  Math.max(...[-13, -26, -39].map((z) => WATER_STAGE.height(-38, z))) + 8.2;
for (const column of WATER_STAGE.platforms.filter((p) => p.x === -38 && p.w === 2.2)) {
  column.h = WATER_STAGE.aqueductDeck - 0.2 - WATER_STAGE.height(column.x, column.z);
  column.y = WATER_STAGE.height(column.x, column.z) + column.h / 2;
}
for (const z of [-13, -26, -39])
  WATER_STAGE.platforms.push({
    x: -38,
    y: WATER_STAGE.aqueductDeck,
    z: z - 5.5,
    w: 2.5,
    h: 0.8,
    d: 13,
    visible: false,
  });
