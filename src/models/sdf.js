/**
 * Sculpting in code. A creature is a list of shapes — balls, ellipsoids,
 * tapered capsules, rounded boxes, tori, flat plates — each a signed
 * distance field, melted into the ones before it with a smooth union (or
 * carved out of them), the way a sculptor adds and smooths clay. The result
 * is one surface with no seams, turned into a mesh (`build`) by surface
 * nets on a grid, each vertex pulled back onto the true surface.
 *
 * Every vertex then gets:
 * - a normal from the field's gradient, so the shading is smooth;
 * - a colour, blended from the shapes nearest it, varied with noise and
 *   painted with any `paint` volumes (stripes, bellies, eye whites);
 * - ambient occlusion from the field itself, so creases and the undersides
 *   of things go dark the way they do in clay under a light;
 * - bone weights from how close each shape is, for skinning (`rig.js`).
 *
 * Units are tiles; y is up and the creature faces +z.
 */

// ——————————————————————————————————————— vectors, on plain arrays

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;

/** A rotation as three rows, from Euler angles in radians (x, then y, then z). */
export function rotation([rx = 0, ry = 0, rz = 0] = []) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz · Ry · Rx
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}

/** p in a shape's own frame: moved to its centre and turned back by its rotation. */
const local = (p, c, R) => {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  if (!R) return [x, y, z];
  // Rᵀ · v
  return [
    R[0][0] * x + R[1][0] * y + R[2][0] * z,
    R[0][1] * x + R[1][1] * y + R[2][1] * z,
    R[0][2] * x + R[1][2] * y + R[2][2] * z,
  ];
};

// ——————————————————————————————————————— noise

const PERM = new Uint8Array(512);
const VALUE = new Float32Array(256);
{
  // A fixed shuffle, so every bake comes out the same.
  let seed = 1234567;
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) VALUE[i] = rand();
}

/** Smooth value noise, 0 to 1. */
export function noise(x, y, z) {
  const fx0 = Math.floor(x), fy0 = Math.floor(y), fz0 = Math.floor(z);
  const fx = x - fx0, fy = y - fy0, fz = z - fz0;
  const ix = fx0 & 255, iy = fy0 & 255, iz = fz0 & 255;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = PERM[ix] + iy, b = PERM[ix + 1] + iy;
  const aa = PERM[a] + iz, ab = PERM[a + 1] + iz, ba = PERM[b] + iz, bb = PERM[b + 1] + iz;
  const x00 = VALUE[PERM[aa]] + (VALUE[PERM[ba]] - VALUE[PERM[aa]]) * u;
  const x10 = VALUE[PERM[ab]] + (VALUE[PERM[bb]] - VALUE[PERM[ab]]) * u;
  const x01 = VALUE[PERM[aa + 1]] + (VALUE[PERM[ba + 1]] - VALUE[PERM[aa + 1]]) * u;
  const x11 = VALUE[PERM[ab + 1]] + (VALUE[PERM[bb + 1]] - VALUE[PERM[ab + 1]]) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/**
 * Overlapping locks of fur, or scales: cells of a Voronoi pattern, longer
 * along `axis` by `stretch`, each raised toward its back edge (the −axis
 * side) and sunk at its borders. `height` is 0 in the creases to 1 at a
 * lock's tip; `id` is a number 0–1 for the lock, to vary its colour by.
 * `size` is a lock's width, in tiles.
 */
export function shingles(p, size, axis = 2, stretch = 1.8, out = { height: 0, id: 0, edge: 0 }) {
  const sx = axis === 0 ? size * stretch : size, sy = axis === 1 ? size * stretch : size, sz = axis === 2 ? size * stretch : size;
  const x = p[0] / sx, y = p[1] / sy, z = p[2] / sz;
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let f1 = 9, f2 = 9, id = 0, along = 0;
  for (let k = -1; k <= 1; k++) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j, cz = iz + k;
        const h = PERM[PERM[PERM[cx & 255] + (cy & 255)] + (cz & 255)];
        const fx = cx + VALUE[h], fy = cy + VALUE[(h + 71) & 255], fz = cz + VALUE[(h + 151) & 255];
        const dx = x - fx, dy = y - fy, dz = z - fz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < f1) {
          f2 = f1; f1 = d; id = VALUE[(h + 33) & 255];
          along = axis === 0 ? dx : axis === 1 ? dy : dz;
        } else if (d < f2) f2 = d;
      }
    }
  }
  const edge = Math.min(1, (f2 - f1) / 0.32);
  const lift = Math.min(1, Math.max(0, 0.55 - along));
  out.edge = edge;
  out.height = Math.sqrt(edge) * (0.3 + 0.7 * lift);
  out.id = id;
  return out;
}

