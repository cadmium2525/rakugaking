import { finishExpedition, smooth, mound } from './expedition-terrain.js';
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
      [-9, -7, 4],
      [11, -11, 5],
      [10, -39, 4],
    ],
    solids: [
      ...[
        [-37, -10, 5],
        [-38, -27, 7],
        [-37, -45, 5],
        [37, -12, 6],
        [37, -29, 7],
        [36, -47, 5],
        [-9, -7, 4],
        [11, -11, 5],
        [10, -39, 4],
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
    ],
    discoveries: [
      { id: 'alley', name: '夕焼けの小路', x: -35, z: -42, radius: 3 },
      { id: 'bridge', name: '崩れかけた近道', x: 0, z: -38, radius: 4 },
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
    ],
  },
  (x, z) => {
    const rim =
      10 * Math.max(smooth(40, 48, Math.abs(x)), smooth(16, 24, z), 1 - smooth(-88, -80, z));
    const flat = Math.max(
      mound(x, z, 0, 10, 8, 16),
      mound(x, z, -26, -23, 14, 22),
      mound(x, z, 24, -33, 14, 22),
      mound(x, z, -9, -59, 12, 18),
      mound(x, z, 0, -47, 5, 12),
    );
    return (
      rim +
      1.5 * (1 - flat) -
      2 * (1 - smooth(2, 7, Math.abs(z + 38))) * (1 - smooth(7, 12, Math.abs(x))) +
      3 * mound(x, z, 0, -78, 6, 17)
    );
  },
);
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
