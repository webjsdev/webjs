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
 *   node scripts/fetch-fonts.mjs                 every family
 *   node scripts/fetch-fonts.mjs geist geist-mono  only the named slugs
 *
 * Geist and Geist Mono are the faces of the /ui section, ported from
 * shadcn/ui's site (#1666), and are declared in public/ui-input.css rather
 * than input.css, so a marketing page never downloads them.
 *
 * The typeset builder's faces (/ui/typeset) come from its own list,
 * modules/ui/typeset/fonts.ts, so the pickers and the files cannot drift. They
 * are declared in public/typeset-fonts.css, which only the typeset pages link,
 * so no other page downloads them. The four that the site already serves
 * (Inter, JetBrains Mono, Geist, Geist Mono) are the same files, and the
 * typeset faces are printed as a second block for that stylesheet.
 *
 * The site is English, so the latin subset (which already includes the General
 * Punctuation block: curly quotes, the middle dot) is enough.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FONTS as TYPESET_FONTS } from '../modules/ui/typeset/fonts.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const OUT_DIR = resolve('public/fonts');

const FAMILIES = [
  { name: 'Inter Tight', slug: 'inter-tight', range: '100..900' },
  { name: 'Inter', slug: 'inter', range: '100..900' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', range: '100..800' },
  { name: 'Geist', slug: 'geist', range: '100..900' },
  { name: 'Geist Mono', slug: 'geist-mono', range: '100..900' },
  // The typeset builder's faces not already listed above.
  ...TYPESET_FONTS.filter((font) => !['inter', 'jetbrains-mono', 'geist', 'geist-mono'].includes(font.id))
    .map((font) => ({ name: font.name, slug: font.id, range: font.range })),
];
const TYPESET_SLUGS = new Set(TYPESET_FONTS.map((font) => font.id));

// Optional slug filter, so adding a family does not re-download (and possibly
// change the bytes of) the files already committed.
const only = process.argv.slice(2);
const wanted = only.length ? FAMILIES.filter((f) => only.includes(f.slug)) : FAMILIES;
if (only.length && wanted.length !== only.length) throw new Error(`unknown slug in: ${only.join(', ')}`);

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
const typesetFaces = [];

for (const fam of wanted) {
  const res = await fetch(cssUrl(fam.name, fam.range), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${fam.name}: ${res.status}`);
  const latin = parseLatin(await res.text());
  if (!latin) throw new Error(`no latin woff2 for ${fam.name}`);

  const file = `${fam.slug}.woff2`;
  const bytes = Buffer.from(await (await fetch(latin.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  await writeFile(resolve(OUT_DIR, file), bytes);
  console.log(`saved ${file} (${(bytes.length / 1024).toFixed(1)} KB, weight ${latin.weight})`);
  const face =
    `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${latin.weight};font-display:swap;` +
    `src:url('/public/fonts/${file}') format('woff2');}`;
  faces.push(face);
  if (TYPESET_SLUGS.has(fam.slug)) typesetFaces.push(face);
}

console.log('\n/* paste into public/input.css (or public/ui-input.css for the /ui faces) */\n' + faces.join('\n'));
if (typesetFaces.length) console.log('\n/* the typeset faces, for public/typeset-fonts.css */\n' + typesetFaces.join('\n'));