/** Layered noise, 0 to 1. */
export function fbm(x, y, z, octaves = 3) {
  let s = 0, a = 0.5, f = 1, t = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * noise(x * f, y * f, z * f);
    t += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / t;
}

// ——————————————————————————————————————— colours

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  // Linear, as vertex colours are.
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ——————————————————————————————————————— distance functions (Inigo Quilez's)

function sdEllipsoid(q, r) {
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
  const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** A capsule whose radius goes from r1 at a to r2 at b. */
function sdRoundCone(p, a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pa = sub(p, a);
  const y = dot(pa, ba), z = y - l2;
  const xv = [pa[0] * l2 - ba[0] * y, pa[1] * l2 - ba[1] * y, pa[2] * l2 - ba[2] * y];
  const x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

function sdRoundBox(q, b, r) {
  const x = Math.abs(q[0]) - b[0] + r, y = Math.abs(q[1]) - b[1] + r, z = Math.abs(q[2]) - b[2] + r;
  return Math.hypot(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0)) + Math.min(Math.max(x, y, z), 0) - r;
}

/** A torus round the y axis, radius R, tube r; `arc` keeps only the part within that angle of +z (radians). */
function sdTorus(q, R, r, arc) {
  if (arc < Math.PI) {
    // Capped torus (iq's sdCappedTorus), opening toward −z.
    const sc = [Math.sin(arc), Math.cos(arc)];
    const px = Math.abs(q[0]), pz = q[2];
    const k = sc[1] * px > sc[0] * pz ? px * sc[0] + pz * sc[1] : Math.hypot(px, pz);
    return Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + R * R - 2 * R * k) - r;
  }
  return Math.hypot(Math.hypot(q[0], q[2]) - R, q[1]) - r;
}

/** A cone with its tip at the origin going down −y to a base of radius r at height h. */
function sdCone(q, r, h) {
  const qx = Math.hypot(q[0], q[2]), qy = -q[1];
  // Rounded-tip solid cone: distance to the segment profile.
  const k = [r, h];
  const w = [qx, qy];
  const t = clamp((w[0] * k[0] + w[1] * k[1]) / (k[0] * k[0] + k[1] * k[1]), 0, 1);
  const a = [w[0] - k[0] * t, w[1] - k[1] * t];
  const b = [w[0] - clamp(w[0], 0, r), w[1] - h];
  const s = Math.max(k[1] * w[0] - k[0] * w[1], w[1] - h) > 0 ? 1 : -1;
  const s2 = qy < 0 ? 1 : s;
  return Math.sqrt(Math.min(a[0] * a[0] + a[1] * a[1], b[0] * b[0] + b[1] * b[1])) * (qy < 0 && qx < 1e9 ? 1 : 1) * s2;
}

const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
};

const smax = (a, b, k) => -smin(-a, -b, k);

// ——————————————————————————————————————— the sculpt

let shapeId = 0;

export class Sculpt {
  constructor() {
    this.shapes = [];
    this.paints = [];
    /** Shapes go into this part; each part is meshed on its own (see `split`). */
    this.current = 'body';
  }

  /** Shapes added in `fn` go into part `name`: its own mesh, not melted into the rest. */
  part(name, fn) {
    const was = this.current;
    this.current = name;
    fn(this);
    this.current = was;
    return this;
  }

