import { createActors } from './actors.js';
import { createBlubber } from './blubber.js';
import { createEffects } from './effects.js';
import { buildGrounds } from './grounds.js';
import { createHaunt, litCount, moons, SPOOK, STEP_TIME, stepHaunt } from './haunt.js';
import { createIce } from './ice.js';
import { nightWords, t } from './lang.js';
import { decorDetailOf, detailOf, hurry, readyAll } from './models/library.js';
import { buildNight } from './night.js';
import { NIGHTS } from './nights.js';
import { createDecor } from './decor.js';
import { createGate, createGroundMeshes, createWallLights } from './scenery.js';
import { groundAxes } from './view.js';

/**
 * The game: the nights one after another, October to December. Each is a
 * maze to float round, lighting every lantern so the moon gate opens, and
 * eating what candy can be got on the way; out through the gate, the night
 * is tallied in moons. Nothing ends a run: getting caught only spills some
 * candy.
 *
 * Blubber is the Blueberry avatar as it is (blubber.js); what it is doing
 * shows in its own four moods — idle when it hangs still, listening as it
 * floats along, speaking when it spooks, thinking when it has just been
 * caught.
 */

/** How the camera sits for the title: low, so the sky and the moon show, and circling. */
const TITLE = Object.freeze({ zoom: 0.62, pitch: 0.42, turn: 0.12 });

/** The light baked into the ground round each lit lantern, candle and the open gate: [reach, [r, g, b]]. */
const BAKE = {
  lantern: [6.5, [1.0, 0.5, 0.14]],
  scenery: [5, [0.85, 0.42, 0.12]],
  candle: [4.2, [0.8, 0.45, 0.16]],
  gate: [6, [0.45, 0.32, 0.95]],
  shut: [3.5, [0.12, 0.08, 0.3]],
  ghost: [0, [0, 0, 0]],
};

