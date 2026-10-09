import { rgb, shingles } from '../sdf.js';
import { grainy, mix } from '../skins.js';

/**
 * The turkey: November's chaser. A plump brown body, a great fan of a tail
 * banded in rust and cream and tipped dark, a small bare head on a long
 * neck with a red wattle and snood, a yellow beak, sturdy orange legs. It
 * struts with its head bobbing, and pecks; spooked, it flaps and runs.
 * Faces +z, feet on y = 0, about 0.62 tiles tall to the top of the fan.
 */

const BRONZE = rgb('#6a4630'), COPPER = rgb('#a8643a'), DARK = rgb('#2e2018');
const lockCell = { height: 0, id: 0, edge: 0 };
const plumage = (p, n) => {
  const l = shingles(p, 0.03, 2, 1.6, lockCell);
  const base = mix(BRONZE, COPPER, 0.3 + 0.4 * l.id);
  // Each feather darker at its edge, a little sheen at its tip.
  return base.map((v) => v * (0.7 + 0.5 * l.height)).map((v, i) => v + (l.height > 0.8 ? [0.03, 0.04, 0.02][i] : 0) + Math.max(0, n[1]) * 0.02);
};
const fanColour = (p) => {
  const r = Math.hypot(p[0], p[1] - 0.25, p[2] + 0.1);
  const band = r % 0.06 < 0.012 ? DARK : r > 0.33 ? rgb('#f0dcb8') : r % 0.06 < 0.03 ? rgb('#b8642a') : rgb('#7a4a2a');
  return r > 0.37 ? DARK : band;
};
const head = rgb('#9ab8d8');
const wattle = rgb('#d82a2a');
const legs = grainy('#e09040', 0.1, 60);
const side = (m) => (m > 0 ? 'L' : 'R');

