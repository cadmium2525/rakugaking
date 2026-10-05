const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Telegraph and damage use this same description. A warning never promises a
// smaller safe region than the attack that follows it.
export function bossPattern(id, time, aim = 0, boss = {}) {
  const kind = id === 2 ? 'fan' : id === 3 ? 'wave' : id === 4 ? 'cross' : 'double';
  const cycle = kind === 'fan' ? 6.7 : kind === 'wave' ? 7.2 : kind === 'cross' ? 7 : 9.5;
  const t = time % cycle;
  const start = kind === 'fan' ? 2.7 : kind === 'wave' ? 2.9 : kind === 'cross' ? 3 : 2.8;
  const end = kind === 'fan' ? 3.25 : kind === 'wave' ? 4 : kind === 'cross' ? 3.65 : 3.1;
  const phase =
    kind === 'double'
      ? t < 1.6
        ? 'guard'
        : t < 2.8
          ? 'windup'
          : t < 3.1
            ? 'slam'
            : t < 3.6
              ? 'guard'
              : t < 4.8
                ? 'windup'
                : t < 5.1
                  ? 'slam'
                  : 'rest'
      : t < start - 1.2
        ? 'guard'
        : t < start
          ? 'windup'
          : t < end
            ? 'slam'
            : 'rest';
  return {
    kind,
    phase,
    aim,
    cycle,
    radius: kind === 'fan' ? 8 : kind === 'wave' ? 9.4 : boss.radius || 7,
    wave: phase === 'slam' && kind === 'wave' ? (t - start) * 8.5 : 0,
    sweep:
      aim + (kind === 'fan' && phase === 'slam' ? -0.9 + ((t - start) / (end - start)) * 1.8 : 0),
    // Clock hands rotate a quarter turn between beats; diagonal pockets are safe.
    rotation: Math.floor(time / cycle) % 2 ? Math.PI / 4 : 0,
    progress: Math.max(0, Math.min(1, (t - start) / (end - start))),
  };
}

export function bossAttackHits(pattern, boss, player) {
  if (pattern.phase !== 'slam' || player.y >= boss.y + 1.6) return false;
  const x = player.x - boss.x,
    z = player.z - boss.z,
    distance = Math.hypot(x, z);
  if (distance >= pattern.radius) return false;
  if (pattern.kind === 'fan') return Math.abs(delta(Math.atan2(x, z), pattern.sweep)) < 0.31;
  if (pattern.kind === 'wave') return Math.abs(distance - pattern.wave) < 0.75;
  if (pattern.kind === 'cross') {
    const c = Math.cos(pattern.rotation),
      s = Math.sin(pattern.rotation);
    return Math.abs(x * c - z * s) < 1.05 || Math.abs(x * s + z * c) < 1.05;
  }
  return true;
}

export function bossAdvice(kind) {
  return kind === 'fan'
    ? '赤い扇の横へ！ 向きは構えた時に固定'
    : kind === 'wave'
      ? '広がる水の輪をジャンプで飛び越えよう'
      : kind === 'cross'
        ? '赤い時計の針の間へ！ ジャンプでも回避'
        : '二連続の衝撃波の後、緑に光るまで待とう';
}
