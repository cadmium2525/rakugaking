import { clamp } from './shape.js';
export function levelFromExp(exp) {
  return clamp(
    1 +
      Math.floor((Math.sqrt(1 + (8 * Math.max(0, Number.isFinite(exp) ? exp : 0)) / 100) - 1) / 2),
    1,
    20,
  );
}
export function newPlayer() {
  return { exp: 0, cleared: [], unlocked: 1 };
}
export function awardClear(player, stage) {
  const first = !player.cleared.includes(stage);
  const gained = first ? 120 + stage * 40 : 40;
  player.exp = Math.min(200000, player.exp + gained);
  if (first) player.cleared.push(stage);
  player.unlocked = Math.min(5, Math.max(player.unlocked, stage + 1));
  return gained;
}
export function levelStats(base, level) {
  const bonus = clamp(Math.floor(level) - 1, 0, 19);
  return {
    ...base,
    hp: base.hp + bonus * 2,
    power: base.power + bonus * 0.5,
    defense: base.defense + bonus * 0.3,
    speed: base.speed + bonus * 0.015,
    jump: base.jump + bonus * 0.01,
  };
}
