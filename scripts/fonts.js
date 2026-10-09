// Cuts the Japanese fonts down to the characters the Japanese words use, so they load in a moment.
//
//   node scripts/fonts.js PottaOne-Regular.ttf ZenMaruGothic-Medium.ttf ZenMaruGothic-Bold.ttf
//
// The three are the whole fonts, from Google Fonts. It needs `pyftsubset` (pip install fonttools brotli).
// It writes src/fonts/ja.txt, the characters, and a woff2 of each font beside it. Run it again
// whenever a Japanese word in src/lang.js changes: test/lang.test.js says when.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jaChars } from '../src/lang.js';

const [potta, medium, bold] = process.argv.slice(2);
if (!bold) {
  console.error('usage: node scripts/fonts.js PottaOne-Regular.ttf ZenMaruGothic-Medium.ttf ZenMaruGothic-Bold.ttf');
  process.exit(1);
}
const fonts = fileURLToPath(new URL('../src/fonts/', import.meta.url));
const text = jaChars().join('');
for (const [from, to] of [[potta, 'potta-ja.woff2'], [medium, 'zen-maru-ja-500.woff2'], [bold, 'zen-maru-ja-700.woff2']]) {
  execFileSync('pyftsubset', [from, `--text=${text}`, '--flavor=woff2', '--layout-features=*', '--no-hinting', `--output-file=${fonts}${to}`], { stdio: 'inherit' });
}
writeFileSync(`${fonts}ja.txt`, `${text}\n`);
console.log(`${text.length} characters`);
