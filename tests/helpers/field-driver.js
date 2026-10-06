import { FIELD_STAGE } from '../../src/game/field-stage.js';

// Route through the actual field's solid buildings. This is test navigation,
// not a game-state shortcut: the pilot still sends ordinary movement keys.
const obstacleCache = new WeakMap();
const navigation = new WeakMap();
const routeProgress = new WeakMap();
function detour(position, target, stage) {
  if (!obstacleCache.has(stage)) {
    const candidates = stage.platforms.filter(
      (b) =>
        !b.terrain &&
        !b.boundary &&
        !b.gate &&
        b.visible === false &&
        b.h > 0 &&
        b.y - b.h / 2 < stage.height(b.x, b.z) + 2.8,
    );
    obstacleCache.set(
      stage,
      candidates.filter(
        (b, i) =>
          !candidates.some(
            (a, j) =>
              j !== i &&
              Math.abs(b.x - a.x) + b.w / 2 <= a.w / 2 &&
              Math.abs(b.z - a.z) + b.d / 2 <= a.d / 2 &&
              (a.w > b.w || a.d > b.d || j < i),
          ),
      ),
    );
  }
  const boxes = obstacleCache.get(stage);
  const inside = (p, b, pad = 0) =>
    Math.abs(p.x - b.x) < b.w / 2 + pad && Math.abs(p.z - b.z) < b.d / 2 + pad;
  // Interaction points can be inside a small pedestal; walking toward it
  // turns the hero toward ACTION while the real collider supplies the stop.
  if (boxes.some((b) => inside(target, b))) return target;
  const containing = boxes.find((b) => inside(position, b, 0.85));
  if (containing) {
    navigation.delete(stage);
    const b = containing,
      exits = [];
    if (position.x >= b.x + b.w / 2) exits.push({ x: b.x + b.w / 2 + 1.5, z: position.z });
    if (position.x <= b.x - b.w / 2) exits.push({ x: b.x - b.w / 2 - 1.5, z: position.z });
    if (position.z >= b.z + b.d / 2) exits.push({ x: position.x, z: b.z + b.d / 2 + 1.5 });
    if (position.z <= b.z - b.d / 2) exits.push({ x: position.x, z: b.z - b.d / 2 - 1.5 });
    if (!exits.length)
      for (const [axis, size] of [
        ['x', 'w'],
        ['z', 'd'],
      ])
        for (const sign of [-1, 1])
          exits.push({ ...position, [axis]: b[axis] + sign * (b[size] / 2 + 1.5) });
    return exits.sort(
      (a, b) =>
        Math.hypot(a.x - position.x, a.z - position.z) -
        Math.hypot(b.x - position.x, b.z - position.z),
    )[0];
  }
  const intersection = (a, b, box, pad = 0.85) => {
    let lo = 0,
      hi = 1;
    for (const [key, size] of [
      ['x', 'w'],
      ['z', 'd'],
    ]) {
      const d = b[key] - a[key],
        min = box[key] - box[size] / 2 - pad,
        max = box[key] + box[size] / 2 + pad;
      if (Math.abs(d) < 1e-8) {
        if (a[key] <= min || a[key] >= max) return null;
      } else {
        const t1 = (min - a[key]) / d,
          t2 = (max - a[key]) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    return lo < hi && hi > 0.002 && lo < 0.998 ? lo : null;
  };
  const clear = (a, b) => !boxes.some((box) => intersection(a, b, box) !== null);
  if (clear(position, target)) return target;
  const key = `${target.x},${target.z}`;
  let route = navigation.get(stage);
  if (!route || route.key !== key) {
    const points = [position, target];
    for (const b of boxes)
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          points.push({ x: b.x + x * (b.w / 2 + 1.5), z: b.z + z * (b.d / 2 + 1.5) });
    const distance = points.map(() => Infinity),
      previous = points.map(() => -1),
      visited = new Set();
    distance[0] = 0;
    for (let step = 0; step < points.length; step++) {
      let index = -1;
      for (let i = 0; i < points.length; i++)
        if (!visited.has(i) && (index < 0 || distance[i] < distance[index])) index = i;
      if (index < 0 || !Number.isFinite(distance[index]) || index === 1) break;
      visited.add(index);
      for (let i = 0; i < points.length; i++)
        if (!visited.has(i) && clear(points[index], points[i])) {
          const next =
            distance[index] +
            Math.hypot(points[index].x - points[i].x, points[index].z - points[i].z);
          if (next < distance[i]) {
            distance[i] = next;
            previous[i] = index;
          }
        }
    }
    const path = [];
    for (let i = 1; i > 0 && previous[i] >= 0; i = previous[i]) path.unshift(points[i]);
    route = { key, path };
    navigation.set(stage, route);
  }
  while (
    route.path.length > 1 &&
    Math.hypot(position.x - route.path[0].x, position.z - route.path[0].z) < 0.65
  )
    route.path.shift();
  return route.path[0] || target;
}
function alongRoute(p, points, stage, key) {
  if (!routeProgress.has(stage)) routeProgress.set(stage, new Map());
  const progress = routeProgress.get(stage);
  if (progress.has(key)) {
    let next = progress.get(key);
    while (
      next < points.length - 1 &&
      Math.hypot(p.x - points[next][0], p.z - points[next][1]) < 0.65
    )
      next++;
    progress.set(key, next);
    return { x: points[next][0], z: points[next][1] };
  }
  let best = Infinity,
    next = 1;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1],
      [bx, bz] = points[i],
      dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz || 1))),
      distance = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
    if (distance < best) {
      best = distance;
      next = t > 0.94 && i < points.length - 1 ? i + 1 : i;
    }
  }
  progress.set(key, next);
  return { x: points[next][0], z: points[next][1] };
}

