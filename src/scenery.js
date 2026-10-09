import { createBogMaterial } from './bog.js';
import { flicker } from './stage.js';
import { glow, surface } from './textures.js';

/**
 * The night as it is drawn, round what `buildGrounds` made: the floor, the
 * walls' tops and sides and the earth under the edges, each with its
 * painted texture (textures.js); the bog brewing; the candles and lamps on
 * the walls, with live flames; and the moon gate out — a stone arch with a
 * crescent over it and a swirl in it that wakes when every lantern is lit.
 */

const geometry = (GFX, part) => {
  const g = new GFX.BufferGeometry();
  g.setAttribute('position', new GFX.BufferAttribute(part.position, 3));
  g.setAttribute('normal', new GFX.BufferAttribute(part.normal, 3));
  g.setAttribute('color', new GFX.BufferAttribute(part.color, 3));
  g.setAttribute('uv', new GFX.BufferAttribute(part.uv, 2));
  g.computeBoundingSphere();
  return g;
};

/** The meshes for the built grounds (see `buildGrounds`), dressed as `look` says. `relight(lights)` re-bakes their light. */
export function createGroundMeshes(GFX, built, look) {
  const group = new GFX.Group();
  group.name = 'grounds';
  const tex = look.textures;
  const material = (name, texture, opts = {}) => {
    const t = texture ? surface(GFX, texture) : { map: null, bump: null };
    return new GFX.MeshStandardMaterial({ name, vertexColors: true, map: t.map, bumpMap: t.bump, bumpScale: opts.bump ?? 2, roughness: opts.roughness ?? 0.9 });
  };
  const mats = {
    floor: material('floor', tex.floor, { bump: tex.floor === 'flagstone' ? 2.2 : 1.4, roughness: look.season === 'winter' ? 0.55 : 0.92 }),
    tops: material('wall-top', tex.top, { bump: 2.4 }),
    walls: material('wall-side', tex.wall, { bump: 2.6 }),
    earth: material('earth', tex.earth, { bump: 2 }),
  };
  const meshes = [];
  let bog = null;
  for (const [name, part] of Object.entries(built.parts)) {
    if (!part.position.length) continue;
    const g = geometry(GFX, part);
    let m;
    if (name === 'bog') {
      bog = createBogMaterial(GFX);
      m = new GFX.Mesh(g, bog);
    } else {
      m = new GFX.Mesh(g, mats[name]);
      m.receiveShadow = true;
      m.castShadow = name !== 'floor';
    }
    m.name = name;
    m.frustumCulled = false;
    group.add(m);
    meshes.push(m);
  }
  return {
    group,
    relight(lights) {
      built.relight(lights);
      for (const m of meshes) m.geometry.attributes.color.needsUpdate = true;
    },
    update(time) {
      if (!bog) return;
      bog.uniforms.uTime.value = time;
      bog.uniforms.uBright.value = 0.95 + 0.05 * Math.sin(time * 1.3);
    },
  };
}

/**
 * The lights on the walls: little clusters of candles (`candles`), or iron
 * lamps on posts (`lamp`), each with a flame and a halo, flickering.
 * Returns where each flame is, for the real lights near Blubber.
 */
