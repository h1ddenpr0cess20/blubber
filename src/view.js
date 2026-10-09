/**
 * Where the camera is, round Blubber: turned (`yaw`, round the vertical,
 * from +z toward +x), tilted (`pitch`, up from level) and drawn in or out
 * (`zoom`, a multiple of the usual distance). The player moves the aim; the
 * view eases after it, so a flick of the wheel or a twist of two fingers
 * glides rather than jumps.
 *
 * It starts square on to the maze, from the front and well up — about
 * fifty-five degrees — so the corridors run straight up, down and across
 * the screen, the way the keys push, and the walls hide little.
 */

export const HOME = Object.freeze({ yaw: 0, pitch: 0.96, zoom: 1 });

/** No lower than a skim over the hedges, no higher than nearly straight down; no closer than Blubber filling the view, no further than most of a maze. */
export const LIMITS = Object.freeze({ pitch: [0.3, 1.45], zoom: [0.35, 2.2] });

/** How quickly the view catches up with its aim, per second. */
const EASE = 12;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

export function createView(start = HOME) {
  const view = {
    yaw: start.yaw, pitch: start.pitch, zoom: start.zoom,
    aim: { yaw: start.yaw, pitch: start.pitch, zoom: start.zoom },

    /** Turn by `yaw` and tilt by `pitch`, in radians. */
    turn(yaw, pitch = 0) {
      view.aim.yaw += yaw;
      view.aim.pitch = clamp(view.aim.pitch + pitch, LIMITS.pitch);
    },

    /** Draw in (factor below 1) or back (above 1). */
    zoomBy(factor) {
      view.aim.zoom = clamp(view.aim.zoom * factor, LIMITS.zoom);
    },

    /** Back to the corner it started from, at the usual distance. */
    reset() {
      // The short way round, from wherever it has been turned to.
      const turns = Math.round((view.aim.yaw - HOME.yaw) / (Math.PI * 2));
      Object.assign(view.aim, { ...HOME, yaw: HOME.yaw + turns * Math.PI * 2 });
    },

    /** Ease toward the aim. `jump` lands on it at once. */
    step(dt, jump = false) {
      const k = jump ? 1 : 1 - Math.exp(-EASE * dt);
      view.yaw += (view.aim.yaw - view.yaw) * k;
      view.pitch += (view.aim.pitch - view.pitch) * k;
      view.zoom += (view.aim.zoom - view.zoom) * k;
    },

    /** From what it looks at to the camera, as a unit vector. */
    direction() {
      const c = Math.cos(view.pitch);
      return [Math.sin(view.yaw) * c, Math.sin(view.pitch), Math.cos(view.yaw) * c];
    },
  };
  return view;
}

/**
 * Which way along the ground is right on the screen, and which is up it, for
 * a camera turned to `yaw` — so the controls push the way they point
 * however the maze has been turned. Each is [x, z].
 */
export function groundAxes(yaw = HOME.yaw) {
  return {
    right: [Math.cos(yaw), -Math.sin(yaw)],
    up: [-Math.sin(yaw), -Math.cos(yaw)],
  };
}