  /** The parts, each a sculpt of its own (sharing the paint). */
  split() {
    const parts = new Map();
    for (const s of this.shapes) {
      if (!parts.has(s.part)) {
        const p = new Sculpt();
        p.paints = this.paints;
        p.current = s.part;
        parts.set(s.part, p);
      }
      parts.get(s.part).shapes.push(s);
    }
    return parts;
  }

  /**
   * Adds a shape: `d(p)` is its distance from p ([x, y, z]); `box` its bounds
   * [[x0, y0, z0], [x1, y1, z1]]. Options: `op` ('add', 'sub' or 'inter'),
   * `k` (how softly it melts in), `color` ('#rrggbb' or (p) => linear rgb),
   * `bone`, `mat` (which material: the model's table), `bump` ([amplitude,
   * frequency]: lumpy surface), `locks` ([size, height, axis, stretch]: fur
   * or scales, see `shingles`).
   */
  shape(d, box, { op = 'add', k = 0.03, color = '#c0c0c0', bone = 'root', mat = 'skin', bump = null, locks = null } = {}) {
    const s = { id: shapeId++, d, box, op, k, bone, mat, bump, part: this.current, color: typeof color === 'string' ? rgb(color) : color };
    if (locks) {
      // [size, height, axis, stretch]: the surface raised in locks of fur or scales (`shingles`).
      const [size, amp, axis = 2, stretch = 1.8] = locks, inner = s.d, cell = { height: 0, id: 0, edge: 0 };
      s.d = (p) => {
        const d = inner(p);
        if (d > amp * 3 || d < -amp * 3) return d;
        return d - amp * shingles(p, size, axis, stretch, cell).height;
      };
      s.box = [box[0].map((v) => v - amp), box[1].map((v) => v + amp)];
    }
    if (bump) {
      const [amp, freq] = bump, inner = d;
      s.d = (p) => inner(p) - amp * (fbm(p[0] * freq, p[1] * freq, p[2] * freq, 2) - 0.5) * 2;
      s.box = [box[0].map((v) => v - amp), box[1].map((v) => v + amp)];
    }
    this.shapes.push(s);
    return this;
  }

  sphere(c, r, o) {
    return this.shape((p) => len(sub(p, c)) - r, [c.map((v) => v - r), c.map((v) => v + r)], o);
  }

  /** An ellipsoid of radii r, turned by `rot` (Euler angles). */
  ellipsoid(c, r, o = {}) {
    const R = o.rot ? rotation(o.rot) : null, m = Math.max(...r);
    return this.shape((p) => sdEllipsoid(local(p, c, R), r), [c.map((v) => v - m), c.map((v) => v + m)], o);
  }

  /** A capsule from a (radius r1) to b (radius r2). */
  limb(a, b, r1, r2 = r1, o) {
    const m = Math.max(r1, r2);
    return this.shape((p) => sdRoundCone(p, a, b, r1, r2),
      [[0, 1, 2].map((i) => Math.min(a[i], b[i]) - m), [0, 1, 2].map((i) => Math.max(a[i], b[i]) + m)], o);
  }

  /**
   * A flattened capsule from a (radius r1) to b (r2), squashed to `flat` of
   * its width along `up`: a petal, a feather, a clump of fur, a blade.
   */
  flake(a, b, up, r1, r2, flat = 0.5, o) {
    const L = len(sub(b, a));
    const z = sub(b, a).map((v) => v / L);
    const u = dot(up, z);
    let y = [up[0] - z[0] * u, up[1] - z[1] * u, up[2] - z[2] * u];
    const yl = len(y) || 1;
    y = y.map((v) => v / yl);
    const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
    const end = [0, 0, L], zero = [0, 0, 0];
    const m = Math.max(r1, r2);
    return this.shape((p) => {
      const v = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      return sdRoundCone([dot(v, x), dot(v, y) / flat, dot(v, z)], zero, end, r1, r2) * flat;
    }, [[0, 1, 2].map((i) => Math.min(a[i], b[i]) - m), [0, 1, 2].map((i) => Math.max(a[i], b[i]) + m)], o);
  }