export default {
  name: 'turkey',
  cell: 0.0075,
  cells: { eyes: 0.0028, fan: 0.007, face: 0.004 },
  bones: [
    ['root', null, [0, 0, 0]],
    ['body', 'root', [0, 0.24, 0]],
    ['neck', 'body', [0, 0.3, 0.08]],
    ['head', 'neck', [0, 0.42, 0.12]],
    ['fan', 'body', [0, 0.28, -0.1]],
    ...[1, -1].flatMap((m) => {
      const S = side(m);
      return [
        [`wing${S}`, 'body', [m * 0.1, 0.28, 0.02]],
        [`leg${S}`, 'root', [m * 0.05, 0.16, 0]],
        [`foot${S}`, `leg${S}`, [m * 0.05, 0.03, 0.01]],
      ];
    }),
  ],
  materials: {
    feather: { roughness: 0.75, sheen: 0.8, sheenColor: '#7ad0a0', sheenRoughness: 0.4 },
    skin: { roughness: 0.55 },
    beak: { roughness: 0.4, clearcoat: 0.4 },
    eye: { roughness: 0.1, clearcoat: 1 },
  },
  sculpt(s) {
    const F = { color: plumage, mat: 'feather' };
    // A plump round body, breast puffed out.
    s.ellipsoid([0, 0.25, 0], [0.13, 0.12, 0.15], { ...F, bone: 'body', k: 0.02 });
    s.ellipsoid([0, 0.27, 0.08], [0.1, 0.1, 0.08], { ...F, bone: 'body', k: 0.05 });
    // The tail fan, spread wide behind.
    s.part('fan', () => {
      for (let i = 0; i < 11; i++) {
        const a = -1.25 + (i / 10) * 2.5;
        const root = [0, 0.27, -0.1];
        const tip = [Math.sin(a) * 0.32, 0.27 + Math.cos(a) * 0.3, -0.16 - Math.abs(Math.sin(a)) * 0.02];
        s.flake(root, tip, [0, -0.3, 1], 0.03, 0.05, 0.22, { color: fanColour, mat: 'feather', bone: 'fan', k: 0.008 });
      }
    });
    // Wings folded at the sides.
    for (const m of [1, -1]) s.ellipsoid([m * 0.11, 0.27, 0.0], [0.04, 0.08, 0.12], { ...F, bone: `wing${side(m)}`, k: 0.02, rot: [0.2, 0, m * 0.15] });
    // The long neck and the small bare head.
    s.limb([0, 0.3, 0.1], [0, 0.42, 0.13], 0.035, 0.026, { color: head, mat: 'skin', bone: 'neck', k: 0.03 });
    s.sphere([0, 0.45, 0.14], 0.04, { color: head, mat: 'skin', bone: 'head', k: 0.02 });
    s.part('face', () => {
      s.cone([0, 0.45, 0.205], 0.016, 0.03, { color: '#f0c040', mat: 'beak', bone: 'head', k: 0, rot: [-Math.PI / 2, 0, 0] });
      // The wattle down the throat, the snood over the beak.
      s.ellipsoid([0, 0.405, 0.16], [0.016, 0.035, 0.016], { color: wattle, mat: 'skin', bone: 'head', k: 0.01 });
      s.limb([0.004, 0.475, 0.175], [0.01, 0.43, 0.205], 0.008, 0.005, { color: wattle, mat: 'skin', bone: 'head', k: 0.005 });
    });
    s.part('eyes', () => {
      for (const m of [1, -1]) {
        s.sphere([m * 0.027, 0.462, 0.163], 0.011, { color: '#fff8e0', mat: 'eye', bone: 'head', k: 0 });
        s.sphere([m * 0.03, 0.463, 0.171], 0.0065, { color: '#120a06', mat: 'eye', bone: 'head', k: 0 });
      }
    });
    // Sturdy legs, three toes forward.
    for (const m of [1, -1]) {
      const S = side(m);
      s.limb([m * 0.05, 0.16, 0], [m * 0.05, 0.03, 0.01], 0.014, 0.011, { color: legs, mat: 'skin', bone: `leg${S}`, k: 0.01 });
      for (const a of [-0.5, 0, 0.5]) s.limb([m * 0.05, 0.015, 0.01], [m * 0.05 + Math.sin(a) * 0.05, 0.008, 0.01 + Math.cos(a) * 0.05], 0.008, 0.005, { color: legs, mat: 'skin', bone: `foot${S}`, k: 0.006 });
    }
  },
  animate(k, { clip = 'idle', t = 0, time = 0, seed = 0, speed = 1 }) {
    const T = time + seed;
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    k.turn('fan', Math.sin(T * 1.1) * 0.05, 0, Math.sin(T * 0.8) * 0.06);
    if (clip === 'scared') {
      // Wings flapping, fan down, running flat out.
      const r = T * 16;
      k.move('root', 0, Math.abs(Math.sin(r)) * 0.03, 0);
      k.turn('body', 0.3, 0, 0);
      k.turn('fan', 0.6, 0, 0);
      k.turn('neck', -0.3, 0, Math.sin(T * 20) * 0.2);
      for (const m of [1, -1]) {
        const S = side(m);
        k.turn(`wing${S}`, 0, 0, m * (0.8 + Math.sin(T * 24) * 0.6));
        k.turn(`leg${S}`, Math.sin(r + (m > 0 ? 0 : Math.PI)) * 0.8, 0, 0);
      }
      return;
    }
    if (clip === 'walk') {
      // A strut: legs stepping, head bobbing back and forth with each step.
      const w = T * 6 * Math.max(0.6, speed);
      k.move('root', 0, Math.abs(Math.cos(w)) * 0.012, 0);
      k.turn('body', 0, Math.sin(w) * 0.06, Math.sin(w) * 0.05);
      k.move('head', 0, 0, Math.sin(w * 2) * 0.025);
      for (const m of [1, -1]) {
        const S = side(m);
        k.turn(`leg${S}`, Math.sin(w + (m > 0 ? 0 : Math.PI)) * 0.5, 0, 0);
        k.turn(`foot${S}`, Math.max(0, Math.sin(w + (m > 0 ? 0 : Math.PI))) * 0.4, 0, 0);
      }
    } else if (clip === 'attack') {
      // A peck: head drawn back, then darted forward and down.
      const back = ease(t / 0.15), peck = ease((t - 0.15) / 0.1), rec = ease((t - 0.35) / 0.3);
      k.turn('neck', -0.4 * back * (1 - peck) + 0.8 * peck * (1 - rec), 0, 0);
      k.turn('body', 0.2 * peck * (1 - rec), 0, 0);
    } else {
      // Idle: looking about, now and then a peck at the ground, a gobble of the wattle.
      const look = Math.sin(T * 0.7);
      k.turn('head', 0, look * 0.6, 0);
      const peck = Math.max(0, Math.sin(T * 1.3) - 0.85) * 6;
      k.turn('neck', peck * 0.8, 0, 0);
      k.turn('body', peck * 0.25, 0, 0);
      k.scale('fan', 1 + Math.max(0, Math.sin(T * 0.5) - 0.7) * 0.4);
    }
  },
};
