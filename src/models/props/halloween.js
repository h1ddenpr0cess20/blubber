import { fbm, noise, rgb } from '../sdf.js';
import { coat, grainy, grime, mix } from '../skins.js';

/**
 * October's scenery: hay bales, dead trees, a scarecrow, gravestones and
 * stone crosses, an obelisk, coffins, heaps of bones, glowing toadstools
 * and the witch's cauldron. All still, all sitting on y = 0. Seen from
 * well up and some way off, so each is a clear shape first.
 */

const one = [['root', null, [0, 0, 0]]];

// ———————————————————————————————— surfaces

const strawBase = rgb('#d8b862'), strawDark = rgb('#9a7a38');
/** Straw: streaks along `axis`, gold and brown. */
export const straw = (axis = 0) => (p) => {
  const q = [p[0] * 90, p[1] * 90, p[2] * 90];
  q[axis] *= 0.08;
  const v = noise(q[0], q[1], q[2]);
  return mix(strawDark, strawBase, 0.35 + v * 0.65);
};
const twine = grainy('#6a4a2a', 0.2, 120);
const bark = (p, n) => {
  const c = grainy('#4a3c34', 0.2, 30)(p);
  // Furrows running up the trunk.
  const f = 0.75 + 0.35 * Math.abs(Math.sin(Math.atan2(p[0], p[2]) * 9 + p[1] * 3 + fbm(p[0] * 6, p[1] * 2, p[2] * 6, 2) * 4));
  return c.map((v) => v * f * (0.8 + 0.2 * Math.max(0, n[1])));
};
const stone = (hex = '#9a978e') => (p, n) => {
  const c = grime(grainy(hex, 0.16, 26), 0, 0.5, 0.72)(p, n);
  // Moss where it faces up and in the lower cracks.
  const moss = Math.max(0, fbm(p[0] * 9, p[1] * 9, p[2] * 9, 3) - 0.48) * 2.2 * (0.4 + 0.6 * Math.max(0, n[1]) + Math.max(0, 0.15 - p[1]) * 3);
  return mix(c, rgb('#5a7a3a'), Math.min(0.75, moss));
};
const wood = (hex = '#6a4a32') => (p) => {
  const g = grainy(hex, 0.14, 40)(p);
  const ring = 0.85 + 0.2 * Math.sin(p[1] * 40 + noise(p[0] * 20, p[1] * 3, p[2] * 20) * 6);
  return g.map((v) => v * ring);
};
const bone = (p, n) => mix(grainy('#e8dcc0', 0.1, 70)(p), rgb('#8a7a5a'), Math.max(0, -n[1]) * 0.4);

// ———————————————————————————————— the pieces

export const haybale = {
  name: 'haybale',
  cell: 0.013,
  bones: one,
  decor: 0.7,
  materials: { straw: { roughness: 0.95, sheen: 0.6, sheenColor: '#ffe0a0', sheenRoughness: 0.6 }, twine: { roughness: 0.9 } },
  sculpt(s) {
    // A rectangular bale, its edges softened and shaggy, two bands of twine round it.
    s.box([0, 0.21, 0], [0.34, 0.21, 0.22], 0.06, { color: straw(0), mat: 'straw', k: 0, bump: [0.008, 40] });
    for (const x of [-0.16, 0.16]) s.box([x, 0.21, 0], [0.012, 0.215, 0.225], 0.01, { color: twine, mat: 'twine', k: 0.006 });
    // A few loose stalks sticking out.
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4, y = 0.05 + (i % 5) * 0.08, sx = i % 2 ? 1 : -1;
      s.limb([sx * 0.33, y, Math.sin(a) * 0.18], [sx * 0.4, y + 0.03 * Math.cos(a), Math.sin(a) * 0.2], 0.006, 0.003, { color: straw(0), mat: 'straw', k: 0.004 });
    }
  },
};

