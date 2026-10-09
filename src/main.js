import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { preload } from './models/library.js';
import { NIGHTS } from './nights.js';
import { createStage } from './stage.js';
import { createStorage } from './storage.js';

// The creatures and props are sculpted in code: start baking them before anything else,
// the first night's first.
preload(['pumpkin', 'jack', 'sweet', 'candycorn', 'lollipop', NIGHTS[0].chasers[0]?.kind].filter(Boolean));

const view = document.getElementById('view');
const audio = createAudio();
const wake = () => audio.wake();
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

let game = null;
const hud = createHud(document.body, {
  onStart: (index) => { audio.wake(); game?.startRun(index); },
  onAgain: () => game?.again(),
  onOnward: () => game?.onward(),
});
hud.muted(audio.muted);
document.getElementById('mute').addEventListener('mute', () => hud.muted(audio.toggleMute()));
document.getElementById('start').addEventListener('click', (e) => {
  e.stopPropagation();
  audio.wake();
  game?.startRun(0);
});
document.getElementById('start').addEventListener('pointerdown', (e) => e.stopPropagation());

const input = createInput(view, {
  anchor: () => game?.ghostOnScreen(view.getBoundingClientRect()),
});
document.getElementById('spook').addEventListener('click', (e) => {
  e.stopPropagation();
  input.press('spook');
});

try {
  const stage = await createStage(view);
  game = createGame({ stage, hud, input, audio, storage: createStorage() });
  globalThis.blubber = game;

  // At most 60 frames a second, even where the screen refreshes at 90 or 120: past that a phone only gets
  // hotter. While nothing much moves (the title, a pause, the tally), 30.
  // And if the frames come slow, draw fewer pixels: down from the screen's own density, as far as one to one.
  let slow = 0, ratio = stage.renderer.getPixelRatio();
  let last = performance.now(), due = last;
  stage.renderer.setAnimationLoop((now) => {
    const every = 1000 / (game.calm ? 30 : 60);
    // A few milliseconds' grace, since the screen's own frames don't land exactly on ours.
    if (now < due - 3) return;
    due = Math.max(due + every, now);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    slow = slow * 0.98 + (dt > every * 1.5 / 1000 ? 1 : 0) * 0.02;
    if (slow > 0.6 && ratio > 1) {
      ratio = Math.max(1, ratio - 0.5);
      stage.renderer.setPixelRatio(ratio);
      slow = 0;
    }
    game.update(dt, input.take());
    stage.look();
    stage.render();
  });
} catch (err) {
  const box = document.getElementById('error');
  box.hidden = false;
  box.textContent = 'Blubber could not start: this browser offers neither WebGPU nor WebGL 2.\n\n'
    + String(err && err.message ? err.message : err);
  console.error(err);
}
