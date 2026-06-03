/**
 * Download the self-hosted fonts into public/fonts/.
 *
 * Manual dev tool, not part of the build or deploy. Google now serves Inter,
 * Inter Tight, and JetBrains Mono as a single VARIABLE woff2 per subset, so we
 * fetch one variable file per family (the latin slice) over its full weight
 * range and emit ONE @font-face per family with a font-weight RANGE. That
 * avoids the trap of requesting several static weights and getting the same
 * variable file back under each name (byte-identical duplicates the browser
 * re-downloads). The font-family names match the --font-* stacks in
 * app/layout.ts.
 *
 *   node scripts/fetch-fonts.mjs
 *
 * The site is English, so the latin subset (which already includes the General
 * Punctuation block: curly quotes, the middle dot) is enough.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const OUT_DIR = resolve('public/fonts');

const FAMILIES = [
  { name: 'Inter Tight', slug: 'inter-tight', range: '100..900' },
  { name: 'Inter', slug: 'inter', range: '100..900' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', range: '100..800' },
];

const cssUrl = (name, range) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@${range}&display=swap`;

// Pull the latin @font-face block and return its weight range + woff2 url.
const parseLatin = (css) => {
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)];
  for (const [, subset, body] of blocks) {
    if (subset !== 'latin') continue;
    const weight = body.match(/font-weight:\s*([^;]+);/)?.[1].trim(); // e.g. "100 900"
    const url = body.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (weight && url) return { weight, url };
  }
  return null;
};

await mkdir(OUT_DIR, { recursive: true });
const faces = [];

for (const fam of FAMILIES) {
  const res = await fetch(cssUrl(fam.name, fam.range), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${fam.name}: ${res.status}`);
  const latin = parseLatin(await res.text());
  if (!latin) throw new Error(`no latin woff2 for ${fam.name}`);

  const file = `${fam.slug}.woff2`;
  const bytes = Buffer.from(await (await fetch(latin.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  await writeFile(resolve(OUT_DIR, file), bytes);
  console.log(`saved ${file} (${(bytes.length / 1024).toFixed(1)} KB, weight ${latin.weight})`);
  faces.push(
    `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${latin.weight};font-display:swap;` +
    `src:url('/public/fonts/${file}') format('woff2');}`,
  );
}

console.log('\n/* paste into public/input.css */\n' + faces.join('\n'));