/** A dead tree: a gnarled trunk splitting into crooked bare limbs and twigs. */
export const deadtree = {
  name: 'deadtree',
  cell: 0.02,
  cells: { twigs: 0.012 },
  bones: one,
  decor: 0.8,
  materials: { bark: { roughness: 0.9 } },
  sculpt(s) {
    const B = { color: bark, mat: 'bark' };
    // Roots splaying into the ground.
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.3;
      s.limb([0, 0.12, 0], [Math.sin(a) * 0.32, -0.02, Math.cos(a) * 0.32], 0.07, 0.03, { ...B, k: 0.06 });
    }
    s.chain([[0, 0, 0], [0.03, 0.45, 0.02], [-0.04, 0.85, 0.05], [0.02, 1.15, 0.0]], [0.13, 0.1, 0.075, 0.055], { ...B, k: 0.05 });
    // Limbs: each a crooked chain, forking.
    const limbs = [
      [[-0.04, 0.85, 0.05], [-0.3, 1.05, 0.1], [-0.45, 1.32, 0.05], [-0.62, 1.4, 0.12]],
      [[0.02, 1.15, 0.0], [0.25, 1.35, -0.05], [0.33, 1.6, -0.12], [0.5, 1.72, -0.08]],
      [[0.03, 0.6, 0.02], [0.3, 0.75, 0.12], [0.5, 0.82, 0.28]],
      [[0.02, 1.15, 0.0], [-0.05, 1.45, 0.08], [0.05, 1.7, 0.12]],
      [[-0.02, 0.95, 0.04], [-0.1, 1.1, -0.25], [-0.05, 1.3, -0.4]],
    ];
    for (const pts of limbs) s.chain(pts, pts.map((_, i) => 0.05 * Math.pow(0.62, i) + 0.012), { ...B, k: 0.03 });
    s.part('twigs', () => {
      for (const pts of limbs) {
        const end = pts[pts.length - 1], before = pts[pts.length - 2];
        const d = [end[0] - before[0], end[1] - before[1], end[2] - before[2]];
        for (const [u, v] of [[0.5, 0.6], [-0.4, 0.5]]) {
          s.limb(end, [end[0] + d[0] * 0.6 + u * 0.12, end[1] + d[1] * 0.4 + 0.1, end[2] + d[2] * 0.6 + v * 0.1], 0.012, 0.004, { ...B, k: 0.01 });
        }
      }
    });
  },
};

const sack = coat({ over: '#c8b48a', under: '#a8946a', vary: 0.2, freq: 18, grain: 0.15, gfreq: 140 });
const plaid = (p) => {
  const a = Math.sin(p[0] * 60) > 0.6, b = Math.sin(p[1] * 60) > 0.6;
  return a && b ? rgb('#3a1a14') : a || b ? rgb('#8a2a1a') : rgb('#c8442a');
};
const denim = grainy('#3a4a6a', 0.2, 50);
const hat = grainy('#5a4a3a', 0.2, 40);