// Test pilot issues movement, jump and ACTION only; never mutates game state.
export function fieldControls(
  state,
  frame,
  order = ['orchard', 'ruins', 'boss'],
  stage = FIELD_STAGE,
) {
  const f = state.field,
    p = state.position;
  let target,
    jump = false;
  const mission = order.find((id) => !f.rewards.includes(id));
  if (stage.expedition) {
    if (frame === 0) {
      navigation.delete(stage);
      routeProgress.delete(stage);
    }
    const complete = (m) =>
      m.type === 'boss'
        ? f.bossHP <= 0
        : m.type === 'escort'
          ? f.escorts[m.id].arrived
          : m.type === 'defense'
            ? f.defenses[m.id].complete
            : m.type === 'combat'
              ? f.enemies.every((e, i) => stage.enemies[i].mission !== m.id || e.hp <= 0)
              : stage.runes.every((r, i) => r.mission !== m.id || f.runes.includes(i));
    let m = stage.missions.find((m) => m.id === mission);
    while (m?.requires?.some((id) => !complete(stage.missions.find((n) => n.id === id))))
      m = stage.missions.find(
        (n) => n.id === m.requires.find((id) => !complete(stage.missions.find((r) => r.id === id))),
      );
    const boss = stage.boss;
    if (!m) target = stage.goal;
    else if (complete(m)) target = m.reward;
    else if (m.type === 'escort') {
      const e = f.escorts[m.id];
      if (!e.started)
        target = m.route
          ? alongRoute(p, [...m.route].reverse().concat(m.nodes), stage, `${m.id}:approach`)
          : e;
      else if (e.waiting) target = e;
      else if (Math.hypot(e.x - p.x, e.z - p.z) > 7) target = p;
      else {
        const points = [...m.nodes, ...(m.route || []), [m.destination.x, m.destination.z]];
        target = alongRoute(p, points, stage, `${m.id}:follow`);
      }
    } else if (m.type === 'defense') {
      const d = f.defenses[m.id];
      target = !d.started
        ? { x: m.x, z: m.z }
        : f.enemies.find((e, i) => stage.enemies[i].mission === m.id && e.active && e.hp > 0) || {
            x: m.x + 1.5,
            z: m.z,
          };
    } else if (m.type === 'combat')
      target = f.enemies.find((e, i) => stage.enemies[i].mission === m.id && e.hp > 0) || m.reward;
    else if (m.type === 'boss')
      target =
        f.bossHP <= 0
          ? m.reward
          : {
              x:
                boss.x +
                (f.bossPhase === 'rest'
                  ? 2.8
                  : Math.max(boss.radius || 6, f.bossAttack?.radius || 0) + 1.5),
              z: boss.z,
            };
    else
      target = stage.runes.find((r, i) => r.mission === m.id && !f.runes.includes(i)) || m.reward;
    target = detour(p, target, stage);
    const dx = target.x - p.x,
      dz = target.z - p.z,
      d = Math.hypot(dx, dz),
      scale = Math.max(1, d),
      stopDistance = target.hp > 0 ? 1.8 : 0.35;
    return {
      x: d < stopDistance ? 0 : dx / scale,
      z: d < stopDistance ? 0 : dz / scale,
      jump:
        state.grounded &&
        stage.platforms.some(
          (t) =>
            t.visible !== false &&
            !t.terrain &&
            Math.abs(p.x - t.x) < t.w / 2 + 1.2 &&
            Math.abs(p.z - t.z) < t.d / 2 + 1.2 &&
            t.y + t.h / 2 > p.y - 0.8 + 0.26,
        ),
      action:
        frame % 48 === 0 &&
        !(m?.type === 'escort' && f.escorts[m.id].started) &&
        !(
          m?.type === 'defense' &&
          f.defenses[m.id].started &&
          !f.enemies.some((e, i) => stage.enemies[i].mission === m.id && e.active && e.hp > 0)
        ),
    };
  }
  if (mission === 'orchard') {
    target = f.enemies.find((e) => e.hp > 0) || FIELD_STAGE.missions[0].reward;
  } else if (mission === 'ruins') {
    target =
      FIELD_STAGE.runes.find((r, i) => !f.runes.includes(i)) || FIELD_STAGE.missions[1].reward;
    jump = state.grounded;
  } else if (mission === 'boss') {
    const boss = FIELD_STAGE.boss;
    target =
      f.bossHP <= 0
        ? FIELD_STAGE.missions[2].reward
        : { x: boss.x + (f.bossPhase === 'rest' ? 2.8 : 8), z: boss.z };
  } else target = FIELD_STAGE.goal;
  const dx = target.x - p.x,
    dz = target.z - p.z;
  const distance = Math.hypot(dx, dz),
    scale = Math.max(1, distance),
    // Fight within reach rather than walking through the enemy's centre and
    // stopping with the previous facing pointing away from the next strike.
    stopDistance = target.hp > 0 ? 1.8 : 0.35;
  return {
    x: distance < stopDistance ? 0 : dx / scale,
    z: distance < stopDistance ? 0 : dz / scale,
    jump,
    action: frame % 48 === 0,
  };
}
export function driveField(course, maxFrames = 24000, order) {
  for (let frame = 0; frame < maxFrames && !course.complete; frame++) {
    course.step(
      fieldControls(
        {
          field: course.field.snapshot(),
          position: course.sim.position,
          grounded: course.sim.grounded,
        },
        frame,
        order || course.stage.missions.map((m) => m.id),
        course.stage,
      ),
    );
  }
  return { time: course.elapsed, deaths: course.sim.deaths };
}
