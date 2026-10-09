import { fbm, rgb } from '../sdf.js';
import { coat, grainy, mix } from '../skins.js';

/**
 * The zombie: a big, sorry head on a hunched body, arms held out in front
 * the way they are, shuffling with one stiff leg. Grey-green skin, a
 * stitched grin, sunken eyes with a sickly glow, a torn shirt and old
 * trousers. Not frightening — Blubber frightens it: spooked, it throws its
 * arms up and runs. Faces +z, feet on y = 0, about 0.78 tiles tall.
 */

const SKIN = coat({ over: '#6e9a4c', under: '#8cb468', vary: 0.22, freq: 12, grain: 0.06 });
const BRUISE = rgb('#6a7a9a');
const skin = (p, n) => mix(SKIN(p, n), BRUISE, Math.max(0, fbm(p[0] * 9 + 3, p[1] * 9, p[2] * 9, 2) - 0.6) * 1.5);
const SHIRT = grainy('#6a5a9a', 0.18, 40);
const shirt = (p, n) => {
  const c = SHIRT(p, n);
  // Faded on top, grubby toward the hem.
  return c.map((v) => v * (0.75 + 0.35 * Math.max(0, Math.min(1, (p[1] - 0.36) * 4))));
};
const trousers = grainy('#5a4632', 0.2, 50);
const shoe = grainy('#2e2620', 0.15, 60);
const hair = grainy('#2a2a22', 0.2, 80);
const side = (m) => (m > 0 ? 'L' : 'R');