export const scarecrow = {
  name: 'scarecrow',
  cell: 0.012,
  cells: { face: 0.006 },
  bones: one,
  decor: 0.8,
  materials: { cloth: { roughness: 0.9, sheen: 0.4, sheenColor: '#d0b080' }, straw: { roughness: 0.95 }, wood: { roughness: 0.85 }, dark: { roughness: 0.7 } },
  sculpt(s) {
    const W = { color: wood('#6a5038'), mat: 'wood' };
    s.limb([0, 0, 0], [0, 1.45, 0], 0.035, 0.03, { ...W, k: 0 });
    s.limb([-0.5, 1.08, 0], [0.5, 1.08, 0], 0.028, 0.028, { ...W, k: 0.01 });
    // A plaid shirt on the crossbar, stuffed, straw out of the cuffs.
    s.ellipsoid([0, 0.92, 0], [0.17, 0.22, 0.11], { color: plaid, mat: 'cloth', k: 0.04 });
    s.limb([-0.12, 1.06, 0], [-0.42, 1.06, 0.02], 0.065, 0.05, { color: plaid, mat: 'cloth', k: 0.04 });
    s.limb([0.12, 1.06, 0], [0.42, 1.06, 0.02], 0.065, 0.05, { color: plaid, mat: 'cloth', k: 0.04 });
    for (const m of [1, -1]) for (let i = 0; i < 4; i++) {
      const a = i * 1.6;
      s.limb([m * 0.44, 1.06, 0], [m * 0.53, 1.06 + Math.sin(a) * 0.06, Math.cos(a) * 0.06], 0.012, 0.004, { color: straw(0), mat: 'straw', k: 0.006 });
    }
    // Patched dungarees, legs dangling.
    s.ellipsoid([0, 0.7, 0], [0.15, 0.1, 0.1], { color: denim, mat: 'cloth', k: 0.04 });
    for (const m of [1, -1]) s.limb([m * 0.07, 0.68, 0], [m * 0.09, 0.42, 0.03], 0.055, 0.045, { color: denim, mat: 'cloth', k: 0.03 });
    for (const m of [1, -1]) for (let i = 0; i < 3; i++) s.limb([m * 0.09, 0.42, 0.03], [m * 0.09 + (i - 1) * 0.03, 0.34, 0.05], 0.012, 0.004, { color: straw(1), mat: 'straw', k: 0.006 });
    // A sack head, tied at the neck, with a stitched face and a pointed straw hat.
    s.sphere([0, 1.3, 0], 0.13, { color: sack, mat: 'cloth', k: 0.03 });
    s.limb([0, 1.17, 0], [0, 1.2, 0], 0.05, 0.06, { color: sack, mat: 'cloth', k: 0.02 });
    s.part('face', () => {
      for (const m of [1, -1]) {
        s.limb([m * 0.065, 1.32, 0.115], [m * 0.025, 1.36, 0.12], 0.008, 0.008, { color: '#1a120c', mat: 'dark', k: 0 });
        s.limb([m * 0.065, 1.36, 0.115], [m * 0.025, 1.32, 0.12], 0.008, 0.008, { color: '#1a120c', mat: 'dark', k: 0 });
      }
      s.chain([[-0.07, 1.25, 0.11], [-0.03, 1.235, 0.124], [0.03, 1.235, 0.124], [0.07, 1.25, 0.11]], [0.007, 0.007, 0.007, 0.007], { color: '#1a120c', mat: 'dark', k: 0 });
    });
    s.cylinder([0, 1.42, 0], 0.2, 0.012, { color: hat, mat: 'straw', k: 0.01 });
    s.cone([0, 1.66, 0], 0.13, 0.26, { color: hat, mat: 'straw', k: 0.02, rot: [0.08, 0, 0.1] });
  },
};

export const tombstone = {
  name: 'tombstone',
  cell: 0.012,
  bones: one,
  decor: 0.8,
  materials: { stone: { roughness: 0.88 } },
  sculpt(s) {
    const S = { color: stone(), mat: 'stone' };
    // A slab with a rounded top, leaning a little, a carved cross, chipped at one shoulder; a mound of earth in front.
    s.box([0, 0.24, 0], [0.19, 0.24, 0.05], 0.015, { ...S, k: 0, rot: [-0.06, 0, 0.04] });
    s.cylinder([0, 0.48, 0], 0.19, 0.05, { ...S, k: 0.02, rot: [Math.PI / 2 - 0.06, 0, 0.04] });
    s.box([0, 0.36, 0.06], [0.014, 0.1, 0.03], 0.004, { op: 'sub', k: 0.004, rot: [-0.06, 0, 0.04] });
    s.box([0, 0.39, 0.06], [0.06, 0.014, 0.03], 0.004, { op: 'sub', k: 0.004, rot: [-0.06, 0, 0.04] });
    s.sphere([0.17, 0.6, 0.03], 0.06, { op: 'sub', k: 0.02 });
  },
};

export const cross = {
  name: 'cross',
  cell: 0.012,
  bones: one,
  decor: 0.8,
  materials: { stone: { roughness: 0.88 } },
  sculpt(s) {
    const S = { color: stone('#a8a49a'), mat: 'stone' };
    s.box([0, 0.06, 0], [0.13, 0.06, 0.1], 0.015, { ...S, k: 0 });
    s.box([0, 0.38, 0], [0.04, 0.3, 0.035], 0.01, { ...S, k: 0.01 });
    s.box([0, 0.52, 0], [0.16, 0.04, 0.035], 0.01, { ...S, k: 0.01 });
  },
};