  /**
   * A thin flat triangle a–b–c, `thick` through (half each side): a panel of
   * wing membrane, a sail, a blade's facet.
   */
  panel(a, b, c, thick, o) {
    const n = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
    const l = len(n) || 1;
    const N = n.map((v) => v / l);
    const corners = [a, b, c];
    // For each edge, the way into the triangle, in its plane.
    const edges = corners.map((u, i) => {
      const v = corners[(i + 1) % 3];
      const e = sub(v, u);
      const inward = [N[1] * e[2] - N[2] * e[1], N[2] * e[0] - N[0] * e[2], N[0] * e[1] - N[1] * e[0]];
      const il = len(inward) || 1;
      return { u, inward: inward.map((x) => x / il) };
    });
    const half = thick / 2;
    return this.shape((p) => {
      const d = Math.abs(dot(sub(p, a), N)) - half;
      let out = -Infinity;
      for (const { u, inward } of edges) out = Math.max(out, -dot(sub(p, u), inward));
      return Math.hypot(Math.max(out, 0), Math.max(d, 0)) + Math.min(Math.max(out, d), 0);
    }, [[0, 1, 2].map((i) => Math.min(a[i], b[i], c[i]) - half), [0, 1, 2].map((i) => Math.max(a[i], b[i], c[i]) + half)], o);
  }

  /** A chain of capsules through points, with a radius at each. */
  chain(points, radii, o) {
    for (let i = 0; i < points.length - 1; i++) {
      const bone = Array.isArray(o?.bones) ? o.bones[i] : o?.bone;
      this.limb(points[i], points[i + 1], radii[i], radii[i + 1], { ...o, bone });
    }
    return this;
  }

  /** A box of half-size b, its corners rounded by r, turned by `rot`. */
  box(c, b, r = 0.01, o = {}) {
    const R = o.rot ? rotation(o.rot) : null, m = Math.hypot(...b);
    return this.shape((p) => sdRoundBox(local(p, c, R), b, r), [c.map((v) => v - m), c.map((v) => v + m)], o);
  }

  /** A cylinder of radius r round its local y axis, `h` tall either side of c, its edges rounded by `round`, turned by `rot`. */
  cylinder(c, r, h, o = {}) {
    const R = o.rot ? rotation(o.rot) : null, m = Math.hypot(r, h), round = o.round ?? 0;
    return this.shape((p) => {
      const q = local(p, c, R);
      const dx = Math.hypot(q[0], q[2]) - r + round, dy = Math.abs(q[1]) - h + round;
      return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - round;
    }, [c.map((v) => v - m), c.map((v) => v + m)], o);
  }

  /** A torus of radius R and tube r round its local y axis, turned by `rot`; `arc` keeps a part of it. */
  torus(c, R, r, o = {}) {
    const Rm = o.rot ? rotation(o.rot) : null, m = R + r, arc = o.arc ?? Math.PI;
    return this.shape((p) => sdTorus(local(p, c, Rm), R, r, arc), [c.map((v) => v - m), c.map((v) => v + m)], o);
  }

  /** A cone with its tip at `tip`, pointing up its local +y, base radius r, height h, turned by `rot`. */
  cone(tip, r, h, o = {}) {
    const R = o.rot ? rotation(o.rot) : null, m = Math.max(r, h);
    return this.shape((p) => sdCone(local(p, tip, R), r, h), [tip.map((v) => v - m), tip.map((v) => v + m)], o);
  }

  /**
   * Where a ray from `from` going `dir` first meets the surface so far, and
   * the surface's normal there; null if it misses within `far`.
   */
  cast(from, dir, far = 2) {
    // Onto what was there before the tufts started: tufts don't grow on tufts.
    const shapes = this.shapes;
    if (this.bare !== undefined) this.shapes = shapes.slice(0, this.bare);
    try {
      return this.march(from, dir, far);
    } finally {
      this.shapes = shapes;
    }
  }

  march(from, dir, far) {
    let t = 0;
    for (let i = 0; i < 160 && t < far; i++) {
      const p = [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t];
      const d = this.field(p);
      if (d < 0.0005) return { p, n: this.gradient(p, 0.002) };
      t += Math.max(d * 0.8, 0.0008);
    }
    return null;
  }

