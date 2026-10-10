/**
 * The controls, Dungeon Roller's. Floating is reduced to one stick: which
 * way on the screen to push, as `x` (right) and `y` (up), each -1 to 1.
 *
 * - Keys: arrows or WASD.
 * - Mouse or touch: hold anywhere, and Blubber floats toward the
 *   pointer — harder the further it is from Blubber.
 * - Gamepad: left stick or d-pad.
 *
 * The view (`view()`) is turned, tilted and zoomed by:
 *
 * - Q and E, to turn; + and −, to zoom; C, back to the start.
 * - The right (or middle) mouse button dragged: across to turn, up and down
 *   to tilt. The wheel zooms.
 * - Two fingers: pinch to zoom, twist to turn, drag up or down to tilt. A
 *   second finger only tapped, while the first steers, spooks instead.
 * - Gamepad: right stick to turn and tilt, shoulder buttons to zoom.
 *
 * Buttons come out as one-shot presses: `spook` (Space, B, or a second
 * finger's tap), `start` (Enter or A; Space too, off the maze), `pause` (P, Escape, Start),
 * `mute` (M), `home` (C, or the right stick pressed).
 */

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyQ: 'turnLeft', KeyE: 'turnRight',
  Equal: 'zoomIn', NumpadAdd: 'zoomIn',
  Minus: 'zoomOut', NumpadSubtract: 'zoomOut',
};
const PRESSES = {
  Enter: 'start', Space: 'spook',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute', KeyC: 'home',
};

/** How far from Blubber, in CSS pixels, the pointer has to be for a full push. */
const REACH = 110;

/** Turning by key or stick, in radians a second; zooming, as a factor a second. */
const TURN_RATE = 1.9;
const ZOOM_RATE = 2.2;

/** Dragging the view: radians per CSS pixel. */
const DRAG_TURN = 0.0085;
const DRAG_TILT = 0.006;

/** A second finger lifted within this many milliseconds, moved less than this many CSS pixels, is a tap. */
const TAP_TIME = 260;
const TAP_SLOP = 14;

