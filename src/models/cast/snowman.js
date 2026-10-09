import { noise, rgb } from '../sdf.js';
import { grainy, mix } from '../skins.js';

/**
 * The snowman, December's chaser: three snowballs, a coal smile and coal
 * eyes, a carrot nose, twig arms, a battered top hat and a long striped
 * scarf. It gets about by hopping, squashing as it lands; spooked, its
 * arms fly up and it bounds away, hat jumping. Faces +z, base on y = 0,
 * about 0.82 tiles tall with its hat.
 */

const SNOW = rgb('#f2f6ff'), BLUE = rgb('#b8c8e8');
const snow = (p, n) => {
  const g = 0.9 + 0.16 * noise(p[0] * 40, p[1] * 40, p[2] * 40);
  // Blue in the shade underneath, bright on top, sparkling.
  const c = mix(BLUE, SNOW, 0.35 + 0.65 * Math.max(0, n[1] * 0.5 + 0.5));
  return c.map((v) => v * g * (noise(p[0] * 300, p[1] * 300, p[2] * 300) > 0.86 ? 1.15 : 1));
};
const coal = grainy('#141418', 0.3, 80);
const carrot = (p) => mix(rgb('#e8661a'), rgb('#ff9a3a'), 0.5 + 0.5 * Math.sin(p[2] * 240));
const twig = grainy('#4a3424', 0.2, 60);
const hat = grainy('#1c1a22', 0.1, 40);
const scarf = (p) => (Math.sin((p[0] + p[2]) * 70 + p[1] * 20) > 0 ? rgb('#d82a3a') : rgb('#2a8a5a'));
const side = (m) => (m > 0 ? 'L' : 'R');

