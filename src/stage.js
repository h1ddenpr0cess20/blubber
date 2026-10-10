/**
 * The screen, on Dungeon Roller's engine (`vendor/gfx`): WebGPU where the
 * browser has it and WebGL 2 where it does not, physically based shading
 * and shadows, and a perspective camera that looks down over the maze from
 * the front and can be turned, tilted and zoomed round Blubber (`view.js`).
 *
 * The lighting is for a night out: a cold wash from the sky; the moon, low
 * and to one side, for the shadows; Blubber's own glow, carried with it;
 * and real, flickering lights at the few lit lanterns and candles nearest
 * it. Every other one is baked into the ground (`grounds.js`). Round it all
 * is a painted sky — moon, stars, a treeline — and what the shiny things
 * reflect is that sky too.
 */

import * as GFX from './vendor/gfx/index.js';
import { Renderer } from './vendor/gfx/renderer.js';
import { WebGLBackend } from './vendor/gfx/webgl.js';
import { WebGPUBackend } from './vendor/gfx/webgpu.js';
import { mist as mistTexture, seeded } from './textures.js';
import { createView } from './view.js';

/** How far back the camera sits at zoom 1, and its lens. */
export const LENS = Object.freeze({ distance: 14.5, fov: 38 });

/** Where the moon is, as a direction from the maze to it: high, behind and to the left. */
export const MOON = Object.freeze({ azimuth: -0.6, elevation: 0.42 });
const KEY = new GFX.Vector3(Math.sin(MOON.azimuth) * Math.cos(0.72), Math.sin(0.72), -Math.cos(MOON.azimuth) * Math.cos(0.72)).normalize();

/** How many warm lights (lanterns, candles) near Blubber get a real light. Fixed, so the shaders never change. */
const WARM_LIGHTS = 4;

/** Wisps of ground mist drifting round Blubber. */
const MISTS = 26;

/**
 * What a phone (or anything held and touched) is spared, so it doesn't run hot: fewer pixels, a smaller
 * shadow map, and what shows through Blubber's skin drawn at half size, where it is blurred anyway.
 */
export const HANDHELD = Object.freeze({ pixelRatio: 1.5, shadowMap: 1024, transmission: 0.5 });
const handheld = () => globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;

