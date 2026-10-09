import { fbm, noise, rgb } from '../sdf.js';
import { mix } from '../skins.js';

/**
 * Pumpkins: a fat one of eight ribs, squat, its crown sunk round a crooked
 * stalk, waxy orange deepening into the grooves. `pumpkin` is whole;
 * `jack` is carved — the shell hollowed, a face cut through the front (two
 * eyes, a nose, a grin with teeth) and a candle's glow filling it.
 * `bigpumpkin` is the same pumpkin grown huge, for rolling down halls.
 * They sit on y = 0 and face +z.
 */

const RIBS = 8;
const DEEP = rgb('#a8400c'), BRIGHT = rgb('#ff8c1e'), PALE = rgb('#ffc060'), STALK = rgb('#5e5a30'), STALK_DARK = rgb('#3a3020');

/** The pumpkin's orange: lighter on the ribs, deep in the grooves, darker underneath, blotched, speckled. */
export function rind(radius, base = BRIGHT, deep = DEEP, pale = PALE) {
  return (p, n) => {
    const a = Math.atan2(p[0], p[2]);
    const rib = 0.5 + 0.5 * Math.cos(a * RIBS);
    let c = mix(deep, base, Math.pow(rib, 0.6));
    c = mix(c, pale, Math.max(0, n[1]) * 0.18 * rib);
    const under = Math.max(0, -n[1]);
    c = c.map((v) => v * (1 - under * 0.35));
    const blotch = 1 + (fbm(p[0] * 14, p[1] * 14, p[2] * 14, 3) - 0.5) * 0.3;
    const speck = noise(p[0] * 260, p[1] * 260, p[2] * 260) > 0.82 ? 1.15 : 1;
    return c.map((v) => v * blotch * speck);
  };
}

const stalkColour = (p) => mix(STALK_DARK, STALK, 0.5 + 0.5 * Math.sin(Math.atan2(p[0], p[2]) * 6 + p[1] * 30));

/**
 * Adds a pumpkin `r` round and `h` tall, its base at `at`, to the sculpt
 * `s`. `flat` presses its base flat (not for one rolling on its side).
 */
export function sculptPumpkin(s, { r = 0.22, h = 0.3, k = 0.05, colour = rind(r), ribs = RIBS, stalk = true, mat = 'rind', at = [0, 0, 0], flat = true, turn = 0 } = {}) {
  const [ox, oy, oz] = at;
  const cy = oy + h / 2;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2 + turn;
    const off = r * 0.42;
    s.ellipsoid([ox + Math.sin(a) * off, cy, oz + Math.cos(a) * off], [r * 0.62, h / 2, r * 0.62], { color: colour, mat, k, rot: [0, a, 0] });
  }
  // The crown sunk round the stalk, and the base pressed flat.
  s.sphere([ox, oy + h + r * 0.18, oz], r * 0.32, { op: 'sub', k: r * 0.25 });
  if (flat) s.box([ox, oy - r, oz], [r * 2, r, r * 2], 0, { op: 'sub', k: r * 0.08 });
  if (stalk) {
    s.part('stalk', () => {
      const top = oy + h - r * 0.04;
      const c = Math.cos(turn), sn = Math.sin(turn);
      const p = (x, y, z) => [ox + x * c + z * sn, y, oz - x * sn + z * c];
      const q = r / 0.22;
      s.chain([p(0, top - 0.02 * q, 0), p(0.008 * q, top + 0.04 * q, 0.004 * q), p(0.026 * q, top + 0.075 * q, 0.012 * q), p(0.05 * q, top + 0.088 * q, 0.02 * q)], [r * 0.13, r * 0.11, r * 0.095, r * 0.08], { color: stalkColour, mat: 'stalk', k: 0.01 * q });
      s.sphere(p(0, top - 0.01 * q, 0), r * 0.16, { color: stalkColour, mat: 'stalk', k: 0.02 * q });
    });
  }
}

const MATERIALS = {
  rind: { roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.3, sheenColor: '#ffd090', sheenRoughness: 0.6 },
  stalk: { roughness: 0.85 },
};

export const pumpkin = {
  name: 'pumpkin',
  cell: 0.0105,
  cells: { stalk: 0.0055 },
  bones: [['root', null, [0, 0, 0]]],
  decor: 0.6,
  materials: MATERIALS,
  sculpt(s) { sculptPumpkin(s); },
};

