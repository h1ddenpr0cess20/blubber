/**
 * The Ice Cube avatar, as it is, brought onto this engine: the same rounded
 * block (a sphere pulled out to a superellipsoid, edges as sharp as its
 * mood says), the same frozen-in facets, the same dished top, the same
 * clear ice with its frost rim, cloudy core and trapped air bubbles.
 *
 * The winter nights' walls are built of it — a block on every wall tile,
 * each the avatar at rest — and `createIceCube` stands the whole avatar up,
 * drifting, in their rooms. The frost rim is written once more in WGSL,
 * for WebGPU. Nothing about how it looks is changed; the wall blocks are
 * only meshed more coarsely, as there are hundreds of them.
 */

const R = 0.5;
const ICE_COLORS = ['#f8fcff', '#f1f8ff', '#f4f6ff', '#f3fbff'];

/** The avatar's moods, exactly as it has them. */
export const ICE_MODES = {
  idle:      { sharp: 12,  shimmer: 0.4, speed: 0.8, spin: 0.06, glow: 1.6, halo: 0.3,  tint: 0.015, melt: 0, bob: 0.010 },
  listening: { sharp: 17,  shimmer: 0.6, speed: 1.4, spin: 0.03, glow: 2.6, halo: 0.5,  tint: 0.03,  melt: 0, bob: 0.016 },
  thinking:  { sharp: 9,   shimmer: 0.8, speed: 2.4, spin: 0.45, glow: 2.2, halo: 0.42, tint: 0.16,  melt: 0, bob: 0.030 },
  speaking:  { sharp: 13,  shimmer: 1.0, speed: 3.2, spin: 0.09, glow: 3.2, halo: 0.6,  tint: 0.06,  melt: 0, bob: 0.045 },
  melting:   { sharp: 4.2, shimmer: 1.4, speed: 1.0, spin: 0.02, glow: 1.0, halo: 0.2,  tint: 0.03,  melt: 1, bob: 0.003 },
};