export function createGame({ stage, hud, input, audio, storage }) {
  const { GFX, scene, view } = stage;
  const effects = createEffects(GFX, scene);
  const blubber = createBlubber(GFX);
  scene.add(blubber.group);

  let index = 0;
  let night = null, haunt = null, world = null;
  let state = 'title'; // title · ready · play · out · tally
  let paused = false, timer = 0, accumulator = 0, baking = false;
  let saved = storage.load();
  let runCandy = 0;
  let speaking = 0;
  let lastLit = -1, gateOpen = 0;
  /** When the scenery was last looked at for anything newly baked to put in. */
  let sceneryCheck = 0;

  /** Builds night `i` and puts it in the scene. */
  function setNight(i) {
    if (world) scene.remove(world.group);
    index = i;
    night = buildNight(NIGHTS[i]);
    haunt = createHaunt(night, { seed: 1000 + i });
    const look = night.recipe.look;
    stage.dress(look);
    const group = new GFX.Group();
    const built = buildGrounds(night.grounds, look);
    const grounds = createGroundMeshes(GFX, built, look);
    const wallLights = night.candles.length ? createWallLights(GFX, night.candles, look.candle) : null;
    const gate = createGate(GFX, night.gate, look);
    const actors = createActors(GFX, haunt);
    const decor = createDecor(GFX, night);
    const ice = look.ice ? createIce(GFX, night) : null;
    group.add(grounds.group, gate.group, actors.group, decor.group);
    if (wallLights) group.add(wallLights.group);
    if (ice) group.add(ice.group);
    world = { group, grounds, gate, actors, wallLights, decor, ice, built };
    scene.add(group);
    effects.setGrounds(night.grounds);
    accumulator = 0;
    lastLit = -1;
    gateOpen = 0;
    relight();
    const g = haunt.ghost;
    stage.target.set(g.x, g.y, g.z);
    hud.map(haunt);
    // Everything in it is sculpted in the background. What Blubber deals with is baked first, and the
    // night waits a moment for it; the scenery comes after, and is put in as it arrives.
    const here = haunt;
    const kinds = new Set([
      ...night.candy.map((c) => c.kind), ...night.treats.map((t) => t.kind),
      night.recipe.lantern, night.recipe.dark,
      ...night.chasers.map((c) => c.kind), ...night.rollers.map((r) => r.kind), ...night.flyers.map((f) => f.kind),
      night.hands.length ? 'hand' : null,
    ].filter(Boolean));
    const needed = [...kinds].map((k) => [k, detailOf(k)]);
    hurry([...needed, ...[...new Set(night.decor.map((d) => d.kind))].map((k) => [k, decorDetailOf(k)])]);
    baking = true;
    readyAll(needed, 2500).then(() => {
      if (haunt !== here) return;
      baking = false;
      warmUp();
    });
    sceneryCheck = 0;
    warmUp();
  }

  /** Bakes the light of every lit lantern, candle and the gate into the ground. */
  function relight() {
    const lights = [];
    const add = (x, y, z, [reach, colour]) => lights.push([x, y, z, reach, colour]);
    for (const l of haunt.lanterns) if (l.lit) add(l.x, l.y + 0.4, l.z, BAKE.lantern);
    for (const c of night.candles) add(c.x, c.y + 0.3, c.z, BAKE.candle);
    for (const d of night.decor) if (d.glow) add(d.x, d.y + 0.35, d.z, BAKE.scenery);
    add(night.gate.x, night.gate.y + 1, night.gate.z, haunt.open ? BAKE.gate : BAKE.shut);
    world.grounds.relight(lights);
    stage.setWarm(warmLights());
  }

  /** Every warm light in the night: the lit lanterns, the candles on the walls, the lit ones among the scenery. */
  function warmLights() {
    const scenery = night.decor.filter((d) => d.glow).map((d, i) => ({ at: [d.x, d.y + 0.3, d.z], seed: i * 3.1, colour: 0xff9440, strength: 0.8 }));
    return [...world.actors.lights(), ...(world.wallLights?.lights ?? []), ...scenery];
  }

  /** Draws the whole night once with nothing culled, so every shader is ready before it is needed. */
  function warmUp() {
    const off = [];
    world.group.traverse((o) => {
      if ((o.isMesh || o.isSprite) && o.frustumCulled) { o.frustumCulled = false; off.push(o); }
    });
    try { stage.look(); stage.render(); } finally { for (const o of off) o.frustumCulled = true; }
  }

  function enter(next) {
    state = next;
    timer = 0;
  }

  function showTitle() {
    setNight(0);
    enter('title');
    paused = false;
    hud.paused(false);
    Object.assign(view.aim, { zoom: TITLE.zoom, pitch: TITLE.pitch });
    audio.stopMusic();
    hud.title(saved);
    blubber.setMode('idle');
  }

  function startRun(i) {
    runCandy = 0;
    beginNight(i);
  }

  function beginNight(i) {
    setNight(i);
    saved = storage.reached(i);
    view.reset();
    view.step(0, true);
    enter('ready');
    hud.play(night, i);
    // The title has no room to say how a finger steers, so the first night says it.
    const touch = i === 0 && globalThis.matchMedia?.('(pointer: coarse)').matches;
    const { name, intro } = nightWords(night.recipe);
    hud.banner(name, 'big', touch ? `${intro}\n${t('touchHint')}` : intro);
    hud.candy(0);
    hud.lanterns(haunt);
    hud.clock(0, night.recipe.par);
    blubber.setMode('idle');
    audio.wake();
    audio.night(night.season);
    audio.startMusic(night.season, i);
  }

  function escaped() {
    enter('out');
    audio.stopMusic();
    audio.escape();
    hud.banner(null);
    const won = moons({ carried: haunt.carried, total: haunt.total, time: haunt.time, par: night.recipe.par });
    runCandy += haunt.carried;
    saved = storage.moons(index, won);
    saved = storage.reached(Math.min(NIGHTS.length - 1, index + 1));
    const last = index === NIGHTS.length - 1;
    if (last) saved = storage.record(runCandy);
    tally = { night, index, carried: haunt.carried, total: haunt.total, time: haunt.time, par: night.recipe.par, caught: haunt.caught, moons: won, last };
  }
  let tally = null;

  function onward() {
    if (state !== 'tally') return;
    if (index === NIGHTS.length - 1) {
      saved = storage.record(runCandy);
      showTitle();
    } else {
      beginNight(index + 1);
    }
  }

  function again() {
    if (state !== 'tally') return;
    beginNight(index);
  }

  function step(push, spook) {
    const out = stepHaunt(haunt, push, { spook, live: state === 'play' });
    const g = haunt.ghost;
    for (const c of out.eaten) {
      const big = c.amount > 1;
      effects.sparkle(c.x, (night.grounds.heightAt(c.x, c.z) ?? 0) + 0.35, c.z, big ? '#fff0a8' : '#ffd27a', big ? 22 : 8);
      audio.candy(big);
    }
    if (out.eaten.length) hud.candy(haunt.carried);
    if (out.lit) {
      const l = out.lit;
      effects.kindle(l.x, l.y + 0.35, l.z, night.season === 'winter' ? '#bfe6ff' : '#ffb040');
      audio.lantern();
      hud.lanterns(haunt);
      relight();
      const n = litCount(haunt), all = haunt.lanterns.length;
      if (!out.opened) hud.banner(t('lit', n, all), 'normal', t('left', all - n));
    }
    if (out.opened) {
      audio.gate();
      relight();
      hud.banner(t('gateOpens'), 'big berry', t('floatOut'));
    }
    if (out.spooked) {
      speaking = 0.9;
      effects.ring(g.x, g.ground ?? 0, g.z, SPOOK.reach);
      audio.spook(out.spooked.length);
    }
    if (out.caught) {
      effects.splash(g.x, g.y, g.z);
      audio.caught(out.caught.lost);
      hud.candy(haunt.carried);
      if (out.caught.lost) hud.banner(`−${out.caught.lost}`, 'normal');
    }
    if (out.bump > 2.5) audio.bump(out.bump);
    if (out.escaped) escaped();
  }

  function update(dt, presses) {
    const stick = input.stick();
    const look = input.view(dt);
    if (state !== 'title') {
      view.turn(look.turn, look.tilt);
      view.zoomBy(look.zoom);
    } else {
      view.aim.yaw += TITLE.turn * dt;
    }
    view.step(dt);
    stage.time += dt;

    let spook = false;
    for (const p of presses) {
      if (p === 'mute') hud.muted(audio.toggleMute());
      if (p === 'home' && state !== 'title') view.reset();
      if (p === 'pause' && (state === 'play' || state === 'ready')) {
        paused = !paused;
        hud.paused(paused);
        if (paused) audio.stopMusic(); else audio.startMusic(night.season, index);
      }
      if (state === 'title' && (p === 'start' || p === 'spook')) startRun(0);
      else if (state === 'tally' && p === 'start' && timer > 0.6) onward();
      else if (state === 'play' && p === 'spook') spook = true;
    }
    if (paused) return;

    timer += dt;
    const axes = groundAxes(view.yaw);
    const push = state === 'play'
      ? [axes.right[0] * stick.x + axes.up[0] * stick.y, axes.right[1] * stick.x + axes.up[1] * stick.y]
      : [0, 0];
    accumulator = Math.min(accumulator + dt, STEP_TIME * 24);
    let first = true;
    while (accumulator >= STEP_TIME) {
      accumulator -= STEP_TIME;
      step(push, spook && first);
      first = false;
    }

    switch (state) {
      case 'ready':
        // Off as soon as the player pushes, or after a moment; once what Blubber deals with is there.
        if (!baking && (timer > 2.2 || (timer > 0.4 && (Math.hypot(stick.x, stick.y) > 0.3 || presses.length)))) { enter('play'); hud.banner(null); }
        break;
      case 'play':
        if (timer > 2.4 && hud.bannerShown && !haunt.open) hud.banner(null);
        hud.clock(haunt.time, night.recipe.par);
        if (!night.midnight && haunt.time > night.recipe.par) { night.midnight = true; audio.midnight(); }
        break;
      case 'out':
        if (timer > 1.6) { enter('tally'); hud.tally(tally); audio.tally(tally.moons); }
        break;
    }

    // Blubber: where the haunt has it, in the mood for what it is doing.
    const g = haunt.ghost;
    const speed = Math.hypot(g.vx, g.vz);
    speaking = Math.max(0, speaking - dt);
    let mood = 'idle';
    if (haunt.safe > 0) mood = 'thinking';
    else if (speaking > 0) mood = 'speaking';
    else if (speed > 1.2) mood = 'listening';
    if (state === 'title') mood = 'idle';
    blubber.setMode(mood);
    blubber.update(dt);
    if (state === 'out') {
      // Drawn into the gate, and gone.
      const k = Math.min(1, timer / 1.2);
      g.x += (night.gate.x - g.x) * Math.min(1, dt * 4);
      g.z += (night.gate.z - g.z) * Math.min(1, dt * 4);
      blubber.group.scale.setScalar(Math.max(0.001, 1 - k));
    } else {
      blubber.group.scale.setScalar(1);
    }
    blubber.group.position.set(g.x, g.y, g.z);
    blubber.group.visible = !(haunt.safe > 0 && Math.sin(haunt.safe * 30) > 0.3);
    stage.ghost.set(g.x, g.y, g.z);
    stage.glow.color.copy(blubber.tint).lerp(new GFX.Color('#b9aeff'), 0.4);
    stage.glow.intensity = 6 + blubber.halo * 10;

    if (haunt.open) gateOpen = Math.min(1, gateOpen + dt * 0.8);
    world.gate.open(gateOpen);
    world.gate.update(stage.time);
    world.grounds.update(stage.time);
    world.wallLights?.update(stage.time);
    world.ice?.update(stage.time);
    world.decor.update(dt);
    sceneryCheck -= dt;
    if (sceneryCheck <= 0 && !world.decor.complete) {
      sceneryCheck = 0.4;
      world.decor.build();
    }
    world.actors.sync(dt, stage.time);
    if (litCount(haunt) !== lastLit) { lastLit = litCount(haunt); stage.setWarm(warmLights()); }
    effects.update(dt);
    hud.spook(1 - haunt.spookWait / SPOOK.every);
    hud.tick(dt, haunt);
    audio.floating(state === 'play' ? speed : 0);

    // The camera follows Blubber.
    const k = 1 - Math.exp(-(state === 'title' ? 2 : 6) * dt);
    stage.target.x += (g.x - stage.target.x) * k;
    stage.target.y += (g.y - 0.4 - stage.target.y) * k;
    stage.target.z += (g.z - stage.target.z) * k;
    if (debug.look) {
      stage.target.set(...debug.look.at);
      view.zoom = view.aim.zoom = debug.look.zoom;
      if (debug.look.pitch != null) view.pitch = view.aim.pitch = debug.look.pitch;
      if (debug.look.yaw != null) view.yaw = view.aim.yaw = debug.look.yaw;
    }
  }

  /** For tests and the console. */
  const debug = {
    stage, look: null,
    get haunt() { return haunt; },
    get night() { return night; },
    get state() { return state; },
    /** Straight into play, past the night's banner (the slow software renderer takes an age otherwise). */
    play() { if (state === 'ready') { baking = false; enter('play'); hud.banner(null); } },
    /** Puts Blubber at (x, z). */
    put(x, z) { Object.assign(haunt.ghost, { x, z, vx: 0, vz: 0 }); },
    /** Puts Blubber at (x, z) and takes one step there, so whatever is there happens. */
    visit(x, z) { Object.assign(haunt.ghost, { x, z, vx: 0, vz: 0 }); step([0, 0], false); },
    /** On to the tally, if Blubber is on its way out. */
    hurry() { if (state === 'out') timer = 10; },
  };

  showTitle();

  return {
    update,
    startRun,
    onward,
    again,
    get state() { return state; },
    get paused() { return paused; },
    /** Nothing much is moving: the title, a pause, the tally. It can be drawn less often. */
    get calm() { return paused || state === 'title' || state === 'tally'; },
    /** Where Blubber is on the screen, in CSS pixels, for the pointer controls. */
    ghostOnScreen(rect) {
      const g = haunt.ghost;
      const v = new GFX.Vector3(g.x, g.y, g.z).project(stage.camera);
      return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
    },
    debug,
  };
}
