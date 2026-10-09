/**
 * A turntable for the models (models.html): one or a row of them on the
 * grass under a night sky, to look at while sculpting. Not part of the
 * game. ?m=zombie,pumpkin&clip=walk&yaw=0.6&pitch=0.3&dist=1.4&time=0
 * (time fixed for a still; no time and it plays; detail=0.5 for the
 * board's mesh). A model not yet listed is loaded from its file.
 */

import * as GFX from '../vendor/gfx/index.js';
import { createRenderer, paintSky } from '../stage.js';
import { THEMES } from '../themes.js';
import { createModel, createStatic } from './model.js';
import { CAST } from './cast/index.js';
import { PROPS } from './props/index.js';

const params = new URLSearchParams(location.search);
const host = document.getElementById('view');
const renderer = await createRenderer(params.get('renderer') ?? 'webgl');
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = GFX.PCFShadowMap;
host.appendChild(renderer.domElement);

const scene = new GFX.Scene();
const camera = new GFX.PerspectiveCamera(30, 1, 0.05, 100);
scene.add(new GFX.HemisphereLight(0x8a9ad0, 0x1a1420, 0.9));
const key = new GFX.DirectionalLight(0xc0ccff, 1.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.01;
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 100 });
key.shadow.camera.updateProjectionMatrix();
key.position.set(-6, 20, -8);
scene.add(key, key.target);
const ghost = new GFX.PointLight(0x9a8cff, 6, 6, 1.6);
ghost.position.set(1.2, 1.2, 1.8);
scene.add(ghost);
const warm = new GFX.PointLight(0xff9a4a, 5, 6, 1.7);
warm.position.set(-1.6, 0.9, 0.8);
scene.add(warm);
const sky = paintSky(THEMES.hedge.sky, { width: 1024 });
const texture = new GFX.Texture(sky);
texture.mapping = GFX.EquirectangularReflectionMapping;
texture.colorSpace = GFX.SRGBColorSpace;
texture.needsUpdate = true;
scene.environment = new GFX.PMREMGenerator(renderer).fromEquirectangular(texture).texture;

const floor = new GFX.Mesh(new GFX.CircleGeometry(6, 64), new GFX.MeshStandardMaterial({ color: new GFX.Color('#3a4030'), roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

let models = [];
const state = { clip: params.get('clip') ?? 'idle', t: 0, yaw: Number(params.get('yaw') ?? 0.5), pitch: Number(params.get('pitch') ?? 0.32), dist: Number(params.get('dist') ?? 1), time: params.has('time') ? Number(params.get('time')) : null, playing: !params.has('time') };

const defs = new Map();
async function load(name) {
  if (!defs.has(name)) {
    defs.set(name, CAST[name] ?? PROPS[name] ?? (await import(`./cast/${name}.js`).catch(() => import(`./props/${name}.js`))).default);
  }
  return defs.get(name);
}

async function place(names, detail = 1) {
  const list = await Promise.all(names.map(load));
  for (const m of models) scene.remove(m.group);
  models = list.map((def) => {
    if (def.animate) return createModel(GFX, def, { detail });
    const group = new GFX.Group();
    group.add(createStatic(GFX, def, { detail, tint: params.get('tint') }));
    return { group, pose() {} };
  });
  const box = new GFX.Box3();
  const boxes = models.map((m) => {
    m.pose({ clip: 'idle', t: 0, time: 0, seed: 0 });
    m.group.updateMatrixWorld(true);
    return box.setFromObject(m.group).clone();
  });
  const widths = boxes.map((b) => Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 0.1) / 2);
  const total = widths.reduce((s, w) => s + w * 2.2, 0);
  let x = -total / 2;
  models.forEach((m, i) => {
    m.group.position.x = x + widths[i] * 1.1;
    if (boxes[i].min.y < -0.01) m.group.position.y = -boxes[i].min.y + 0.15;
    x += widths[i] * 2.2;
    scene.add(m.group);
  });
  state.radius = Math.max(total / 2, ...widths, ...boxes.map((b) => (b.max.y - b.min.y) * 0.62));
  state.height = Math.max(...boxes.map((b, i) => (b.max.y + b.min.y) / 2 + models[i].group.position.y));
}

const bar = document.getElementById('bar');
for (const clip of ['idle', 'walk', 'attack', 'scared', 'grab']) {
  const b = document.createElement('button');
  b.textContent = clip;
  b.onclick = () => { state.clip = clip; state.t = 0; };
  bar.append(b);
}

let clock = 0;
function frame(dt) {
  clock += dt;
  state.t += dt;
  const time = state.time ?? clock;
  const t = state.playing ? state.t % 1.6 : state.t;
  models.forEach((m, i) => m.pose({ clip: state.clip, t, time, seed: i * 1.7, speed: 1 }));
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const r = state.radius * 3.2 * state.dist;
  const ty = state.height * 0.9;
  camera.position.set(Math.sin(state.yaw) * Math.cos(state.pitch) * r, ty + Math.sin(state.pitch) * r, Math.cos(state.yaw) * Math.cos(state.pitch) * r);
  camera.lookAt(new GFX.Vector3(0, ty, 0));
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
}

await place((params.get('m') ?? 'pumpkin').split(','), params.has('detail') ? Number(params.get('detail')) : 1);
let last = performance.now();
function loop(now) {
  frame(Math.min(0.05, (now - last) / 1000));
  last = now;
  if (state.playing) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
globalThis.viewer = { state, place, ready: true };
