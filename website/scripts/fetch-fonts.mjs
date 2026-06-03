/**
 * Download the self-hosted woff2 fonts into public/fonts/.
 *
 * Manual dev tool, not part of the build or deploy. It asks Google Fonts
 * for the CSS (with a Chrome user agent so the response is woff2), keeps
 * only the `latin` subset slice of each weight the site uses, saves each
 * file under public/fonts/, and prints the matching @font-face CSS to paste
 * into public/input.css. Re-run it only to refresh or add a weight.
 *
 *   node scripts/fetch-fonts.mjs
 *
 * The site is English, so the latin subset (which already includes the
 * General Punctuation block: curly quotes, the middle dot) is enough. The
 * font-family names match the --font-* stacks declared in app/layout.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const OUT_DIR = resolve('public/fonts');

const FAMILIES = [
  { name: 'Inter Tight', slug: 'inter-tight', weights: [500, 600, 700, 800] },
  { name: 'Inter', slug: 'inter', weights: [400, 500, 600] },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', weights: [400, 500, 600] },
];

const cssUrl = (name, weights) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@${weights.join(';')}&display=swap`;

// Pull each subset-delimited @font-face block and keep the latin slices.
const parseLatin = (css) => {
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)];
  const byWeight = {};
  for (const [, subset, body] of blocks) {
    if (subset !== 'latin') continue;
    const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
    const url = body.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (weight && url) byWeight[weight] = url;
  }
  return byWeight;
};

await mkdir(OUT_DIR, { recursive: true });
const faces = [];

for (const fam of FAMILIES) {
  const res = await fetch(cssUrl(fam.name, fam.weights), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${fam.name}: ${res.status}`);
  const byWeight = parseLatin(await res.text());

  for (const weight of fam.weights) {
    const url = byWeight[String(weight)];
    if (!url) throw new Error(`no latin woff2 for ${fam.name} ${weight}`);
    const file = `${fam.slug}-${weight}.woff2`;
    const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    await writeFile(resolve(OUT_DIR, file), bytes);
    console.log(`saved ${file} (${(bytes.length / 1024).toFixed(1)} KB)`);
    faces.push(
      `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url('/public/fonts/${file}') format('woff2');}`,
    );
  }
}

console.log('\n/* paste into public/input.css */\n' + faces.join('\n'));