// The rim stands a little proud of the block: `uGrow` times its size, about the mesh's own middle.
const RIM_VERTEX = `uniform float uGrow; varying vec3 vN; varying vec3 vP;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position * uGrow, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const RIM_FRAGMENT = `uniform vec3 uColor; uniform float uStrength;
varying vec3 vN; varying vec3 vP;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(-vP)));
  float a = pow(f, 2.4) * (1.0 - pow(f, 9.0)) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`;
const RIM_WGSL = `struct Varyings { @builtin(position) position: vec4f, @location(0) vN: vec3f, @location(1) vP: vec3f };
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> Varyings {
  var out: Varyings;
  out.vN = normalize(object.normalMatrix * normal);
  let mv = object.modelViewMatrix * vec4f(position * material.uGrow, 1.0);
  out.vP = mv.xyz;
  out.position = object.projectionMatrix * mv;
  return out;
}
@fragment fn fs(in: Varyings) -> @location(0) vec4f {
  let f = 1.0 - abs(dot(normalize(in.vN), normalize(-in.vP)));
  let a = pow(f, 2.4) * (1.0 - pow(f, 9.0)) * material.uStrength;
  return vec4f(material.uColor * a, a);
}`;

const RIM_GROW = 1.03;

/** Frozen-in facet irregularity, per direction: fixed, so the surface never breathes. */
const chipAt = (x, y, z) => Math.sin(x * 6.1 + y * 4.3 - z * 5.7) * 0.5 + Math.sin(y * 9.4 - z * 7.9 + x * 3.1) * 0.3 + Math.sin(z * 13.7 + x * 11.2) * 0.2;

const smooth = (x) => x * x * (3 - 2 * x);

/**
 * The block's shape for a mood `m` (sharp, shimmer, melt) at `phase`: each
 * unit-sphere direction in `dirs` to a point, written to `arr`. The
 * avatar's own deformation, line for line.
 */
function shape(dirs, chip, arr, m, phase) {
  const melt = m.melt;
  const sharp = m.sharp - melt * (m.sharp - 4) * 0.75;
  const glisten = m.shimmer * melt;
  const e = smooth(melt);
  const RP = R * 1.75, HH = R * 0.105;
  for (let i = 0; i < arr.length; i += 3) {
    const dx = dirs[i], dy = dirs[i + 1], dz = dirs[i + 2];
    const r = 1 / Math.pow(Math.pow(Math.abs(dx), sharp) + Math.pow(Math.abs(dy), sharp) + Math.pow(Math.abs(dz), sharp), 1 / sharp);
    let x = dx * r * R, y = dy * r * R, z = dz * r * R;
    const rp = 1 + chip[i / 3] * 0.0035 * (1 - e) + glisten * 0.0015 * Math.sin(dy * 30 + phase * 3.0);
    x *= rp; y *= rp; z *= rp;
    y -= Math.max(0, dy) * 0.05 * R * (1 - melt) * (1 - (x * x + z * z) / (R * R));
    if (e > 0.001) {
      const rho = Math.hypot(dx, dz);
      const d = Math.pow(Math.pow(rho, 4) + Math.pow(Math.abs(dy), 4), 0.25) || 1;
      const wob = 1 + 0.05 * Math.sin(Math.atan2(dz, dx) * 5 + phase * 0.8);
      const tx = (dx / d) * RP * wob, tz = (dz / d) * RP * wob;
      const ty = (dy / d) * HH - R + HH;
      x += (tx - x) * e; y += (ty - y) * e; z += (tz - z) * e;
    }
    arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
  }
}

/** The avatar's octahedral core, as `OctahedronGeometry(radius, 1)` makes it. */
function octahedron(GFX, radius) {
  const vertices = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
  const indices = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];
  return new GFX.PolyhedronGeometry(vertices, indices, radius, 1);
}

function materials(GFX) {
  const ice = new GFX.MeshPhysicalMaterial({
    name: 'ice',
    color: new GFX.Color('#ffffff'),
    transparent: true,
    opacity: 1,
    transmission: 0.94,
    thickness: 0.95,
    envMapIntensity: 3.6,
    specularIntensity: 1,
    specularColor: new GFX.Color('#ffffff'),
    ior: 1.31,
    roughness: 0.012,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.008,
    iridescence: 0,
    iridescenceIOR: 1.31,
    attenuationDistance: 4.0,
    attenuationColor: new GFX.Color('#e6f4ff'),
    sheen: 0,
  });
  const rim = new GFX.ShaderMaterial({
    name: 'frost_rim',
    uniforms: { uColor: { value: new GFX.Color('#bfe6ff') }, uStrength: { value: 0.5 }, uGrow: { value: RIM_GROW } },
    glsl: { vertex: RIM_VERTEX, fragment: RIM_FRAGMENT },
    wgsl: RIM_WGSL,
    transparent: true, blending: GFX.AdditiveBlending, depthWrite: false,
  });
  const core = new GFX.MeshStandardMaterial({
    name: 'core',
    color: new GFX.Color('#cfeaff'),
    emissive: new GFX.Color('#eef6ff'),
    emissiveIntensity: 0.2,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
    transparent: true,
    opacity: 0.16,
  });
  const bubble = new GFX.MeshPhysicalMaterial({
    name: 'air_bubble',
    color: new GFX.Color('#f4fdff'),
    roughness: 0.04, metalness: 0,
    transmission: 0.95, thickness: 0.06, ior: 1.05,
    transparent: true, opacity: 0.45,
  });
  return { ice, rim, core, bubble };
}

/** The nine trapped bubbles' sizes and orbits, as the avatar has them. */
const BUBBLES = Array.from({ length: 9 }, (_, i) => ({
  r: 0.016 + (i % 4) * 0.012,
  a: i * 2.399963, rr: 0.13 + (i % 4) * 0.07, y: -0.22 + i * 0.055, sp: 0.12 + (i % 3) * 0.07,
}));

/**
 * The whole avatar, drifting, for a room: { group, update(dt) }. It keeps
 * to its idle mood; `mode(name)` changes it.
 */
export function createIceCube(GFX, { mats = materials(GFX) } = {}) {
  const cube = new GFX.Group();
  cube.name = 'ice_cube';
  const iceGeo = new GFX.SphereGeometry(1, 128, 88);
  const dirs = iceGeo.attributes.position.array.slice();
  const chip = new Float32Array(dirs.length / 3);
  for (let i = 0, j = 0; i < dirs.length; i += 3, j++) chip[j] = chipAt(dirs[i], dirs[i + 1], dirs[i + 2]);
  const ice = new GFX.Mesh(iceGeo, mats.ice);
  ice.name = 'block';
  cube.add(ice);
  const rim = new GFX.Mesh(iceGeo, mats.rim);
  rim.name = 'frost_rim';
  cube.add(rim);
  const coreGeo = octahedron(GFX, 0.21);
  const core = new GFX.Mesh(coreGeo, mats.core);
  core.name = 'core';
  cube.add(core);
  const coreBase = coreGeo.attributes.position.array.slice();
  const bubbles = BUBBLES.map((o, i) => {
    const b = new GFX.Mesh(new GFX.SphereGeometry(o.r, 18, 12), mats.bubble);
    b.name = 'air_bubble_' + (i + 1);
    b.userData.orbit = o;
    cube.add(b);
    return b;
  });
  cube.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rim.castShadow = false; rim.receiveShadow = false;
  for (const b of bubbles) { b.castShadow = false; b.receiveShadow = false; }

  const tintAt = (() => {
    const colors = ICE_COLORS.map((h) => new GFX.Color(h));
    return (t, out) => {
      const f = ((t % colors.length) + colors.length) % colors.length;
      const i = Math.floor(f);
      return out.copy(colors[i]).lerp(colors[(i + 1) % colors.length], f - i);
    };
  })();
  let mode = ICE_MODES.idle;
  const m = { ...ICE_MODES.idle };
  let phase = 0, drift = 0, t = 0;
  const tint = new GFX.Color();
  const pos = iceGeo.attributes.position;

  return {
    group: cube,
    mode(name) { if (ICE_MODES[name]) mode = ICE_MODES[name]; },
    update(dtIn) {
      const dt = Math.min(dtIn, 0.05);
      t += dt;
      for (const k in m) m[k] += (mode[k] - m[k]) * Math.min(1, dt * (k === 'melt' ? 0.9 : 3));
      phase += dt * m.speed;
      drift += dt * m.tint;
      const melt = m.melt, e = smooth(melt);
      shape(dirs, chip, pos.array, m, phase);
      pos.needsUpdate = true;
      iceGeo.computeVertexNormals();
      const ca = coreGeo.attributes.position.array;
      const jitter = 0.006 * (1 + m.shimmer);
      for (let i = 0; i < ca.length; i += 3) {
        const x = coreBase[i], y = coreBase[i + 1], z = coreBase[i + 2];
        const s = 1 + jitter * Math.sin(x * 21 + y * 13 - phase * 3.1);
        ca[i] = x * s; ca[i + 1] = y * s; ca[i + 2] = z * s;
      }
      coreGeo.attributes.position.needsUpdate = true;
      coreGeo.computeVertexNormals();
      tintAt(drift, tint);
      mats.ice.color.copy(tint);
      mats.ice.roughness = 0.012 + melt * 0.05;
      mats.ice.attenuationColor.set('#e6f4ff');
      mats.core.emissive.copy(tint);
      mats.core.emissiveIntensity = m.glow * 0.12 * (1 - e) * (0.9 + Math.sin(phase * 2.3) * 0.1);
      mats.core.opacity = 0.16 * Math.max(0, 1 - e * 1.6);
      core.visible = mats.core.opacity > 0.005;
      mats.rim.uniforms.uColor.value.set('#eaf6ff');
      mats.rim.uniforms.uStrength.value = (0.45 + m.halo * 0.5) * (1 - melt * 0.7) * (0.85 + Math.sin(phase * 1.9) * 0.15);
      core.scale.setScalar(1 - e * 0.62);
      core.position.set(Math.sin(phase * 0.6) * 0.02 * (1 - e), (Math.sin(phase * 0.8) * 0.015) * (1 - e) + e * (-R + 0.055), Math.cos(phase * 0.5) * 0.02 * (1 - e));
      core.rotation.set(phase * 0.12, phase * 0.21, 0);
      bubbles.forEach((b) => {
        const o = b.userData.orbit, a = o.a + phase * o.sp;
        const rr = o.rr * (1 + e * 1.1);
        const fy = o.y + Math.sin(phase * 0.7 + o.a) * 0.03;
        b.position.set(Math.cos(a) * rr, fy + (-R + 0.045 - fy) * e, Math.sin(a) * rr);
        b.scale.setScalar(1 - e * 0.5);
        mats.bubble.opacity = 0.45 * Math.max(0, 1 - e * 1.5);
        b.visible = mats.bubble.opacity > 0.005;
      });
      const w = m.bob * 4 * (1 - e), lift = (1 - e);
      cube.position.set(
        (Math.sin(t * 0.37) + 0.6 * Math.sin(t * 0.91 + 1.7) + 0.35 * Math.sin(t * 1.63 + 4.1)) * w,
        (Math.sin(t * 0.53 + 0.4) + 0.5 * Math.sin(t * 1.27 + 2.6)) * w * 0.7 + 0.06 * lift,
        (Math.cos(t * 0.43 + 2.1) + 0.6 * Math.sin(t * 1.07 + 0.9) + 0.3 * Math.cos(t * 1.79)) * w);
      cube.rotation.x = (Math.sin(t * 0.31) + 0.4 * Math.sin(t * 0.83 + 1.2)) * 0.18 * lift;
      cube.rotation.z = (Math.cos(t * 0.27 + 1.9) + 0.4 * Math.sin(t * 0.71)) * 0.16 * lift;
      cube.rotation.y += dt * m.spin * (1 - e * 0.8);
    },
  };
}

/** Appends `geometry`'s vertices (moved by `place(x, y, z) → [x, y, z]`, normals turned by `turn`) to `out`. */
function append(out, geometry, place, turn) {
  const P = geometry.attributes.position.array, N = geometry.attributes.normal.array;
  const base = out.position.length / 3;
  for (let i = 0; i < P.length; i += 3) {
    out.position.push(...place(P[i], P[i + 1], P[i + 2]));
    out.normal.push(...turn(N[i], N[i + 1], N[i + 2]));
  }
  const index = geometry.index ? geometry.index.array : Array.from({ length: P.length / 3 }, (_, k) => k);
  for (let k = 0; k < index.length; k++) out.index.push(index[k] + base);
}

/**
 * The winter walls: on every wall tile, a block of the avatar at rest, with
 * its core and its bubbles, all merged into a few meshes. Each block is
 * turned a quarter at random so their facets don't line up. Returns
 * { group, update(time) }; the frost rim and the core breathe as the
 * avatar's do.
 */
export function createIce(GFX, night) {
  const group = new GFX.Group();
  group.name = 'ice-walls';
  const mats = materials(GFX);
  const { grounds } = night;
  // One block, as the avatar is at rest.
  const block = new GFX.SphereGeometry(1, 28, 18);
  const dirs = block.attributes.position.array.slice();
  const chip = new Float32Array(dirs.length / 3);
  for (let i = 0, j = 0; i < dirs.length; i += 3, j++) chip[j] = chipAt(dirs[i], dirs[i + 1], dirs[i + 2]);
  shape(dirs, chip, block.attributes.position.array, ICE_MODES.idle, 0);
  block.computeVertexNormals();
  const core = octahedron(GFX, 0.21);
  core.computeVertexNormals();
  const bubble = BUBBLES.map((o) => new GFX.SphereGeometry(o.r, 6, 4));

  const parts = { ice: { position: [], normal: [], index: [] }, rim: { position: [], normal: [], index: [] }, core: { position: [], normal: [], index: [] }, bubble: { position: [], normal: [], index: [] } };
  const cubes = [];
  for (let z = 0; z < grounds.rows; z++) {
    for (let x = 0; x < grounds.cols; x++) {
      const c = grounds.cell(x, z);
      if (c?.kind !== 'wall') continue;
      const q = Math.floor(((x * 73856093) ^ (z * 19349663)) >>> 0) % 4;
      const cos = Math.cos(q * Math.PI / 2), sin = Math.sin(q * Math.PI / 2);
      const cx = x + 0.5, cy = c.floor + R, cz = z + 0.5;
      const place = (px, py, pz) => [cx + px * cos + pz * sin, cy + py, cz - px * sin + pz * cos];
      const turn = (nx, ny, nz) => [nx * cos + nz * sin, ny, -nx * sin + nz * cos];
      append(parts.ice, block, place, turn);
      // The rim grown about this block's own middle: the shader would grow the whole maze about the corner of the world.
      append(parts.rim, block, (px, py, pz) => place(px * RIM_GROW, py * RIM_GROW, pz * RIM_GROW), turn);
      append(parts.core, core, place, turn);
      BUBBLES.forEach((o, i) => {
        const bx = Math.cos(o.a) * o.rr, bz = Math.sin(o.a) * o.rr;
        append(parts.bubble, bubble[i], (px, py, pz) => place(px + bx, py + o.y, pz + bz), turn);
      });
      cubes.push([cx, cz]);
    }
  }
  const mesh = (part, material, name) => {
    const g = new GFX.BufferGeometry();
    g.setAttribute('position', new GFX.BufferAttribute(new Float32Array(part.position), 3));
    g.setAttribute('normal', new GFX.BufferAttribute(new Float32Array(part.normal), 3));
    const count = part.position.length / 3;
    g.setIndex(new GFX.BufferAttribute(count > 65535 ? new Uint32Array(part.index) : new Uint16Array(part.index), 1));
    g.computeBoundingSphere();
    const m = new GFX.Mesh(g, material);
    m.name = name;
    m.frustumCulled = false;
    return m;
  };
  const ice = mesh(parts.ice, mats.ice, 'ice-blocks');
  ice.castShadow = true;
  ice.receiveShadow = true;
  mats.rim.uniforms.uGrow.value = 1;
  const rim = mesh(parts.rim, mats.rim, 'ice-frost');
  group.add(ice, rim, mesh(parts.core, mats.core, 'ice-cores'), mesh(parts.bubble, mats.bubble, 'ice-bubbles'));
  return {
    group,
    count: cubes.length,
    /** The frost rim and the core breathe, at rest, as the avatar's do. */
    update(time) {
      const phase = time * ICE_MODES.idle.speed;
      mats.rim.uniforms.uColor.value.set('#eaf6ff');
      mats.rim.uniforms.uStrength.value = (0.45 + ICE_MODES.idle.halo * 0.5) * (0.85 + Math.sin(phase * 1.9) * 0.15);
      mats.core.emissiveIntensity = ICE_MODES.idle.glow * 0.12 * (0.9 + Math.sin(phase * 2.3) * 0.1);
    },
  };
}