export function createInput(surface, { anchor }) {
  const held = new Set();
  const presses = [];
  /** The finger or button steering Blubber, if any. */
  let pointer = null;
  /** Every pointer down on the view, for drags and two-finger gestures. */
  const touches = new Map();
  /** View changes gathered since last asked. */
  let turn = 0, tilt = 0, zoom = 1;

  addEventListener('keydown', (e) => {
    // A focused button takes its own Enter and Space.
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (KEYS[e.code]) {
      held.add(KEYS[e.code]);
      e.preventDefault();
    }
    if (PRESSES[e.code] && !e.repeat) {
      presses.push(PRESSES[e.code]);
      if (e.code === 'Space') e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    if (KEYS[e.code]) held.delete(KEYS[e.code]);
  });
  addEventListener('blur', () => { held.clear(); pointer = null; touches.clear(); });

  /** Two fingers: how far apart, at what angle, and where between them. */
  const pair = () => {
    const [a, b] = [...touches.values()].filter((t) => !t.look);
    return { span: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), y: (a.y + b.y) / 2 };
  };
  /** The two-finger gesture under way, once a second finger has shown it means one. */
  let gesture = null;
  const fingers = () => [...touches.values()].filter((t) => t.touch).length;
  const startGesture = () => {
    if (gesture || fingers() < 2) return;
    pointer = null;
    gesture = pair();
  };

  surface.addEventListener('pointerdown', (e) => {
    surface.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    const look = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
    const touch = e.pointerType === 'touch';
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, from: [e.clientX, e.clientY], at: performance.now(), look, touch });
    // Another finger while one steers: Blubber keeps floating. If it's lifted again
    // quickly, it was a tap, and spooks; if it stays down or moves, it's the view.
    if (touch && fingers() >= 2) return;
    if (!look && !pointer) pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  surface.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (t.look) {
      turn -= dx * DRAG_TURN;
      tilt += dy * DRAG_TILT;
    } else if (t.touch && !gesture && pointer?.id !== e.pointerId && Math.hypot(t.x - t.from[0], t.y - t.from[1]) > TAP_SLOP) {
      startGesture();
    } else if (gesture && fingers() >= 2) {
      const now = pair();
      if (now.span > 1 && gesture.span > 1) zoom *= gesture.span / now.span;
      let twist = now.angle - gesture.angle;
      if (twist > Math.PI) twist -= Math.PI * 2;
      if (twist < -Math.PI) twist += Math.PI * 2;
      // The board follows the fingers round.
      turn += twist;
      tilt += (now.y - gesture.y) * DRAG_TILT;
      gesture = now;
    }
    if (pointer && pointer.id === e.pointerId) { pointer.x = e.clientX; pointer.y = e.clientY; }
  });
  const release = (e) => {
    const t = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (!t) return;
    const steering = pointer?.id === e.pointerId;
    if (steering) pointer = null;
    // A quick tap of a second finger, with no gesture made of it: a spook.
    else if (t.touch && !gesture && e.type === 'pointerup' && performance.now() - t.at < TAP_TIME) presses.push('spook');
    if (fingers() < 2) gesture = null;
    // Back down to one finger: it takes over the steering.
    if (!pointer && !gesture && fingers() === 1) {
      const [id, left] = [...touches].find(([, f]) => f.touch);
      pointer = { id, x: left.x, y: left.y };
    }
  };
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
  surface.addEventListener('contextmenu', (e) => e.preventDefault());
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    const lines = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    zoom *= Math.exp(e.deltaY * lines * 0.0015);
  }, { passive: false });

  let padWas = {};
  let padLook = { turn: 0, tilt: 0, zoom: 0 };

  return {
    /** The push this frame. */
    stick() {
      // A second finger held down past a tap is the start of a pinch or twist.
      if (!gesture && fingers() >= 2) {
        const now = performance.now();
        for (const [id, t] of touches) if (t.touch && id !== pointer?.id && now - t.at >= TAP_TIME) { startGesture(); break; }
      }
      let x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      let y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);

      if (pointer) {
        const at = anchor();
        if (at) {
          const dx = pointer.x - at.x, dy = at.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d > 6) {
            const k = Math.min(1, d / REACH) / d;
            x += dx * k; y += dy * k;
          }
        }
      }

      const pad = navigator.getGamepads?.().find((p) => p && p.connected);
      if (pad) {
        const [sx = 0, sy = 0] = pad.axes;
        const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);
        x += dead(sx); y -= dead(sy);
        const b = (i) => pad.buttons[i]?.pressed;
        if (b(12)) y += 1;
        if (b(13)) y -= 1;
        if (b(14)) x -= 1;
        if (b(15)) x += 1;
        const [, , rx = 0, ry = 0] = pad.axes;
        padLook = { turn: -dead(rx), tilt: dead(ry), zoom: (b(4) ? -1 : 0) + (b(5) ? 1 : 0) };
        const now = { start: b(0), spook: b(1) || b(2), pause: b(9), home: b(11) };
        for (const name of Object.keys(now)) if (now[name] && !padWas[name]) presses.push(name);
        padWas = now;
      }

      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },

    /**
     * How the view is to change, since last asked over `dt` seconds: turned
     * by `turn` and tilted by `tilt` (radians), and zoomed by the factor `zoom`.
     */
    view(dt) {
      const keyTurn = (held.has('turnRight') ? 1 : 0) - (held.has('turnLeft') ? 1 : 0);
      const keyZoom = (held.has('zoomOut') ? 1 : 0) - (held.has('zoomIn') ? 1 : 0);
      const out = {
        turn: turn + (keyTurn + padLook.turn) * TURN_RATE * dt,
        tilt: tilt + padLook.tilt * TURN_RATE * 0.6 * dt,
        zoom: zoom * Math.pow(ZOOM_RATE, (keyZoom - padLook.zoom) * dt),
      };
      turn = 0; tilt = 0; zoom = 1;
      return out;
    },

    /** A press from somewhere else: the spook button on the screen. */
    press(name) { presses.push(name); },

    /** The one-shot presses since last asked. */
    take() {
      return presses.splice(0);
    },

    get pointing() { return pointer !== null; },
  };
}