export function createWallLights(GFX, list, style = 'candles') {
  const group = new GFX.Group();
  group.name = 'wall-lights';
  const wax = new GFX.MeshStandardMaterial({ name: 'wax', color: new GFX.Color('#efe4cc'), roughness: 0.55, emissive: new GFX.Color('#ff9a40'), emissiveIntensity: 0.12 });
  const iron = new GFX.MeshStandardMaterial({ name: 'iron', color: new GFX.Color('#2c2a2a'), roughness: 0.45, metalness: 0.8 });
  const glass = new GFX.MeshStandardMaterial({ name: 'lamp-glass', color: new GFX.Color('#ffd890'), emissive: new GFX.Color('#ffb050'), emissiveIntensity: 1.6, roughness: 0.2 });
  const outer = new GFX.MeshBasicMaterial({ name: 'flame', color: new GFX.Color('#ff9a3a'), transparent: true, opacity: 0.92, toneMapped: false });
  const inner = new GFX.MeshBasicMaterial({ name: 'flame-core', color: new GFX.Color('#fff2b8'), toneMapped: false });
  const haloMap = glow(GFX);
  const haloMat = haloMap ? new GFX.SpriteMaterial({ name: 'halo', map: haloMap, color: new GFX.Color('#ffb070'), blending: GFX.AdditiveBlending, depthWrite: false, opacity: 0.75 }) : null;
  const flameGeo = new GFX.ConeGeometry(0.045, 0.16, 8);
  const coreGeo = new GFX.ConeGeometry(0.022, 0.08, 6);
  const flames = [];
  const flame = (parent, x, y, z, scale = 1) => {
    const f = new GFX.Mesh(flameGeo, outer);
    f.position.set(x, y + 0.08 * scale, z);
    f.scale.setScalar(scale);
    const c = new GFX.Mesh(coreGeo, inner);
    c.position.set(x, y + 0.05 * scale, z);
    c.scale.setScalar(scale);
    parent.add(f, c);
    flames.push({ flame: f, core: c, seed: flames.length * 1.37, scale });
  };
  const spots = list.map(({ x, y, z }, i) => {
    const holder = new GFX.Group();
    holder.position.set(x, y, z);
    if (style === 'lamp') {
      const post = new GFX.Mesh(new GFX.CylinderGeometry(0.03, 0.04, 0.5, 8), iron);
      post.position.y = 0.25;
      const cage = new GFX.Mesh(new GFX.CylinderGeometry(0.09, 0.07, 0.2, 6, 1, true), glass);
      cage.position.y = 0.6;
      const cap = new GFX.Mesh(new GFX.ConeGeometry(0.12, 0.1, 6), iron);
      cap.position.y = 0.75;
      holder.add(post, cage, cap);
      flame(holder, 0, 0.54, 0, 0.8);
      if (haloMat) {
        const h = new GFX.Sprite(haloMat);
        h.position.y = 0.6;
        h.scale.set(1.2, 1.2, 1);
        holder.add(h);
      }
    } else {
      // Three candles of different heights, a little melted together.
      const sizes = [[0, 0, 0.26], [0.09, 0.05, 0.18], [-0.07, 0.07, 0.13]];
      for (const [dx, dz, h] of sizes) {
        const c = new GFX.Mesh(new GFX.CylinderGeometry(0.035, 0.04, h, 10), wax);
        c.position.set(dx, h / 2, dz);
        c.castShadow = true;
        holder.add(c);
        flame(holder, dx, h, dz, 0.85);
      }
      if (haloMat) {
        const h = new GFX.Sprite(haloMat);
        h.position.y = 0.32;
        h.scale.set(1.1, 1.1, 1);
        holder.add(h);
      }
    }
    group.add(holder);
    return { at: [x, y + (style === 'lamp' ? 0.6 : 0.3), z], seed: i * 1.91 };
  });
  return {
    group,
    lights: spots,
    update(time) {
      for (const f of flames) {
        const t = time * 9 + f.seed;
        const k = 1 + 0.18 * Math.sin(t) + 0.1 * Math.sin(t * 2.7 + 1);
        f.flame.scale.set(f.scale / Math.sqrt(k), f.scale * k, f.scale / Math.sqrt(k));
        f.flame.rotation.z = Math.sin(t * 0.7) * 0.12;
        f.core.scale.set(f.scale, f.scale * (0.9 + 0.15 * Math.sin(t * 1.3)), f.scale);
      }
    },
  };
}

const PORTAL_VERTEX = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PORTAL_FRAGMENT = `uniform float uTime;
uniform float uOpen;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.4) * 0.5 + 0.5;
  float swirl2 = sin(a * 5.0 - r * 14.0 + uTime * 1.7) * 0.5 + 0.5;
  float core = 1.0 - smoothstep(0.0, 0.55, r);
  vec3 col = mix(uOuter * (0.6 + 0.8 * swirl), uInner, core * 0.8);
  col += vec3(0.8, 0.7, 1.0) * pow(swirl * swirl2, 4.0) * 0.8;
  float edge = 1.0 - smoothstep(0.82, 1.0, r);
  float shut = 0.12 + 0.1 * swirl2;
  float alpha = edge * mix(shut, 0.92, uOpen);
  gl_FragColor = vec4(col * mix(0.35, 1.25, uOpen) * alpha, alpha);
}`;
const PORTAL_WGSL = `struct Varyings { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f, @location(2) uv: vec2f) -> Varyings {
  var out: Varyings;
  out.uv = uv;
  out.position = object.projectionMatrix * object.modelViewMatrix * vec4f(position, 1.0);
  return out;
}
@fragment fn fs(in: Varyings) -> @location(0) vec4f {
  let p = in.uv * 2.0 - 1.0;
  let r = length(p);
  if (r > 1.0) { discard; }
  let a = atan2(p.y, p.x);
  let t = material.uTime;
  let swirl = sin(a * 3.0 + r * 9.0 - t * 2.4) * 0.5 + 0.5;
  let swirl2 = sin(a * 5.0 - r * 14.0 + t * 1.7) * 0.5 + 0.5;
  let core = 1.0 - smoothstep(0.0, 0.55, r);
  var col = mix(material.uOuter * (0.6 + 0.8 * swirl), material.uInner, core * 0.8);
  col += vec3f(0.8, 0.7, 1.0) * pow(swirl * swirl2, 4.0) * 0.8;
  let edge = 1.0 - smoothstep(0.82, 1.0, r);
  let shut = 0.12 + 0.1 * swirl2;
  let alpha = edge * mix(shut, 0.92, material.uOpen);
  return vec4f(col * mix(0.35, 1.25, material.uOpen) * alpha, alpha);
}`;

