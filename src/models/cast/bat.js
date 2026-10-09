import { rgb, shingles } from '../sdf.js';
import { coat, grainy, mix, pelt } from '../skins.js';

/**
 * The cave bat: a furry little body, a pug face with a squashed nose, huge
 * pointed ears, tiny fangs and red eyes that glow, on leathery wings that
 * stretch between long finger bones. A flyer: its origin is its middle and
 * the game holds it up in the air. Faces +z; about 0.9 tiles across the
 * wings.
 */

const furBase = pelt({ over: '#3b2c34', under: '#5e4650', vary: 0.18, freq: 14, grain: 0.1, edge: [-0.5, 0.4], strands: 0.35, sfreq: 200 });
const TIPS = rgb('#7a6470');
const lockCell = { height: 0, id: 0, edge: 0 };
const fur = (p, n) => {
  const c = furBase(p, n);
  const l = shingles(p, 0.016, 2, 2.6, lockCell);
  return mix(c.map((v) => v * (0.75 + 0.4 * l.height)), TIPS, Math.max(0, l.height - 0.65) * 0.4);
};
const skin = coat({ over: '#4a3038', under: '#6a4a50', vary: 0.12, freq: 20, grain: 0.05 });
const membrane = (p) => {
  // Veins: darker lines fanning out along the wing.
  const c = grainy('#3a2026', 0.1, 40)(p);
  const v = Math.abs(Math.sin(Math.atan2(p[2] + 0.02, Math.abs(p[0])) * 9));
  return c.map((x) => x * (0.85 + 0.25 * v));
};
const side = (m) => (m > 0 ? 'L' : 'R');

/** The wing's joints at rest, spread: shoulder, wrist, then the finger tips, for side m. */
function wing(m) {
  const sh = [m * 0.045, 0.02, 0.0];
  const el = [m * 0.17, 0.045, -0.01];
  const wr = [m * 0.27, 0.03, 0.02];
  const tips = [[m * 0.45, 0.02, 0.06], [m * 0.44, -0.01, -0.07], [m * 0.36, -0.03, -0.16], [m * 0.22, -0.03, -0.17]];
  return { sh, el, wr, tips };
}

