/**
 * Blubber: the Blueberry avatar, unchanged, brought onto this engine the way
 * Dungeon Roller brought Slimey's orb. The same squashed berry with its
 * calyx well and raised lip, the same deep-blue waxy skin over a glowing
 * juice core, the same five dried sepals in the crown, the same rim bloom
 * and the two halos; the same lobes of waves moving the skin and the core,
 * the same palette drifting through it, and the same four moods — idle,
 * listening, thinking, speaking — with the same numbers.
 *
 * Only two things differ, and neither changes how it looks: it is built
 * here at the size of a maze corridor (`size`), and it is moved on by
 * `update(dt)` from the game loop rather than from its own onBeforeRender,
 * because this renderer uploads a frame's geometry before onBeforeRender.
 * The rim bloom is written once more in WGSL, for WebGPU.
 */

import { radial } from './textures.js';

const PALETTE = ['#4a56c8', '#5b4fd2', '#3b3a9e', '#6a4fd0', '#4361d6'];

/** The avatar's four moods, exactly as it has them. */
export const MODES = {
  idle:      { wobble: 0.36, speed: 0.80, hue: 0.030, breathe: 0.016, spin: 0.035, glow: 3.6, halo: 0.14 },
  listening: { wobble: 0.20, speed: 1.20, hue: 0.014, breathe: 0.036, spin: 0.020, glow: 5.0, halo: 0.20 },
  thinking:  { wobble: 0.55, speed: 1.95, hue: 0.190, breathe: 0.012, spin: 0.260, glow: 9.5, halo: 0.42 },
  speaking:  { wobble: 0.48, speed: 2.45, hue: 0.075, breathe: 0.050, spin: 0.070, glow: 6.2, halo: 0.28 },
};

/* ---- berry profile: squashed sphere, sunken calyx well with a raised lip ---- */
const WELL_R = 0.30;
const toBerry = (nx, ny, nz, out) => {
  const a = Math.acos(Math.max(-1, Math.min(1, ny)));
  const dip = 0.30 * Math.exp(-Math.pow(a / 0.42, 2));
  const lip = 0.055 * Math.exp(-Math.pow((a - 0.66) / 0.27, 2));
  const scar = 0.05 * Math.exp(-Math.pow((Math.PI - a) / 0.34, 2));
  const r = 1 - dip + lip - scar;
  const belly = 1 + 0.035 * Math.sin(a);
  out[0] = nx * r * belly; out[1] = ny * r * 0.93; out[2] = nz * r * belly;
  return out;
};

const LOBES = [];
for (let i = 0; i < 5; i++) {
  const a = i * 2.399963, r = Math.sqrt(1 - Math.pow(1 - 2 * (i + 0.5) / 5, 2));
  const d = [Math.cos(a) * r, 1 - 2 * (i + 0.5) / 5, Math.sin(a) * r];
  const l = Math.hypot(...d);
  LOBES.push({ dir: d.map((v) => v / l), freq: 1.0 + i * 0.42, speed: 0.45 + i * 0.19, amp: 0.085 / (1 + i * 0.6), phase: i * 1.7 });
}

