import { FIELD_STAGE } from './field-stage.js';
const tile = (x, z, top, w = 7, d = 5.5, extra = {}) => ({
  x,
  z,
  y: top - 0.6,
  w,
  h: 1.2,
  d,
  ...extra,
});
const crumble = { collapse: 2.1, color: 0xc0876e };
export const STAGES = [
  FIELD_STAGE,
  {
    id: 2,
    name: '風車と雲の峡谷',
    subtitle: '風車をぬけ、雲上の灯台を目指す。',
    theme: 'SKY WINDMILLS',
    color: 0xa8bec0,
    sky: 0xd6e5ef,
    hint: '直進は短い風の橋。左は遠回りの無風道。矢印が緑の凪に渡る方法もある。',
    zones: ['風車の丘', '雲の吊り橋', '空の灯台'],
    platforms: [
      tile(0, 0, 0, 12, 10),
      tile(0, -12, 0.2, 6, 12),
      tile(1, -23, 0.5, 10, 7),
      tile(3, -32, 0.9, 8, 7),
      tile(2, -41, 1.3, 12, 8),
      tile(0, -51, 1.7, 6, 10),
      tile(-2, -62, 2.1, 8, 8),
      tile(-3, -71, 2.5, 9, 7),
      tile(-1, -80, 2.9, 12, 8),
      tile(1, -90, 3.3, 6, 10),
      tile(2, -101, 3.7, 8, 8),
      tile(0, -112, 4.1, 14, 10),
    ],
    spawn: { x: 0, y: 1.8, z: 2 },
    goal: { x: 0, y: 4.1, z: -114 },
    checkpoints: [4, 8],
    winds: [
      { minZ: -18, maxZ: -6 },
      { minZ: -56, maxZ: -46 },
      { minZ: -95, maxZ: -85 },
    ],
    hazards: [
      { x: 0, y: 2.5, z: -51, travel: 1.6, speed: 1.2 },
      { x: 1, y: 4.1, z: -90, travel: 1.6, speed: 1 },
    ],
    sidePaths: [tile(11, -41, 2, 6, 6), tile(-11, -71, 3.2, 6, 6)],
  },
  {
    id: 3,
    name: '青の水庭と古代神殿',
    subtitle: '水庭を渡り、眠る門を開く。',
    theme: 'AZURE SANCTUARY',
    color: 0x80b7b3,
    sky: 0xcde7e7,
    hint: '水路と高い寄り道を選んで進もう。神殿の封印に近づいてACTION。',
    zones: ['水の庭', '沈んだ回廊', '封印の神殿'],
    platforms: [
      tile(0, 0, 0, 12, 10),
      tile(0, -12, -0.3, 10, 12),
      tile(2, -23, 0.1, 9, 7),
      tile(3, -32, 0.5, 8, 7),
      tile(1, -41, 0.9, 12, 8),
      tile(-1, -52, 0.6, 10, 12),
      tile(-3, -63, 1, 8, 7),
      tile(-2, -72, 1.4, 8, 7),
      tile(0, -81, 1.8, 12, 8),
      tile(2, -91, 2.2, 8, 9),
      tile(1, -101, 2.6, 8, 8),
      tile(0, -112, 3, 15, 11),
    ],
    spawn: { x: 0, y: 1.8, z: 2 },
    goal: { x: 0, y: 3, z: -115 },
    checkpoints: [4, 8],
    requiresAction: true,
    waters: [
      { minZ: -20, maxZ: -4, surface: 0.65, width: 12 },
      { minZ: -58, maxZ: -46, surface: 1.5, width: 12 },
    ],
    sidePaths: [tile(-9, -52, 2.1, 5, 10)],
    hazards: [{ x: 2, y: 3, z: -91, travel: 2.2, speed: 1.1 }],
  },
  {
    id: 4,
    name: '夕映えの崩壊都市',
    subtitle: '崩れる街路を越えて、鐘楼へ。',
    theme: 'FALLING CITADEL',
    color: 0xc69b83,
    sky: 0xefcfba,
    hint: 'ひび割れた床は踏むと崩れる。青い灯りの周りで休もう。赤くなる前に次の床へ。',
    zones: ['古都の入口', '崩れる空中街路', '夕映えの鐘楼'],
    platforms: [
      tile(0, 0, 0, 12, 10),
      tile(0, -9, 0.5, 8, 6, crumble),
      tile(1, -17, 1, 8, 6, crumble),
      tile(3, -25, 1.5, 8, 6, crumble),
      tile(1, -34, 2, 12, 9),
      tile(-1, -44, 2.5, 8, 7, crumble),
      tile(-3, -53, 3, 8, 7, crumble),
      tile(-2, -62, 3.5, 8, 7, crumble),
      tile(0, -72, 4, 12, 9),
      tile(2, -82, 4.5, 8, 7, crumble),
      tile(1, -91, 5, 8, 7, crumble),
      tile(0, -102, 5.5, 14, 12),
    ],
    spawn: { x: 0, y: 1.8, z: 2 },
    goal: { x: 0, y: 5.5, z: -105 },
    checkpoints: [4, 8],
    sidePaths: [tile(11, -34, 2.7, 6, 6), tile(-10, -72, 4.7, 6, 6)],
    hazards: [
      { x: 1, y: 2.8, z: -36.5, travel: 3, speed: 1.1 },
      { x: 0, y: 4.8, z: -74.5, travel: 3, speed: 1.3 },
    ],
  },
  {
    id: 5,
    name: '星の巨人と天空城',
    subtitle: '風、水、崩壊。すべてを越えて星の門へ。',
    theme: 'STARBOUND CASTLE',
    color: 0x9e9bc5,
    sky: 0xbac4e2,
    hint: '全ての仕掛けが集う天空城。かけらを探しながら、最上階の封印をACTIONで壊そう。',
    zones: ['雲海の門', '巨人の回廊', '星の玉座'],
    platforms: [
      tile(0, 0, 0, 12, 10),
      tile(0, -12, 0.3, 6, 12),
      tile(2, -23, 0.8, 9, 7),
      tile(3, -32, 1.3, 8, 7, crumble),
      tile(1, -41, 1.8, 12, 8),
      tile(-1, -52, 1.5, 10, 12),
      tile(-3, -63, 2, 8, 7),
      tile(-2, -72, 2.5, 8, 7, crumble),
      tile(0, -81, 3, 12, 8),
      tile(2, -91, 3.5, 7, 9),
      tile(1, -101, 4, 8, 8, crumble),
      tile(-1, -111, 4.5, 8, 8, crumble),
      tile(-2, -121, 5, 12, 9),
      tile(0, -132, 5.5, 8, 10),
      tile(1, -144, 6, 8, 10, crumble),
      tile(0, -157, 6.5, 16, 13),
    ],
    spawn: { x: 0, y: 1.8, z: 2 },
    goal: { x: 0, y: 6.5, z: -161 },
    checkpoints: [4, 8, 12],
    requiresAction: true,
    sealHP: 75,
    winds: [
      { minZ: -18, maxZ: -6 },
      { minZ: -96, maxZ: -86 },
    ],
    waters: [{ minZ: -58, maxZ: -46, surface: 2.4, width: 12 }],
    hazards: [
      { x: 2, y: 1.6, z: -23, travel: 2.5, speed: 1.2 },
      { x: 0, y: 3.8, z: -83.5, travel: 3, speed: 1.4 },
      { x: 0, y: 7.3, z: -157, travel: 3, speed: 1.4 },
    ],
    sidePaths: [tile(11, -41, 2.5, 6, 6), tile(-10, -81, 3.7, 6, 6)],
  },
];