export default {
  name: 'bat',
  cell: 0.0055,
  cells: { eyes: 0.0018, fangs: 0.0016, wings: 0.0038, ears: 0.0028 },
  bones: [
    ['root', null, [0, 0, 0]],
    ['body', 'root', [0, 0, 0]],
    ['head', 'body', [0, 0.03, 0.05]],
    ...[1, -1].flatMap((m) => {
      const w = wing(m), S = side(m);
      return [
        [`arm${S}`, 'body', w.sh],
        [`fore${S}`, `arm${S}`, w.el],
        [`hand${S}`, `fore${S}`, w.wr],
        [`ear${S}`, 'head', [m * 0.03, 0.08, 0.05]],
        [`leg${S}`, 'body', [m * 0.03, -0.04, -0.05]],
      ];
    }),
  ],
  materials: {
    fur: { roughness: 0.85, sheen: 1, sheenColor: '#a08090', sheenRoughness: 0.45 },
    skin: { roughness: 0.55, sheen: 0.5, sheenColor: '#c08088', sheenRoughness: 0.5 },
    wing: { roughness: 0.6, sheen: 0.8, sheenColor: '#d06070', sheenRoughness: 0.5, side: 'double' },
    eye: { roughness: 0.08, clearcoat: 1, emissive: '#ff2010', emissiveIntensity: 1.2 },
    fang: { roughness: 0.3, clearcoat: 0.6 },
  },
  sculpt(s) {
    const F = { color: fur, mat: 'fur' };
    // Body and head: a furry egg with a round head, a ruff where they meet.
    s.ellipsoid([0, 0, -0.01], [0.055, 0.06, 0.075], { ...F, bone: 'body', k: 0.02, locks: [0.016, 0.003, 2, 2.6] });
    s.ellipsoid([0, 0.035, 0.05], [0.05, 0.047, 0.045], { ...F, bone: 'head', k: 0.025 });
    // The pug face: a squashed snout, a nose leaf, a mouth with fangs.
    s.ellipsoid([0, 0.022, 0.088], [0.026, 0.02, 0.016], { color: skin, mat: 'skin', bone: 'head', k: 0.015 });
    s.ellipsoid([0, 0.035, 0.1], [0.01, 0.013, 0.006], { color: skin, mat: 'skin', bone: 'head', k: 0.006 });
    for (const m of [1, -1]) s.sphere([m * 0.007, 0.028, 0.104], 0.004, { op: 'sub', k: 0.003 });
    s.paint((p) => Math.max(Math.abs(p[1] - 0.008 + Math.abs(p[0]) * 0.3) - 0.003, Math.abs(p[0]) - 0.02, 0.08 - p[2]), '#1a0c10', 0.002);
    s.part('fangs', () => {
      for (const m of [1, -1]) s.limb([m * 0.011, 0.01, 0.094], [m * 0.01, -0.006, 0.095], 0.0035, 0.0008, { color: '#f0e6d0', mat: 'fang', bone: 'head', k: 0.001 });
    });
    // Eyes.
    for (const m of [1, -1]) {
      const c = [m * 0.025, 0.048, 0.083];
      s.part('eyes', () => s.sphere(c, 0.0095, { color: '#ff3a20', mat: 'eye', bone: 'head', k: 0 }));
      s.part('eyes', () => s.ellipsoid([c[0], c[1], c[2] + 0.007], [0.003, 0.006, 0.003], { color: '#0a0204', mat: 'eye', bone: 'head', k: 0 }));
    }
    // Ears: huge, pointed, cupped forward.
    s.part('ears', () => {
      for (const m of [1, -1]) {
        const S = side(m);
        s.flake([m * 0.028, 0.06, 0.045], [m * 0.06, 0.15, 0.04], [0, 0.1, 1], 0.026, 0.004, 0.3, { color: skin, mat: 'skin', bone: `ear${S}`, k: 0.004 });
        s.flake([m * 0.03, 0.065, 0.051], [m * 0.057, 0.135, 0.047], [0, 0.1, 1], 0.017, 0.003, 0.25, { op: 'sub', k: 0.003 });
      }
    });
    // Legs, tucked under, with little hooked claws.
    for (const m of [1, -1]) {
      const S = side(m);
      s.limb([m * 0.03, -0.04, -0.05], [m * 0.035, -0.06, -0.09], 0.01, 0.006, { color: skin, mat: 'skin', bone: `leg${S}`, k: 0.008 });
    }
    // Wings: an arm and four fingers each, and membrane stretched between.
    s.part('wings', () => {
      for (const m of [1, -1]) {
        const S = side(m), w = wing(m);
        s.limb(w.sh, w.el, 0.012, 0.008, { color: skin, mat: 'skin', bone: `arm${S}`, k: 0.006 });
        s.limb(w.el, w.wr, 0.008, 0.006, { color: skin, mat: 'skin', bone: `fore${S}`, k: 0.005 });
        // The thumb's hook at the wrist.
        s.limb(w.wr, [w.wr[0] + m * 0.01, w.wr[1] + 0.03, w.wr[2] + 0.02], 0.005, 0.002, { color: '#1c1014', mat: 'fang', bone: `hand${S}`, k: 0.002 });
        const pts = [w.wr, ...w.tips];
        for (const tip of w.tips) s.limb(w.wr, tip, 0.005, 0.0025, { color: skin, mat: 'skin', bone: `hand${S}`, k: 0.004 });
        // Membrane panels: flat triangles of skin between each pair of fingers, and back to the body.
        // Thick enough that the board's coarser grid can't miss it and leave holes.
        const panel = (p0, p1, p2, bone) => s.panel(p0, p1, p2, 0.012, { color: membrane, mat: 'wing', bone, k: 0.004 });
        // Wrist to each pair of finger tips; the last finger back to the body's flank.
        for (let i = 1; i < pts.length - 1; i++) panel(pts[0], pts[i], pts[i + 1], `hand${S}`);
        panel(w.wr, w.tips[3], [m * 0.04, -0.02, -0.07], `fore${S}`);
        panel(w.wr, [m * 0.04, -0.02, -0.07], w.sh, `fore${S}`);
        panel(w.sh, w.el, w.wr, `arm${S}`);
      }
    });
  },
  animate(k, { clip = 'idle', t = 0, time = 0, seed = 0, speed = 1 }) {
    const T = time + seed;
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // Flying all the time: a fast flap, the body bobbing against it.
    let rate = 14, depth = 1, fold = 0;
    if (clip === 'walk') { rate = 17 * Math.max(0.6, speed); depth = 1.1; }
    if (clip === 'hit') { rate = 26; depth = 0.6; }
    if (clip === 'ko') { fold = ease(t / 0.4); depth = 1 - fold; }
    const f = Math.sin(T * rate);
    for (const m of [1, -1]) {
      const S = m > 0 ? 'L' : 'R';
      k.turn(`arm${S}`, 0, m * 0.15 * f * depth, m * (0.55 * f * depth - 0.15 + fold * 1.1));
      k.turn(`fore${S}`, 0, m * -0.25 * fold, m * (0.25 * f * depth + fold * 1.4));
      k.turn(`hand${S}`, 0, m * 0.12 * Math.sin(T * rate - 0.8) * depth, m * (0.2 * Math.sin(T * rate - 0.8) * depth + fold * 0.9));
      k.turn(`ear${S}`, 0.1 * Math.sin(T * 3 + m), 0, m * -0.1 * Math.sin(T * 2.3));
      k.turn(`leg${S}`, 0.3 * Math.sin(T * rate + 1) * depth, 0, 0);
    }
    k.move('body', 0, -f * 0.012 * depth, 0);
    k.turn('head', Math.sin(T * 1.7) * 0.1, Math.sin(T * 0.9) * 0.3, 0);
    if (clip === 'attack') {
      // A dive: up and back, then down in at the throat, mouth open.
      const up = ease(t / 0.2), dive = ease((t - 0.2) / 0.12), back = ease((t - 0.4) / 0.3);
      const w = up * (1 - dive), d = dive * (1 - back);
      k.move('root', 0, 0.08 * w - 0.06 * d, -0.04 * w + 0.16 * d);
      k.turn('body', -0.4 * w + 0.6 * d, 0, 0);
      k.turn('head', 0.3 * d, 0, 0);
    } else if (clip === 'hit') {
      const h = Math.sin(Math.min(1, t / 0.4) * Math.PI);
      k.move('root', 0, 0.02 * h, -0.08 * h);
      k.turn('body', -0.5 * h, 0, Math.sin(t * 30) * 0.4 * h);
    } else if (clip === 'ko') {
      // Wings folded, it drops and tumbles.
      k.move('root', 0, -0.2 * fold, 0);
      k.turn('body', fold * 2.2, 0, fold * 0.6);
    }
  },
};
