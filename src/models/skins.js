import { fbm, noise, rgb } from './sdf.js';

/**
 * Colours for sculpts: functions of a point and its normal, in linear RGB,
 * for the `color` of a shape or a paint.
 */

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const toRGB = (c) => (typeof c === 'string' ? rgb(c) : c);

/**
 * Fur, hide or cloth: `over` where it faces up, `under` where it faces
 * down (the belly), shaded with blotchy noise (`vary`, at `freq` per tile)
 * and fine grain (`grain`). `seed` moves the noise.
 */
export function coat({ over, under = over, vary = 0.18, freq = 9, grain = 0.08, gfreq = 60, seed = 0, edge = [-0.35, 0.35] }) {
  const o = toRGB(over), u = toRGB(under);
  return (p, n) => {
    const t = smooth(edge[0], edge[1], n[1]);
    let c = mix(u, o, t);
    const blotch = 1 + (fbm(p[0] * freq + seed, p[1] * freq, p[2] * freq, 3) - 0.5) * 2 * vary;
    const fine = 1 + (noise(p[0] * gfreq, p[1] * gfreq + seed, p[2] * gfreq) - 0.5) * 2 * grain;
    return c.map((v) => v * blotch * fine);
  };
}

/**
 * Fur by colour: `coat`'s shading with strands — noise stretched along the
 * way the fur lies (`flow`: 0 x, 1 y, 2 z) — light and dark by `strands`.
 */
export function pelt({ strands = 0.35, sfreq = 160, flow = 2, stretch = 0.12, ...o }) {
  const base = coat(o);
  return (p, n) => {
    const c = base(p, n);
    const q = [p[0] * sfreq, p[1] * sfreq, p[2] * sfreq];
    q[flow] *= stretch;
    const k = 1 + (noise(q[0], q[1], q[2]) - 0.5) * 2 * strands;
    return c.map((v) => v * k);
  };
}

/** Along an axis (0 x, 1 y, 2 z) from `a` at `from` to `b` at `to`. */
export function ramp(axis, from, to, a, b, inner = null) {
  const A = toRGB(a), B = toRGB(b);
  return (p, n) => {
    const t = smooth(from, to, p[axis]);
    const c = mix(A, B, t);
    if (!inner) return c;
    const k = inner(p, n);
    return [c[0] * k[0], c[1] * k[1], c[2] * k[2]];
  };
}

/** Bands every `period` along an axis: `a` and `b` alternating, `width` of each period `b`. */
export function bands(axis, period, a, b, width = 0.25, soft = 0.2) {
  const A = toRGB(a), B = toRGB(b);
  return (p) => {
    const f = ((p[axis] / period) % 1 + 1) % 1;
    const d = Math.min(f, 1 - f);
    return mix(B, A, smooth(width * 0.5 * (1 - soft), width * 0.5 * (1 + soft), d));
  };
}

/** A colour times light grain noise: for metal, bone, stone. */
export function grainy(color, amount = 0.12, freq = 40, seed = 0) {
  const c = toRGB(color);
  return (p) => {
    const k = 1 + (fbm(p[0] * freq + seed, p[1] * freq, p[2] * freq, 2) - 0.5) * 2 * amount;
    return c.map((v) => v * k);
  };
}

/** `fn`'s colour, darker toward its bottom: dirt and shadow, `from` to `to` up y. */
export function grime(fn, from, to, dark = 0.55) {
  return (p, n) => {
    const c = typeof fn === 'function' ? fn(p, n) : toRGB(fn);
    const k = dark + (1 - dark) * smooth(from, to, p[1]);
    return c.map((v) => v * k);
  };
}

export { mix, clamp, smooth };