// Choices reconnect forward rather than sending the player down a dead end.
STAGES[1].routes = [
  {
    name: '無風の外回廊',
    from: 0,
    to: 2,
    platforms: [
      tile(-6, 0, 0, 5, 8),
      tile(-8, -7, 0.2, 4, 7),
      tile(-8, -14, 0.4, 4, 7),
      tile(-6, -22, 0.5, 5, 7),
    ],
  },
];
STAGES[2].routes = [
  {
    name: '水上の細道',
    from: 0,
    to: 2,
    platforms: [
      tile(6.5, -2, 0.6, 4, 7),
      tile(6.5, -9, 1.2, 3.6, 6),
      tile(6.5, -16, 1.2, 3.6, 6),
      tile(5, -23, 0.5, 4, 7),
    ],
  },
];
STAGES[3].platforms[2].collapse = undefined;
STAGES[3].platforms[2].color = undefined;
STAGES[3].platforms[3].collapse = undefined;
STAGES[3].platforms[3].color = undefined;
STAGES[3].platforms[7].collapse = undefined;
STAGES[3].platforms[7].color = undefined;
STAGES[3].platforms.splice(11, 0, tile(0, -99, 5.25, 6, 6, crumble));
STAGES[3].platforms[12] = tile(0, -109, 5.5, 14, 10);
STAGES[3].goal.z = -112;
STAGES[4].routes = [
  {
    name: '星の細道',
    from: 12,
    to: 14,
    platforms: [tile(7, -121, 5.6, 4, 8), tile(9, -130, 6.1, 3.6, 8), tile(8, -139, 6.5, 4, 8)],
  },
];
const choices = [
  { x: 1, z: -32, text: '左は広い道 / 右は樹冠の細道と星' },
  { x: 0, z: 0, text: '直進：短い風の橋 / 左：長い無風道' },
  { x: 0, z: 0, text: '直進：広い水路 / 右：狭い水上の道' },
  { x: 0, z: 0, text: 'ひび割れのない床で休み、赤くなる床は止まらず渡ろう' },
  { x: -2, z: -120, text: '直進：崩壊床 / 右：狭い星の道' },
];
STAGES.forEach((stage, i) => {
  if (!stage.field) stage.signs = [choices[i]];
});
for (const stage of STAGES) {
  if (stage.field) continue;
  // The main route remains reachable by the slowest/heaviest legal body.
  // Side paths retain their larger gaps as optional jumping challenges.
  for (let i = 1; i < stage.platforms.length; i++) {
    const a = stage.platforms[i - 1],
      b = stage.platforms[i];
    const gap = a.z - b.z - (a.d + b.d) / 2;
    if (gap > 1.25) b.d += (gap - 1.25) * 2;
  }
  // Leave a landing apron before the gust and a takeoff apron after it.
  // Otherwise a gust can stop a jump over the gap before feet reach the bridge.
  for (const wind of stage.winds || []) {
    wind.minZ += 2;
    wind.maxZ -= 2;
  }
  for (const wind of stage.winds || []) {
    const bridge = stage.platforms.find((p) => p.z > wind.minZ - 2 && p.z < wind.maxZ);
    wind.x = bridge?.x || 0;
    wind.width = bridge?.w || 6;
    wind.maxY = (bridge?.y || 0) + 4;
  }
  for (const p of stage.platforms)
    if (p.collapse) p.collapse = Math.max(p.collapse, p.d / 4.3 + 0.6);
  stage.routeLength = stage.platforms.length;
  stage.platforms.push(...stage.sidePaths);
  for (const route of stage.routes || []) {
    route.indices = [];
    for (const p of route.platforms) {
      p.color = 0x9ec9b6;
      p.alternative = true;
      route.indices.push(stage.platforms.length);
      stage.platforms.push(p);
    }
  }
  stage.collectibles = stage.platforms
    .filter((p, i) => !p.alternative && (i % 3 === 1 || i >= stage.routeLength))
    .map((p, i) => ({ x: p.x + (i % 2 ? 1.2 : -1.2), y: p.y + p.h / 2 + 1.15, z: p.z }));
  for (const route of stage.routes || [])
    for (const p of route.platforms.slice(1))
      stage.collectibles.push({ x: p.x, y: p.y + p.h / 2 + 1.35, z: p.z });
}
export function getStage(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}
