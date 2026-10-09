import { noise, rgb } from '../sdf.js';
import { mix } from '../skins.js';

/**
 * The sweets, from October to December. Small: they lie on the trails a
 * hand's width across, and the treats twice that. Each sits on y = 0.
 *
 * `sweet` is a twist-wrapped bonbon, its wrapper tinted per sweet (the
 * game hands each its colour); `candycorn` the three-banded kernel;
 * `lollipop` a swirled disc on a stick; `caramelapple` an apple dipped in
 * caramel on a stick; `peppermint` a red-and-white swirl; `gumdrop` a
 * sugared dome; `candycane` the striped crook.
 */

const WRAP = rgb('#ffffff');
const wrapper = (p) => {
  // Foil, crinkled, with a pale stripe round it.
  const crinkle = 0.85 + 0.3 * noise(p[0] * 160, p[1] * 160, p[2] * 160);
  const stripe = Math.abs(Math.sin(p[0] * 60)) > 0.92 ? 1.15 : 1;
  return WRAP.map((v) => v * crinkle * stripe);
};

const SUGAR = { roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 };
const one = [['root', null, [0, 0, 0]]];

export const sweet = {
  name: 'sweet',
  cell: 0.0055,
  bones: one,
  materials: {
    wrapper: { roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, tinted: true },
  },
  sculpt(s) {
    const W = { color: wrapper, mat: 'wrapper' };
    s.ellipsoid([0, 0.06, 0], [0.068, 0.05, 0.05], { ...W, k: 0 });
    // Twisted shut at each end, and fanned out past the twist: two fans crossed, their ends crimped.
    for (const m of [1, -1]) {
      s.limb([m * 0.06, 0.06, 0], [m * 0.088, 0.06, 0], 0.02, 0.008, { ...W, k: 0.01 });
      s.flake([m * 0.085, 0.06, 0], [m * 0.135, 0.06, 0], [0, 0, 1], 0.008, 0.036, 0.22, { ...W, k: 0.006 });
      s.flake([m * 0.085, 0.06, 0], [m * 0.13, 0.06, 0], [0, 1, 0], 0.008, 0.03, 0.22, { ...W, k: 0.006 });
      for (const t of [-1, 0, 1]) s.sphere([m * 0.172, 0.06 + t * 0.026, t * 0.022], 0.016, { op: 'sub', k: 0.004 });
    }
  },
};

const cornBands = (p) => {
  const y = p[1];
  return y > 0.105 ? rgb('#fff8e4') : y > 0.055 ? rgb('#ff8a1a') : rgb('#ffcf2a');
};

export const candycorn = {
  name: 'candycorn',
  cell: 0.006,
  bones: one,
  materials: { sugar: { ...SUGAR, roughness: 0.5, sheen: 0.6, sheenColor: '#fff0c0', sheenRoughness: 0.4 } },
  sculpt(s) {
    // A fat wedge: wide and round at the base, tapering to a soft point, a little flattened.
    s.flake([0, 0.012, 0], [0, 0.15, 0], [0, 0, 1], 0.056, 0.014, 0.62, { color: cornBands, mat: 'sugar', k: 0 });
    s.box([0, -0.05, 0], [0.1, 0.05, 0.1], 0, { op: 'sub', k: 0.01 });
  },
};

const swirl = (a, b, c = null, arms = 3) => {
  const A = rgb(a), B = rgb(b), C = c ? rgb(c) : null;
  return (p) => {
    const ang = Math.atan2(p[1] - 0.29, p[0]);
    const r = Math.hypot(p[0], p[1] - 0.29);
    const t = (Math.sin(ang * arms + r * 70) + 1) / 2;
    const col = mix(A, B, t > 0.5 ? 1 : 0);
    return C && t > 0.47 && t < 0.53 ? C : col;
  };
};
const stick = (p) => mix(rgb('#f4eee4'), rgb('#d8cfc0'), noise(p[0] * 200, p[1] * 40, p[2] * 200) * 0.6);

