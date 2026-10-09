/**
 * What the game remembers between visits: the furthest night reached (any
 * night up to it can be started from the title), the most moons won on
 * each night, and the most candy a whole run has come home with. Browser
 * storage can be missing or refuse, so every touch of it is guarded and the
 * game plays the same without it.
 */

const KEY = 'blubber.v1';

export function createStorage(store = globalThis.localStorage) {
  let saved = { best: 0, reached: 0, moons: {} };
  try {
    const raw = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      saved.best = Number.isFinite(raw.best) ? raw.best : 0;
      saved.reached = Number.isInteger(raw.reached) ? raw.reached : 0;
      if (raw.moons && typeof raw.moons === 'object') {
        for (const [k, v] of Object.entries(raw.moons)) if (Number.isInteger(v) && v >= 0 && v <= 3) saved.moons[k] = v;
      }
    }
  } catch {}

  const save = () => {
    try { store?.setItem(KEY, JSON.stringify(saved)); } catch {}
    return { ...saved, moons: { ...saved.moons } };
  };

  return {
    load: () => ({ ...saved, moons: { ...saved.moons } }),
    reached(index) {
      saved = { ...saved, reached: Math.max(saved.reached, index) };
      return save();
    },
    /** Night `index` escaped with `moons`: kept if it is the most yet. */
    moons(index, moons) {
      saved = { ...saved, moons: { ...saved.moons, [index]: Math.max(saved.moons[index] ?? 0, moons) } };
      return save();
    },
    /** A run's candy, kept if it is the most yet. */
    record(candy) {
      saved = { ...saved, best: Math.max(saved.best, candy) };
      return save();
    },
  };
}
