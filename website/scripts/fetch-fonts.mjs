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
 * Google serves a different build of a family to a different browser, so the
 * user agent decides the bytes. The one below is the string next/font sends
 * (next.js packages/font/src/google/fetch-resource.ts), which is how
 * ui.shadcn.com got its files, so a re-run saves exactly the files that site
 * serves. Under the Chrome/124 string this script used before, Google returned
 * an older Geist build whose strokes draw visibly lighter, and every /ui label
 * looked a weight thinner than shadcn's.
 *
 * shadcn loads Geist Mono twice. Its site asks for weight 400 alone (a static
 * file, so a font-medium in mono draws at 400 there, the browser having no 500
 * to pick), and its preview frames ask for the variable file. So there are two
 * files here too: geist-mono.woff2, the static 400 the /ui chrome declares as
 * 'Geist Mono Regular' for its --font-mono, and geist-mono-variable.woff2, the
 * 'Geist Mono' the kit's font data and the typeset builder name, with every
 * weight.
 *
 * The typeset builder's faces (/ui/typeset) come from its own list,
 * modules/ui/typeset/fonts.ts, so the pickers and the files cannot drift. They
 * are declared in public/typeset-fonts.css, which only the typeset pages link,
 * so no other page downloads them. The four that the site already serves
 * (Inter, JetBrains Mono, Geist, Geist Mono) are the same files, and the
 * typeset faces are printed as a second block for that stylesheet, Inter and
 * JetBrains Mono included, since a /ui page does not load public/input.css.
 *
 * EB Garamond and Instrument Serif are two of the configurator's (/ui/create)
 * fonts that the typeset builder does not offer. They are declared in
 * public/create-fonts.css, which only the configurator's preview frame links,
 * and printed as their own block for that stylesheet. Instrument Serif comes
 * at weight 400 alone, as shadcn's preview loads it.
 *
 * Playfair Display is the heading face of the /ui/sera showcase only, the one
 * shadcn's Sera page loads. It is declared in public/sera-fonts.css, which only
 * that page links, and printed as its own block for that stylesheet.
 *
 * The site is English, so the latin subset (which already includes the General
 * Punctuation block: curly quotes, the middle dot) is enough.
 *
 * The one exception is the /ui RTL example, which shows Arabic and Hebrew in
 * the faces shadcn's site loads for it, Noto Sans Arabic and Noto Sans Hebrew
 * (its --font-ar and --font-he). Those take their script's subset as well as
 * latin, each a file of its own declared with its unicode-range, and are
 * printed as their own block for public/rtl-fonts.css, which only that page
 * links. Ask for them by slug: `node scripts/fetch-fonts.mjs rtl`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FONTS as TYPESET_FONTS } from '../modules/ui/typeset/fonts.ts';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36';
const OUT_DIR = resolve('public/fonts');

const FAMILIES = [
  { name: 'Inter Tight', slug: 'inter-tight', range: '100..900' },
  { name: 'Inter', slug: 'inter', range: '100..900' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', range: '100..800' },
  { name: 'Geist', slug: 'geist', range: '100..900' },
  // `face` is the declared family when it is not Google's name for it.
  { name: 'Geist Mono', slug: 'geist-mono', range: '400', face: 'Geist Mono Regular' },
  { name: 'Geist Mono', slug: 'geist-mono-variable', range: '100..900' },
  // The Sera showcase's heading face (/ui/sera).
  { name: 'Playfair Display', slug: 'playfair-display', range: '400..900' },
  // The configurator's fonts the typeset builder does not offer (/ui/create).
  { name: 'EB Garamond', slug: 'eb-garamond', range: '400..800' },
  { name: 'Instrument Serif', slug: 'instrument-serif', range: '400' },
  // The typeset builder's faces not already listed above.
  ...TYPESET_FONTS.filter((font) => !['inter', 'jetbrains-mono', 'geist', 'geist-mono'].includes(font.id))
    .map((font) => ({ name: font.name, slug: font.id, range: font.range })),
];
// The typeset faces this script prints for public/typeset-fonts.css: the ones
// no other /ui stylesheet declares.
const TYPESET_SLUGS = new Set(TYPESET_FONTS.map((font) => font.id).filter((id) => !['geist', 'geist-mono'].includes(id)));
const SERA_SLUGS = new Set(['playfair-display']);
const CREATE_SLUGS = new Set(['eb-garamond', 'instrument-serif']);

// Optional slug filter, so adding a family does not re-download (and possibly
// change the bytes of) the files already committed.
const only = process.argv.slice(2);
// The RTL example's faces: a family per script, each in its script's subset and latin.
const RTL_FAMILIES = [
  { name: 'Noto Sans Arabic', slug: 'noto-sans-arabic', range: '100..900', subsets: ['arabic', 'latin'] },
  { name: 'Noto Sans Hebrew', slug: 'noto-sans-hebrew', range: '100..900', subsets: ['hebrew', 'latin'] },
];
const rtl = only.includes('rtl');
const wanted = only.length ? FAMILIES.filter((f) => only.includes(f.slug)) : FAMILIES;
if (only.length && wanted.length !== only.filter((s) => s !== 'rtl').length) throw new Error(`unknown slug in: ${only.join(', ')}`);

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
const seraFaces = [];
const createFaces = [];

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
    `@font-face{font-family:'${fam.face ?? fam.name}';font-style:normal;font-weight:${latin.weight};font-display:swap;` +
    `src:url('/fonts/${file}') format('woff2');}`;
  faces.push(face);
  if (TYPESET_SLUGS.has(fam.slug)) typesetFaces.push(face);
  if (SERA_SLUGS.has(fam.slug)) seraFaces.push(face);
  if (CREATE_SLUGS.has(fam.slug)) createFaces.push(face);
}

// The RTL faces: one file per subset, declared with the subset's unicode-range.
const rtlFaces = [];
for (const fam of rtl ? RTL_FAMILIES : []) {
  const res = await fetch(cssUrl(fam.name, fam.range), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${fam.name}: ${res.status}`);
  const css = await res.text();
  for (const subset of fam.subsets) {
    const body = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)].find(([, name]) => name === subset)?.[2];
    const weight = body?.match(/font-weight:\s*([^;]+);/)?.[1].trim();
    const url = body?.match(/src:\s*url\(([^)]+)\)/)?.[1];
    const unicode = body?.match(/unicode-range:\s*([^;]+);/)?.[1].trim();
    if (!weight || !url || !unicode) throw new Error(`no ${subset} woff2 for ${fam.name}`);
    const file = subset === 'latin' ? `${fam.slug}-latin.woff2` : `${fam.slug}.woff2`;
    const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    await writeFile(resolve(OUT_DIR, file), bytes);
    console.log(`saved ${file} (${(bytes.length / 1024).toFixed(1)} KB, weight ${weight})`);
    rtlFaces.push(
      `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url('/fonts/${file}') format('woff2');unicode-range:${unicode};}`,
    );
  }
}

if (faces.length) console.log('\n/* paste into public/input.css (or public/ui-input.css for the /ui faces) */\n' + faces.join('\n'));
if (typesetFaces.length) console.log('\n/* the typeset faces, for public/typeset-fonts.css */\n' + typesetFaces.join('\n'));
if (rtlFaces.length) console.log('\n/* the RTL example faces, for public/rtl-fonts.css */\n' + rtlFaces.join('\n'));
if (seraFaces.length) console.log('\n/* the Sera showcase faces, for public/sera-fonts.css */\n' + seraFaces.join('\n'));
if (createFaces.length) console.log('\n/* the configurator faces, for public/create-fonts.css */\n' + createFaces.join('\n'));