export const bigpumpkin = {
  name: 'bigpumpkin',
  cell: 0.016,
  cells: { stalk: 0.008 },
  bones: [['root', null, [0, 0, 0]]],
  materials: MATERIALS,
  sculpt(s) {
    // Rolled over and over down the hall: round all the way, its middle at its origin.
    sculptPumpkin(s, { r: 0.4, h: 0.6, at: [0, -0.3, 0], flat: false });
  },
};

const FLESH = rgb('#ffb030');
const GLOW = rgb('#ffc860');

/**
 * The carved face: two slanted eyes, a nose, and a wide grin with two
 * square teeth left in it — cut straight through the front of the shell.
 */
function face(s, r, cy) {
  const z = r * 0.95, d = r * 1.0;
  const cut = (pts) => s.panel(...pts.map(([x, y]) => [x * r, cy + y * r, z]), d, { op: 'sub', k: 0.006 });
  for (const m of [1, -1]) cut([[m * 0.1, 0.12], [m * 0.6, 0.16], [m * 0.36, 0.52]]);
  cut([[-0.12, -0.02], [0.12, -0.02], [0, 0.17]]);
  // The grin: a crescent of cuts along a curve, with two gaps for teeth.
  const top = (x) => -0.12 - 0.12 * (1 - x * x);
  const bottom = (x) => -0.22 - 0.3 * (1 - x * x);
  const xs = [-0.66, -0.4, -0.22, -0.08, 0.08, 0.22, 0.4, 0.66];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    // The teeth: a hand's width up from the bottom of the grin, either side of the middle.
    const tooth = (x) => (Math.abs(Math.abs(x) - 0.15) < 0.075 ? 0.11 : 0);
    const ta = top(a), tb = top(b);
    const ba = bottom(a) + (i === 2 || i === 4 ? tooth((a + b) / 2) : 0), bb = bottom(b) + (i === 2 || i === 4 ? tooth((a + b) / 2) : 0);
    cut([[a, ta], [b, tb], [b, bb]]);
    cut([[a, ta], [b, bb], [a, ba]]);
  }
}

/** A heap of pumpkins, big and small, for the middle of a room. */
export const pumpkinpile = {
  name: 'pumpkinpile',
  cell: 0.02,
  cells: { stalk: 0.01 },
  bones: [['root', null, [0, 0, 0]]],
  decor: 0.8,
  materials: MATERIALS,
  sculpt(s) {
    sculptPumpkin(s, { r: 0.42, h: 0.56, at: [0, 0, 0], turn: 0.3 });
    sculptPumpkin(s, { r: 0.26, h: 0.34, at: [0.62, 0, 0.32], turn: 1.2 });
    sculptPumpkin(s, { r: 0.22, h: 0.3, at: [-0.55, 0, 0.42], turn: 2.1 });
    sculptPumpkin(s, { r: 0.3, h: 0.38, at: [-0.4, 0, -0.55], turn: 0.7 });
    sculptPumpkin(s, { r: 0.18, h: 0.24, at: [0.35, 0, -0.6], turn: 2.8 });
  },
};

export const jack = {
  name: 'jack',
  cell: 0.0072,
  cells: { stalk: 0.0055, candle: 0.014 },
  bones: [['root', null, [0, 0, 0]]],
  materials: {
    ...MATERIALS,
    candle: { roughness: 0.5, emissive: '#ffa53a', emissiveIntensity: 2.2 },
  },
  sculpt(s) {
    const r = 0.22, h = 0.3;
    sculptPumpkin(s, { r, h });
    // Hollowed: the flesh inside glows with the candle.
    s.ellipsoid([0, h / 2 + 0.005, 0], [r * 0.82, h * 0.4, r * 0.82], { op: 'sub', k: 0.02 });
    s.paint((p) => Math.hypot(p[0] / (r * 0.86), (p[1] - h / 2) / (h * 0.44), p[2] / (r * 0.86)) - 1, mix(FLESH, GLOW, 0.3), 0.012);
    face(s, r, h / 2);
    // The light inside, seen through the face.
    s.part('candle', () => {
      s.ellipsoid([0, h * 0.47, -r * 0.05], [r * 0.7, h * 0.32, r * 0.66], { color: GLOW, mat: 'candle', k: 0 });
    });
  },
};