  /**
   * One tuft of fur (or a spine, a scale, a feather) stuck in the surface so
   * far where a ray from `from` going `dir` meets it: from radius `r` at its
   * root to a point `length` along `aim(p, n)` (a vector; it is made unit).
   * It is flattened to `flat` across the surface, takes the bone of the
   * shape it grows from, and is coloured `color(t, p)` from root (t 0) to
   * tip (1). Returns whether it found the surface.
   */
  tuft(from, dir, { aim, length = 0.04, r = 0.012, k = 0.008, color = null, mat = 'skin', bury = 0.4, flat = 1, tip = 0.12, keep = () => true, far = 1 }) {
    this.bare ??= this.shapes.length;
    const hit = this.cast(from, dir, far);
    if (!hit || !keep(hit.p, hit.n)) return false;
    const { p, n } = hit;
    let w = aim(p, n);
    const wl = len(w) || 1;
    w = [w[0] / wl, w[1] / wl, w[2] / wl];
    const root = [p[0] - n[0] * r * bury * 2, p[1] - n[1] * r * bury * 2, p[2] - n[2] * r * bury * 2];
    const end = [p[0] + w[0] * length, p[1] + w[1] * length, p[2] + w[2] * length];
    let bone = 'root', best = Infinity;
    for (const s of this.shapes.slice(0, this.bare)) {
      if (s.op !== 'add') continue;
      const d = s.d(p);
      if (d < best) { best = d; bone = s.bone; }
    }
    const axis = sub(end, root), al = dot(axis, axis);
    const paint = color ? (x) => color(clamp(dot(sub(x, root), axis) / al, 0, 1), x) : '#808080';
    if (flat < 1) this.flake(root, end, n, r, r * tip, flat, { k, bone, mat, color: paint });
    else this.limb(root, end, r, r * tip, { k, bone, mat, color: paint });
    return true;
  }

  /** Done with tufts: what comes next is cast onto like any surface. */
  grown() {
    this.bare = undefined;
    return this;
  }

  /**
   * `count` tufts (see `tuft`) scattered over the surface round `center`:
   * cast in from `spread` away in random directions. `keep(p, n)` can
   * refuse a spot; sizes and aims vary by `jitter`.
   */
  tufts({ count, center, spread = 0.3, aim, seed = 1, jitter = 0.3, length = 0.04, r = 0.012, ...o }) {
    let state = seed * 9301 + 49297;
    const rand = () => ((state = (state * 9301 + 49297) % 233280) / 233280);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 8; tries++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      const dir = [q * Math.cos(a), u, q * Math.sin(a)];
      const from = [center[0] + dir[0] * spread, center[1] + dir[1] * spread, center[2] + dir[2] * spread];
      const j = [(rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter];
      const L = length * (0.7 + rand() * 0.6), rr = r * (0.8 + rand() * 0.4);
      const ok = this.tuft(from, [-dir[0], -dir[1], -dir[2]], {
        ...o, length: L, r: rr, far: spread * 1.2,
        aim: (p, n) => {
          const w = aim(p, n), l = len(w) || 1;
          return [w[0] / l + j[0], w[1] / l + j[1], w[2] / l + j[2]];
        },
      });
      if (ok) placed++;
    }
    return this;
  }

  /**
   * Colour only: inside `inside(p)` (a distance, negative inside) the surface
   * is painted `color`, softened over `soft`.
   */
  paint(inside, color, soft = 0.01) {
    this.paints.push({ inside, color: typeof color === 'string' ? rgb(color) : color, soft });
    return this;
  }

  /** Shapes mirrored across x = 0: `fn(side)` adds them for side = 1 and again for −1. */
  mirror(fn) {
    fn(1);
    fn(-1);
    return this;
  }

