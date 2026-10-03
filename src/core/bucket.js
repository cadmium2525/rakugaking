import { hitStroke, SKETCH_LIMIT } from './sketch.js';

const N = 256;
// Rasterize only the drawing, flood the tapped region, then trace it back to
// editable vector contours. Open regions touching the paper edge stay unfilled.
export function bucketFill(drawing, point, properties) {
  const top = drawing.strokes.findLastIndex((s) => hitStroke(s, point, 0));
  if (top >= 0 && drawing.strokes[top].closed) {
    if (drawing.strokes[top].color === properties.color) return 'same';
    drawing.strokes[top].color = properties.color;
    return 'painted';
  }
  if (top >= 0) return 'line';
  const blocked = new Uint8Array(N * N);
  const stamp = (x, y, radius) => {
    for (
      let yy = Math.max(0, Math.floor(y - radius));
      yy <= Math.min(N - 1, Math.ceil(y + radius));
      yy++
    )
      for (
        let xx = Math.max(0, Math.floor(x - radius));
        xx <= Math.min(N - 1, Math.ceil(x + radius));
        xx++
      )
        if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= radius ** 2) blocked[yy * N + xx] = 1;
  };
  for (const s of drawing.strokes) {
    if (s.closed) {
      const xs = s.points.map((p) => p.x),
        ys = s.points.map((p) => p.y);
      for (
        let y = Math.max(0, Math.floor(Math.min(...ys) * N));
        y < Math.min(N, Math.ceil(Math.max(...ys) * N));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(Math.min(...xs) * N));
          x < Math.min(N, Math.ceil(Math.max(...xs) * N));
          x++
        )
          if (hitStroke(s, { x: (x + 0.5) / N, y: (y + 0.5) / N }, 0)) blocked[y * N + x] = 1;
    }
    const count = s.points.length + (s.closed ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const b = s.points[i % s.points.length],
        a = s.points[Math.max(0, i - 1)];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * N * 2));
      for (let j = 0; j <= steps; j++)
        stamp(
          (a.x + ((b.x - a.x) * j) / steps) * N,
          (a.y + ((b.y - a.y) * j) / steps) * N,
          Math.max(0.9, (s.width * N) / 2),
        );
    }
  }
  const start =
    Math.min(N - 1, Math.floor(point.y * N)) * N + Math.min(N - 1, Math.floor(point.x * N));
  if (blocked[start]) return 'line';
  const region = new Uint8Array(N * N),
    queue = new Int32Array(N * N);
  let head = 0,
    end = 1,
    edge = false;
  queue[0] = start;
  region[start] = 1;
  while (head < end) {
    const at = queue[head++],
      x = at % N,
      y = Math.floor(at / N);
    if (!x || !y || x === N - 1 || y === N - 1) edge = true;
    for (const next of [
      x > 0 ? at - 1 : -1,
      x < N - 1 ? at + 1 : -1,
      y > 0 ? at - N : -1,
      y < N - 1 ? at + N : -1,
    ])
      if (next >= 0 && !blocked[next] && !region[next]) {
        region[next] = 1;
        queue[end++] = next;
      }
  }
  if (edge) return 'open';
  if (drawing.strokes.length >= SKETCH_LIMIT) return 'limit';
  // Overlap the raster boundary by one cell so antialiased pen edges do not
  // leave a hairline of white between the outline and its colored interior.
  const originalEnd = end;
  for (let i = 0; i < originalEnd; i++) {
    const at = queue[i];
    for (const next of [at - 1, at + 1, at - N, at + N]) {
      if (next >= 0 && next < N * N && !region[next]) {
        region[next] = 1;
        queue[end++] = next;
      }
    }
  }
  const edges = new Map(),
    key = (x, y) => y * (N + 1) + x;
  const add = (ax, ay, bx, by) => {
    const from = key(ax, ay);
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from).push(key(bx, by));
  };
  for (let i = 0; i < end; i++) {
    const at = queue[i],
      x = at % N,
      y = Math.floor(at / N);
    if (y === 0 || !region[at - N]) add(x, y, x + 1, y);
    if (x === N - 1 || !region[at + 1]) add(x + 1, y, x + 1, y + 1);
    if (y === N - 1 || !region[at + N]) add(x + 1, y + 1, x, y + 1);
    if (x === 0 || !region[at - 1]) add(x, y + 1, x, y);
  }
  const loops = [];
  while (edges.size) {
    const first = edges.keys().next().value;
    let at = first;
    const loop = [];
    do {
      loop.push({ x: (at % (N + 1)) / N, y: Math.floor(at / (N + 1)) / N });
      const targets = edges.get(at);
      if (!targets) return 'complex';
      const next = targets.pop();
      if (!targets.length) edges.delete(at);
      at = next;
    } while (at !== first && loop.length <= N * N * 4);
    loops.push(simplifyLoop(loop));
  }
  const area = (p) =>
    p.reduce((a, v, i) => {
      const q = p[(i + 1) % p.length];
      return a + v.x * q.y - q.x * v.y;
    }, 0);
  loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const holes = loops.slice(1).filter((p) => Math.abs(area(p)) > 0.00012);
  if (
    !loops[0] ||
    loops[0].length < 3 ||
    loops[0].length + holes.reduce((n, p) => n + p.length, 0) > 128 ||
    holes.length > 8 ||
    holes.some((p) => p.length > 32)
  )
    return 'complex';
  drawing.strokes.unshift({
    ...properties,
    points: loops[0],
    ...(holes.length ? { holes } : {}),
    closed: true,
  });
  return 'filled';
}

function simplifyLoop(points) {
  const distance = (p, a, b) => {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  const simplify = (p) => {
    if (p.length < 3) return p;
    let far = 0.003,
      index = -1;
    for (let i = 1; i < p.length - 1; i++) {
      const d = distance(p[i], p[0], p.at(-1));
      if (d > far) {
        far = d;
        index = i;
      }
    }
    return index < 0
      ? [p[0], p.at(-1)]
      : [...simplify(p.slice(0, index + 1)).slice(0, -1), ...simplify(p.slice(index))];
  };
  const mid = Math.floor(points.length / 2);
  return [
    ...simplify(points.slice(0, mid + 1)).slice(0, -1),
    ...simplify([...points.slice(mid), points[0]]).slice(0, -1),
  ];
}
