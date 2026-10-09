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
 * Resolves once every one of `jobs` ([name, detail] pairs) is baked, or
 * after `limit` milliseconds whatever happens; at once where nothing bakes
 * in the background (no workers: tests, scripts).
 */
export function readyAll(jobs, limit = 8000) {
  if (typeof Worker === 'undefined') return Promise.resolve();
  const all = Promise.all(jobs.filter(([n]) => SCULPTED[n]).map(([n, d]) => ready(n, d)));
  // Not forever, though: if a bake has gone wrong, better to play without it.
  return Promise.race([all, new Promise((r) => setTimeout(r, limit))]);
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

/** What is still to bake, in order; what is being baked now; the workers baking it, and which are free. */
const queue = [];
const baking = new Set();
const idle = [];

/** Hands the next job to every free worker. */
function pump() {
  while (idle.length && queue.length) {
    const job = queue.shift();
    const k = key(...job);
    if (done.has(k) || baking.has(k)) continue;
    baking.add(k);
    idle.pop().postMessage({ name: job[0], detail: job[1] });
  }
}

/**
 * Starts the workers and queues `jobs` ([name, detail] pairs) to bake, first
 * come first served across them: by default everything, at every detail it
 * is used at, `first` before the rest.
 */
export function preload(first = [], jobs = [
  ...Object.keys(SCULPTED).map((n) => [n, detailOf(n)]),
  ...Object.keys(PROPS).filter((n) => PROPS[n].decor).map((n) => [n, decorDetailOf(n)]),
]) {
  if (typeof Worker === 'undefined') return;
  queue.push(...first.map((n) => [n, detailOf(n)]), ...jobs.filter(([n, d]) => SCULPTED[n] && !first.includes(n) && !done.has(key(n, d))));
  const count = Math.max(1, Math.min(queue.length, (navigator.hardwareConcurrency || 4) - 1, 4));
  for (let i = idle.length + baking.size; i < count; i++) {
    const worker = new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: { name, detail, data } }) => {
      adopt(SCULPTED[name], detail, data);
      const k = key(name, detail);
      baking.delete(k);
      done.set(k, true);
      waiting.get(k)?.resolve();
      idle.push(worker);
      pump();
    };
    worker.onerror = (e) => console.error('blubber: a model would not bake', e);
    idle.push(worker);
  }
  pump();
}

/**
 * Moves `jobs` ([name, detail] pairs) to the front of what is still to
 * bake, in the order given, adding any not queued at all: what a night
 * needs now goes before what a later one will.
 */
export function hurry(jobs) {
  if (typeof Worker === 'undefined') return;
  const wanted = jobs.filter(([n, d]) => SCULPTED[n] && !done.has(key(n, d)) && !baking.has(key(n, d)));
  const ids = new Set(wanted.map((j) => key(...j)));
  for (let i = queue.length - 1; i >= 0; i--) if (ids.has(key(...queue[i]))) queue.splice(i, 1);
  queue.unshift(...wanted);
  pump();
}