export default {
  name: 'zombie',
  cell: 0.0072,
  cells: { eyes: 0.0026, face: 0.0035 },
  bones: [
    ['root', null, [0, 0, 0]],
    ['hips', 'root', [0, 0.33, 0]],
    ['spine', 'hips', [0, 0.41, 0]],
    ['chest', 'spine', [0, 0.5, 0.0]],
    ['neck', 'chest', [0, 0.58, 0.03]],
    ['head', 'neck', [0, 0.62, 0.04]],
    ['jaw', 'head', [0, 0.645, 0.08]],
    ...[1, -1].flatMap((m) => {
      const S = side(m);
      return [
        [`arm${S}`, 'chest', [m * 0.105, 0.545, 0.01]],
        [`fore${S}`, `arm${S}`, [m * 0.12, 0.53, 0.14]],
        [`hand${S}`, `fore${S}`, [m * 0.11, 0.52, 0.26]],
        [`thigh${S}`, 'hips', [m * 0.055, 0.32, 0]],
        [`shin${S}`, `thigh${S}`, [m * 0.06, 0.18, 0.012]],
        [`foot${S}`, `shin${S}`, [m * 0.06, 0.045, 0]],
      ];
    }),
  ],
  materials: {
    skin: { roughness: 0.62, sheen: 0.35, sheenColor: '#c8e0b0', sheenRoughness: 0.6 },
    cloth: { roughness: 0.92, sheen: 0.4, sheenColor: '#a090c0', sheenRoughness: 0.7 },
    eye: { roughness: 0.25, emissive: '#d8ff6a', emissiveIntensity: 2.4 },
    dark: { roughness: 0.6 },
  },
  sculpt(s) {
    const K = { color: skin, mat: 'skin' };
    const C = { color: shirt, mat: 'cloth' };
    // The head: big, a heavy brow, a long jaw, small ears.
    s.ellipsoid([0, 0.7, 0.04], [0.105, 0.11, 0.1], { ...K, bone: 'head', k: 0.02 });
    s.ellipsoid([0, 0.645, 0.085], [0.075, 0.05, 0.06], { ...K, bone: 'jaw', k: 0.035 });
    s.ellipsoid([0, 0.73, 0.11], [0.085, 0.022, 0.03], { ...K, bone: 'head', k: 0.025 });
    s.ellipsoid([0, 0.685, 0.14], [0.018, 0.026, 0.018], { ...K, bone: 'head', k: 0.012 });
    for (const m of [1, -1]) s.ellipsoid([m * 0.105, 0.69, 0.03], [0.018, 0.03, 0.014], { ...K, bone: 'head', k: 0.012, rot: [0, m * 0.4, 0] });
    // Sunken sockets, dark round the eyes.
    for (const m of [1, -1]) s.ellipsoid([m * 0.04, 0.705, 0.125], [0.03, 0.026, 0.026], { op: 'sub', k: 0.012 });
    s.paint((p) => Math.min(...[1, -1].map((m) => Math.hypot((p[0] - m * 0.04) / 1.2, p[1] - 0.705, p[2] - 0.11) - 0.03)), '#3a4a3a', 0.012);
    s.part('eyes', () => {
      for (const m of [1, -1]) s.sphere([m * 0.04, 0.703, 0.108], 0.016, { color: '#f4ffc0', mat: 'eye', bone: 'head', k: 0 });
    });
    // The grin, stitched across, and a stitched scar over the crown.
    s.part('face', () => {
      s.limb([-0.05, 0.645, 0.13], [0.05, 0.64, 0.13], 0.006, 0.006, { color: '#2a1a1a', mat: 'dark', bone: 'jaw', k: 0 });
      for (let i = -3; i <= 3; i++) s.limb([i * 0.014, 0.632, 0.131], [i * 0.014 + 0.002, 0.655, 0.128], 0.0028, 0.0028, { color: '#d8d0b0', mat: 'dark', bone: 'jaw', k: 0 });
      s.limb([0.03, 0.8, 0.02], [0.07, 0.765, 0.07], 0.004, 0.004, { color: '#3a2a2a', mat: 'dark', bone: 'head', k: 0 });
      for (let i = 0; i < 4; i++) {
        const t = i / 3, x = 0.03 + t * 0.04, y = 0.8 - t * 0.035, z = 0.02 + t * 0.05;
        s.limb([x - 0.012, y - 0.006, z], [x + 0.012, y + 0.006, z], 0.0026, 0.0026, { color: '#3a2a2a', mat: 'dark', bone: 'head', k: 0 });
      }
    });
    // A few tufts of hair left.
    for (const [x, z, a] of [[-0.04, 0.0, -0.4], [0.0, -0.03, 0.1], [-0.07, 0.02, -0.8], [0.03, -0.05, 0.5]]) {
      s.flake([x, 0.795, z], [x + Math.sin(a) * 0.035, 0.81, z - 0.04], [0, 1, 0.3], 0.012, 0.003, 0.4, { color: hair, mat: 'dark', bone: 'head', k: 0.008 });
    }
    // Neck and a hunched body in a torn shirt.
    s.limb([0, 0.56, 0.02], [0, 0.64, 0.05], 0.03, 0.032, { ...K, bone: 'neck', k: 0.02 });
    s.ellipsoid([0, 0.5, 0.01], [0.105, 0.075, 0.07], { ...C, bone: 'chest', k: 0.04 });
    s.limb([0, 0.36, 0.0], [0, 0.46, 0.005], 0.07, 0.08, { ...C, bone: 'spine', k: 0.04 });
    // The shirt's hem in rags.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, len = 0.035 + (i % 3) * 0.018;
      s.flake([Math.sin(a) * 0.07, 0.36, Math.cos(a) * 0.065], [Math.sin(a) * 0.08, 0.36 - len, Math.cos(a) * 0.075], [Math.sin(a), 0, Math.cos(a)], 0.024, 0.006, 0.3, { ...C, bone: 'spine', k: 0.01 });
    }
    // A hole in the shirt, skin showing.
    s.paint((p) => Math.hypot(p[0] - 0.045, p[1] - 0.47, (p[2] - 0.07) * 0.6) - 0.025, skin, 0.006);
    s.ellipsoid([0, 0.33, 0], [0.08, 0.05, 0.06], { color: trousers, mat: 'cloth', bone: 'hips', k: 0.03 });
    // Arms held out in front, hanging hands.
    for (const m of [1, -1]) {
      const S = side(m);
      s.sphere([m * 0.1, 0.54, 0.01], 0.035, { ...C, bone: `arm${S}`, k: 0.035 });
      s.limb([m * 0.105, 0.545, 0.01], [m * 0.12, 0.53, 0.14], 0.03, 0.026, { ...C, bone: `arm${S}`, k: 0.02 });
      s.limb([m * 0.12, 0.53, 0.14], [m * 0.11, 0.52, 0.25], 0.022, 0.019, { ...K, bone: `fore${S}`, k: 0.015 });
      // The sleeve torn off at the elbow.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        s.flake([m * 0.12 + Math.cos(a) * 0.026, 0.53 + Math.sin(a) * 0.026, 0.135], [m * 0.12 + Math.cos(a) * 0.03, 0.53 + Math.sin(a) * 0.03 - 0.012, 0.165], [Math.cos(a), Math.sin(a), 0], 0.012, 0.004, 0.35, { ...C, bone: `arm${S}`, k: 0.006 });
      }
      s.ellipsoid([m * 0.11, 0.512, 0.28], [0.024, 0.016, 0.03], { ...K, bone: `hand${S}`, k: 0.012 });
      for (const f of [-1, 0, 1]) s.limb([m * 0.11 + f * 0.011, 0.508, 0.3], [m * 0.11 + f * 0.012, 0.49, 0.325], 0.0065, 0.005, { ...K, bone: `hand${S}`, k: 0.005 });
      s.limb([m * 0.11 - m * 0.018, 0.51, 0.285], [m * 0.11 - m * 0.026, 0.5, 0.305], 0.006, 0.005, { ...K, bone: `hand${S}`, k: 0.005 });
      // Legs in baggy trousers, one shoe split.
      s.limb([m * 0.055, 0.32, 0], [m * 0.06, 0.18, 0.012], 0.036, 0.032, { color: trousers, mat: 'cloth', bone: `thigh${S}`, k: 0.025 });
      s.limb([m * 0.06, 0.18, 0.012], [m * 0.06, 0.06, 0.0], 0.03, 0.028, { color: trousers, mat: 'cloth', bone: `shin${S}`, k: 0.02 });
      s.ellipsoid([m * 0.06, 0.03, 0.03], [0.034, 0.028, 0.06], { color: shoe, mat: 'dark', bone: `foot${S}`, k: 0.015 });
    }
    s.box([0, -0.05, 0], [0.3, 0.05, 0.3], 0, { op: 'sub', k: 0.004 });
  },
  animate(k, { clip = 'idle', t = 0, time = 0, seed = 0, speed = 1 }) {
    const T = time + seed;
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // Always: a loll of the head, a slack jaw, arms bobbing out in front.
    k.turn('head', 0.1 + Math.sin(T * 0.9) * 0.06, Math.sin(T * 0.6) * 0.15, Math.sin(T * 0.7) * 0.18);
    k.turn('jaw', 0.12 + Math.max(0, Math.sin(T * 1.7)) * 0.12, 0, 0);
    k.turn('chest', 0.12, 0, 0);
    if (clip === 'scared') {
      // Arms flung up, knees knocking, running for it.
      const run = T * 14;
      k.move('root', 0, Math.abs(Math.sin(run)) * 0.03, 0);
      k.turn('spine', -0.15, 0, Math.sin(T * 30) * 0.05);
      k.turn('head', -0.35, 0, 0);
      k.turn('jaw', 0.35, 0, 0);
      for (const m of [1, -1]) {
        const S = side(m);
        k.turn(`arm${S}`, -2.2 + Math.sin(T * 25 + m) * 0.15, 0, m * 0.5);
        k.turn(`fore${S}`, -0.4, 0, 0);
        k.turn(`hand${S}`, Math.sin(T * 30 + m) * 0.4, 0, 0);
        k.turn(`thigh${S}`, Math.sin(run + (m > 0 ? 0 : Math.PI)) * 0.7, 0, 0);
        k.turn(`shin${S}`, 0.4 + Math.max(0, Math.sin(run + (m > 0 ? 0 : Math.PI))) * 0.6, 0, 0);
      }
      return;
    }
    for (const m of [1, -1]) {
      const S = side(m);
      k.turn(`arm${S}`, Math.sin(T * 1.3 + m) * 0.08, 0, 0);
      k.turn(`hand${S}`, 0.35 + Math.sin(T * 1.9 + m) * 0.15, 0, 0);
    }
    if (clip === 'walk') {
      // A shuffle: the left leg steps, the right drags stiff behind; the body lurches with it.
      const w = T * 4.2 * Math.max(0.5, speed);
      const step = Math.sin(w);
      k.move('root', Math.sin(w) * 0.012, Math.abs(Math.cos(w)) * 0.012, 0);
      k.turn('hips', 0, Math.sin(w) * 0.12, Math.sin(w) * 0.08);
      k.turn('spine', 0.08, -Math.sin(w) * 0.1, -Math.sin(w) * 0.06);
      k.turn('thighL', step * 0.55, 0, 0);
      k.turn('shinL', Math.max(0, -step) * 0.7, 0, 0);
      k.turn('thighR', -step * 0.3, 0, 0.05);
      k.turn('shinR', 0.05, 0, 0);
      k.turn('footR', 0.3, 0, 0);
    } else if (clip === 'attack') {
      // A lunge with both hands, then a stagger back.
      const g = ease(t / 0.25), back = ease((t - 0.35) / 0.4);
      const w = g * (1 - back);
      k.turn('spine', 0.35 * w, 0, 0);
      k.move('root', 0, 0, 0.06 * w);
      for (const m of [1, -1]) {
        const S = side(m);
        k.turn(`arm${S}`, -0.3 * w, m * -0.2 * w, 0);
        k.turn(`hand${S}`, -0.6 * w, 0, 0);
      }
    } else {
      // Standing, swaying.
      k.turn('hips', 0, 0, Math.sin(T * 0.8) * 0.05);
      k.turn('spine', 0, 0, -Math.sin(T * 0.8) * 0.04);
      k.turn('shinL', 0.08, 0, 0);
    }
  },
};
