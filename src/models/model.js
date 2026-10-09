import { Sculpt, build } from './sdf.js';
import { Skeleton, skin } from './rig.js';

/**
 * A model is a definition — its bones, its materials, how it is sculpted
 * and how it moves — baked once into a mesh (`bake`) and stood up in the
 * world as many times as wanted (`createModel`), each with its own pose.
 *
 * A definition:
 *   name       what it is called
 *   bones      [name, parent, pivot], parents first (see rig.js)
 *   materials  { name: { roughness, metalness, sheen, sheenColor, sheenRoughness,
 *                clearcoat, clearcoatRoughness, emissive, emissiveIntensity,
 *                transmission, thickness, ior, attenuationColor,
 *                attenuationDistance, opacity, side } } — vertex colours
 *              give the colour
 *   cell       the grid step it is meshed at, in tiles
 *   cells      { part: step } for parts that need a finer grid (eyes, teeth)
 *   scale      how big it is stood up in the world (1 as sculpted)
 *   budget     how many vertices its board mesh may have (the tests hold it to this; 9000 if not given)
 *   sculpt(s)  adds its shapes to the Sculpt s (sdf.js)
 *   animate(skeleton, state)  poses it; state is { clip, t, time, seed, speed }
 */

const cache = new Map();

/**
 * The definition as a mesh: one set of vertices, triangles grouped by
 * material. `detail` divides the grid steps: 1 is as the definition asks,
 * 0.5 a quarter of the triangles (for far away).
 */
export function bake(def, { detail = 1 } = {}) {
  const key = `${def.name}@${detail}`;
  if (cache.has(key)) return cache.get(key);
  const cell = (def.cell ?? 0.012) / detail;
  const sculpt = new Sculpt();
  def.sculpt(sculpt);
  const bones = def.bones.map(([name]) => name);
  const matNames = Object.keys(def.materials);
  const buckets = matNames.map(() => []);
  const chunks = [];
  let base = 0;
  for (const [name, part] of sculpt.split()) {
    // Far off (detail under 1) the fine parts needn't be much finer than the rest: they're a few pixels.
    const fine = def.cells?.[name] ? Math.max(def.cells[name] / detail, detail < 1 ? cell * 0.35 : 0) : cell;
    const m = build(part, { cell: fine, bones, ambient: def.ambient ?? 0.3, shade: def.shade });
    chunks.push(m);
    // Each triangle takes the material most of its corners have.
    for (let t = 0; t < m.index.length; t += 3) {
      const a = m.mats[m.index[t]], b = m.mats[m.index[t + 1]], c = m.mats[m.index[t + 2]];
      const mat = b === c ? b : a;
      let mi = matNames.indexOf(mat);
      if (mi < 0) mi = 0;
      buckets[mi].push(m.index[t] + base, m.index[t + 1] + base, m.index[t + 2] + base);
    }
    base += m.count;
  }
  const join = (field, size, Type) => {
    const out = new Type(base * size);
    let o = 0;
    for (const c of chunks) { out.set(c[field], o); o += c.count * size; }
    return out;
  };
  const index = new Uint32Array(buckets.reduce((s, b) => s + b.length, 0));
  const groups = [];
  let start = 0;
  buckets.forEach((b, materialIndex) => {
    if (!b.length) return;
    index.set(b, start);
    groups.push({ start, count: b.length, materialIndex });
    start += b.length;
  });
  const baked = {
    position: join('position', 3, Float32Array),
    normal: join('normal', 3, Float32Array),
    color: join('color', 3, Float32Array),
    skinIndex: join('skinIndex', 4, Uint8Array),
    skinWeight: join('skinWeight', 4, Float32Array),
    index: base > 65535 ? index : Uint16Array.from(index),
    groups,
    count: base,
  };
  cache.set(key, baked);
  return baked;
}

const materialCache = new WeakMap();

/**
 * The definition's materials, made once. `tint` multiplies the colour of
 * the ones the definition marks `tinted` (a sweet's wrapper, say), so one
 * bake can be many colours.
 */
