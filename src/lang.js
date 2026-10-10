/**
 * The words on screen, in English and in Japanese, and which of them is
 * showing. The language is the one last picked on the title, or `?lang=ja`
 * / `?lang=en`, or else whichever the browser asks for first. Like the
 * saved game, it's kept in browser storage only if the browser allows it.
 *
 * In the page, `data-t="key"` puts a word in an element's text,
 * `data-t-html` its markup, and `data-t-label` / `data-t-title` its
 * `aria-label` / `title`. Everything else asks `t(key, ...)`.
 *
 * The Japanese is drawn in two fonts cut down to just the characters used
 * here (`src/fonts/ja.txt`): a test checks every one of them is in it, so
 * a new word needs `node scripts/fonts.js` run again.
 */

const KEY = 'blubber.lang';
export const LANGS = ['en', 'ja'];

const keys = (...k) => k.map((c) => `<kbd>${c}</kbd>`).join('');

export const WORDS = {
  en: {
    name: 'English',
    short: 'EN',
    title: 'Blubber',
    candy: 'candy',
    map: 'Map of the maze so far',
    lanternsLit: 'Lanterns lit',
    time: 'The time',
    spook: 'spook',
    spookLabel: 'Spook',
    paused: 'paused',
    carryOn: 'P to carry on',
    tag: 'a haunted maze',
    start: 'Float',
    choose: 'choose a night',
    startFrom: 'Start from a night',
    close: 'Close',
    helpFloat: `${keys('←', '↑', '↓', '→')} or ${keys('WASD')} float`,
    helpPointer: 'hold the mouse or a finger — float toward it',
    helpSpook: `${keys('Space')} spook`,
    helpGoal: 'light every lantern, then out through the moon gate',
    helpView: `${keys('Q', 'E')} or right-drag turn · wheel zoom · ${keys('C')} reset view · ${keys('P')} pause · ${keys('M')} mute`,
    helpTouch: 'tap a second finger to spook · two fingers: pinch to zoom, twist to turn',
    outBy: 'out by',
    caught: 'caught',
    again: 'again',
    onward: 'onward',
    theEnd: 'the end',
    soundOn: 'sound on',
    soundOff: 'sound off',
    soundOnLabel: 'Sound on',
    soundOffLabel: 'Sound off',
    langLabel: 'Language: English. Switch to Japanese',
    halloween: 'October',
    harvest: 'November',
    winter: 'December',
    nightOf: (month, n) => `${month} · night ${n}`,
    clock: (h24, m) => `${((h24 + 11) % 12) + 1}:${m} ${h24 < 12 ? 'am' : 'pm'}`,
    locked: 'Escape the night before to start here',
    startHere: (name) => `Start from ${name}`,
    best: (candy, moons, of) => `most candy ${candy} · moons ${moons} of ${of}`,
    beforeMidnight: 'before midnight',
    pastMidnight: 'past midnight',
    home: 'Home at last!',
    escaped: 'Escaped!',
    outOf: (n, of) => `${n} <small>of ${of}</small>`,
    times: (n) => (n === 0 ? 'never' : n === 1 ? 'once' : `${n} times`),
    tipCandy: (n) => `${n} candy for the second moon`,
    tipTime: 'out before midnight for the third',
    tipsJoin: ' · ',
    everyMoon: 'Every moon. Splendid haunting.',
    touchHint: 'Hold anywhere and Blubber floats toward it. Tap with another finger to spook.',
    gotCaught: 'Caught!',
    dropped: (n) => `−${n} candy · grab it back quick`,
    lit: (n, of) => `${n} of ${of}`,
    left: (n) => (n === 1 ? 'one lantern left' : `${n} lanterns left`),
    gateOpens: 'The moon gate opens!',
    floatOut: 'Float out through it.',
    noStart: 'Blubber could not start: this browser offers neither WebGPU nor WebGL 2.',
  },

  ja: {
    name: '日本語',
    short: 'あ',
    title: 'ブラバー',
    candy: 'キャンディ',
    map: 'これまでに見た迷路の地図',
    lanternsLit: '灯したランタン',
    time: '時刻',
    spook: 'わっ！',
    spookLabel: 'おどかす',
    paused: 'ひと休み',
    carryOn: 'P でつづける',
    tag: 'おばけ迷路',
    start: 'ふわり',
    choose: '夜をえらぶ',
    startFrom: 'どの夜からはじめる？',
    close: '閉じる',
    helpFloat: `${keys('←', '↑', '↓', '→')} か ${keys('WASD')} でただよう`,
    helpPointer: 'マウスや指で押さえると、そっちへただよう',
    helpSpook: `${keys('Space')} でおどかす`,
    helpGoal: 'ランタンをぜんぶ灯して、月の門から外へ',
    helpView: `${keys('Q', 'E')} か右ドラッグで回転・ホイールでズーム・${keys('C')} で視点をもどす・${keys('P')} でひと休み・${keys('M')} で消音`,
    helpTouch: 'もう一本の指で押すとおどかす・二本指：つまんでズーム、ひねって回転',
    outBy: '脱出時刻',
    caught: 'つかまった',
    again: 'もう一度',
    onward: 'つぎへ',
    theEnd: 'おしまい',
    soundOn: '音あり',
    soundOff: '音なし',
    soundOnLabel: '音あり',
    soundOffLabel: '音なし',
    langLabel: '言語：日本語。英語に切りかえる',
    halloween: '10月',
    harvest: '11月',
    winter: '12月',
    nightOf: (month, n) => `${month}・第${n}夜`,
    // The Japanese way round: 午後10:00 to 午前0:00 at midnight.
    clock: (h24, m) => `${h24 < 12 ? '午前' : '午後'}${h24 % 12}:${m}`,
    locked: '前の夜を脱出すると、ここからはじめられる',
    startHere: (name) => `${name}からはじめる`,
    best: (candy, moons, of) => `最多キャンディ ${candy}・月 ${moons} / ${of}`,
    beforeMidnight: '真夜中まえ',
    pastMidnight: '真夜中すぎ',
    home: 'ついにおうちへ！',
    escaped: '脱出！',
    outOf: (n, of) => `${n} <small>/ ${of}</small>`,
    times: (n) => (n === 0 ? 'なし' : `${n}回`),
    tipCandy: (n) => `2つめの月はキャンディ${n}個で`,
    tipTime: '3つめは真夜中までに脱出で',
    tipsJoin: '・',
    everyMoon: '月がぜんぶそろった。みごとなおばけっぷり！',
    touchHint: 'どこでも押さえると、ブラバーがそっちへただよう。もう一本の指で押すと、おどかす。',
    gotCaught: 'つかまった！',
    dropped: (n) => `キャンディ −${n}・はやくひろおう`,
    lit: (n, of) => `${n} / ${of}`,
    left: (n) => `あと${n}つ`,
    gateOpens: '月の門がひらいた！',
    floatOut: 'ただよって外へ出よう。',
    noStart: 'ブラバーを起動できませんでした。このブラウザは WebGPU にも WebGL 2 にも対応していません。',
  },
};

