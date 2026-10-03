export const SKETCH_LIMIT = 96;
export const ROLES = {
  body: 'そのまま',
  head: 'あたま',
  leg: 'あし',
  wing: 'つばさ',
  tail: 'しっぽ',
  detail: 'もよう',
};
export const INKS = [
  '#ed8063',
  '#e55353',
  '#f2a65a',
  '#ebc85b',
  '#fff1b8',
  '#ffffff',
  '#83b782',
  '#397e66',
  '#58bfc2',
  '#659dcc',
  '#4169b1',
  '#a68dc9',
  '#df8bb8',
  '#885638',
  '#c7a481',
  '#344d48',
  '#171e29',
  '#a9b5b1',
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const validInk = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
export function sketchBounds(points) {
  if (!points.length) return { minX: 0.5, maxX: 0.5, minY: 0.5, maxY: 0.5 };
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function sanitizeSketch(raw) {
  const strokes = (Array.isArray(raw?.strokes) ? raw.strokes : [])
    .slice(0, SKETCH_LIMIT)
    .flatMap((s) => {
      let points = (Array.isArray(s?.points) ? s.points : [])
        .slice(0, 2048)
        .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => ({
          x: Math.round(clamp(p.x, 0, 1) * 10000) / 10000,
          y: Math.round(clamp(p.y, 0, 1) * 10000) / 10000,
        }));
      points = points.filter(
        (p, i) => !i || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 0.001,
      );
      if (!points.length) return [];
      const rawHoles = s.closed && Array.isArray(s.holes) ? s.holes.slice(0, 8) : [];
      const holes = rawHoles.flatMap((loop) => {
        if (!Array.isArray(loop)) return [];
        let p = loop
          .slice(0, 2048)
          .filter((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y))
          .map((q) => ({
            x: Math.round(clamp(q.x, 0, 1) * 10000) / 10000,
            y: Math.round(clamp(q.y, 0, 1) * 10000) / 10000,
          }));
        const limit = Math.min(32, Math.floor(64 / Math.max(1, rawHoles.length)));
        if (p.length > limit) {
          const source = p;
          p = Array.from(
            { length: limit },
            (_, i) => source[Math.floor((i * source.length) / limit)],
          );
        }
        return p.length >= 3 ? [p] : [];
      });
      const limit = 128 - holes.reduce((n, p) => n + p.length, 0);
      if (points.length > limit) {
        const source = points;
        points = Array.from(
          { length: limit },
          (_, i) => source[Math.round((i * (source.length - 1)) / (limit - 1))],
        );
      }
      return [
        {
          points,
          color: validInk(s.color) ? s.color.toLowerCase() : '#ed8063',
          width: clamp(Number.isFinite(s.width) ? s.width : 0.018, 0.004, 0.16),
          depth: clamp(Number.isFinite(s.depth) ? s.depth : 0.18, 0.03, 0.5),
          closed: s.closed === true,
          role: Object.hasOwn(ROLES, s.role) ? s.role : 'body',
          ...(holes.length ? { holes } : {}),
        },
      ];
    });
  return { kind: 'sketch', version: 1, strokes };
}
export function validSketch(raw) {
  return (
    raw?.kind === 'sketch' &&
    raw.version === 1 &&
    Array.isArray(raw.strokes) &&
    raw.strokes.length > 0 &&
    raw.strokes.length <= SKETCH_LIMIT &&
    raw.strokes.every(
      (s) =>
        s &&
        validInk(s.color) &&
        Object.hasOwn(ROLES, s.role) &&
        typeof s.closed === 'boolean' &&
        Number.isFinite(s.width) &&
        s.width >= 0.004 &&
        s.width <= 0.16 &&
        Number.isFinite(s.depth) &&
        s.depth >= 0.03 &&
        s.depth <= 0.5 &&
        Array.isArray(s.points) &&
        s.points.length > 0 &&
        s.points.length <= 128 &&
        (s.holes === undefined ||
          (s.closed &&
            Array.isArray(s.holes) &&
            s.holes.length <= 8 &&
            s.holes.every(
              (p) =>
                Array.isArray(p) &&
                p.length >= 3 &&
                p.length <= 32 &&
                p.every(
                  (q) =>
                    q &&
                    Number.isFinite(q.x) &&
                    Number.isFinite(q.y) &&
                    q.x >= 0 &&
                    q.x <= 1 &&
                    q.y >= 0 &&
                    q.y <= 1,
                ),
            ) &&
            s.points.length + s.holes.reduce((n, p) => n + p.length, 0) <= 128)) &&
        s.points.every(
          (p) =>
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 0 &&
            p.x <= 1 &&
            p.y >= 0 &&
            p.y <= 1,
        ),
    )
  );
}
export function inkArea(s) {
  if (s.closed && s.points.length >= 3) {
    let area = 0;
    s.points.forEach((p, i) => {
      const q = s.points[(i + 1) % s.points.length];
      area += p.x * q.y - q.x * p.y;
    });
    const holes = (s.holes || []).reduce((n, p) => n + inkArea({ points: p, closed: true }), 0);
    return Math.max(0, Math.abs(area) / 2 - holes);
  }
  let length = 0;
  s.points.forEach((p, i) => {
    if (i) length += Math.hypot(p.x - s.points[i - 1].x, p.y - s.points[i - 1].y);
  });
  return length * s.width + Math.PI * (s.width / 2) ** 2;
}
export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function hitStroke(s, p, radius = 0.015) {
  if (s.points.some((v, i) => distanceToSegment(p, v, s.points[i + 1] || v) < radius + s.width / 2))
    return true;
  if (!s.closed) return false;
  return insideLoop(s.points, p) && !(s.holes || []).some((loop) => insideLoop(loop, p));
}
function insideLoop(points, p) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function eraseSketch(drawing, p, radius = 0.035) {
  const erased = drawing.strokes.flatMap((s) => {
    if (!hitStroke(s, p, radius)) return [s];
    if (s.closed) return [];
    const samples = [];
    s.points.forEach((b, i) => {
      if (!i) {
        samples.push(b);
        return;
      }
      const a = s.points[i - 1],
        n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.008);
      for (let j = 1; j <= n; j++)
        samples.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
    });
    const pieces = [];
    let current = [];
    for (const v of samples) {
      if (Math.hypot(v.x - p.x, v.y - p.y) < radius + s.width / 2) {
        if (current.length) pieces.push({ ...s, points: current });
        current = [];
      } else current.push(v);
    }
    if (current.length) pieces.push({ ...s, points: current });
    return pieces;
  });
  if (erased.length > SKETCH_LIMIT) return false;
  drawing.strokes = erased;
  return true;
}