export const lollipop = {
  name: 'lollipop',
  cell: 0.0062,
  cells: { stick: 0.005 },
  bones: one,
  materials: { candy: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, stick: { roughness: 0.8 } },
  sculpt(s) {
    s.cylinder([0, 0.29, 0], 0.115, 0.02, { color: swirl('#ff4a9a', '#ffe0f0', '#9a5aff', 4), mat: 'candy', k: 0, round: 0.016, rot: [Math.PI / 2, 0, 0] });
    s.part('stick', () => s.limb([0, 0.0, 0], [0, 0.2, 0], 0.011, 0.011, { color: stick, mat: 'stick', k: 0 }));
  },
};

export const caramelapple = {
  name: 'caramelapple',
  cell: 0.0062,
  cells: { stick: 0.005 },
  bones: one,
  materials: { caramel: { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }, apple: { roughness: 0.35, clearcoat: 0.6 }, stick: { roughness: 0.85 } },
  sculpt(s) {
    // The apple: round, a dimple top and bottom.
    const apple = (p) => mix(rgb('#b8141c'), rgb('#e83a2a'), noise(p[0] * 30, p[1] * 30, p[2] * 30));
    s.sphere([0, 0.1, 0], 0.095, { color: apple, mat: 'apple', k: 0 });
    s.sphere([0, 0.205, 0], 0.03, { op: 'sub', k: 0.025 });
    s.sphere([0, -0.01, 0], 0.03, { op: 'sub', k: 0.02 });
    // Dipped: caramel over the bottom two thirds, dripping.
    const caramel = (p) => mix(rgb('#a8641c'), rgb('#e8a040'), 0.5 + 0.5 * Math.sin(p[1] * 90));
    s.paint((p) => p[1] - 0.12 - 0.02 * Math.sin(Math.atan2(p[0], p[2]) * 5), caramel, 0.004);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      s.limb([Math.sin(a) * 0.09, 0.115, Math.cos(a) * 0.09], [Math.sin(a) * 0.094, 0.07 - (i % 2) * 0.02, Math.cos(a) * 0.094], 0.012, 0.009, { color: caramel, mat: 'caramel', k: 0.012 });
    }
    s.part('stick', () => s.limb([0, 0.16, 0], [0.01, 0.34, 0], 0.01, 0.009, { color: stick, mat: 'stick', k: 0 }));
  },
};

export const peppermint = {
  name: 'peppermint',
  cell: 0.0055,
  bones: one,
  materials: { candy: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 } },
  sculpt(s) {
    const mint = (p) => {
      const a = Math.atan2(p[1] - 0.075, p[0]);
      return Math.sin(a * 8) > 0 ? rgb('#e8162a') : rgb('#fdfbf6');
    };
    s.cylinder([0, 0.075, 0], 0.07, 0.022, { color: mint, mat: 'candy', k: 0, round: 0.018, rot: [Math.PI / 2, 0, 0] });
  },
};

export const gumdrop = {
  name: 'gumdrop',
  cell: 0.0055,
  bones: one,
  materials: { gum: { roughness: 0.6, sheen: 1, sheenColor: '#ffffff', sheenRoughness: 0.3, transmission: 0, clearcoat: 0.2, tinted: true } },
  sculpt(s) {
    // Sugared: speckled white over the colour.
    const sugar = (p) => (noise(p[0] * 300, p[1] * 300, p[2] * 300) > 0.7 ? [1.2, 1.2, 1.2] : [0.85, 0.85, 0.85]);
    s.limb([0, 0.03, 0], [0, 0.07, 0], 0.055, 0.035, { color: sugar, mat: 'gum', k: 0 });
    s.box([0, -0.05, 0], [0.1, 0.05, 0.1], 0, { op: 'sub', k: 0.012 });
  },
};

export const candycane = {
  name: 'candycane',
  cell: 0.006,
  bones: one,
  materials: { candy: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 } },
  sculpt(s) {
    // Stripes wound round the cane: by height and by the way round it, so they spiral.
    const stripes = (p) => (Math.sin((p[1] + Math.atan2(p[0], p[2]) * 0.012) * 90 + p[0] * 60) > 0.2 ? rgb('#e01a2a') : rgb('#fdfbf6'));
    s.limb([0, 0.01, 0], [0, 0.3, 0], 0.022, 0.022, { color: stripes, mat: 'candy', k: 0 });
    s.torus([0.06, 0.3, 0], 0.06, 0.022, { color: stripes, mat: 'candy', k: 0.004, arc: Math.PI / 2, rot: [Math.PI / 2, 0, Math.PI / 2] });
  },
};

