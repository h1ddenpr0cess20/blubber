import { CAST } from './cast/index.js';
import { adopt } from './model.js';
import { PROPS } from './props/index.js';

/** Everything sculpted, by name: the creatures and the props. A definition's `detail` is the one it is baked and used at. */
export const SCULPTED = { ...CAST, ...PROPS };

/**
 * The models, baked in the background as the page starts: a few workers
 * share out the work, and each mesh is handed over as it is done. Until
 * then whoever wants one waits (`ready`) or carries on without it.
 */

const done = new Map();
const waiting = new Map();
const key = (name, detail) => `${name}@${detail}`;

/** Whether `name` at `detail` is ready to use. */
export const isBaked = (name, detail) => done.has(key(name, detail));

/**
 * Resolves once every one of `jobs` ([name, detail] pairs) is baked (or
 * after 20 seconds whatever happens); at once where nothing bakes in the
 * background (no workers: tests, scripts).
 */
export function readyAll(jobs) {
  if (typeof Worker === 'undefined') return Promise.resolve();
  const all = Promise.all(jobs.filter(([n]) => SCULPTED[n]).map(([n, d]) => ready(n, d)));
  // Not forever, though: if a bake has gone wrong, better to play without it.
  return Promise.race([all, new Promise((r) => setTimeout(r, 20000))]);
}

/** Resolves once `name` at `detail` is baked. */
export function ready(name, detail) {
  const k = key(name, detail);
  if (done.has(k)) return Promise.resolve();
  if (!waiting.has(k)) {
    let resolve;
    const p = new Promise((r) => { resolve = r; });
    waiting.set(k, { p, resolve });
  }
  return waiting.get(k).p;
}

/** The detail `name` is used at: its own, or 1 for a still prop and the board's 0.5 for a creature. */
export const detailOf = (name) => SCULPTED[name]?.detail ?? (CAST[name] ? 0.5 : 1);

/** The detail `name` is used at as scenery, seen from further off: its own `decor`, or 0.7. */
export const decorDetailOf = (name) => SCULPTED[name]?.decor ?? 0.7;

/**
 * Starts baking `jobs` ([name, detail] pairs), first come first served
 * across the workers: by default everything, `first` before the rest.
 */
export function preload(first = [], jobs = [
  ...Object.keys(SCULPTED).map((n) => [n, detailOf(n)]),
  ...Object.keys(PROPS).filter((n) => PROPS[n].decor).map((n) => [n, decorDetailOf(n)]),
]) {
  jobs = [...first.map((n) => [n, detailOf(n)]), ...jobs.filter(([n]) => !first.includes(n))];
  if (typeof Worker === 'undefined') return;
  const queue = jobs.filter(([n, d]) => SCULPTED[n] && !done.has(key(n, d)));
  const count = Math.max(1, Math.min(queue.length, (navigator.hardwareConcurrency || 4) - 1, 4));
  for (let i = 0; i < count; i++) {
    const worker = new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' });
    const next = () => {
      const job = queue.shift();
      if (!job) { worker.terminate(); return; }
      worker.postMessage({ name: job[0], detail: job[1] });
    };
    worker.onmessage = ({ data: { name, detail, data } }) => {
      adopt(SCULPTED[name], detail, data);
      const k = key(name, detail);
      done.set(k, true);
      waiting.get(k)?.resolve();
      next();
    };
    worker.onerror = (e) => console.error('blubber: a model would not bake', e);
    next();
  }
}
