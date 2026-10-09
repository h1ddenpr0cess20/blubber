import { NIGHTS } from './nights.js';
import { SEASONS } from './themes.js';

/**
 * Everything on screen that isn't the 3D view: the night and the candy
 * along the top; the lanterns lit and the clock along the bottom; the map
 * of what has been seen; the spook button; the big messages in the middle;
 * the title, with the nights to start from; and the tally after each night.
 */

/** The clock: a night starts at ten, and midnight is its `par`. */
export function clockAt(seconds, par) {
  const minutes = Math.floor(22 * 60 + (seconds / par) * 120);
  const h24 = Math.floor(minutes / 60) % 24, m = minutes % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

export function createHud(root, { onStart, onAgain, onOnward }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const top = $('top'), bottom = $('bottom'), nightEl = $('night'), candyEl = $('candy');
  const lanternsEl = $('lanterns'), clockEl = $('clock'), spookEl = $('spook');
  const bannerEl = $('banner'), titleEl = $('title'), nightsEl = $('nights'), bestEl = $('best');
  const pauseEl = $('pause'), muteEl = $('mute'), mapEl = $('map'), tallyEl = $('tally');
  const ctx = mapEl.getContext('2d');
  const ring = spookEl.querySelector('.ready');
  let shown = false, mapEvery = 0, mapScale = 2, last = -1;

  muteEl.addEventListener('click', (e) => {
    e.stopPropagation();
    muteEl.dispatchEvent(new CustomEvent('mute', { bubbles: true }));
  });
  for (const el of [spookEl, muteEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  tallyEl.querySelector('.again').addEventListener('click', (e) => { e.stopPropagation(); onAgain(); });
  tallyEl.querySelector('.go').addEventListener('click', (e) => { e.stopPropagation(); onOnward(); });
  tallyEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  /** The map: every tile seen, the lanterns (all of them, lit or not), what chases nearby, the gate, Blubber. */
  function drawMap(h) {
    const { grounds } = h.night;
    const s = mapScale;
    ctx.clearRect(0, 0, mapEl.width, mapEl.height);
    for (let z = 0; z < grounds.rows; z++) {
      for (let x = 0; x < grounds.cols; x++) {
        if (!h.explored[z * grounds.cols + x]) continue;
        const c = grounds.cell(x, z);
        if (!c) continue;
        ctx.fillStyle = c.kind === 'wall' ? '#4a4478' : c.kind === 'bog' ? '#3aa830' : c.margin ? '#2a2648' : '#b8b2e0';
        ctx.fillRect(x * s, z * s, s, s);
      }
    }
    const dot = (x, z, r, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x * s, z * s, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const g = h.ghost;
    for (const c of h.chasers) if (Math.hypot(c.x - g.x, c.z - g.z) < 10) dot(c.x, c.z, s * 1.1, c.state === 'scared' ? '#9ad0ff' : '#ff5a5a');
    for (const l of h.lanterns) dot(l.x, l.z, s * 1.4, l.lit ? '#ffb040' : '#6a5a40');
    dot(h.night.gate.x, h.night.gate.z, s * 1.8, h.open ? '#d8c8ff' : '#5a4a90');
    dot(g.x, g.z, s * 1.7, '#ffffff');
    ctx.strokeStyle = '#7d6ae4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.x * s, g.z * s, s * 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  return {
    get bannerShown() { return shown; },

    title(saved) {
      titleEl.hidden = false;
      for (const el of [top, bottom, mapEl, spookEl, tallyEl, bannerEl]) el.hidden = true;
      shown = false;
      document.body.dataset.season = 'halloween';
      const months = Object.keys(SEASONS);
      nightsEl.replaceChildren(...months.map((season) => {
        const row = document.createElement('div');
        row.className = 'month';
        row.dataset.season = season;
        const label = document.createElement('b');
        label.textContent = SEASONS[season].month;
        row.append(label);
        NIGHTS.forEach((n, i) => {
          if (n.season !== season) return;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'night';
          b.disabled = i > saved.reached;
          const won = saved.moons[i] ?? 0;
          b.innerHTML = `<span class="n">${i + 1}</span><span class="name"></span><span class="moons">${'<b>●</b>'.repeat(won)}${'●'.repeat(3 - won)}</span>`;
          b.querySelector('.name').textContent = n.name;
          b.title = b.disabled ? 'Escape the night before to start here' : `Start from ${n.name}`;
          b.addEventListener('click', (e) => { e.stopPropagation(); onStart(i); });
          b.addEventListener('pointerdown', (e) => e.stopPropagation());
          row.append(b);
        });
        return row;
      }));
      const total = Object.values(saved.moons).reduce((s, m) => s + m, 0);
      bestEl.textContent = saved.best > 0 ? `most candy ${saved.best} · moons ${total} of ${NIGHTS.length * 3}` : '';
    },

    play(night, index) {
      titleEl.hidden = true;
      tallyEl.hidden = true;
      for (const el of [top, bottom, mapEl, spookEl]) el.hidden = false;
      document.body.dataset.season = night.season;
      nightEl.innerHTML = `<span class="label">${SEASONS[night.season].month} · night ${index + 1}</span><span class="name"></span>`;
      nightEl.querySelector('.name').textContent = night.name;
      lanternsEl.replaceChildren(...night.lanterns.map(() => document.createElement('i')));
      last = -1;
    },

    candy(n) {
      if (n === last) return;
      candyEl.textContent = String(n);
      if (n > last && last >= 0) {
        candyEl.classList.remove('pop');
        void candyEl.offsetWidth;
        candyEl.classList.add('pop');
      }
      last = n;
    },

    lanterns(h) {
      h.lanterns.forEach((l, i) => lanternsEl.children[i]?.classList.toggle('lit', l.lit));
    },

    clock(seconds, par) {
      clockEl.querySelector('.time').textContent = clockAt(seconds, par);
      clockEl.querySelector('.face').textContent = seconds <= par ? 'before midnight' : 'past midnight';
      clockEl.classList.toggle('late', seconds > par);
    },

    /** How ready the next spook is, 0 to 1. */
    spook(ready) {
      ring.style.strokeDashoffset = String(289 * (1 - ready));
      spookEl.classList.toggle('cooling', ready < 1);
    },

    map(h) {
      const { cols, rows } = h.night.grounds;
      mapScale = Math.max(1, Math.floor(Math.min(180 / cols, 180 / rows)));
      mapEl.width = cols * mapScale;
      mapEl.height = rows * mapScale;
      mapEvery = 0;
    },

    tick(dt, h) {
      mapEvery -= dt;
      if (mapEvery > 0 || mapEl.hidden) return;
      mapEvery = 0.12;
      drawMap(h);
    },

    banner(text, size = 'normal', sub = '') {
      shown = text != null;
      bannerEl.hidden = !shown;
      if (!shown) return;
      bannerEl.textContent = text;
      if (sub) {
        const small = document.createElement('small');
        small.textContent = sub;
        bannerEl.appendChild(small);
      }
      bannerEl.className = size;
      void bannerEl.offsetWidth;
      bannerEl.classList.add('pop');
    },

    /** The card after a night: what was gathered, when it got out, the moons. */
    tally({ night, index, carried, total, time, par, caught, moons, last: final }) {
      for (const el of [spookEl, bannerEl]) el.hidden = true;
      shown = false;
      tallyEl.hidden = false;
      tallyEl.querySelector('.month').textContent = `${SEASONS[night.season].month} · night ${index + 1}`;
      tallyEl.querySelector('h2').textContent = final ? 'Home at last!' : 'Escaped!';
      tallyEl.querySelector('.moons').replaceChildren(...[0, 1, 2].map((k) => {
        const i = document.createElement('i');
        if (k < moons) i.className = 'won';
        return i;
      }));
      const needed = Math.ceil(total * 0.8);
      const candyRow = tallyEl.querySelector('.row.candy');
      candyRow.querySelector('dd').innerHTML = `${carried} <small>of ${total}</small>`;
      candyRow.classList.toggle('met', carried >= needed);
      const timeRow = tallyEl.querySelector('.row.time');
      timeRow.querySelector('dd').textContent = clockAt(time, par);
      timeRow.classList.toggle('met', time <= par);
      tallyEl.querySelector('.row.caught dd').textContent = caught === 0 ? 'never' : caught === 1 ? 'once' : `${caught} times`;
      const tips = [];
      if (carried < needed) tips.push(`${needed} candy for the second moon`);
      if (time > par) tips.push('out before midnight for the third');
      tallyEl.querySelector('.note').textContent = tips.length ? tips.join(' · ') : 'Every moon. Splendid haunting.';
      tallyEl.querySelector('.go').textContent = final ? 'the end' : 'onward';
      requestAnimationFrame(() => tallyEl.querySelector('.go').focus());
    },

    paused(on) { pauseEl.hidden = !on; },

    muted(on) {
      muteEl.setAttribute('aria-pressed', String(on));
      muteEl.textContent = on ? 'sound off' : 'sound on';
    },
  };
}