export function sketchTemplate(kind) {
  const strokes = [];
  const line = (points, color, width, role = 'body') =>
    strokes.push({
      points: points.map(([x, y]) => ({ x, y })),
      color,
      width,
      depth: 0.2,
      closed: false,
      role,
    });
  const shape = (points, color, role = 'body', depth = 0.22) =>
    strokes.push({
      points: points.map(([x, y]) => ({ x, y })),
      color,
      width: 0.012,
      depth,
      closed: true,
      role,
    });
  const oval = (x, y, rx, ry, color, role = 'body', depth = 0.22) =>
    shape(
      Array.from({ length: 28 }, (_, i) => [
        x + Math.cos((i / 28) * Math.PI * 2) * rx,
        y + Math.sin((i / 28) * Math.PI * 2) * ry,
      ]),
      color,
      role,
      depth,
    );
  if (kind === 'blank') return { kind: 'sketch', version: 1, strokes };
  if (kind === 'human') {
    line(
      [
        [0.42, 0.61],
        [0.4, 0.85],
      ],
      '#659dcc',
      0.08,
      'leg',
    );
    line(
      [
        [0.57, 0.61],
        [0.6, 0.85],
      ],
      '#659dcc',
      0.08,
      'leg',
    );
    line(
      [
        [0.36, 0.43],
        [0.23, 0.61],
      ],
      '#ed8063',
      0.065,
    );
    line(
      [
        [0.63, 0.43],
        [0.77, 0.54],
      ],
      '#ed8063',
      0.065,
    );
    oval(0.5, 0.49, 0.15, 0.18, '#83b782');
    oval(0.5, 0.25, 0.13, 0.13, '#ed8063', 'head');
    oval(0.45, 0.23, 0.015, 0.02, '#171e29', 'detail');
    oval(0.55, 0.23, 0.015, 0.02, '#171e29', 'detail');
    line(
      [
        [0.46, 0.3],
        [0.5, 0.32],
        [0.54, 0.3],
      ],
      '#885638',
      0.012,
      'detail',
    );
  } else if (kind === 'dog') {
    for (const x of [0.32, 0.4, 0.6, 0.68])
      line(
        [
          [x, 0.55],
          [x - 0.02, 0.8],
        ],
        x === 0.32 || x === 0.6 ? '#885638' : '#c7a481',
        0.065,
        'leg',
      );
    line(
      [
        [0.28, 0.47],
        [0.17, 0.38],
        [0.12, 0.27],
      ],
      '#885638',
      0.065,
      'tail',
    );
    oval(0.48, 0.5, 0.25, 0.14, '#c7a481', 'body', 0.36);
    oval(0.72, 0.35, 0.12, 0.13, '#c7a481', 'head', 0.32);
    shape(
      [
        [0.63, 0.27],
        [0.65, 0.5],
        [0.74, 0.4],
      ],
      '#885638',
      'head',
    );
    oval(0.82, 0.38, 0.09, 0.055, '#e3c69e', 'head');
    oval(0.89, 0.36, 0.025, 0.03, '#171e29', 'detail');
    oval(0.76, 0.31, 0.018, 0.022, '#171e29', 'detail');
    line(
      [
        [0.75, 0.44],
        [0.82, 0.46],
      ],
      '#885638',
      0.012,
      'detail',
    );
  } else {
    shape(
      [
        [0.47, 0.4],
        [0.22, 0.1],
        [0.16, 0.4],
        [0.29, 0.34],
        [0.34, 0.52],
      ],
      '#a68dc9',
      'wing',
      0.07,
    );
    shape(
      [
        [0.51, 0.41],
        [0.62, 0.12],
        [0.76, 0.29],
        [0.62, 0.27],
        [0.6, 0.48],
      ],
      '#659dcc',
      'wing',
      0.07,
    );
    line(
      [
        [0.35, 0.6],
        [0.16, 0.68],
        [0.09, 0.55],
      ],
      '#397e66',
      0.08,
      'tail',
    );
    line(
      [
        [0.4, 0.64],
        [0.33, 0.83],
        [0.43, 0.83],
      ],
      '#397e66',
      0.08,
      'leg',
    );
    line(
      [
        [0.57, 0.63],
        [0.63, 0.82],
        [0.73, 0.82],
      ],
      '#83b782',
      0.08,
      'leg',
    );
    oval(0.48, 0.56, 0.18, 0.16, '#83b782', 'body', 0.38);
    line(
      [
        [0.59, 0.51],
        [0.68, 0.35],
      ],
      '#83b782',
      0.14,
      'head',
    );
    oval(0.71, 0.3, 0.12, 0.085, '#83b782', 'head');
    shape(
      [
        [0.63, 0.24],
        [0.66, 0.12],
        [0.72, 0.25],
      ],
      '#ebc85b',
      'head',
    );
    oval(0.78, 0.33, 0.09, 0.05, '#83b782', 'head');
    oval(0.73, 0.27, 0.016, 0.021, '#171e29', 'detail');
    line(
      [
        [0.81, 0.36],
        [0.88, 0.37],
      ],
      '#344d48',
      0.012,
      'detail',
    );
    oval(0.5, 0.57, 0.09, 0.1, '#fff1b8', 'detail', 0.04);
  }
  return sanitizeSketch({ strokes });
}

