import { CAST } from './cast/index.js';
import { bake } from './model.js';
import { PROPS } from './props/index.js';

const SCULPTED = { ...CAST, ...PROPS };

const ARRAYS = ['position', 'normal', 'color', 'skinIndex', 'skinWeight', 'index'];

/** Bakes models off the main thread: { name, detail } in, the mesh's arrays out (handed over, not copied). */
self.onmessage = ({ data: { name, detail } }) => {
  const data = { ...bake(SCULPTED[name], { detail }) };
  for (const k of ARRAYS) data[k] = data[k].slice();
  self.postMessage({ name, detail, data }, ARRAYS.map((k) => data[k].buffer));
};
