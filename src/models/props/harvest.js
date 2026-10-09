import { noise, rgb } from '../sdf.js';
import { grainy, mix } from '../skins.js';
import { straw } from './halloween.js';
import { rind, sculptPumpkin } from './pumpkin.js';

/**
 * November's: the harvest lantern — a white pumpkin with rings of holes
 * punched through it and a candle inside (`gourd`; dark, `whitepumpkin`)
 * — corn shocks, barrels, a haystack with a pitchfork in it, and the
 * feast table. Still, sitting on y = 0.
 */

const one = [['root', null, [0, 0, 0]]];
const CREAM = rgb('#f2ead2'), CREAM_DEEP = rgb('#bcb08a'), CREAM_PALE = rgb('#fffaf0');
const cream = rind(0.22, CREAM, CREAM_DEEP, CREAM_PALE);
const PUMPKIN_MATS = {
  rind: { roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: '#fff4d8', sheenRoughness: 0.6 },
  stalk: { roughness: 0.85 },
};

export const whitepumpkin = {
  name: 'whitepumpkin',
  cell: 0.0105,
  cells: { stalk: 0.0055 },
  bones: one,
  materials: PUMPKIN_MATS,
  sculpt(s) { sculptPumpkin(s, { r: 0.22, h: 0.28, colour: cream }); },
};

export const gourd = {
  name: 'gourd',
  cell: 0.0075,
  cells: { stalk: 0.0055, candle: 0.014 },
  bones: one,
  materials: { ...PUMPKIN_MATS, candle: { roughness: 0.5, emissive: '#ffa53a', emissiveIntensity: 2.2 } },
  sculpt(s) {
    const r = 0.22, h = 0.28;
    sculptPumpkin(s, { r, h, colour: cream });
    s.ellipsoid([0, h / 2 + 0.005, 0], [r * 0.82, h * 0.4, r * 0.82], { op: 'sub', k: 0.02 });
    // Holes punched right round it, in two rings and a ring of smaller ones above.
    for (const [y, n, rad, off] of [[0.1, 12, 0.026, 0], [0.18, 12, 0.022, 0.26], [0.235, 8, 0.016, 0]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + off;
        const d = [Math.sin(a), 0, Math.cos(a)];
        s.limb([d[0] * r * 0.6, y, d[2] * r * 0.6], [d[0] * r * 1.3, y, d[2] * r * 1.3], rad, rad, { op: 'sub', k: 0.004 });
      }
    }
    s.paint((p) => Math.hypot(p[0] / (r * 0.86), (p[1] - h / 2) / (h * 0.44), p[2] / (r * 0.86)) - 1, rgb('#ffc860'), 0.012);
    s.part('candle', () => s.ellipsoid([0, h * 0.47, 0], [r * 0.7, h * 0.32, r * 0.7], { color: '#ffc860', mat: 'candle', k: 0 }));
  },
};

const stalkColour = (p) => mix(rgb('#b08a3a'), rgb('#ead27a'), noise(p[0] * 40, p[1] * 6, p[2] * 40));

export const cornshock = {
  name: 'cornshock',
  cell: 0.014,
  bones: one,
  decor: 0.8,
  materials: { stalk: { roughness: 0.9, sheen: 0.5, sheenColor: '#fff0c0' }, twine: { roughness: 0.9 } },
  sculpt(s) {
    // Stalks gathered into a bundle, tied, flaring out at the foot and the top, leaves hanging off.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r0 = 0.2 + (i % 3) * 0.03;
      const foot = [Math.sin(a) * r0, 0, Math.cos(a) * r0];
      const waist = [Math.sin(a) * 0.07, 0.55, Math.cos(a) * 0.07];
      const top = [Math.sin(a + 0.4) * (0.16 + (i % 4) * 0.03), 1.05 + (i % 3) * 0.1, Math.cos(a + 0.4) * (0.16 + (i % 4) * 0.03)];
      s.chain([foot, waist, top], [0.022, 0.02, 0.01], { color: stalkColour, mat: 'stalk', k: 0.03 });
      if (i % 2) s.flake(waist, [Math.sin(a) * 0.3, 0.35 + (i % 3) * 0.12, Math.cos(a) * 0.3], [0, 1, 0], 0.02, 0.04, 0.4, { color: stalkColour, mat: 'stalk', k: 0.01 });
    }
    s.torus([0, 0.55, 0], 0.085, 0.018, { color: '#7a5a3a', mat: 'twine', k: 0.01 });
  },
};

export const barrel = {
  name: 'barrel',
  cell: 0.011,
  bones: one,
  decor: 0.8,
  materials: { wood: { roughness: 0.7 }, iron: { roughness: 0.45, metalness: 0.7 } },
  sculpt(s) {
    // Staves round a bellied middle, lines between them, iron hoops.
    const staves = (p) => {
      const a = Math.atan2(p[0], p[2]);
      const g = grainy('#8a5a34', 0.15, 30)(p);
      return g.map((v) => v * (Math.abs(Math.sin(a * 9)) < 0.08 ? 0.45 : 0.9 + 0.2 * noise(a * 9, p[1] * 3, 0)));
    };
    s.ellipsoid([0, 0.27, 0], [0.22, 0.4, 0.22], { color: staves, mat: 'wood', k: 0 });
    s.box([0, 0.27, 0], [0.3, 0.27, 0.3], 0, { op: 'inter', k: 0.01 });
    s.cylinder([0, 0.55, 0], 0.16, 0.03, { op: 'sub', k: 0.01 });
    for (const y of [0.06, 0.18, 0.36, 0.49]) {
      const r = 0.22 * Math.sqrt(1 - ((y - 0.27) / 0.4) ** 2) + 0.004;
      s.torus([0, y, 0], r, 0.009, { color: grainy('#3a3a3e', 0.2, 40), mat: 'iron', k: 0.003 });
    }
  },
};

