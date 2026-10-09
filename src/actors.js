import { detailOf, isBaked, SCULPTED } from './models/library.js';
import { createModel, createStatic } from './models/model.js';
import { glow } from './textures.js';

/**
 * Everything in a night that is drawn and moves or can be taken: the
 * sweets and treats, the lanterns (dark until Blubber lights them), what
 * chases, what grabs from the ground, what rolls and what flies, and the
 * candy Blubber spills when it is caught. Each follows its state in the
 * haunt (haunt.js) every frame.
 *
 * Every one of them is sculpted (models/); until a model has baked, a
 * plain stand-in shape is drawn in its place, and swapped out once it has.
 */

/** Stand-in shapes and colours, while the sculpted ones bake. */
const STAND_IN = {
  sweet: ['#ff8a2a', 0.09], candycorn: ['#ffc040', 0.08], lollipop: ['#ff5a9a', 0.16], caramelapple: ['#c0302a', 0.15],
  peppermint: ['#ffffff', 0.09], gumdrop: ['#5aff8a', 0.08], candycane: ['#ff3a3a', 0.15],
  pumpkin: ['#e06a10', 0.3], jack: ['#ff9a20', 0.3], gourd: ['#e8e0c0', 0.28], whitepumpkin: ['#e8e0c0', 0.28], snowlantern: ['#eef4ff', 0.28], snowheap: ['#eef4ff', 0.28],
  zombie: ['#6a9a5a', 0.3], turkey: ['#7a4a2a', 0.3], snowman: ['#f0f4ff', 0.32],
  hand: ['#7aa060', 0.12], bigpumpkin: ['#e07018', 0.42], haybale: ['#d8b860', 0.42], snowball: ['#f4f8ff', 0.42],
  bat: ['#3a2a3a', 0.15], crow: ['#1a1a20', 0.15],
};

/** How much bigger than life the sweets are drawn, to read from up where the camera is. */
const SWEET_SIZE = 1.7;

/** Which sweet is drawn for what the haunt calls it. */
const SWEET_COLOURS = { sweet: ['#ff8a2a', '#9a5aff', '#5ad06a'], gumdrop: ['#ff4a6a', '#5ad06a', '#ffb02a', '#9a6aff'] };