const GLOW_VERTEX = `varying vec3 vN; varying vec3 vP;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position * 1.06, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAGMENT = `uniform vec3 uColor; uniform float uStrength;
varying vec3 vN; varying vec3 vP;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(-vP)));
  float rim = pow(f, 1.55) * (1.0 - pow(f, 12.0));
  float body = pow(f, 0.4) * 0.16;
  float a = (rim + body) * uStrength;
  gl_FragColor = vec4(uColor * a * 1.15, a);
}`;
const GLOW_WGSL = `struct Varyings { @builtin(position) position: vec4f, @location(0) vN: vec3f, @location(1) vP: vec3f };
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> Varyings {
  var out: Varyings;
  out.vN = normalize(object.normalMatrix * normal);
  let mv = object.modelViewMatrix * vec4f(position * 1.06, 1.0);
  out.vP = mv.xyz;
  out.position = object.projectionMatrix * mv;
  return out;
}
@fragment fn fs(in: Varyings) -> @location(0) vec4f {
  let f = 1.0 - abs(dot(normalize(in.vN), normalize(-in.vP)));
  let rim = pow(f, 1.55) * (1.0 - pow(f, 12.0));
  let body = pow(f, 0.4) * 0.16;
  let a = (rim + body) * material.uStrength;
  return vec4f(material.uColor * a * 1.15, a);
}`;

/**
 * Blubber, `size` tiles across its middle. Returns { group, berry, update(dt),
 * mode(name), modes }: put `group` where Blubber is; `update(dt)` once a
 * frame moves it on; `mode(name)` changes its mood, and it eases into the
 * new one as the avatar does.
 */
export function createBlubber(GFX, { size = 0.62 } = {}) {
  const group = new GFX.Group();
  group.name = 'blubber';
  const berry = new GFX.Group();
  berry.name = 'blueberry';
  // The avatar is about 2.1 across its middle; this is the only change of size.
  berry.scale.setScalar(size / 2.1);
  group.add(berry);

  const palette = PALETTE.map((h) => new GFX.Color(h));
  const paletteAt = (t, out) => {
    const f = ((t % palette.length) + palette.length) % palette.length;
    const i = Math.floor(f);
    return out.copy(palette[i]).lerp(palette[(i + 1) % palette.length], f - i);
  };
  const v = [0, 0, 0];
  const tmpColor = new GFX.Color();

  /* skin: deep berry blue under a waxy pale bloom (sheen carries the frost) */
  const skinMat = new GFX.MeshPhysicalMaterial({
    name: 'berry_skin',
    color: new GFX.Color('#4a56c8'),
    transparent: true,
    opacity: 0.9,
    transmission: 0.62,
    thickness: 0.55,
    ior: 1.34,
    roughness: 0.26,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    iridescence: 0.28,
    iridescenceIOR: 1.32,
    attenuationDistance: 1.8,
    attenuationColor: new GFX.Color('#8f9ff2'),
    sheen: 1,
    sheenRoughness: 0.75,
    sheenColor: new GFX.Color('#cfd6ff'),
  });
  const skinGeo = new GFX.SphereGeometry(1, 144, 96);
  const skinDirs = skinGeo.attributes.position.array.slice();
  const basePos = new Float32Array(skinDirs.length);
  for (let i = 0; i < skinDirs.length; i += 3) {
    toBerry(skinDirs[i], skinDirs[i + 1], skinDirs[i + 2], v);
    basePos[i] = v[0]; basePos[i + 1] = v[1]; basePos[i + 2] = v[2];
  }
  skinGeo.attributes.position.array.set(basePos);
  skinGeo.attributes.position.needsUpdate = true;
  skinGeo.computeVertexNormals();
  const skin = new GFX.Mesh(skinGeo, skinMat);
  skin.name = 'skin';
  berry.add(skin);

  /* juice core — the glow lives inside the fruit */
  const coreMat = new GFX.MeshStandardMaterial({
    name: 'berry_juice',
    color: new GFX.Color('#160f2e'),
    emissive: new GFX.Color('#7d6ae4'),
    emissiveIntensity: 3.5,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.95,
  });
  const coreGeo = new GFX.SphereGeometry(1, 72, 48);
  const coreDirs = coreGeo.attributes.position.array.slice();
  const coreBase = new Float32Array(coreDirs.length);
  for (let i = 0; i < coreDirs.length; i += 3) {
    toBerry(coreDirs[i], coreDirs[i + 1], coreDirs[i + 2], v);
    coreBase[i] = v[0] * 0.56; coreBase[i + 1] = v[1] * 0.56; coreBase[i + 2] = v[2] * 0.56;
  }
  coreGeo.attributes.position.array.set(coreBase);
  coreGeo.attributes.position.needsUpdate = true;
  coreGeo.computeVertexNormals();
  const core = new GFX.Mesh(coreGeo, coreMat);
  core.name = 'juice';
  berry.add(core);

  /* ---- the crown: five dried sepals ringing the well, plus the calyx disc ---- */
  const crown = new GFX.Group();
  crown.name = 'crown';
  const crownMat = new GFX.MeshStandardMaterial({
    name: 'berry_crown',
    color: new GFX.Color('#221a3c'),
    emissive: new GFX.Color('#4a3fb0'),
    emissiveIntensity: 0.35,
    roughness: 0.85,
    metalness: 0,
  });
  const wellY = toBerry(0, 1, 0, [0, 0, 0])[1];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sepal = new GFX.Mesh(new GFX.ConeGeometry(0.075, 0.34, 5), crownMat);
    sepal.name = 'sepal_' + (i + 1);
    sepal.position.set(Math.cos(a) * WELL_R * 0.62, wellY + 0.10, Math.sin(a) * WELL_R * 0.62);
    sepal.rotation.set(0, -a, 0);
    sepal.rotateX(0.62);
    sepal.rotateZ(Math.PI);
    sepal.scale.set(1, 1, 0.55);
    crown.add(sepal);
  }
  const calyx = new GFX.Mesh(new GFX.CylinderGeometry(WELL_R * 0.52, WELL_R * 0.72, 0.07, 24), crownMat);
  calyx.name = 'calyx';
  calyx.position.y = wellY + 0.02;
  crown.add(calyx);
  berry.add(crown);

  /* rim bloom bound to the skin's own geometry */
  const glowMat = new GFX.ShaderMaterial({
    name: 'berry_glow',
    uniforms: { uColor: { value: new GFX.Color('#7d6ae4') }, uStrength: { value: 0.5 } },
    glsl: { vertex: GLOW_VERTEX, fragment: GLOW_FRAGMENT },
    wgsl: GLOW_WGSL,
    transparent: true,
    blending: GFX.AdditiveBlending,
    side: GFX.FrontSide,
    depthWrite: false,
  });
  const glow = new GFX.Mesh(skinGeo, glowMat);
  glow.name = 'glow';
  berry.add(glow);

  const haloMat = new GFX.SpriteMaterial({
    name: 'halo',
    map: radial(GFX, [[0, 1], [0.14, 0.55], [0.34, 0.17], [0.66, 0.035], [1, 0]]),
    color: new GFX.Color('#7d6ae4'), transparent: true,
    blending: GFX.AdditiveBlending, depthWrite: false, opacity: 0.85,
  });
  const halo = new GFX.Sprite(haloMat);
  halo.name = 'halo';
  halo.scale.setScalar(4.4);
  berry.add(halo);

  const haloWideMat = new GFX.SpriteMaterial({
    name: 'halo_wide',
    map: radial(GFX, [[0, 0.42], [0.3, 0.16], [0.6, 0.05], [1, 0]]),
    color: new GFX.Color('#4a56c8'), transparent: true,
    blending: GFX.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.3,
  });
  const haloWide = new GFX.Sprite(haloWideMat);
  haloWide.name = 'halo_wide';
  haloWide.scale.setScalar(9);
  haloWide.renderOrder = -1;
  berry.add(haloWide);

  // As the avatar's stage has it: every mesh casts and takes shadow, but the bloom.
  berry.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  glow.castShadow = false; glow.receiveShadow = false;

  let mode = MODES.idle, modeName = 'idle';
  const m = { ...MODES.idle };
  let hue = 0, phase = 0;
  const white = new GFX.Color('#dfe2ff'), lilac = new GFX.Color('#b9aeff');

  return {
    group,
    berry,
    modes: MODES,
    get mode() { return modeName; },
    /** Changes its mood to one of MODES; it eases into it. */
    setMode(name) {
      if (!MODES[name]) return;
      modeName = name;
      mode = MODES[name];
    },
    /** What its palette is showing now, for the light it casts. */
    tint: tmpColor,
    /** How strong its rim glow is now. */
    get halo() { return m.halo; },
    update(dtIn) {
      const dt = Math.min(dtIn, 0.05);
      for (const k in m) m[k] += (mode[k] - m[k]) * Math.min(1, dt * 3.2);
      phase += dt * m.speed;
      hue += dt * m.hue;

      const pos = skinGeo.attributes.position, arr = pos.array;
      const breathe = 1 + Math.sin(phase * 1.5) * m.breathe;
      for (let i = 0; i < arr.length; i += 3) {
        const x = skinDirs[i], y = skinDirs[i + 1], z = skinDirs[i + 2];
        let d = 0;
        for (const l of LOBES) d += l.amp * Math.sin(l.freq * (x * l.dir[0] + y * l.dir[1] + z * l.dir[2]) * 2.35 + phase * l.speed * 2.2 + l.phase);
        const s = (1 + d * m.wobble) * breathe;
        arr[i] = basePos[i] * s; arr[i + 1] = basePos[i + 1] * s; arr[i + 2] = basePos[i + 2] * s;
      }
      pos.needsUpdate = true;
      skinGeo.computeVertexNormals();
      crown.scale.setScalar(breathe);
      crown.position.y = (breathe - 1) * 0.1;

      const cpos = coreGeo.attributes.position, ca = cpos.array;
      for (let i = 0; i < ca.length; i += 3) {
        const x = coreDirs[i], y = coreDirs[i + 1], z = coreDirs[i + 2];
        let d = 0;
        for (let j = 0; j < 3; j++) {
          const l = LOBES[j];
          d += l.amp * 1.5 * Math.sin(l.freq * (x * l.dir[0] + y * l.dir[1] + z * l.dir[2]) * 2.6 - phase * l.speed * 3 + l.phase);
        }
        const s = 1 + d * m.wobble;
        ca[i] = coreBase[i] * s; ca[i + 1] = coreBase[i + 1] * s; ca[i + 2] = coreBase[i + 2] * s;
      }
      cpos.needsUpdate = true;
      coreGeo.computeVertexNormals();

      paletteAt(hue, tmpColor);
      skinMat.color.copy(tmpColor);
      skinMat.attenuationColor.copy(tmpColor).lerp(white, 0.45);
      coreMat.emissive.copy(tmpColor).lerp(lilac, 0.35);
      coreMat.emissiveIntensity = m.glow;
      crownMat.emissive.copy(tmpColor);
      crownMat.emissiveIntensity = 0.12 + m.halo * 0.9;
      glowMat.uniforms.uColor.value.copy(tmpColor).lerp(lilac, 0.3);
      glowMat.uniforms.uStrength.value = m.halo * 8.5 * (0.94 + Math.sin(phase * 2.1) * 0.06);
      haloMat.color.copy(tmpColor);
      haloMat.opacity = 0.42 + m.halo * 2.6 * (0.96 + Math.sin(phase * 1.7) * 0.04);
      halo.scale.setScalar(4.9 + m.halo * 1.6 + Math.sin(phase * 1.3) * 0.12);
      haloWideMat.color.copy(tmpColor);
      haloWideMat.opacity = 0.12 + m.halo * 1.1;
      haloWide.scale.setScalar(8 + m.halo * 6);

      core.position.set(Math.sin(phase * 0.7) * 0.02, Math.sin(phase * 0.9) * 0.018, Math.cos(phase * 0.6) * 0.01);
      berry.rotation.y += dt * m.spin * 0.35;
      berry.rotation.z = Math.sin(phase * 0.2) * 0.06;
    },
  };
}
