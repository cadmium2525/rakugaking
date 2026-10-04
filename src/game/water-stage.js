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
    ],
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
    ],
  },
  (x, z) => {
    const rim =
      10 * Math.max(smooth(39, 48, Math.abs(x)), smooth(16, 24, z), 1 - smooth(-88, -80, z));
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -25, -24, 12, 20),
      mound(x, z, 0, -61, 12, 19),
      mound(x, z, 0, -48, 4, 10),
    );
    return (
      rim +
      (1.4 + 0.5 * Math.sin(x * 0.12) * Math.cos(z * 0.1)) * (1 - flat) -
      2.2 * mound(x, z, 25, -27, 9, 19) +
      3 * mound(x, z, 0, -78, 7, 17)
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
for (const z of [-13, -26, -39])
  WATER_STAGE.platforms.push({
    x: -38,
    y: WATER_STAGE.height(-38, z) + 8.2,
    z: z - 5.5,
    w: 2.5,
    h: 0.8,
    d: 13,
    visible: false,
  });