export const haystack = {
  name: 'haystack',
  cell: 0.02,
  cells: { fork: 0.008 },
  bones: one,
  decor: 0.8,
  materials: { straw: { roughness: 0.95, sheen: 0.6, sheenColor: '#ffe0a0' }, wood: { roughness: 0.8 }, iron: { roughness: 0.4, metalness: 0.7 } },
  sculpt(s) {
    s.ellipsoid([0, 0.35, 0], [0.75, 0.75, 0.75], { color: straw(1), mat: 'straw', k: 0, bump: [0.025, 7] });
    s.box([0, -0.5, 0], [1, 0.5, 1], 0, { op: 'sub', k: 0.08 });
    s.part('fork', () => {
      const a = [0.25, 0.95, 0.25], b = [0.6, 1.9, 0.5];
      s.limb(a, b, 0.018, 0.016, { color: grainy('#8a6a42', 0.15, 40), mat: 'wood', k: 0 });
      for (const off of [-0.05, 0, 0.05]) s.limb([a[0] + off, a[1] + 0.02, a[2] - off], [a[0] + off * 1.2 - 0.06, a[1] - 0.28, a[2] - off * 1.2 - 0.05], 0.007, 0.004, { color: '#5a5a60', mat: 'iron', k: 0.004 });
    });
  },
};

const cloth = (p) => (Math.sin(p[0] * 30) > 0.85 || Math.sin(p[2] * 30) > 0.85 ? rgb('#b84a2a') : rgb('#f0e4cc'));
const crust = grainy('#d8a050', 0.2, 60);

export const table = {
  name: 'table',
  cell: 0.016,
  cells: { food: 0.01 },
  bones: one,
  decor: 0.8,
  materials: { wood: { roughness: 0.6, clearcoat: 0.3 }, cloth: { roughness: 0.85 }, food: { roughness: 0.5, clearcoat: 0.4 }, glow: { roughness: 0.4, emissive: '#ffb050', emissiveIntensity: 3 } },
  sculpt(s) {
    // A long trestle table with a cloth on it, a horn of plenty spilling squash and apples, pies, and candles.
    const W = { color: grainy('#6a4228', 0.15, 30), mat: 'wood' };
    s.box([0, 0.48, 0], [1.1, 0.03, 0.42], 0.01, { ...W, k: 0 });
    for (const x of [-0.95, 0.95]) for (const z of [-0.33, 0.33]) s.box([x, 0.24, z], [0.035, 0.24, 0.035], 0.008, { ...W, k: 0.01 });
    s.box([0, 0.5, 0], [1.0, 0.012, 0.44], 0.006, { color: cloth, mat: 'cloth', k: 0.004 });
    s.part('food', () => {
      // The horn: a curling cone, open toward the front.
      const horn = (p) => mix(rgb('#a87838'), rgb('#e0b060'), 0.5 + 0.5 * Math.sin((p[0] + p[1]) * 90));
      s.chain([[-0.35, 0.62, -0.05], [-0.2, 0.6, 0.0], [-0.05, 0.6, 0.04], [0.05, 0.62, 0.06]], [0.015, 0.05, 0.09, 0.12], { color: horn, mat: 'food', k: 0.03 });
      s.sphere([0.12, 0.62, 0.07], 0.1, { op: 'sub', k: 0.02 });
      for (const [x, z, r, c] of [[0.14, 0.12, 0.06, '#e07a20'], [0.22, 0.02, 0.05, '#c81a20'], [0.16, -0.08, 0.05, '#e8c040'], [0.27, 0.13, 0.045, '#5a2a6a'], [0.1, 0.2, 0.04, '#c81a20']]) {
        s.sphere([x, 0.55 + r, z], r, { color: c, mat: 'food', k: 0.005 });
      }
      for (const x of [-0.75, 0.6]) {
        s.cylinder([x, 0.53, 0.1], 0.13, 0.025, { color: crust, mat: 'food', k: 0, round: 0.015 });
        s.paint((p) => Math.hypot(p[0] - x, p[2] - 0.1) - 0.1 + Math.max(0, 0.53 - p[1]) * 10, rgb('#b8562a'), 0.01);
      }
      for (const x of [-0.45, 0.85]) {
        s.limb([x, 0.51, -0.25], [x, 0.7, -0.25], 0.02, 0.02, { color: '#f0e8d8', mat: 'food', k: 0 });
        s.sphere([x, 0.73, -0.25], 0.02, { color: '#ffd080', mat: 'glow', k: 0 });
      }
    });
  },
};