  bounds(margin = 0.05) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const s of this.shapes) {
      if (s.op !== 'add') continue;
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], s.box[0][i] - s.k);
        hi[i] = Math.max(hi[i], s.box[1][i] + s.k);
      }
    }
    return [lo.map((v) => v - margin), hi.map((v) => v + margin)];
  }

  /**
   * Sorts the shapes into bins of a grid over [lo, hi], each bin listing only
   * the shapes that can change the field within `margin` of the surface
   * there; after this, `field` looks only at those.
   */
  prepare(lo, hi, margin, size = 0.04) {
    const n = [0, 1, 2].map((i) => Math.max(1, Math.ceil((hi[i] - lo[i]) / size)));
    const bins = new Array(n[0] * n[1] * n[2]);
    const reach = this.shapes.map((s) => (s.op === 'inter' ? Infinity : margin + s.k));
    for (let k = 0; k < n[2]; k++) {
      for (let j = 0; j < n[1]; j++) {
        for (let i = 0; i < n[0]; i++) {
          const b0 = [lo[0] + i * size, lo[1] + j * size, lo[2] + k * size];
          const list = [];
          this.shapes.forEach((s, si) => {
            const bx = s.box;
            let d2 = 0;
            for (let a = 0; a < 3; a++) {
              const gap = Math.max(bx[0][a] - (b0[a] + size), 0, b0[a] - bx[1][a]);
              d2 += gap * gap;
            }
            if (d2 <= reach[si] * reach[si]) list.push(s);
          });
          bins[i + n[0] * (j + n[1] * k)] = list;
        }
      }
    }
    this.grid = { lo, n, size, bins };
    return this;
  }

  /** The shapes that matter at p. */
  near(p) {
    const g = this.grid;
    if (!g) return this.shapes;
    const i = Math.floor((p[0] - g.lo[0]) / g.size), j = Math.floor((p[1] - g.lo[1]) / g.size), k = Math.floor((p[2] - g.lo[2]) / g.size);
    if (i < 0 || j < 0 || k < 0 || i >= g.n[0] || j >= g.n[1] || k >= g.n[2]) return this.shapes;
    return g.bins[i + g.n[0] * (j + g.n[1] * k)];
  }

  /** The field at p: the shapes, in order, melted together and carved. */
  field(p) {
    let d = 1e9;
    const list = this.near(p);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.op === 'add') {
        d = smin(d, s.d(p), s.k);
      } else if (s.op === 'sub') {
        d = smax(d, -s.d(p), s.k);
      } else {
        d = smax(d, s.d(p), s.k);
      }
    }
    return d;
  }

  gradient(p, e) {
    const f = (x, y, z) => this.field([x, y, z]);
    const g = [
      f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]),
      f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]),
      f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e),
    ];
    const l = len(g) || 1;
    return [g[0] / l, g[1] / l, g[2] / l];
  }

  /** Colour and bone weights at a point on the surface: from the shapes nearest it, and the paint on it. */
  surface(p, n, bones, cell = 0.004) {
    let best = Infinity, mat = 'skin';
    const near = [];
    for (const s of this.near(p)) {
      if (s.op !== 'add') continue;
      const d = s.d(p);
      near.push([s, d]);
      if (d < best) { best = d; mat = s.mat; }
    }
    let w = 0;
    let c = [0, 0, 0];
    const weights = new Map();
    for (const [s, d] of near) {
      const t = d - best;
      if (t > 0.08) continue;
      // Colours blend over at least a grid step, or their edges come out sawn.
      const k = Math.exp(-t / Math.max(cell * 0.7, s.k * 0.35));
      const col = typeof s.color === 'function' ? s.color(p, n) : s.color;
      c = [c[0] + col[0] * k, c[1] + col[1] * k, c[2] + col[2] * k];
      w += k;
      const kb = Math.exp(-t / Math.max(0.012, s.k * 0.8));
      weights.set(s.bone, (weights.get(s.bone) ?? 0) + kb);
    }
    c = c.map((v) => v / w);
    for (const pt of this.paints) {
      const d = pt.inside(p);
      if (d < pt.soft) {
        const t = clamp(0.5 - d / (2 * pt.soft), 0, 1);
        const col = typeof pt.color === 'function' ? pt.color(p, n) : pt.color;
        c = mix3(c, col, t);
      }
    }
    // The four bones that matter most, normalised.
    const top = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((s, [, v]) => s + v, 0);
    const bw = top.map(([name, v]) => [bones.indexOf(name) < 0 ? 0 : bones.indexOf(name), v / total]);
    return { color: c, bones: bw, mat };
  }

  /** How much light reaches p, pointing n: Quilez's ambient occlusion, from the field. */
  occlusion(p, n, scale) {
    let occ = 0, sca = 1;
    for (let i = 1; i <= 5; i++) {
      const h = scale * (0.02 + 0.16 * (i / 5));
      const d = this.field([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]);
      occ += (h - d) * sca;
      sca *= 0.8;
    }
    return clamp(1 - (2.2 * occ) / scale, 0, 1);
  }
}