export const obelisk = {
  name: 'obelisk',
  cell: 0.016,
  bones: one,
  decor: 1,
  materials: { stone: { roughness: 0.8, clearcoat: 0.1 } },
  sculpt(s) {
    const S = { color: stone('#8e8a84'), mat: 'stone' };
    s.box([0, 0.12, 0], [0.42, 0.12, 0.42], 0.02, { ...S, k: 0 });
    s.box([0, 0.3, 0], [0.32, 0.06, 0.32], 0.02, { ...S, k: 0.01 });
    s.limb([0, 0.36, 0], [0, 1.9, 0], 0.17, 0.11, { ...S, k: 0.02 });
    s.box([0, 1.1, 0], [0.19, 0.8, 0.19], 0.01, { op: 'inter', k: 0.01 });
    s.cone([0, 2.08, 0], 0.15, 0.2, { ...S, k: 0.01 });
  },
};

export const coffin = {
  name: 'coffin',
  cell: 0.012,
  bones: one,
  decor: 0.8,
  materials: { wood: { roughness: 0.6, clearcoat: 0.3 }, brass: { roughness: 0.3, metalness: 0.8 } },
  sculpt(s) {
    // The six-sided shape: wide at the shoulders, narrow at head and foot; a lid a little ajar.
    const W = { color: wood('#5a3424'), mat: 'wood' };
    const outline = [[0, -0.48], [0.15, -0.3], [0.2, 0.28], [0.12, 0.5], [-0.12, 0.5], [-0.2, 0.28], [-0.15, -0.3]];
    const prism = (y0, y1, grow, opts) => {
      for (let i = 1; i < outline.length - 1; i++) {
        const a = outline[0], b = outline[i], c = outline[i + 1];
        const P = (q, y) => [q[0] * grow, y, q[1] * grow];
        s.panel(P(a, (y0 + y1) / 2), P(b, (y0 + y1) / 2), P(c, (y0 + y1) / 2), y1 - y0, opts);
      }
    };
    prism(0, 0.22, 1, { ...W, k: 0.01 });
    prism(0.23, 0.29, 1.05, { ...W, k: 0.01 });
    s.part('brass', () => {
      s.box([0, 0.3, 0.12], [0.012, 0.004, 0.09], 0.003, { color: '#c8a050', mat: 'brass', k: 0 });
      s.box([0, 0.3, 0.06], [0.05, 0.004, 0.012], 0.003, { color: '#c8a050', mat: 'brass', k: 0 });
    });
  },
};

export const bones = {
  name: 'bones',
  cell: 0.009,
  bones: one,
  decor: 0.7,
  materials: { bone: { roughness: 0.6 }, dark: { roughness: 0.8 } },
  sculpt(s) {
    const B = { color: bone, mat: 'bone' };
    // A skull on a heap of long bones.
    const long = (a, b) => {
      s.limb(a, b, 0.016, 0.016, { ...B, k: 0.01 });
      for (const e of [a, b]) for (const m of [1, -1]) s.sphere([e[0] + m * 0.012, e[1], e[2] + m * 0.008], 0.018, { ...B, k: 0.01 });
    };
    long([-0.2, 0.03, -0.05], [0.18, 0.03, 0.08]);
    long([-0.15, 0.06, 0.12], [0.16, 0.05, -0.1]);
    long([-0.05, 0.08, -0.18], [0.1, 0.07, 0.17]);
    s.sphere([0.02, 0.16, 0.02], 0.085, { ...B, k: 0.02 });
    s.ellipsoid([0.02, 0.11, 0.07], [0.055, 0.04, 0.05], { ...B, k: 0.03 });
    for (const m of [1, -1]) s.sphere([0.02 + m * 0.033, 0.165, 0.085], 0.024, { op: 'sub', k: 0.01 });
    s.paint((p) => Math.min(...[1, -1].map((m) => Math.hypot(p[0] - 0.02 - m * 0.033, p[1] - 0.165, p[2] - 0.08) - 0.03)), '#1a1410', 0.01);
    s.box([0, -0.05, 0], [0.4, 0.05, 0.4], 0, { op: 'sub', k: 0.005 });
  },
};

