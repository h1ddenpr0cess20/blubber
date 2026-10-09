import { noise, rgb } from '../sdf.js';
import { grainy, mix } from '../skins.js';

/**
 * December's: the snow lantern — a cone of snowballs heaped in rings with a
 * candle inside, glowing out between them (`snowlantern`; unlit,
 * `snowheap`) — the big snowball that rolls down the halls, snowy pines,
 * rocks under snow, and clusters of ice crystals. Still, on y = 0, but the
 * snowball, whose middle is its origin.
 */

const one = [['root', null, [0, 0, 0]]];
const SNOW = rgb('#f2f6ff'), SHADE = rgb('#aebfe0');
const snow = (p, n) => {
  const c = mix(SHADE, SNOW, 0.3 + 0.7 * Math.max(0, n[1] * 0.5 + 0.5));
  const g = 0.92 + 0.14 * noise(p[0] * 30, p[1] * 30, p[2] * 30);
  return c.map((v) => v * g * (noise(p[0] * 260, p[1] * 260, p[2] * 260) > 0.86 ? 1.15 : 1));
};
const SNOW_MAT = { roughness: 0.72, sheen: 1, sheenColor: '#ffffff', sheenRoughness: 0.4 };

/** The snowballs of the lantern: rings of them, smaller going up, each ring turned half a ball from the last. */
function heap(s) {
  const rings = [[0.17, 9, 0.055], [0.135, 8, 0.05], [0.1, 7, 0.045], [0.065, 5, 0.04], [0.028, 3, 0.035]];
  let y = 0.05;
  rings.forEach(([R, n, r], j) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + (j % 2) * 0.5) / n) * Math.PI * 2;
      s.sphere([Math.sin(a) * R, y, Math.cos(a) * R], r, { color: snow, mat: 'snow', k: 0.004 });
    }
    y += r * 1.55;
  });
  s.sphere([0, y + 0.01, 0], 0.035, { color: snow, mat: 'snow', k: 0.006 });
}

export const snowlantern = {
  name: 'snowlantern',
  scale: 1.3,
  cell: 0.0095,
  cells: { candle: 0.012 },
  bones: one,
  materials: { snow: SNOW_MAT, candle: { roughness: 0.5, emissive: '#ffb050', emissiveIntensity: 2.6 } },
  sculpt(s) {
    heap(s);
    s.part('candle', () => s.ellipsoid([0, 0.13, 0], [0.11, 0.1, 0.11], { color: '#ffc870', mat: 'candle', k: 0 }));
  },
};

export const snowheap = {
  name: 'snowheap',
  scale: 1.3,
  cell: 0.0095,
  cells: { candle: 0.012 },
  bones: one,
  materials: { snow: SNOW_MAT, candle: { roughness: 0.9 } },
  sculpt(s) {
    heap(s);
    s.part('candle', () => s.ellipsoid([0, 0.13, 0], [0.11, 0.1, 0.11], { color: '#141820', mat: 'candle', k: 0 }));
  },
};

export const snowball = {
  name: 'snowball',
  cell: 0.014,
  bones: one,
  materials: { snow: SNOW_MAT },
  sculpt(s) {
    // Rolled up big: lumpy, with the odd twig and leaf picked up on the way.
    s.sphere([0, 0, 0], 0.4, { color: snow, mat: 'snow', k: 0, bump: [0.012, 9] });
    s.limb([0.2, 0.25, 0.28], [0.28, 0.33, 0.38], 0.008, 0.004, { color: '#4a3424', mat: 'snow', k: 0.004 });
  },
};

const needles = (p, n) => {
  const g = grainy('#1e5a34', 0.2, 40)(p);
  // Snow lying on whatever faces up.
  const lie = Math.max(0, n[1] - 0.82) * 5 + (noise(p[0] * 30, p[1] * 30, p[2] * 30) - 0.62) * 0.8;
  return mix(g, rgb('#eef4ff'), Math.max(0, Math.min(1, lie)));
};

export const pine = {
  name: 'pine',
  cell: 0.03,
  bones: one,
  decor: 0.8,
  materials: { needles: { roughness: 0.8, sheen: 0.6, sheenColor: '#ffffff' }, bark: { roughness: 0.9 } },
  sculpt(s) {
    s.limb([0, 0, 0], [0, 0.4, 0], 0.07, 0.06, { color: grainy('#4a3424', 0.2, 40), mat: 'bark', k: 0 });
    // Tiers of branches, each a drooping cone, snow along their tops.
    const tiers = [[0.35, 0.62, 0.55], [0.75, 0.5, 0.48], [1.12, 0.38, 0.42], [1.45, 0.26, 0.36], [1.72, 0.15, 0.3]];
    for (const [y, r, h] of tiers) {
      s.cone([0, y + h, 0], r, h, { color: needles, mat: 'needles', k: 0.03, bump: [0.012, 14] });
      s.ellipsoid([0, y + 0.02, 0], [r * 0.85, 0.06, r * 0.85], { op: 'sub', k: 0.04 });
    }
  },
};

export const snowrock = {
  name: 'snowrock',
  cell: 0.015,
  bones: one,
  decor: 0.8,
  materials: { stone: { roughness: 0.85 } },
  sculpt(s) {
    const rock = (p, n) => mix(grainy('#5a5e66', 0.2, 20)(p), rgb('#eef4ff'), Math.max(0, Math.min(1, (n[1] - 0.45) * 3)));
    s.ellipsoid([0, 0.12, 0], [0.32, 0.2, 0.26], { color: rock, mat: 'stone', k: 0, bump: [0.03, 6], rot: [0.1, 0.4, 0.05] });
    s.ellipsoid([0.25, 0.08, 0.12], [0.16, 0.12, 0.14], { color: rock, mat: 'stone', k: 0.04, bump: [0.02, 8] });
    s.box([0, -0.1, 0], [0.6, 0.1, 0.6], 0, { op: 'sub', k: 0.02 });
  },
};

export const crystals = {
  name: 'crystals',
  cell: 0.01,
  bones: one,
  decor: 0.8,
  materials: { crystal: { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#5ac8ff', emissiveIntensity: 0.6, opacity: 0.85 } },
  sculpt(s) {
    // Six-sided prisms of ice, leaning out of a heap, each sharpened to a point.
    const ice = (p) => mix(rgb('#9ad8ff'), rgb('#f0fbff'), Math.min(1, p[1] * 1.6));
    const shards = [[0, 0, 0, 0.52, 0.07], [0.12, 0.06, 0.4, 0.36, 0.05], [-0.1, -0.08, -0.5, 0.42, 0.055], [0.05, -0.14, 0.9, 0.28, 0.045], [-0.13, 0.1, -1.1, 0.3, 0.04]];
    for (const [x, z, a, len, r] of shards) {
      const lean = 0.35;
      const tip = [x + Math.sin(a) * lean * len, len, z + Math.cos(a) * lean * len];
      s.limb([x, 0, z], [x + (tip[0] - x) * 0.82, len * 0.82, z + (tip[2] - z) * 0.82], r, r * 0.92, { color: ice, mat: 'crystal', k: 0.01 });
      s.limb([x + (tip[0] - x) * 0.82, len * 0.82, z + (tip[2] - z) * 0.82], tip, r * 0.92, 0.004, { color: ice, mat: 'crystal', k: 0.004 });
    }
    s.ellipsoid([0, 0, 0], [0.2, 0.05, 0.18], { color: '#dceeff', mat: 'crystal', k: 0.03 });
  },
};