export function createActors(GFX, haunt) {
  const group = new GFX.Group();
  group.name = 'actors';
  const night = haunt.night;
  const standInGeometry = new GFX.SphereGeometry(1, 16, 12);
  const standInMaterials = new Map();
  const standIn = (kind) => {
    const [colour, size] = STAND_IN[kind] ?? ['#ff00ff', 0.2];
    if (!standInMaterials.has(kind)) standInMaterials.set(kind, new GFX.MeshStandardMaterial({ name: `stand-in-${kind}`, color: new GFX.Color(colour), roughness: 0.6 }));
    const m = new GFX.Mesh(standInGeometry, standInMaterials.get(kind));
    m.scale.setScalar(size);
    m.position.y = size;
    m.castShadow = true;
    return m;
  };

  /**
   * One thing to draw: its sculpted model if it has baked (still, or
   * posable if `posed`), otherwise a stand-in until it has. `tint` colours a
   * still one (the sweets' wrappers).
   */
  const items = [];
  function thing(kind, { posed = false, tint = null, at = null, shadow = true } = {}) {
    const holder = new GFX.Group();
    const item = { kind, holder, posed, model: null, shown: null, tint };
    const show = () => {
      if (item.shown && item.model) return;
      const def = SCULPTED[kind];
      const d = detailOf(kind);
      if (def && isBaked(kind, d)) {
        if (item.shown) holder.remove(item.shown);
        if (posed) {
          item.model = createModel(GFX, def, { detail: d });
          item.shown = item.model.group;
        } else {
          item.shown = createStatic(GFX, def, { detail: d, tint });
          item.model = { still: true };
        }
        holder.add(item.shown);
      } else if (!item.shown) {
        item.shown = standIn(kind);
        holder.add(item.shown);
      }
      if (!shadow) item.shown.traverse((o) => { o.castShadow = false; });
    };
    item.show = show;
    show();
    if (at) holder.position.set(at.x, at.y ?? 0, at.z);
    group.add(holder);
    items.push(item);
    return item;
  }

  // The sweets: each spins and bobs where it lies.
  const sweets = haunt.candy.map((c, i) => {
    const colours = SWEET_COLOURS[c.kind];
    const t = thing(c.kind, { tint: colours ? colours[i % colours.length] : null, at: c, shadow: false });
    t.holder.rotation.y = i * 2.1;
    t.holder.scale.setScalar(SWEET_SIZE);
    t.data = c;
    return t;
  });
  const treats = haunt.treats.map((c) => {
    const t = Object.assign(thing(c.kind, { at: c }), { data: c });
    t.holder.scale.setScalar(1.5);
    return t;
  });

  // The lanterns: dark, and lit when Blubber reaches them — with a flame, a halo and real light.
  const haloMap = glow(GFX);
  const lanterns = haunt.lanterns.map((l, i) => {
    const dark = thing(night.recipe.dark, { at: l });
    dark.holder.rotation.y = Math.PI + (i % 3 - 1) * 0.3;
    const lit = thing(night.recipe.lantern, { at: l });
    lit.holder.rotation.y = dark.holder.rotation.y;
    lit.holder.visible = false;
    const halo = haloMap ? new GFX.Sprite(new GFX.SpriteMaterial({ name: 'lantern-halo', map: haloMap, color: new GFX.Color('#ffb060'), blending: GFX.AdditiveBlending, depthWrite: false, opacity: 0.85 })) : null;
    if (halo) {
      halo.position.set(0, 0.32, 0);
      halo.scale.set(1.9, 1.9, 1);
      lit.holder.add(halo);
    }
    return { data: l, dark, lit, halo, litAt: -1 };
  });

  const chasers = haunt.chasers.map((c) => Object.assign(thing(c.kind, { posed: true, at: c }), { data: c, clip: 'idle', since: 0 }));
  const hands = haunt.hands.map((hd) => Object.assign(thing('hand', { posed: true, at: hd }), { data: hd, mound: null }));
  const rollers = haunt.rollers.map((r) => Object.assign(thing(r.kind, { at: { x: r.x, y: r.y ?? 0, z: r.z } }), { data: r }));
  const flyers = haunt.flyers.map((f) => Object.assign(thing(f.kind, { posed: true, at: f }), { data: f }));

  // A mound of disturbed earth where each hand comes up.
  const moundMaterial = new GFX.MeshStandardMaterial({ name: 'mound', color: new GFX.Color('#4a3a2c'), roughness: 1 });
  const moundGeometry = new GFX.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const hd of hands) {
    const mound = new GFX.Mesh(moundGeometry, moundMaterial);
    mound.scale.set(1, 0.18, 0.8);
    mound.position.set(hd.data.x, hd.data.y ?? 0, hd.data.z);
    mound.receiveShadow = true;
    group.add(mound);
    hd.mound = mound;
  }

  // The candy Blubber spills, from a pool.
  const spilled = [];
  const pool = () => {
    const t = thing(night.recipe.sweets[0], { tint: SWEET_COLOURS[night.recipe.sweets[0]]?.[0] ?? null, shadow: false });
    t.holder.visible = false;
    t.holder.scale.setScalar(SWEET_SIZE);
    spilled.push(t);
    return t;
  };
  for (let k = 0; k < 10; k++) pool();

  const sync = (dt, time) => {
    for (const it of items) if (!it.model) it.show();
    const g = haunt.ghost;
    const near = (x, z, r = 22) => Math.abs(x - g.x) < r && Math.abs(z - g.z) < r;

    for (const s of sweets) {
      const c = s.data;
      s.holder.visible = !c.taken;
      if (c.taken || !near(c.x, c.z)) continue;
      const ground = night.grounds.heightAt(c.x, c.z) ?? c.y;
      s.holder.position.set(c.x, ground + 0.22 + Math.sin(time * 2.4 + c.x * 1.3 + c.z) * 0.06, c.z);
      s.holder.rotation.y += dt * 1.6;
    }
    for (const s of treats) {
      const c = s.data;
      s.holder.visible = !c.taken;
      if (c.taken) continue;
      const ground = night.grounds.heightAt(c.x, c.z) ?? c.y;
      s.holder.position.set(c.x, ground + 0.12 + Math.sin(time * 1.8 + c.x) * 0.06, c.z);
      s.holder.rotation.y += dt * 0.9;
    }
    for (const l of lanterns) {
      const lit = l.data.lit;
      if (lit && l.litAt < 0) l.litAt = time;
      l.dark.holder.visible = !lit;
      l.lit.holder.visible = lit;
      if (lit) {
        // It pops a little as it catches, then glows on, flickering.
        const t = time - l.litAt;
        const pop = t < 0.5 ? 1 + Math.sin((t / 0.5) * Math.PI) * 0.25 : 1;
        l.lit.holder.scale.setScalar(pop);
        if (l.halo) l.halo.material.opacity = 0.75 + 0.15 * Math.sin(time * 9 + l.data.x);
      }
    }
    for (const c of chasers) {
      const d = c.data;
      c.holder.position.set(d.x, d.y ?? 0, d.z);
      // Turned to where it is going, eased.
      let turn = d.facing - c.holder.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      c.holder.rotation.y += turn * Math.min(1, dt * 8);
      const clip = d.stunned > 0 ? 'attack' : d.state === 'scared' ? 'scared' : d.moving ? 'walk' : 'idle';
      if (clip !== c.clip) { c.clip = clip; c.since = 0; }
      c.since += dt;
      if (c.model?.pose && near(d.x, d.z, 16)) c.model.pose({ clip, t: c.since, time, seed: d.id * 3.7, speed: d.state === 'chase' ? 1 : 0.6 });
      else if (!c.model?.pose) c.shown.position.y = 0.3 + Math.abs(Math.sin(time * 6 + d.id)) * 0.08;
    }
    for (const hd of hands) {
      const d = hd.data;
      const up = d.out;
      hd.holder.position.set(d.x, (d.y ?? 0) - 0.55 + up * 0.55, d.z);
      hd.holder.visible = up > 0.01;
      hd.mound.position.y = (d.y ?? 0) + (d.rumble ? Math.sin(time * 40) * 0.02 : 0);
      if (hd.model?.pose && up > 0.01) hd.model.pose({ clip: 'grab', t: up, time, seed: d.x });
    }
    for (const r of rollers) {
      const d = r.data;
      r.holder.position.set(d.x, d.y ?? 0, d.z);
      const dx = d.to[0] - d.from[0], dz = d.to[1] - d.from[1];
      r.holder.rotation.y = Math.atan2(dx, dz);
      // Rolled over and over along the way it goes.
      if (r.shown) {
        r.shown.rotation.x = d.spin;
        r.shown.position.y = r.model?.still ? 0.42 : 0.42;
        if (r.model?.still) r.shown.position.set(0, 0.42, 0);
      }
    }
    for (const f of flyers) {
      const d = f.data;
      f.holder.position.set(d.x, d.y, d.z);
      f.holder.rotation.y = d.facing ?? 0;
      if (f.model?.pose && near(d.x, d.z, 18)) f.model.pose({ clip: 'walk', t: 0, time, seed: d.phase * 10, speed: 1 });
    }
    // The spilled candy, wherever it is lying.
    while (spilled.length < haunt.dropped.length) pool();
    spilled.forEach((s, i) => {
      const c = haunt.dropped[i];
      s.holder.visible = Boolean(c) && (c.age < 5.5 || Math.sin(c.age * 20) > 0);
      if (!c) return;
      const ground = night.grounds.heightAt(c.x, c.z) ?? 0;
      const hop = c.age < 0.5 ? Math.sin((c.age / 0.5) * Math.PI) * 0.6 : 0;
      s.holder.position.set(c.x, ground + 0.28 + hop, c.z);
      s.holder.rotation.y += dt * 3;
    });
  };

  return {
    group,
    sync,
    /** Where the warm lights are: every lit lantern. */
    lights() {
      return haunt.lanterns.filter((l) => l.lit).map((l, i) => ({ at: [l.x, (l.y ?? 0) + 0.35, l.z], seed: i * 2.3, colour: 0xff9a40 }));
    },
  };
}
