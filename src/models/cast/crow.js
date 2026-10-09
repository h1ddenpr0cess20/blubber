import { rgb } from '../sdf.js';
import { grainy, mix } from '../skins.js';

/**
 * The crow, November's flyer: black, glossed blue-green in the light, a
 * heavy grey beak, beady eyes, broad fingered wings and a wedge of a tail.
 * Always flying, as the bat is. Its origin is its middle; faces +z; about
 * 0.8 tiles across the wings.
 */

const feathers = (p, n) => {
  const g = grainy('#1c1c24', 0.12, 50)(p);
  // A sheen of blue and green on what faces up.
  return mix(g, rgb('#2a3a5a'), Math.max(0, n[1]) * 0.35 + Math.max(0, Math.sin(p[2] * 80)) * 0.05);
};
const side = (m) => (m > 0 ? 'L' : 'R');

/** The wing's joints at rest, spread for gliding: shoulder, elbow, wrist; then each long feather's tip. */
function wing(m) {
  const sh = [m * 0.04, 0.02, 0.02], el = [m * 0.15, 0.04, 0.0], wr = [m * 0.26, 0.03, 0.01];
  const tips = Array.from({ length: 6 }, (_, i) => [m * (0.4 - i * 0.03), 0.02 - i * 0.004, 0.04 - i * 0.045]);
  return { sh, el, wr, tips };
}

export default {
  name: 'crow',
  cell: 0.0055,
  cells: { eyes: 0.002, beak: 0.003, wings: 0.0045 },
  bones: [
    ['root', null, [0, 0, 0]],
    ['body', 'root', [0, 0, 0]],
    ['head', 'body', [0, 0.03, 0.08]],
    ['tail', 'body', [0, 0, -0.08]],
    ...[1, -1].flatMap((m) => {
      const w = wing(m), S = side(m);
      return [[`arm${S}`, 'body', w.sh], [`fore${S}`, `arm${S}`, w.el], [`hand${S}`, `fore${S}`, w.wr]];
    }),
  ],
  materials: {
    feather: { roughness: 0.45, sheen: 1, sheenColor: '#5a7aa8', sheenRoughness: 0.35, side: 'double' },
    beak: { roughness: 0.35, clearcoat: 0.5 },
    eye: { roughness: 0.05, clearcoat: 1, emissive: '#ffcc40', emissiveIntensity: 0.6 },
  },
  sculpt(s) {
    const F = { color: feathers, mat: 'feather' };
    s.ellipsoid([0, 0, 0], [0.045, 0.045, 0.09], { ...F, bone: 'body', k: 0.02 });
    s.sphere([0, 0.03, 0.085], 0.038, { ...F, bone: 'head', k: 0.025 });
    s.part('beak', () => {
      s.limb([0, 0.03, 0.11], [0, 0.022, 0.165], 0.016, 0.003, { color: '#4a4a52', mat: 'beak', bone: 'head', k: 0.004 });
    });
    s.part('eyes', () => {
      for (const m of [1, -1]) s.sphere([m * 0.026, 0.042, 0.1], 0.007, { color: '#1a1206', mat: 'eye', bone: 'head', k: 0 });
    });
    // The tail: a wedge of long feathers.
    for (const a of [-0.25, 0, 0.25]) s.flake([0, 0, -0.06], [Math.sin(a) * 0.05, -0.005, -0.17], [0, 1, 0], 0.016, 0.022, 0.2, { ...F, bone: 'tail', k: 0.006 });
    s.part('wings', () => {
      for (const m of [1, -1]) {
        const S = side(m), w = wing(m);
        s.flake(w.sh, w.el, [0, 1, 0], 0.035, 0.03, 0.3, { ...F, bone: `arm${S}`, k: 0.01 });
        s.flake(w.el, w.wr, [0, 1, 0], 0.03, 0.026, 0.3, { ...F, bone: `fore${S}`, k: 0.008 });
        // The secondaries along the arm, the long fingered primaries off the hand.
        for (let i = 0; i < 4; i++) {
          const t = i / 3, at = [w.sh[0] + (w.wr[0] - w.sh[0]) * t, 0.02, 0.0];
          s.flake(at, [at[0] + m * 0.01, 0.0, -0.1], [0, 1, 0], 0.016, 0.02, 0.2, { ...F, bone: t < 0.5 ? `arm${S}` : `fore${S}`, k: 0.006 });
        }
        for (const tip of w.tips) s.flake(w.wr, tip, [0, 1, 0], 0.012, 0.016, 0.2, { ...F, bone: `hand${S}`, k: 0.004 });
      }
    });
  },
  animate(k, { clip = 'idle', t = 0, time = 0, seed = 0, speed = 1 }) {
    const T = time + seed;
    // Flying: slow deep beats, then a glide.
    const beat = Math.sin(T * 7 * Math.max(0.6, speed));
    const glide = Math.sin(T * 0.9) > 0.5 ? 0.25 : 1;
    for (const m of [1, -1]) {
      const S = side(m);
      k.turn(`arm${S}`, 0, 0, m * 0.6 * beat * glide);
      k.turn(`fore${S}`, 0, 0, m * 0.3 * Math.sin(T * 7 - 0.6) * glide);
      k.turn(`hand${S}`, 0, 0, m * 0.25 * Math.sin(T * 7 - 1.1) * glide);
    }
    k.move('body', 0, -beat * 0.01 * glide, 0);
    k.turn('head', Math.sin(T * 1.4) * 0.15, Math.sin(T * 0.8) * 0.4, 0);
    k.turn('tail', Math.sin(T * 2) * 0.1, 0, 0);
    if (clip === 'attack') k.turn('body', 0.5 * Math.sin(Math.min(1, t / 0.5) * Math.PI), 0, 0);
  },
};

