export function cameraMovement(input, yaw = 0) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return { ...input, x: input.x * c + input.z * s, z: -input.x * s + input.z * c };
}

// Clip the follow camera against the same solid boxes as the character. Hull
// bounds are conservative; the camera never needs to enter a roof ornament.
export function cameraClearance(focus, desired, stage) {
  const d = { x: desired.x - focus.x, y: desired.y - focus.y, z: desired.z - focus.z },
    distance = Math.hypot(d.x, d.y, d.z),
    separation = 0.01 / Math.max(0.01, distance);
  if (distance < 0.000001) return { ...desired };
  const intersection = (p, margin) => {
    let near = -Infinity,
      far = Infinity;
    for (const [axis, size] of [
      ['x', 'w'],
      ['y', 'h'],
      ['z', 'd'],
    ]) {
      const min = p[axis] - p[size] / 2 - margin,
        max = p[axis] + p[size] / 2 + margin;
      if (Math.abs(d[axis]) < 0.000000001) {
        if (focus[axis] < min || focus[axis] > max) return null;
      } else {
        const a = (min - focus[axis]) / d[axis],
          b = (max - focus[axis]) / d[axis];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    return near <= far && far >= 0 ? { near, far } : null;
  };
  let limit = 1;
  for (const p of stage?.platforms || []) {
    if (p.terrain || p.gate || p.cameraBlock === false || !p.w || !p.h || !p.d) continue;
    const hit = intersection(p, 0.3);
    if (!hit || hit.near > 1) continue;
    const solid = intersection(p, 0),
      lensInMargin =
        Math.abs(desired.x - p.x) <= p.w / 2 + 0.3 &&
        Math.abs(desired.y - p.y) <= p.h / 2 + 0.3 &&
        Math.abs(desired.z - p.z) <= p.d / 2 + 0.3;
    // Padding protects the lens. A ray that merely grazes an ornament's margin
    // can reach a clear lens position above it without passing through the solid.
    if (!solid && !lensInMargin) continue;
    if (hit.near <= 0) {
      // A focus in the safety margin must still be able to move away from the
      // wall. Moving toward its solid face instead retreats behind the margin;
      // imposing a minimum follow distance here would put the lens in the wall.
      if (!solid || (solid.near < 0 && solid.far < 1)) continue;
    }
    limit = Math.min(limit, hit.near - separation);
  }
  if (stage?.height && limit > 0) {
    const clearance = (t) => {
      const x = focus.x + d.x * t,
        z = focus.z + d.z * t,
        y = focus.y + d.y * t;
      return y - stage.height(x, z) - 0.3;
    };
    const samples = Math.max(1, Math.ceil((distance * limit) / 0.4));
    let previous = 0,
      outside = clearance(0) >= 0;
    for (let i = 1; i <= samples; i++) {
      const t = (i / samples) * limit;
      if (clearance(t) >= 0) outside = true;
      else if (outside) {
        let low = previous,
          high = t;
        for (let n = 0; n < 10; n++) {
          const middle = (low + high) / 2;
          if (clearance(middle) >= 0) low = middle;
          else high = middle;
        }
        limit = Math.max(0, low - separation);
        break;
      }
      previous = t;
    }
  }
  return { x: focus.x + d.x * limit, y: focus.y + d.y * limit, z: focus.z + d.z * limit };
}

// A close wall must not turn the hero into a huge overhead silhouette. Search
// nearby bearings for a clear side view and retain the previous side at corners.
export function cameraFollow(
  player,
  desired,
  stage,
  { previous = desired, blend = 1, yaw = 0, lookAhead = 8 } = {},
) {
  const focus = { x: player.x, y: player.y + 0.7, z: player.z },
    followDistance = Math.hypot(desired.x - player.x, desired.z - player.z),
    maxSlope = Math.max(1.25, ((desired.y - player.y) / Math.max(1, followDistance)) * 1.15),
    horizontal = (p) => Math.hypot(p.x - player.x, p.z - player.z),
    distance = (p) => Math.hypot(p.x - player.x, p.y - player.y, p.z - player.z),
    readable = (p) =>
      horizontal(p) >= 4 && distance(p) >= 6 && p.y - player.y < horizontal(p) * maxSlope,
    angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
    score = (p) => {
      const bearing = Math.atan2(p.x - player.x, p.z - player.z),
        travel = Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z);
      return (
        angularDistance(bearing, yaw) * 2 +
        travel / Math.max(1, followDistance) +
        Math.max(0, 1 - horizontal(p) / Math.max(1, followDistance)) * 1.5
      );
    },
    manual = cameraClearance(focus, desired, stage);
  let target = manual,
    fallback =
      Math.hypot(manual.x - desired.x, manual.y - desired.y, manual.z - desired.z) > 0.00001 &&
      !readable(manual),
    limited = false;
  if (fallback) {
    const candidates = [manual],
      turns = [
        Math.PI / 4,
        -Math.PI / 4,
        Math.PI / 2,
        -Math.PI / 2,
        (Math.PI * 3) / 4,
        (-Math.PI * 3) / 4,
        Math.PI,
      ],
      fineTurns = [1, -1, 3, -3, 5, -5, 7, -7].map((n) => (n * Math.PI) / 8),
      addCandidates = (angles, height) => {
        for (const turn of angles)
          candidates.push(
            cameraClearance(
              focus,
              {
                x: player.x + Math.sin(yaw + turn) * followDistance,
                y: height,
                z: player.z + Math.cos(yaw + turn) * followDistance,
              },
              stage,
            ),
          );
      };
    addCandidates(turns, desired.y);
    let clear = candidates.filter(readable);
    // A stall awning beside a house can leave a narrow diagonal escape that
    // lies between the ordinary bearings. Expand only after those all fail.
    if (!clear.length) {
      addCandidates(fineTurns, desired.y);
      clear = candidates.filter(readable);
    }
    // Under a low ceiling, a distant eye-level lens can leave horizontally
    // while every high follow ray meets the roof before reaching its edge.
    if (!clear.length) {
      addCandidates([0, ...turns, ...fineTurns], player.y + 0.8);
      clear = candidates.filter(readable);
    }
    limited = !clear.length;
    target = (clear.length ? clear : candidates).sort((a, b) =>
      limited ? horizontal(b) + distance(b) - horizontal(a) - distance(a) : score(a) - score(b),
    )[0];
  }
  const interpolated = {
    x: previous.x + (target.x - previous.x) * blend,
    y: previous.y + (target.y - previous.y) * blend,
    z: previous.z + (target.z - previous.z) * blend,
  };
  let position = cameraClearance(focus, interpolated, stage);
  // The smooth orbit chord may cross the blocking building. Take the safe side
  // immediately rather than briefly placing the lens inside the hero's head.
  if (
    !limited &&
    Math.hypot(
      position.x - interpolated.x,
      position.y - interpolated.y,
      position.z - interpolated.z,
    ) > 0.00001
  )
    position = target;
  else if (!readable(position) && readable(target)) position = target;
  const framing = Math.min(1, horizontal(position) / Math.max(0.01, followDistance)),
    look = fallback
      ? { x: player.x, y: player.y + 0.2, z: player.z }
      : {
          x: player.x - Math.sin(yaw) * lookAhead * framing,
          y: player.y + 0.2 + 1.3 * framing,
          z: player.z - Math.cos(yaw) * lookAhead * framing,
        };
  return {
    target,
    position,
    look,
    heading: Math.atan2(position.x - look.x, position.z - look.z),
    fallback,
    limited,
  };
}