/**
 * The moon gate, at `gate` ({ x, y, z, size }): two stone posts, an arch
 * between them with a crescent moon on top, and the swirl filling it,
 * facing the camera. `open(k)` wakes it (0 shut, 1 open).
 */
export function createGate(GFX, gate, look) {
  const group = new GFX.Group();
  group.name = 'moon-gate';
  group.position.set(gate.x, gate.y, gate.z);
  const t = surface(GFX, look.textures.wall === 'brick' || look.textures.wall === 'fieldstone' ? look.textures.wall : 'flagstone');
  const stone = new GFX.MeshStandardMaterial({ name: 'gate-stone', color: new GFX.Color(look.season === 'winter' ? '#c8d4e4' : '#9a948a'), map: t.map, bumpMap: t.bump, bumpScale: 2, roughness: 0.85 });
  const moonMat = new GFX.MeshStandardMaterial({ name: 'gate-moon', color: new GFX.Color('#fff2c8'), emissive: new GFX.Color('#ffe9a8'), emissiveIntensity: 0.4, roughness: 0.4 });
  const width = 2.2, height = 2.3;
  for (const s of [-1, 1]) {
    const post = new GFX.Mesh(new GFX.BoxGeometry(0.42, height, 0.42), stone);
    post.position.set(s * width / 2, height / 2, 0);
    const cap = new GFX.Mesh(new GFX.BoxGeometry(0.54, 0.14, 0.54), stone);
    cap.position.set(s * width / 2, height + 0.07, 0);
    const foot = new GFX.Mesh(new GFX.BoxGeometry(0.56, 0.18, 0.56), stone);
    foot.position.set(s * width / 2, 0.09, 0);
    group.add(post, cap, foot);
  }
  const arch = new GFX.Mesh(new GFX.TorusGeometry(width / 2, 0.19, 10, 28, Math.PI), stone);
  arch.position.y = height;
  group.add(arch);
  // A crescent moon over the arch.
  // Round the outside of the moon, then back round the inside of the bite out of it.
  const crescent = new GFX.Shape();
  const N = 24;
  for (let k = 0; k <= N; k++) {
    const a = Math.PI * 0.35 + (k / N) * Math.PI * 1.3;
    if (k) crescent.lineTo(Math.cos(a) * 0.36, Math.sin(a) * 0.36);
    else crescent.moveTo(Math.cos(a) * 0.36, Math.sin(a) * 0.36);
  }
  for (let k = 1; k < N; k++) {
    const a = Math.PI * 1.55 - (k / N) * Math.PI * 1.1;
    crescent.lineTo(0.16 + Math.cos(a) * 0.3, Math.sin(a) * 0.3);
  }
  const moon = new GFX.Mesh(new GFX.ExtrudeGeometry(crescent, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }), moonMat);
  moon.position.set(0, height + width / 2 + 0.42, -0.04);
  moon.rotation.z = 0.35;
  group.add(moon);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const swirl = new GFX.ShaderMaterial({
    name: 'portal',
    uniforms: {
      uTime: { value: 0 }, uOpen: { value: 0 },
      uInner: { value: new GFX.Color('#d8c8ff') }, uOuter: { value: new GFX.Color('#3a1ab8') },
    },
    glsl: { vertex: PORTAL_VERTEX, fragment: PORTAL_FRAGMENT },
    wgsl: PORTAL_WGSL,
    transparent: true, depthWrite: false, side: GFX.DoubleSide, blending: GFX.AdditiveBlending,
  });
  const portal = new GFX.Mesh(new GFX.PlaneGeometry(width - 0.4, height + width / 2 - 0.3), swirl);
  portal.position.set(0, (height + width / 2 - 0.3) / 2 + 0.05, 0);
  group.add(portal);
  const haloMap = glow(GFX, 'rgba(220, 210, 255, 1)', 'rgba(140, 110, 255, 0.4)', 'rgba(90, 60, 255, 0)');
  const halo = haloMap ? new GFX.Sprite(new GFX.SpriteMaterial({ name: 'gate-halo', map: haloMap, color: new GFX.Color('#b8a8ff'), blending: GFX.AdditiveBlending, depthWrite: false, opacity: 0 })) : null;
  if (halo) {
    halo.position.set(0, 1.4, 0.1);
    halo.scale.set(5, 5, 1);
    group.add(halo);
  }
  let openness = 0;
  return {
    group,
    at: [gate.x, gate.y + 1.2, gate.z],
    get openness() { return openness; },
    open(k) { openness = k; },
    update(time) {
      swirl.uniforms.uTime.value = time;
      swirl.uniforms.uOpen.value = openness;
      moonMat.emissiveIntensity = 0.4 + openness * 1.6 * (0.9 + 0.1 * Math.sin(time * 2));
      if (halo) halo.material.opacity = openness * (0.55 + 0.1 * Math.sin(time * 2.3));
    },
  };
}

export { flicker };