export async function createRenderer(preference) {
  if (preference !== 'webgl' && typeof navigator !== 'undefined' && navigator.gpu) {
    const canvas = document.createElement('canvas');
    try {
      return new Renderer(await WebGPUBackend.create(canvas), canvas);
    } catch (err) {
      if (preference === 'webgpu') throw err;
      console.warn('blubber: WebGPU unavailable, falling back to WebGL 2.', err);
    }
  }
  const canvas = document.createElement('canvas');
  return new Renderer(new WebGLBackend(canvas), canvas);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

/**
 * The night sky all round, as an equirectangular canvas: `sky` gives the
 * colours ({ top, horizon, glow, haze }). Stars and the moon above, a black
 * treeline on the horizon, and mist below it where the grounds float.
 * `kind` picks the treeline: dead trees, pines or none (underground there
 * is no sky at all, only dark). `aurora` hangs the northern lights.
 */
export function paintSky(sky, { width = 2048, kind = 'dead', aurora = false, underground = false, moon = true } = {}) {
  const height = width / 2;
  const [c, ctx] = (() => {
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = height;
    return [cv, cv.getContext('2d')];
  })();
  if (!ctx) return null;
  const rnd = seeded(4242);
  const horizon = height / 2;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.42, sky.horizon);
  g.addColorStop(0.5, sky.haze);
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  if (underground) return c;

  // Stars, thinning toward the horizon.
  for (let k = 0; k < 1400; k++) {
    const y = Math.pow(rnd(), 1.6) * horizon * 0.95;
    const x = rnd() * width;
    const b = rnd();
    ctx.fillStyle = `rgba(${220 + b * 35 | 0},${225 + b * 30 | 0},255,${(0.25 + b * 0.75) * (1 - y / horizon)})`;
    const s = b > 0.97 ? 2.2 : b > 0.85 ? 1.5 : 1;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalCompositeOperation = 'lighter';
  if (aurora) {
    // Curtains of green and teal, folding across the north.
    for (let band = 0; band < 3; band++) {
      const base = horizon * (0.35 + band * 0.12);
      for (let x = 0; x < width; x += 2) {
        const u = x / width;
        const fold = Math.sin(u * 14 + band * 2) * 0.5 + Math.sin(u * 31 + band) * 0.25;
        const top = base - horizon * (0.18 + 0.12 * fold);
        const fade = Math.max(0, Math.sin(u * Math.PI * 2 + band));
        const grad = ctx.createLinearGradient(0, top, 0, base + 30);
        grad.addColorStop(0, 'rgba(80,255,190,0)');
        grad.addColorStop(0.6, `rgba(70,255,170,${0.09 * fade})`);
        grad.addColorStop(1, `rgba(60,200,255,${0.03 * fade})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, top, 2, base + 30 - top);
      }
    }
  }
  // A glow low on the horizon all round.
  const low = ctx.createLinearGradient(0, horizon * 0.7, 0, horizon * 1.04);
  low.addColorStop(0, rgba(sky.glow, 0));
  low.addColorStop(1, rgba(sky.glow, 0.16));
  ctx.fillStyle = low;
  ctx.fillRect(0, horizon * 0.7, width, horizon * 0.34);
  if (moon) {
    // The moon: where `MOON` puts it, a bright disc with a halo and shadowed seas.
    const mx = ((MOON.azimuth / (Math.PI * 2)) + 0.75) % 1 * width;
    const my = horizon - (MOON.elevation / (Math.PI / 2)) * horizon;
    const r = width * 0.018;
    const halo = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 9);
    halo.addColorStop(0, 'rgba(230,236,255,0.35)');
    halo.addColorStop(0.3, 'rgba(180,190,255,0.1)');
    halo.addColorStop(1, 'rgba(150,160,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - r * 9, my - r * 9, r * 18, r * 18);
    ctx.globalCompositeOperation = 'source-over';
    const disc = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r);
    disc.addColorStop(0, '#fffdf0');
    disc.addColorStop(0.8, '#f0ead6');
    disc.addColorStop(1, '#d8d0bc');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.ellipse(mx, my, r * 1.08, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,140,130,0.28)';
    for (const [dx, dy, s] of [[-0.3, -0.2, 0.32], [0.25, 0.1, 0.24], [-0.05, 0.35, 0.18], [0.35, -0.35, 0.14]]) {
      ctx.beginPath();
      ctx.arc(mx + dx * r, my + dy * r, s * r, 0, Math.PI * 2);
      ctx.fill();
    }
    // A thin cloud across it.
    ctx.fillStyle = rgba(sky.haze, 0.55);
    ctx.beginPath();
    ctx.ellipse(mx + r * 0.8, my + r * 0.55, r * 3.2, r * 0.22, -0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // The treeline: black against the glow.
  ctx.fillStyle = '#020204';
  ctx.beginPath();
  ctx.moveTo(0, height);
  let x = 0;
  while (x <= width) {
    const hill = horizon + 6 - 10 * Math.sin(x * 0.004) - 6 * Math.sin(x * 0.013 + 1);
    ctx.lineTo(x, hill);
    if (kind !== 'none' && rnd() < 0.18) {
      const h = 14 + rnd() * 26, w = 6 + rnd() * 8;
      if (kind === 'pine') {
        for (let k = 0; k < 4; k++) {
          ctx.lineTo(x + w * 0.5 - k * 0.6, hill - h * (0.25 + k * 0.25));
          ctx.lineTo(x + w * 0.5 + k * 0.6 + 1, hill - h * (0.25 + k * 0.25) + h * 0.12);
        }
        ctx.lineTo(x + w, hill);
      } else {
        // A dead tree: a trunk and a few crooked limbs.
        ctx.lineTo(x + w * 0.45, hill - h);
        ctx.lineTo(x + w * 0.2, hill - h * 1.25);
        ctx.lineTo(x + w * 0.5, hill - h * 1.05);
        ctx.lineTo(x + w * 0.85, hill - h * 1.3);
        ctx.lineTo(x + w * 0.6, hill - h * 0.9);
        ctx.lineTo(x + w, hill);
      }
      x += w;
    }
    x += 6;
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  // Below the horizon, mist the grounds float in.
  const below = ctx.createLinearGradient(0, horizon, 0, height);
  below.addColorStop(0, rgba(sky.haze, 0.9));
  below.addColorStop(0.35, rgba(sky.haze, 0.45));
  below.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = below;
  ctx.fillRect(0, horizon + 4, width, height);
  return c;
}

export async function createStage(host) {
  const preference = new URLSearchParams(globalThis.location?.search ?? '').get('renderer');
  const renderer = await createRenderer(preference);
  const held = handheld();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, held ? HANDHELD.pixelRatio : 2));
  if (held) renderer.transmissionResolutionScale = HANDHELD.transmission;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = GFX.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new GFX.Scene();
  const camera = new GFX.PerspectiveCamera(LENS.fov, 1, 0.3, 500);

  if (renderer.isWebGPU && preference !== 'webgpu') {
    renderer.backend.onLost = () => {
      const old = renderer.domElement;
      const canvas = document.createElement('canvas');
      try {
        renderer.setBackend(new WebGLBackend(canvas), canvas);
        old.replaceWith(canvas);
        console.warn('blubber: the GPU went away; carrying on with WebGL 2.');
      } catch (err) {
        console.error('blubber: the GPU went away and WebGL 2 is not available.', err);
      }
    };
  }

  const hemi = new GFX.HemisphereLight(0x8a9ad0, 0x1a1420, 0.6);
  scene.add(hemi);
  const key = new GFX.DirectionalLight(0xc0ccff, 1.0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(held ? HANDHELD.shadowMap : 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  let span = 0;
  const shadowSpan = (zoom) => {
    const want = Math.ceil(15 * Math.max(1, zoom));
    if (want === span) return;
    span = want;
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 120 + span * 2 });
    key.shadow.camera.updateProjectionMatrix();
  };
  shadowSpan(1);
  scene.add(key, key.target);

  // Blubber's own light, carried with it.
  const glow = new GFX.PointLight(0x9a8cff, 7, 6.5, 1.6);
  scene.add(glow);
  // The lanterns and candles nearest it.
  const warmLights = Array.from({ length: WARM_LIGHTS }, () => {
    const light = new GFX.PointLight(0xff9a4a, 0, 6.5, 1.6);
    scene.add(light);
    return light;
  });
  let warm = [];

  const backdrop = new GFX.Mesh(
    new GFX.SphereGeometry(400, 64, 32),
    new GFX.MeshBasicMaterial({ name: 'sky', color: new GFX.Color('#ffffff'), side: GFX.BackSide, depthWrite: false }),
  );
  backdrop.renderOrder = -1;
  backdrop.frustumCulled = false;
  backdrop.onBeforeRender = (r, s, cam) => {
    backdrop.position.copy(cam.position);
    backdrop.updateMatrixWorld();
  };
  scene.add(backdrop);

  // Ground mist: soft wisps drifting low, wrapped round wherever Blubber is.
  const mistMap = mistTexture(GFX);
  const mistMaterial = new GFX.SpriteMaterial({ name: 'mist', map: mistMap, color: new GFX.Color('#9aa8d8'), opacity: 0.16, depthWrite: false });
  const rnd = seeded(91);
  const mists = Array.from({ length: mistMap ? MISTS : 0 }, () => {
    const s = new GFX.Sprite(mistMaterial);
    const size = 3 + rnd() * 4;
    s.scale.set(size * 1.8, size * 0.7, 1);
    s.userData = { ox: (rnd() - 0.5) * 34, oz: (rnd() - 0.5) * 30, y: 0.15 + rnd() * 0.9, drift: 0.15 + rnd() * 0.3, phase: rnd() * 10 };
    scene.add(s);
    return s;
  });

  let skyKey = null;
  const stage = {
    GFX, renderer, scene, camera, key, hemi,
    view: createView(),
    target: new GFX.Vector3(),
    /** Where Blubber is, for its light; set every frame. */
    ghost: new GFX.Vector3(),
    /** How bright Blubber's light is, and its colour. */
    glow,
    time: 0,
    /** The warm lights of the night now being played, as { at: [x, y, z], colour, strength }. */
    setWarm(list) { warm = list.map((w, i) => ({ seed: i * 1.91, strength: 1, colour: 0xff9a4a, ...w })); },

    /** Dresses the scene for a theme: its sky, its light, its mist. */
    dress(theme) {
      const id = `${theme.sky.top}${theme.sky.horizon}${theme.aurora}${theme.underground}`;
      if (id !== skyKey) {
        skyKey = id;
        const kind = theme.season === 'winter' ? 'pine' : theme.season === 'harvest' ? 'none' : 'dead';
        const sky = paintSky(theme.sky, { kind, aurora: theme.aurora, underground: theme.underground });
        if (sky) {
          const map = new GFX.CanvasTexture(sky);
          map.colorSpace = GFX.SRGBColorSpace;
          backdrop.material.map = map;
          backdrop.material.needsUpdate = true;
          // What shiny things reflect: the same sky, smaller.
          const small = paintSky(theme.sky, { width: 1024, kind, aurora: theme.aurora, underground: theme.underground });
          const texture = new GFX.Texture(small);
          texture.mapping = GFX.EquirectangularReflectionMapping;
          texture.colorSpace = GFX.SRGBColorSpace;
          texture.needsUpdate = true;
          const pmrem = new GFX.PMREMGenerator(renderer);
          scene.environment = pmrem.fromEquirectangular(texture).texture;
          pmrem.dispose();
        }
      }
      const a = theme.ambient;
      hemi.color.setRGB(a[0], a[1], a[2] * 1.1);
      if (theme.light?.sky) hemi.color.set(theme.light.sky);
      key.color.set(theme.light?.key ?? '#c0ccff');
      hemi.groundColor.setRGB(0.12, 0.1, 0.16);
      hemi.intensity = theme.underground ? 0.7 : 0.9;
      key.intensity = theme.underground ? 0.5 : theme.season === 'winter' ? 2.2 : 2.0;
      mistMaterial.color.set(theme.mist);
      mistMaterial.opacity = theme.underground ? 0.06 : 0.1;
    },
  };

  const direction = new GFX.Vector3();

  /** Points the camera and the lights at `stage.target` from where the view is; once a frame. */
  stage.look = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    camera.aspect = w / h;
    // An upright phone sees as much maze across as a wide screen does.
    camera.fov = LENS.fov * Math.max(1, Math.min(1.75, 0.8 * h / w));
    camera.updateProjectionMatrix();
    direction.set(...stage.view.direction());
    camera.position.copy(stage.target).addScaledVector(direction, LENS.distance * stage.view.zoom);
    shadowSpan(stage.view.zoom);
    camera.lookAt(stage.target);
    camera.updateMatrixWorld();
    key.position.copy(stage.target).addScaledVector(KEY, 50 + span);
    key.target.position.copy(stage.target);
    key.target.updateMatrixWorld();

    // Just under the crown: at 0.3 it sat right on it and burned a white spot into the top; this leaves a little of that glow.
    glow.position.set(stage.ghost.x, stage.ghost.y + 0.21, stage.ghost.z);
    const g = stage.ghost;
    const near = warm
      .map((t) => ({ t, d: Math.hypot(t.at[0] - g.x, t.at[2] - g.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, WARM_LIGHTS);
    warmLights.forEach((light, i) => {
      const n = near[i];
      if (!n) { light.intensity = 0; return; }
      light.position.set(n.t.at[0], n.t.at[1] + 0.35, n.t.at[2]);
      light.color.setHex(n.t.colour);
      const fade = Math.max(0, Math.min(1, (15 - n.d) / 5));
      light.intensity = 6.5 * n.t.strength * fade * flicker(stage.time, n.t.seed);
    });

    for (const s of mists) {
      const u = s.userData;
      const t = stage.time * u.drift + u.phase;
      // Each wisp keeps its place in a box round Blubber, wrapping as it goes by.
      const wrapTo = (v, centre, size) => centre + ((((v - centre) % size) + size * 1.5) % size) - size / 2;
      s.position.set(
        wrapTo(u.ox + t * 1.2, g.x, 34),
        (g.y - 0.6) + u.y + Math.sin(t) * 0.1,
        wrapTo(u.oz + Math.sin(t * 0.7) * 1.5, g.z, 30),
      );
    }
  };

  const fit = () => renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  fit();
  new ResizeObserver(fit).observe(host);

  stage.render = () => renderer.render(scene, camera);
  return stage;
}

/** How bright a flame is at `time`, for the real lights that stand in for the nearest ones. */
export function flicker(time, seed = 0) {
  const t = time * 9 + seed;
  return 1 + 0.12 * Math.sin(t) + 0.07 * Math.sin(t * 2.7 + 1) + 0.05 * Math.sin(t * 5.1 + 2);
}
