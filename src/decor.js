import { createIceCube } from './ice.js';
import { decorDetailOf, isBaked, SCULPTED } from './models/library.js';
import { bake, materialsFor } from './models/model.js';
import { glow } from './textures.js';

/**
 * The scenery a night is dressed with — the pumpkins, gravestones, trees,
 * hay and the rest round the outside of the maze, in its rooms and tucked
 * into its dead ends. None of it moves, so each kind is merged into one
 * mesh: every copy of it baked into the same vertices, turned and sized
 * where it stands, and drawn in one go.
 *
 * The kinds are sculpted (models/props) and baked in the background;
 * `build()` puts in whatever has baked so far, and is called again once
 * everything has. An `icecube` in a room is the Ice Cube avatar itself,
 * drifting.
 */
/** How big a patch of the grounds each merged mesh of scenery covers, in tiles. */
const PATCH = 12;

export function createDecor(GFX, night) {
  const group = new GFX.Group();
  group.name = 'decor';
  const built = new Set();
  const cubes = [];
  const byKind = new Map();
  for (const d of night.decor) {
    if (!byKind.has(d.kind)) byKind.set(d.kind, []);
    byKind.get(d.kind).push(d);
  }

  function build() {
    for (const [kind, list] of byKind) {
      if (built.has(kind)) continue;
      if (kind === 'icecube') {
        for (const d of list) {
          const cube = createIceCube(GFX);
          const holder = new GFX.Group();
          holder.position.set(d.x, d.y + 0.95, d.z);
          holder.add(cube.group);
          group.add(holder);
          cubes.push(cube);
        }
        built.add(kind);
        continue;
      }
      const def = SCULPTED[kind];
      if (!def || !isBaked(kind, decorDetailOf(kind))) continue;
      // In patches of the grounds, so what is off screen isn't drawn.
      const patches = new Map();
      for (const d of list) {
        const k = `${Math.floor(d.x / PATCH)},${Math.floor(d.z / PATCH)}`;
        if (!patches.has(k)) patches.set(k, []);
        patches.get(k).push(d);
      }
      for (const patch of patches.values()) group.add(merged(GFX, def, patch));
      built.add(kind);
    }
  }
  build();

  // A halo round each lit lantern among the scenery.
  const haloMap = glow(GFX);
  if (haloMap) {
    const material = new GFX.SpriteMaterial({ name: 'scenery-halo', map: haloMap, color: new GFX.Color('#ffb060'), blending: GFX.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    for (const d of night.decor) {
      if (!d.glow) continue;
      const halo = new GFX.Sprite(material);
      halo.position.set(d.x, d.y + 0.3 * (d.scale ?? 1), d.z);
      halo.scale.set(1.7, 1.7, 1);
      group.add(halo);
    }
  }

  return {
    group,
    build,
    /** Whether every kind of scenery is in. */
    get complete() { return built.size === byKind.size; },
    update(dt) { for (const c of cubes) c.update(dt); },
  };
}

/** Every copy of `def` in `list` ({ x, y, z, turn, scale }), in one mesh. */
function merged(GFX, def, list) {
  const data = bake(def, { detail: decorDetailOf(def.name) });
  const n = data.count;
  const position = new Float32Array(n * 3 * list.length);
  const normal = new Float32Array(n * 3 * list.length);
  const color = new Float32Array(n * 3 * list.length);
  const total = data.index.length * list.length;
  const index = n * list.length > 65535 ? new Uint32Array(total) : new Uint16Array(total);
  const s0 = def.scale ?? 1;
  list.forEach((d, k) => {
    const c = Math.cos(d.turn), s = Math.sin(d.turn), sc = s0 * (d.scale ?? 1);
    const o = k * n * 3;
    for (let v = 0; v < n * 3; v += 3) {
      const x = data.position[v] * sc, y = data.position[v + 1] * sc, z = data.position[v + 2] * sc;
      position[o + v] = d.x + x * c + z * s;
      position[o + v + 1] = d.y + y;
      position[o + v + 2] = d.z - x * s + z * c;
      const nx = data.normal[v], ny = data.normal[v + 1], nz = data.normal[v + 2];
      normal[o + v] = nx * c + nz * s;
      normal[o + v + 1] = ny;
      normal[o + v + 2] = -nx * s + nz * c;
    }
    color.set(data.color, o);
  });
  // Triangles grouped by material, as one copy's are, every copy's together.
  const geometry = new GFX.BufferGeometry();
  let at = 0;
  for (const g of data.groups) {
    const start = at;
    list.forEach((_, k) => {
      for (let i = g.start; i < g.start + g.count; i++) index[at++] = data.index[i] + k * n;
    });
    geometry.addGroup(start, at - start, g.materialIndex);
  }
  geometry.setAttribute('position', new GFX.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new GFX.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new GFX.BufferAttribute(color, 3));
  geometry.setIndex(new GFX.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  const mesh = new GFX.Mesh(geometry, materialsFor(GFX, def));
  mesh.name = `decor-${def.name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
