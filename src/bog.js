/**
 * The bog: something green brewing in the witch's clearings and round the
 * edge of her wood. Dungeon Roller's lava shader, cooled and turned to
 * ooze — a scum of dark plates drifting on it, a bright brew showing
 * between them, pools welling up and skinning over, bubbles swelling and
 * popping. GLSL for WebGL 2, WGSL for WebGPU; it lights itself.
 */

const GLSL_VERTEX = `varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const GLSL_FRAGMENT = `uniform float uTime;
uniform float uBright;
uniform vec3 uScum;
uniform vec3 uBrew;
uniform vec3 uFroth;
varying vec3 vWorld;
float hash1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
vec2 plates(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.4 * sin(t * 0.2 + 6.2831 * hash2(i + g));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return vec2(d1, d2 - d1);
}
void main() {
  float t = uTime;
  vec2 p = vWorld.xz;
  vec2 warp = vec2(fbm(p * 0.6 + vec2(t * 0.04, 0.0)), fbm(p * 0.6 + vec2(3.1, -t * 0.03)));
  vec2 q = p * 1.3 + warp * 1.4;
  vec2 v = plates(q, t);
  float crack = 1.0 - smoothstep(0.04, 0.22, v.y);
  float pool = smoothstep(0.48, 0.74, fbm(p * 0.7 + vec2(t * 0.05, -t * 0.04)));
  float glow = clamp(crack + pool, 0.0, 1.0);
  vec3 scum = uScum * (0.7 + 0.6 * vnoise(q * 4.0));
  float pulse = 0.85 + 0.15 * sin(t * 1.4 + fbm(p * 1.5) * 6.0);
  vec3 col = mix(scum, uBrew * pulse, glow);
  vec2 cell = floor(p * 1.4);
  float pick = hash1(cell);
  if (pick > 0.66) {
    vec2 at = (cell + 0.25 + 0.5 * hash2(cell + 7.0)) / 1.4;
    float phase = fract(t * (0.22 + pick * 0.25) + pick * 9.0);
    float r = phase * 0.24, d = length(p - at);
    float ring = (1.0 - smoothstep(0.0, 0.03, abs(d - r))) * (1.0 - phase);
    float dome = (1.0 - smoothstep(0.0, r, d)) * (1.0 - phase) * 0.7;
    col = mix(col, uFroth, clamp(ring + dome, 0.0, 1.0));
  }
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

const WGSL = `struct Varyings { @builtin(position) position: vec4f, @location(0) world: vec3f };
@vertex fn vs(@location(0) position: vec3f) -> Varyings {
  var out: Varyings;
  let world = object.modelMatrix * vec4f(position, 1.0);
  out.world = world.xyz;
  out.position = object.projectionMatrix * object.viewMatrix * world;
  return out;
}
fn hash1(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn hash2(p: vec2f) -> vec2f { return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2f(1.0, 0.0)), u.x), mix(hash1(i + vec2f(0.0, 1.0)), hash1(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var s = 0.0;
  var a = 0.5;
  for (var i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
fn plates(p: vec2f, t: f32) -> vec2f {
  let i = floor(p);
  let f = fract(p);
  var d1 = 8.0;
  var d2 = 8.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2f(f32(x), f32(y));
      let o = 0.5 + 0.4 * sin(t * 0.2 + 6.2831 * hash2(i + g));
      let d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return vec2f(d1, d2 - d1);
}
@fragment fn fs(in: Varyings) -> @location(0) vec4f {
  let t = material.uTime;
  let p = in.world.xz;
  let warp = vec2f(fbm(p * 0.6 + vec2f(t * 0.04, 0.0)), fbm(p * 0.6 + vec2f(3.1, -t * 0.03)));
  let q = p * 1.3 + warp * 1.4;
  let v = plates(q, t);
  let crack = 1.0 - smoothstep(0.04, 0.22, v.y);
  let pool = smoothstep(0.48, 0.74, fbm(p * 0.7 + vec2f(t * 0.05, -t * 0.04)));
  let glow = clamp(crack + pool, 0.0, 1.0);
  let scum = material.uScum * (0.7 + 0.6 * vnoise(q * 4.0));
  let pulse = 0.85 + 0.15 * sin(t * 1.4 + fbm(p * 1.5) * 6.0);
  var col = mix(scum, material.uBrew * pulse, glow);
  let cell = floor(p * 1.4);
  let pick = hash1(cell);
  if (pick > 0.66) {
    let at = (cell + 0.25 + 0.5 * hash2(cell + 7.0)) / 1.4;
    let phase = fract(t * (0.22 + pick * 0.25) + pick * 9.0);
    let r = phase * 0.24;
    let d = length(p - at);
    let ring = (1.0 - smoothstep(0.0, 0.03, abs(d - r))) * (1.0 - phase);
    let dome = (1.0 - smoothstep(0.0, max(r, 0.001), d)) * (1.0 - phase) * 0.7;
    col = mix(col, material.uFroth, clamp(ring + dome, 0.0, 1.0));
  }
  return vec4f(col * material.uBright, 1.0);
}`;

/** The bog's material; keep `uniforms.uTime.value` going to keep it brewing. Colours are linear RGB. */
export function createBogMaterial(GFX, { scum = [0.02, 0.05, 0.02], brew = [0.25, 0.9, 0.12], froth = [0.7, 1.0, 0.45] } = {}) {
  return new GFX.ShaderMaterial({
    name: 'bog',
    uniforms: {
      uTime: { value: 0 }, uBright: { value: 1 },
      uScum: { value: new GFX.Vector3(...scum) }, uBrew: { value: new GFX.Vector3(...brew) }, uFroth: { value: new GFX.Vector3(...froth) },
    },
    glsl: { vertex: GLSL_VERTEX, fragment: GLSL_FRAGMENT },
    wgsl: WGSL,
  });
}