/** The nights' own names and first words, in Japanese; the English is in nights.js. */
export const NIGHT_WORDS = {
  ja: {
    hedge: ['かぼちゃ畑', 'ジャック・オー・ランタンをぜんぶ灯せば、月の門がひらく。'],
    cemetery: ['うつろの丘', 'お墓から手が出てくる。スペースキーで死者をおどかそう。'],
    crypt: ['地下墓所', '長い廊下をかぼちゃが転がってくる。わき道に逃げこもう。'],
    wood: ['魔女の森', '森のひらけた所で、何かがぐつぐつ煮えている。'],
    corn: ['とうもろこし迷路', '11月。七面鳥が逃げだして、ごきげんななめ。'],
    barn: ['七面鳥の納屋', '干し草は転がる。七面鳥は鳴く。ブラバーはただよう。'],
    feast: ['収穫の広間', 'ごちそうの用意はできた。お客さんには羽がある。'],
    snow: ['しもやけ谷', '12月。雪だるまたちは一年じゅう待っていた。'],
    ice: ['氷の宮殿', '氷の壁。雪だるまたちは抜け道を知っている。'],
    aurora: ['いちばん長い夜', 'オーロラの下に、おうちへ帰る最後の門。'],
  },
};

/**
 * Every character the Japanese is written in that the English isn't: what
 * the Japanese fonts are cut down to (scripts/fonts.js).
 */