/**
 * The sculpt as a mesh, `cell` tiles to a grid step: positions, normals,
 * colours (with the occlusion in them), triangle indices, and for each
 * vertex up to four bones and their weights. `bones` names the bones in
 * order. `shade(color, p, n, ao)` can finish a vertex's colour.
 */
export function build(sculpt, { cell = 0.012, bones = ['root'], ambient = 0.32, shade = null } = {}) {
  const [lo, hi] = sculpt.bounds(cell * 3);
  const C = 4;
  sculpt.prepare(lo, hi, Math.max(cell * C * 2, 0.035));
  const nx = Math.ceil((hi[0] - lo[0]) / cell), ny = Math.ceil((hi[1] - lo[1]) / cell), nz = Math.ceil((hi[2] - lo[2]) / cell);
  const sx = nx + 1, sy = ny + 1;
  const at = (i, j, k) => i + sx * (j + sy * k);
  const values = new Float32Array(sx * sy * (nz + 1)).fill(NaN);
  const pos = (i, j, k) => [lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell];

  // A coarse pass first: only near where it crosses zero is the fine grid worth working out.
  const cx = Math.ceil(nx / C), cy = Math.ceil(ny / C), cz = Math.ceil(nz / C);
  const coarse = new Float32Array((cx + 1) * (cy + 1) * (cz + 1));
  const cat = (i, j, k) => i + (cx + 1) * (j + (cy + 1) * k);
  for (let k = 0; k <= cz; k++) for (let j = 0; j <= cy; j++) for (let i = 0; i <= cx; i++) coarse[cat(i, j, k)] = sculpt.field(pos(i * C, j * C, k * C));
  const band = cell * C * 1.9;
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let near = false;
        for (let c = 0; c < 8 && !near; c++) if (Math.abs(coarse[cat(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]) < band) near = true;
        if (!near) continue;
        for (let kk = k * C; kk <= Math.min(nz, (k + 1) * C); kk++) {
          for (let jj = j * C; jj <= Math.min(ny, (j + 1) * C); jj++) {
            for (let ii = i * C; ii <= Math.min(nx, (i + 1) * C); ii++) {
              const a = at(ii, jj, kk);
              if (Number.isNaN(values[a])) values[a] = sculpt.field(pos(ii, jj, kk));
            }
          }
        }
      }
    }
  }
  // Everywhere else, from the coarse grid: far from the surface only the sign matters.
  for (let k = 0; k <= nz; k++) {
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const a = at(i, j, k);
        if (!Number.isNaN(values[a])) continue;
        const fi = Math.min(cx - 1e-6, i / C), fj = Math.min(cy - 1e-6, j / C), fk = Math.min(cz - 1e-6, k / C);
        const i0 = Math.floor(fi), j0 = Math.floor(fj), k0 = Math.floor(fk);
        const u = fi - i0, v = fj - j0, w = fk - k0;
        const g = (a2, b, c) => coarse[cat(i0 + a2, j0 + b, k0 + c)];
        values[a] = mix(mix(mix(g(0, 0, 0), g(1, 0, 0), u), mix(g(0, 1, 0), g(1, 1, 0), u), v),
          mix(mix(g(0, 0, 1), g(1, 0, 1), u), mix(g(0, 1, 1), g(1, 1, 1), u), v), w);
      }
    }
  }

  // Surface nets: a vertex in every cell the surface passes through...
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1);
  const cid = (i, j, k) => i + nx * (j + ny * k);
  const verts = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const corner = (c) => [c & 1, (c >> 1) & 1, (c >> 2) & 1];
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = new Array(8);
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const [a, b, d] = corner(c);
          v[c] = values[at(i + a, j + b, k + d)];
          if (v[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let px = 0, py = 0, pz = 0, n = 0;
        for (const [e0, e1] of EDGES) {
          if ((v[e0] < 0) === (v[e1] < 0)) continue;
          const t = v[e0] / (v[e0] - v[e1]);
          const A = corner(e0), B = corner(e1);
          px += A[0] + (B[0] - A[0]) * t; py += A[1] + (B[1] - A[1]) * t; pz += A[2] + (B[2] - A[2]) * t;
          n++;
        }
        cellIndex[cid(i, j, k)] = verts.length;
        verts.push([lo[0] + (i + px / n) * cell, lo[1] + (j + py / n) * cell, lo[2] + (k + pz / n) * cell]);
      }
    }
  }

  // ...and a quad across every grid edge that crosses it, joining the four cells round that edge.
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // Split along the shorter diagonal.
    const ac = len(sub(verts[a], verts[c])), bd = len(sub(verts[b], verts[d]));
    const t = ac < bd ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [x, y, z] of t) tris.push(...(flip ? [x, z, y] : [x, y, z]));
  };
  for (let k = 1; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = values[at(i, j, k)], b = values[at(i + 1, j, k)];
        if ((a < 0) === (b < 0)) continue;
        quad(cellIndex[cid(i, j - 1, k - 1)], cellIndex[cid(i, j, k - 1)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j - 1, k)], a > 0);
      }
    }
  }
  for (let k = 1; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 1; i < nx; i++) {
        const a = values[at(i, j, k)], b = values[at(i, j + 1, k)];
        if ((a < 0) === (b < 0)) continue;
        quad(cellIndex[cid(i - 1, j, k - 1)], cellIndex[cid(i - 1, j, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j, k - 1)], a > 0);
      }
    }
  }
  for (let k = 0; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 1; i < nx; i++) {
        const a = values[at(i, j, k)], b = values[at(i, j, k + 1)];
        if ((a < 0) === (b < 0)) continue;
        quad(cellIndex[cid(i - 1, j - 1, k)], cellIndex[cid(i, j - 1, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i - 1, j, k)], a > 0);
      }
    }
  }

  // Each vertex onto the surface proper, then its normal, colour, light and bones.
  const count = verts.length;
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), color = new Float32Array(count * 3);
  const skinIndex = new Uint8Array(count * 4), skinWeight = new Float32Array(count * 4);
  const mats = new Array(count);
  const e = cell * 0.5;
  const scale = Math.max(hi[1] - lo[1], 0.3);
  for (let v = 0; v < count; v++) {
    let p = verts[v];
    for (let it = 0; it < 2; it++) {
      const d = sculpt.field(p);
      const g = sculpt.gradient(p, e);
      const step = clamp(d, -cell, cell);
      p = [p[0] - g[0] * step, p[1] - g[1] * step, p[2] - g[2] * step];
    }
    const n = sculpt.gradient(p, e);
    const s = sculpt.surface(p, n, bones, cell);
    const ao = sculpt.occlusion(p, n, scale * 0.35);
    let c = s.color.map((x) => x * mix(ambient, 1, ao));
    if (shade) c = shade(c, p, n, ao);
    position.set(p, v * 3);
    normal.set(n, v * 3);
    color.set(c, v * 3);
    mats[v] = s.mat;
    s.bones.forEach(([b, w], i) => { skinIndex[v * 4 + i] = b; skinWeight[v * 4 + i] = w; });
  }
  const index = count > 65535 ? new Uint32Array(tris) : new Uint16Array(tris);
  return { position, normal, color, index, skinIndex, skinWeight, mats, count, bounds: [lo, hi] };
}