export const mushrooms = {
  name: 'mushrooms',
  cell: 0.012,
  bones: one,
  decor: 0.8,
  materials: { stalk: { roughness: 0.7, sheen: 0.4, sheenColor: '#ffffff' }, cap: { roughness: 0.35, clearcoat: 0.6, emissive: '#5aff9a', emissiveIntensity: 0.9 } },
  sculpt(s) {
    // Toadstools that glow, big and small, leaning out of a mossy clump.
    const caps = [[0, 0.32, 0, 0.16], [0.18, 0.2, 0.08, 0.1], [-0.15, 0.24, 0.1, 0.11], [0.05, 0.13, -0.16, 0.08], [-0.08, 0.1, -0.08, 0.06]];
    const spotted = (p) => (noise(p[0] * 45, p[1] * 45, p[2] * 45) > 0.68 ? rgb('#f0fff4') : rgb('#4ae08a'));
    s.ellipsoid([0, 0.01, 0], [0.26, 0.04, 0.24], { color: rgb('#3a5a2a'), mat: 'stalk', k: 0.02 });
    for (const [x, y, z, r] of caps) {
      s.limb([x * 0.6, 0, z * 0.6], [x, y, z], r * 0.28, r * 0.22, { color: '#e8e4d0', mat: 'stalk', k: 0.03 });
      s.ellipsoid([x, y + r * 0.15, z], [r, r * 0.55, r], { color: spotted, mat: 'cap', k: 0.01 });
      s.ellipsoid([x, y - r * 0.1, z], [r * 0.9, r * 0.3, r * 0.9], { op: 'sub', k: 0.01 });
    }
  },
};

export const cauldron = {
  name: 'cauldron',
  cell: 0.019,
  cells: { brew: 0.014, fire: 0.013 },
  bones: one,
  decor: 0.8,
  materials: { iron: { roughness: 0.45, metalness: 0.7 }, brew: { roughness: 0.2, emissive: '#6aff3a', emissiveIntensity: 2.2 }, wood: { roughness: 0.9 }, fire: { roughness: 0.5, emissive: '#ff7a1a', emissiveIntensity: 2.5 } },
  sculpt(s) {
    const I = { color: grainy('#2e2c30', 0.15, 30), mat: 'iron' };
    // A round-bellied pot on three stubby legs, a thick rim, brew bubbling over the top.
    s.sphere([0, 0.5, 0], 0.42, { ...I, k: 0 });
    s.box([0, 1.05, 0], [0.6, 0.3, 0.6], 0, { op: 'sub', k: 0.04 });
    s.sphere([0, 0.62, 0], 0.36, { op: 'sub', k: 0.02 });
    s.torus([0, 0.75, 0], 0.36, 0.05, { ...I, k: 0.03 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      s.limb([Math.sin(a) * 0.26, 0.22, Math.cos(a) * 0.26], [Math.sin(a) * 0.34, 0, Math.cos(a) * 0.34], 0.05, 0.04, { ...I, k: 0.04 });
    }
    s.part('brew', () => {
      s.cylinder([0, 0.66, 0], 0.355, 0.02, { color: '#7aff4a', mat: 'brew', k: 0 });
      for (const [x, z, r] of [[0.1, 0.05, 0.06], [-0.12, -0.08, 0.045], [0.02, -0.15, 0.035], [-0.05, 0.14, 0.05]]) s.sphere([x, 0.68, z], r, { color: '#b8ff8a', mat: 'brew', k: 0.02 });
      // A drip over the rim.
      s.limb([0.3, 0.76, 0.12], [0.36, 0.6, 0.14], 0.03, 0.02, { color: '#7aff4a', mat: 'brew', k: 0.02 });
    });
    s.part('fire', () => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        s.limb([Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3], [-Math.sin(a) * 0.05, 0.08, -Math.cos(a) * 0.05], 0.045, 0.04, { color: wood('#4a3020'), mat: 'wood', k: 0.01 });
      }
      for (const [x, z] of [[0.05, 0.05], [-0.06, 0.02], [0, -0.06]]) s.cone([x, 0.26, z], 0.07, 0.17, { color: '#ffb040', mat: 'fire', k: 0.02 });
    });
  },
};