function materialsOf(GFX, def, tint = null) {
  let byDef = materialCache.get(GFX);
  if (!byDef) materialCache.set(GFX, (byDef = new Map()));
  const id = tint ? `${def.name}:${tint}` : def.name;
  if (!byDef.has(id)) {
    byDef.set(id, Object.entries(def.materials).map(([name, m]) => {
      const { emissive, sheenColor, attenuationColor, side, tinted, ...rest } = m;
      const material = new GFX.MeshPhysicalMaterial({ name: `${def.name}-${name}`, vertexColors: true, roughness: 0.6, ...rest });
      if (tint && tinted) material.color.set(tint);
      if (emissive) material.emissive.set(emissive);
      if (sheenColor) material.sheenColor.set(sheenColor);
      if (attenuationColor) material.attenuationColor.set(attenuationColor);
      if (side === 'double') material.side = GFX.DoubleSide;
      if (rest.opacity !== undefined && rest.opacity < 1) material.transparent = true;
      return material;
    }));
  }
  return byDef.get(id);
}

/** The definition's materials (shared by every copy), for meshes made elsewhere from its bake: the merged scenery. */
export const materialsFor = (GFX, def, tint = null) => materialsOf(GFX, def, tint);

/** A mesh baked elsewhere (a worker: see library.js), to be used as if baked here. */
export function adopt(def, detail, data) {
  cache.set(`${def.name}@${detail}`, data);
}

/**
 * One of `def`, to put in a scene: `mesh` (in a `group` to move about), and
 * `pose(state)` to set it moving. `detail` as for `bake`.
 */
export function createModel(GFX, def, { detail = 1 } = {}) {
  const data = bake(def, { detail });
  const geometry = new GFX.BufferGeometry();
  const position = new GFX.BufferAttribute(data.position.slice(), 3);
  const normal = new GFX.BufferAttribute(data.normal.slice(), 3);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  geometry.setAttribute('color', sharedAttribute(GFX, data, 'color'));
  geometry.setIndex(sharedAttribute(GFX, data, 'index'));
  for (const g of data.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.computeBoundingSphere();
  // Room for the poses to reach out of the rest pose's sphere.
  geometry.boundingSphere.radius *= 1.5;
  const mesh = new GFX.Mesh(geometry, materialsOf(GFX, def));
  mesh.name = def.name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new GFX.Group();
  mesh.scale.setScalar(def.scale ?? 1);
  group.add(mesh);
  const skeleton = new Skeleton(def.bones);
  return {
    def,
    group,
    mesh,
    skeleton,
    materials: mesh.material,
    /** Poses it for `state` ({ clip, t, time, seed, … }) and moves the skin to match. */
    pose(state) {
      skeleton.reset();
      def.animate?.(skeleton, state);
      skeleton.compute();
      skin(data, skeleton.matrices, position.array, normal.array);
      position.needsUpdate = true;
      normal.needsUpdate = true;
    },
  };
}

const statics = new WeakMap();

/**
 * One of `def` that never moves (a prop): a mesh in its rest pose, sharing
 * its geometry and materials with every other one of it. `detail` as for
 * `bake`.
 */
export function createStatic(GFX, def, { detail = 1, tint = null } = {}) {
  const data = bake(def, { detail });
  let byGFX = statics.get(data);
  if (!byGFX) statics.set(data, (byGFX = new Map()));
  if (!byGFX.has(GFX)) {
    const geometry = new GFX.BufferGeometry();
    geometry.setAttribute('position', new GFX.BufferAttribute(data.position, 3));
    geometry.setAttribute('normal', new GFX.BufferAttribute(data.normal, 3));
    geometry.setAttribute('color', sharedAttribute(GFX, data, 'color'));
    geometry.setIndex(sharedAttribute(GFX, data, 'index'));
    for (const g of data.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
    geometry.computeBoundingSphere();
    byGFX.set(GFX, geometry);
  }
  const mesh = new GFX.Mesh(byGFX.get(GFX), materialsOf(GFX, def, tint));
  mesh.name = def.name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(def.scale ?? 1);
  return mesh;
}

const shared = new WeakMap();

/** The attributes every copy of a model has the same of, made once. */
function sharedAttribute(GFX, data, field) {
  let byGFX = shared.get(data);
  if (!byGFX) shared.set(data, (byGFX = new Map()));
  if (!byGFX.has(field)) byGFX.set(field, new GFX.BufferAttribute(data[field], field === 'index' ? 1 : 3));
  return byGFX.get(field);
}