export default {
  name: 'snowman',
  cell: 0.0085,
  cells: { coal: 0.003, nose: 0.004, arms: 0.004, hat: 0.006, scarf: 0.006 },
  bones: [
    ['root', null, [0, 0, 0]],
    ['base', 'root', [0, 0.15, 0]],
    ['middle', 'base', [0, 0.33, 0]],
    ['head', 'middle', [0, 0.5, 0]],
    ['hat', 'head', [0, 0.6, 0]],
    ['armL', 'middle', [0.12, 0.38, 0]],
    ['armR', 'middle', [-0.12, 0.38, 0]],
  ],
  materials: {
    snow: { roughness: 0.75, sheen: 1, sheenColor: '#ffffff', sheenRoughness: 0.4 },
    coal: { roughness: 0.5, clearcoat: 0.3 },
    carrot: { roughness: 0.5 },
    wood: { roughness: 0.9 },
    cloth: { roughness: 0.85, sheen: 0.6, sheenColor: '#ff9090' },
    hat: { roughness: 0.4, clearcoat: 0.4 },
  },
  sculpt(s) {
    const S = { color: snow, mat: 'snow' };
    s.sphere([0, 0.15, 0], 0.17, { ...S, bone: 'base', k: 0, bump: [0.004, 18] });
    s.sphere([0, 0.36, 0], 0.125, { ...S, bone: 'middle', k: 0.04, bump: [0.003, 20] });
    s.sphere([0, 0.53, 0], 0.095, { ...S, bone: 'head', k: 0.03 });
    s.box([0, -0.05, 0], [0.3, 0.05, 0.3], 0, { op: 'sub', k: 0.02 });
    s.part('coal', () => {
      for (const m of [1, -1]) s.sphere([m * 0.032, 0.56, 0.082], 0.014, { color: coal, mat: 'coal', bone: 'head', k: 0 });
      for (let i = -2; i <= 2; i++) s.sphere([i * 0.022, 0.505 - (2 - Math.abs(i)) * 0.006, 0.088 - Math.abs(i) * 0.006], 0.009, { color: coal, mat: 'coal', bone: 'head', k: 0 });
      for (const y of [0.4, 0.34, 0.28]) s.sphere([0, y, 0.12 - Math.abs(y - 0.34) * 0.3], 0.013, { color: coal, mat: 'coal', bone: 'middle', k: 0 });
    });
    s.part('nose', () => s.limb([0, 0.535, 0.085], [0.01, 0.53, 0.17], 0.016, 0.003, { color: carrot, mat: 'carrot', bone: 'head', k: 0 }));
    s.part('arms', () => {
      for (const m of [1, -1]) {
        const S2 = side(m);
        s.chain([[m * 0.11, 0.38, 0], [m * 0.24, 0.45, 0.02], [m * 0.33, 0.52, 0.03]], [0.011, 0.008, 0.005], { color: twig, mat: 'wood', bone: `arm${S2}`, k: 0.005 });
        s.limb([m * 0.27, 0.48, 0.02], [m * 0.31, 0.56, 0.0], 0.005, 0.003, { color: twig, mat: 'wood', bone: `arm${S2}`, k: 0.003 });
        s.limb([m * 0.31, 0.5, 0.03], [m * 0.37, 0.5, 0.06], 0.004, 0.002, { color: twig, mat: 'wood', bone: `arm${S2}`, k: 0.003 });
      }
    });
    s.part('hat', () => {
      s.cylinder([0, 0.618, 0], 0.1, 0.008, { color: hat, mat: 'hat', bone: 'hat', k: 0, round: 0.004, rot: [0, 0, 0.12] });
      s.cylinder([0.009, 0.68, 0], 0.065, 0.06, { color: hat, mat: 'hat', bone: 'hat', k: 0.004, round: 0.006, rot: [0, 0, 0.12] });
      s.cylinder([0.004, 0.632, 0], 0.067, 0.01, { color: '#a8202a', mat: 'cloth', bone: 'hat', k: 0, rot: [0, 0, 0.12] });
    });
    s.part('scarf', () => {
      s.torus([0, 0.445, 0], 0.085, 0.024, { color: scarf, mat: 'cloth', bone: 'middle', k: 0 });
      s.flake([0.05, 0.44, 0.07], [0.09, 0.3, 0.1], [0, 0, 1], 0.024, 0.022, 0.35, { color: scarf, mat: 'cloth', bone: 'middle', k: 0.006 });
    });
  },
  animate(k, { clip = 'idle', t = 0, time = 0, seed = 0, speed = 1 }) {
    const T = time + seed;
    const hop = (rate) => {
      const p = (T * rate) % 1;
      const up = Math.sin(p * Math.PI);
      // Squash on the ground, stretch in the air.
      const squash = p < 0.12 || p > 0.88 ? 0.12 : -0.06 * up;
      k.move('root', 0, up * 0.09, 0);
      k.scale('base', 1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      return up;
    };
    k.turn('head', 0, Math.sin(T * 0.8) * 0.25, Math.sin(T * 0.6) * 0.08);
    k.turn('armL', 0, 0, Math.sin(T * 1.6) * 0.15);
    k.turn('armR', 0, 0, -Math.sin(T * 1.6 + 1) * 0.15);
    if (clip === 'scared') {
      const up = hop(3.2);
      k.turn('armL', 0, 0, 0.9 + Math.sin(T * 20) * 0.2);
      k.turn('armR', 0, 0, -0.9 - Math.sin(T * 20) * 0.2);
      k.move('hat', 0, 0.04 + up * 0.08, 0);
      k.turn('head', -0.2, 0, Math.sin(T * 25) * 0.1);
    } else if (clip === 'walk') {
      hop(2 * Math.max(0.6, speed));
      k.turn('middle', 0.08, 0, 0);
    } else if (clip === 'attack') {
      const g = Math.sin(Math.min(1, t / 0.5) * Math.PI);
      k.turn('middle', 0.3 * g, 0, 0);
      k.turn('armL', -1.1 * g, 0, 0);
      k.turn('armR', -1.1 * g, 0, 0);
    } else {
      k.scale('base', 1 + Math.sin(T * 2) * 0.01, 1 - Math.sin(T * 2) * 0.015, 1 + Math.sin(T * 2) * 0.01);
    }
  },
};