export function jaChars() {
  const text = (words) => Object.values(words).map((w) => (typeof w === 'function' ? w.toString() : w)).join('');
  const english = new Set(text(WORDS.en));
  const japanese = text(WORDS.ja) + Object.values(NIGHT_WORDS.ja).flat().join('');
  return [...new Set(japanese)].filter((c) => c > '\x7f' && !english.has(c)).sort();
}

/**
 * The fonts each language is drawn in, as `document.fonts.load` takes them:
 * the title's, the words', and in English the Japanese on the button that
 * switches to it. A font is only fetched once something on screen is in it,
 * so without this the title would show in a stand-in font and then swap.
 */
const FONTS = {
  en: [['1em Creepster', 'Blubber'], ['500 1em Fredoka', 'Float'], ['600 1em "Zen Maru Gothic"', '日本語あ']],
  ja: [['1em Creepster', '10'], ['500 1em Fredoka', '10'], ['1em "Potta One"', 'ブラバー'], ['500 1em "Zen Maru Gothic"', 'あ'], ['700 1em "Zen Maru Gothic"', 'あ']],
};

/** Settles once `code`'s fonts are in, or after `wait` ms if they're slow: they swap in when they come. */
export function fontsFor(code, wait = 1500) {
  const fonts = globalThis.document?.fonts;
  if (!fonts || !FONTS[code]) return Promise.resolve();
  const loads = FONTS[code].map(([font, text]) => fonts.load(font, text).catch(() => {}));
  return Promise.race([Promise.all(loads), new Promise((ok) => setTimeout(ok, wait))]);
}

const listeners = new Set();
let current = 'en';

/** The language to start in: `?lang=`, then the last one picked, then the browser's own. */
export function startingLang({ search = globalThis.location?.search ?? '', store = globalThis.localStorage, asks = globalThis.navigator?.languages ?? [] } = {}) {
  const asked = new URLSearchParams(search).get('lang');
  if (LANGS.includes(asked)) return asked;
  try {
    const kept = store?.getItem(KEY);
    if (LANGS.includes(kept)) return kept;
  } catch {}
  for (const a of asks) {
    const code = String(a).toLowerCase().split('-')[0];
    if (LANGS.includes(code)) return code;
  }
  return 'en';
}

export const lang = () => current;

/** A word in the current language: a string, or what its function makes of `args`. */
export function t(key, ...args) {
  const w = WORDS[current][key] ?? WORDS.en[key];
  return typeof w === 'function' ? w(...args) : w;
}

/** A night's name and first words, in the current language. */
export function nightWords(recipe) {
  const [name, intro] = NIGHT_WORDS[current]?.[recipe.theme] ?? [recipe.name, recipe.intro];
  return { name, intro };
}

/** Puts the current language's words into everything under `root` marked for them. */
export function translate(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of root.querySelectorAll('[data-t-html]')) el.innerHTML = t(el.dataset.tHtml);
  for (const el of root.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t(el.dataset.tLabel));
  for (const el of root.querySelectorAll('[data-t-title]')) el.title = t(el.dataset.tTitle);
}

/** Switches to `code`, remembers it, rewrites the page, and tells whoever is listening. */
export function setLang(code, { store = globalThis.localStorage, keep = true } = {}) {
  if (!LANGS.includes(code)) return;
  current = code;
  if (keep) try { store?.setItem(KEY, code); } catch {}
  if (globalThis.document) {
    document.documentElement.lang = code;
    document.title = t('title');
    translate(document);
  }
  for (const fn of listeners) fn(code);
}

export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
