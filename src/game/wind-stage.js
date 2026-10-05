import { finishExpedition, smooth, mound } from './expedition-terrain.js';
export const WIND_STAGE = finishExpedition(
  {
    id: 2,
    name: '風車の谷と雲海の灯台',
    subtitle: '止まった風車を回し、峡谷の嵐を鎮めよう。',
    theme: 'WIND VALLEY',
    color: 0x91ac7c,
    stone: 0xd9c5a0,
    sky: 0xc4e0ec,
    accent: 0xf0c16d,
    hint: '3つの風車をACTIONで起動すると風が弱まる。救出・風車・ボスの紋章を集め、灯台の門へ。',
    zones: ['麦畑の風車村', '峡谷の救出基地', '嵐の闘技場'],
    terrainColor(x, y, z) {
      if (Math.abs(z + 38) < 6 && Math.abs(x) < 27 && y < 0.3) return 0x9c8564;
      if (x < -35 && z > -35) return 0xb8b267;
      return y > 4 ? 0x87a360 : 0x78a858;
    },
    overlooks: [
      { x: -49, z: -18, name: '麦丘の風見台', color: 0xeac378 },
      { x: 53, z: -45, name: '雲海の岬', color: 0xbde5e8 },
    ],
    missions: [
      {
        id: 'mills',
        type: 'switches',
        name: '谷の風車を3基起動',
        short: '風車の復旧',
        x: -20,
        z: -19,
        radius: 10,
        color: 0xeebf6d,
        nodes: [
          [-23, -16],
          [0, -27],
          [23, -19],
        ],
        effect: 'wind',
      },
      {
        id: 'rescue',
        type: 'combat',
        name: '峡谷の基地の敵を3体倒す',
        short: '峡谷の救出',
        x: 25,
        z: -44,
        radius: 11,
        color: 0x80d5c7,
        enemies: [
          [22, -40],
          [29, -44],
          [22, -48],
        ],
      },
      {
        id: 'boss',
        type: 'boss',
        name: '嵐の騎士を倒す',
        short: '嵐の騎士',
        x: 0,
        z: -62,
        radius: 12,
        color: 0xa6ace4,
      },
    ],
    boss: { x: 0, z: -62, hp: 170, radius: 6.5, cycle: 6.5, damage: 30 },
    rests: [[0, -50]],
    solids: [
      ...[
        [-23, -19],
        [0, -30],
        [23, -22],
      ].map(([x, z]) => ({ x, z, w: 4, h: 9, d: 4 })),
      ...[
        [31, -36],
        [35, -46],
        [17, -49],
      ].map(([x, z]) => ({ x, z, w: 3.4, h: 2.2, d: 3.2 })),
      ...[-32.5, -23.5].map((x) => ({ x, z: -38, w: 1.8, h: 8, d: 2 })),
      { x: 0, z: -82, w: 4, h: 20, d: 4 },
    ],
    platforms: [{ x: 0, y: 0.225, z: -38, w: 6, h: 0.35, d: 13, color: 0xad8c60 }],
    winds: [{ x: 0, width: 14, minZ: -39, maxZ: -22, minY: -5, maxY: 8, effect: 'mills' }],
    waters: [],
    paths: [
      [
        [0, 10],
        [-8, -4],
        [-20, -19],
        [0, -27],
        [23, -19],
      ],
      [
        [0, -4],
        [14, -10],
        [31, -29],
        [25, -44],
        [0, -62],
        [0, -78],
      ],
      [
        [-20, -19],
        [-31, -30],
        [-28, -46],
        [0, -62],
      ],
      [
        [0, -27],
        [0, -44],
        [0, -62],
      ],
      [
        [-20, -19],
        [-39, -7],
        [-49, -18],
        [-52, -38],
        [-35, -53],
        [0, -62],
      ],
      [
        [23, -19],
        [47, -20],
        [57, -31],
        [53, -45],
        [39, -58],
        [13, -65],
      ],
    ],
    mills: [
      [-23, -19],
      [0, -30],
      [23, -22],
    ],
    discoveries: [
      { id: 'arch', name: '峡谷の石のアーチ', x: -28, z: -38, radius: 4 },
      { id: 'camp', name: '雲見の展望台', x: 34, z: -29, radius: 4 },
    ],
    stars: [
      [-13, -4],
      [-33, -13],
      [12, -13],
      [-28, -38],
      [34, -29],
      [31, -50],
      [-17, -54],
      [13, -65],
      [0, -72],
      [-49, -18],
      [-52, -38],
      [53, -45],
      [57, -31],
    ],
  },
  (x, z) => {
    const flat = Math.max(
      mound(x, z, 0, 10, 7, 15),
      mound(x, z, -20, -19, 9, 17),
      mound(x, z, 25, -44, 11, 18),
      mound(x, z, 0, -62, 12, 18),
    );
    const ravine = 3.5 * (1 - smooth(2, 9, Math.abs(z + 38))) * (1 - smooth(20, 35, Math.abs(x)));
    return (
      (2.2 + 1.6 * Math.sin(x * 0.09) * Math.cos(z * 0.085)) * (1 - flat) -
      ravine * (1 - flat) +
      4 * mound(x, z, 0, -78, 6, 16) +
      5.8 * mound(x, z, -49, -18, 7, 28) +
      4.8 * mound(x, z, 53, -45, 6, 27) +
      2.3 * mound(x, z, -47, -66, 8, 29)
    );
  },
);
