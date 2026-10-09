import { lang, LANGS, nightWords, onLang, setLang, t, WORDS } from './lang.js';
import { NIGHTS } from './nights.js';
import { SEASONS } from './themes.js';

/**
 * Everything on screen that isn't the 3D view: the night and the candy
 * along the top; the lanterns lit and the clock along the bottom; the map
 * of what has been seen; the spook button; the big messages in the middle;
 * the title, with the nights to start from and the language to read them
 * in; and the tally after each night.
 */

/** The clock: a night starts at ten, and midnight is its `par`. */
export function clockAt(seconds, par) {
  const minutes = Math.floor(22 * 60 + (seconds / par) * 120);
  const h24 = Math.floor(minutes / 60) % 24, m = minutes % 60;
  return t('clock', h24, String(m).padStart(2, '0'));
}

export function createHud(root, { onStart, onAgain, onOnward }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const top = $('top'), bottom = $('bottom'), nightEl = $('night'), candyEl = $('candy');
  const lanternsEl = $('lanterns'), clockEl = $('clock'), spookEl = $('spook');
  const bannerEl = $('banner'), titleEl = $('title'), nightsEl = $('nights'), bestEl = $('best');
  const pauseEl = $('pause'), muteEl = $('mute'), mapEl = $('map'), tallyEl = $('tally');
  const pickerEl = $('picker'), chooseEl = $('choose'), langEl = $('lang');
  const ctx = mapEl.getContext('2d');
  const ring = spookEl.querySelector('.ready');
  const muteWord = muteEl.querySelector('.word');
  const timeEl = clockEl.querySelector('.time'), faceEl = clockEl.querySelector('.face');
  let shown = false, mapEvery = 0, mapScale = 2, last = -1, shownTime = '', shownReady = -1;
  let saved = null, muted = false;

  muteEl.addEventListener('click', (e) => {
    e.stopPropagation();
    muteEl.dispatchEvent(new CustomEvent('mute', { bubbles: true }));
  });
  for (const el of [spookEl, muteEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  tallyEl.querySelector('.again').addEventListener('click', (e) => { e.stopPropagation(); onAgain(); });
  tallyEl.querySelector('.go').addEventListener('click', (e) => { e.stopPropagation(); onOnward(); });
  tallyEl.addEventListener('pointerdown', (e) => e.stopPropagation());

  // On a small screen the nights are in a sheet of their own, opened from the title.
  const pick = (open) => {
    pickerEl.classList.toggle('open', open);
    chooseEl.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('picking', open);
  };
  chooseEl.addEventListener('click', (e) => { e.stopPropagation(); pick(!pickerEl.classList.contains('open')); });
  pickerEl.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); pick(false); });
  // A tap outside the sheet puts it away.
  pickerEl.addEventListener('click', (e) => { if (e.target === pickerEl) pick(false); });
  pickerEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  chooseEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && pickerEl.classList.contains('open')) pick(false); });

  // The other language, by its own name: only on the title, where nothing is half said.
  const showLang = () => {
    const other = LANGS.find((l) => l !== lang());
    for (const [cls, key] of [['long', 'name'], ['short', 'short']]) {
      const word = langEl.querySelector(`.${cls}`);
      word.textContent = WORDS[other][key];
      word.lang = other;
    }
    langEl.setAttribute('aria-label', t('langLabel'));
  };
  langEl.addEventListener('click', (e) => {
    e.stopPropagation();
    setLang(LANGS.find((l) => l !== lang()));
  });
  langEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  onLang(() => {
    showLang();
    hud.muted(muted);
    if (saved && !titleEl.hidden) hud.title(saved);
  });
  showLang();

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

  const hud = {
    get bannerShown() { return shown; },

    title(progress) {
      saved = progress;
      titleEl.hidden = false;
      langEl.hidden = false;
      document.body.classList.add('titled');
      for (const el of [top, bottom, mapEl, spookEl, tallyEl, bannerEl]) el.hidden = true;
      shown = false;
      document.body.dataset.season = 'halloween';
      const months = Object.keys(SEASONS);
      nightsEl.replaceChildren(...months.map((season) => {
        const row = document.createElement('div');
        row.className = 'month';
        row.dataset.season = season;
        const label = document.createElement('b');
        label.textContent = t(season);
        row.append(label);
        NIGHTS.forEach((n, i) => {
          if (n.season !== season) return;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'night';
          b.disabled = i > saved.reached;
          const won = saved.moons[i] ?? 0;
          b.innerHTML = `<span class="n">${i + 1}</span><span class="name"></span><span class="moons">${'<b>●</b>'.repeat(won)}${'●'.repeat(3 - won)}</span>`;
          const { name } = nightWords(n);
          b.querySelector('.name').textContent = name;
          b.title = b.disabled ? t('locked') : t('startHere', name);
          b.addEventListener('click', (e) => { e.stopPropagation(); pick(false); onStart(i); });
          b.addEventListener('pointerdown', (e) => e.stopPropagation());
          row.append(b);
        });
        return row;
      }));
      const total = Object.values(saved.moons).reduce((s, m) => s + m, 0);
      bestEl.textContent = saved.best > 0 ? t('best', saved.best, total, NIGHTS.length * 3) : '';
    },

    play(night, index) {
      pick(false);
      titleEl.hidden = true;
      langEl.hidden = true;
      document.body.classList.remove('titled');
      tallyEl.hidden = true;
      for (const el of [top, bottom, mapEl, spookEl]) el.hidden = false;
      document.body.dataset.season = night.season;
      nightEl.innerHTML = '<span class="label"></span><span class="name"></span>';
      nightEl.querySelector('.label').textContent = t('nightOf', t(night.season), index + 1);
      nightEl.querySelector('.name').textContent = nightWords(night.recipe).name;
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
      // Called every frame, and the time only moves on a minute at a time: touch the page only when it does.
      const time = clockAt(seconds, par), late = seconds > par;
      if (`${time}${late}` === shownTime) return;
      shownTime = `${time}${late}`;
      timeEl.textContent = time;
      faceEl.textContent = t(late ? 'pastMidnight' : 'beforeMidnight');
      clockEl.classList.toggle('late', late);
    },

    /** How ready the next spook is, 0 to 1. */
    spook(ready) {
      if (ready === shownReady) return;
      shownReady = ready;
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
      tallyEl.querySelector('.month').textContent = t('nightOf', t(night.season), index + 1);
      tallyEl.querySelector('h2').textContent = t(final ? 'home' : 'escaped');
      tallyEl.querySelector('.moons').replaceChildren(...[0, 1, 2].map((k) => {
        const i = document.createElement('i');
        if (k < moons) i.className = 'won';
        return i;
      }));
      const needed = Math.ceil(total * 0.8);
      const candyRow = tallyEl.querySelector('.row.candy');
      candyRow.querySelector('dd').innerHTML = t('outOf', carried, total);
      candyRow.classList.toggle('met', carried >= needed);
      const timeRow = tallyEl.querySelector('.row.time');
      timeRow.querySelector('dd').textContent = clockAt(time, par);
      timeRow.classList.toggle('met', time <= par);
      tallyEl.querySelector('.row.caught dd').textContent = t('times', caught);
      const tips = [];
      if (carried < needed) tips.push(t('tipCandy', needed));
      if (time > par) tips.push(t('tipTime'));
      tallyEl.querySelector('.note').textContent = tips.length ? tips.join(t('tipsJoin')) : t('everyMoon');
      tallyEl.querySelector('.go').textContent = t(final ? 'theEnd' : 'onward');
      requestAnimationFrame(() => tallyEl.querySelector('.go').focus());
    },

    paused(on) { pauseEl.hidden = !on; },

    muted(on) {
      muted = on;
      muteEl.setAttribute('aria-pressed', String(on));
      muteWord.textContent = t(on ? 'soundOff' : 'soundOn');
      muteEl.setAttribute('aria-label', t(on ? 'soundOffLabel' : 'soundOnLabel'));
    },
  };
  return hud;
}
