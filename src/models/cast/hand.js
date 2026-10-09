import { coat, grainy, mix } from '../skins.js';
import { rgb } from '../sdf.js';

/**
 * A hand up out of a grave: a grey-green forearm in a ragged cuff, the
 * hand wide open, grasping at the air and clutching shut. The game pushes
 * it up out of the earth and draws it back down. Its wrist is at y = 0.3;
 * the forearm runs down from there to y = 0.
 */

const skin = coat({ over: '#7aa058', under: '#94b870', vary: 0.25, freq: 16, grain: 0.06 });
const NAIL = rgb('#3a3a2a');
const cuff = grainy('#5a4a7a', 0.2, 40);

const FINGERS = [
  // [x at the knuckle, length, spread]
  [-0.033, 0.075, -0.25],
  [-0.011, 0.088, -0.08],
  [0.011, 0.085, 0.08],
  [0.032, 0.07, 0.24],
];

export default {
  name: 'hand',
  detail: 1,
  cell: 0.0062,
  bones: [
    ['root', null, [0, 0, 0]],
    ['wrist', 'root', [0, 0.3, 0]],
    ...FINGERS.map((f, i) => [`f${i}`, 'wrist', [f[0], 0.36, 0.005]]),
    ['thumb', 'wrist', [-0.04, 0.32, 0.02]],
  ],
  materials: {
    skin: { roughness: 0.6, sheen: 0.3, sheenColor: '#c8e0b0' },
    cloth: { roughness: 0.92 },
  },
  sculpt(s) {
    const K = { color: (p, n) => mix(skin(p, n), NAIL, 0), mat: 'skin' };
    s.limb([0, -0.02, 0], [0, 0.3, 0], 0.036, 0.03, { ...K, bone: 'root', k: 0.02 });
    // The palm, flat and broad.
    s.ellipsoid([0, 0.33, 0], [0.045, 0.04, 0.02], { ...K, bone: 'wrist', k: 0.02 });
    FINGERS.forEach(([x, len, a], i) => {
      const base = [x, 0.36, 0.005];
      const mid = [x + Math.sin(a) * len * 0.5, 0.36 + Math.cos(a) * len * 0.5, 0.012];
      const tip = [x + Math.sin(a) * len, 0.36 + Math.cos(a) * len, 0.02];
      s.limb(base, mid, 0.011, 0.009, { ...K, bone: `f${i}`, k: 0.01 });
      s.limb(mid, tip, 0.009, 0.006, { ...K, bone: `f${i}`, k: 0.006 });
      s.sphere(tip, 0.006, { color: NAIL, mat: 'skin', bone: `f${i}`, k: 0.004 });
    });
    s.limb([-0.04, 0.32, 0.02], [-0.075, 0.37, 0.035], 0.012, 0.008, { ...K, bone: 'thumb', k: 0.01 });
    // A ragged cuff of a sleeve round the forearm.
    s.limb([0, 0.08, 0], [0, 0.18, 0], 0.048, 0.044, { color: cuff, mat: 'cloth', bone: 'root', k: 0.01 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      s.flake([Math.sin(a) * 0.044, 0.18, Math.cos(a) * 0.044], [Math.sin(a) * 0.05, 0.21 + (i % 2) * 0.02, Math.cos(a) * 0.05], [Math.sin(a), 0, Math.cos(a)], 0.016, 0.006, 0.3, { color: cuff, mat: 'cloth', bone: 'root', k: 0.005 });
    }
  },
  animate(k, { t = 0, time = 0, seed = 0 }) {
    // Clutching: the fingers curl in as it comes up (t is how far up, 0 to 1), with a twitch.
    const T = time + seed;
    const curl = 0.2 + 0.9 * Math.max(0, Math.sin(T * 5)) * t;
    FINGERS.forEach((_, i) => k.turn(`f${i}`, curl + Math.sin(T * 9 + i) * 0.1, 0, 0));
    k.turn('thumb', curl * 0.6, 0, -curl * 0.4);
    k.turn('wrist', Math.sin(T * 3) * 0.2, Math.sin(T * 2) * 0.3, 0);
    k.turn('root', 0, Math.sin(T * 1.3) * 0.4, Math.sin(T * 2.1) * 0.15);
  },
};