// Bring old six-part drawings onto one shared canvas without overwriting their save.
export function legacyToSketch(raw) {
  if (raw?.kind === 'sketch') return sanitizeSketch(raw);
  const sizes = {},
    bounds = {};
  for (const p of ['body', 'head', 'armLeft', 'armRight', 'legLeft', 'legRight']) {
    const b = sketchBounds((raw[p] || []).flatMap((s) => s.points));
    bounds[p] = b;
    const limb = p.includes('arm') || p.includes('leg');
    sizes[p] = {
      w: clamp((b.maxX - b.minX) * (limb ? 0.65 : 1.25), limb ? 0.12 : 0.3, limb ? 0.5 : 0.95),
      h: clamp((b.maxY - b.minY) * (limb ? 0.8 : 1), limb ? 0.25 : 0.3, limb ? 0.7 : 0.85),
    };
  }
  const legH = Math.max(sizes.legLeft.h, sizes.legRight.h),
    bodyH = sizes.body.h,
    bodyY = legH + bodyH / 2,
    strokes = [];
  for (const p of Object.keys(sizes)) {
    const s = sizes[p],
      b = bounds[p],
      arm = p.includes('arm'),
      leg = p.includes('leg'),
      side = p.includes('Left') ? -1 : 1;
    const x = arm ? side * (sizes.body.w / 2 + 0.01) : leg ? side * sizes.body.w * 0.25 : 0;
    const y =
      bodyY +
      (p === 'head' ? bodyH / 2 + s.h / 2 - 0.04 : arm ? bodyH * 0.3 : leg ? -bodyH / 2 : 0);
    for (const v of raw[p] || [])
      strokes.push({
        color: v.color,
        width: 0.012,
        closed: true,
        depth: p === 'body' ? 0.32 : p === 'head' ? 0.3 : 0.2,
        role: leg ? 'leg' : p === 'head' ? 'head' : 'body',
        points: v.points.map((q) => ({
          x: 0.5 + (x + ((q.x - b.minX) / Math.max(0.01, b.maxX - b.minX) - 0.5) * s.w) / 2.8,
          y:
            0.92 -
            (y +
              (0.5 - (q.y - b.minY) / Math.max(0.01, b.maxY - b.minY)) * s.h -
              (arm || leg ? s.h / 2 : 0)) /
              2.8,
        })),
      });
  }
  for (const side of [-1, 1]) {
    const x = 0.5 + (side * 0.12 * sizes.head.w) / 0.6 / 2.8;
    const y = 0.92 - (bodyY + bodyH / 2 + sizes.head.h / 2 - 0.04 + 0.03) / 2.8;
    strokes.push({
      color: '#233f38',
      width: 0.012,
      depth: 0.03,
      closed: true,
      role: 'detail',
      points: Array.from({ length: 12 }, (_, i) => ({
        x: x + Math.cos((i / 12) * Math.PI * 2) * 0.0096,
        y: y + Math.sin((i / 12) * Math.PI * 2) * 0.0096,
      })),
    });
  }
  return sanitizeSketch({ strokes });
}
