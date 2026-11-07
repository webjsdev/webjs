/**
 * The /ui faces are the files ui.shadcn.com serves (#1666). Google serves a
 * different build of a family to a different browser, and the build this site
 * once fetched drew Geist visibly lighter than shadcn's, so every /ui label
 * looked a weight thin. scripts/fetch-fonts.mjs now asks with next/font's own
 * user agent; these hashes are shadcn's files, so a re-run that brought back
 * another build fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const md5 = (file: string) => createHash('md5').update(readFileSync(resolve(ROOT, 'public/fonts', file))).digest('hex');

// Every self-hosted face shadcn's site also serves, with the md5 of shadcn's
// file (its home page, its typeset previews and its RTL example, fetched from
// ui.shadcn.com). Inter Tight is the marketing site's alone, so it has none.
const SHADCN_FILES: Array<[string, string]> = [
  // shadcn's site: Geist (variable) and Geist Mono at weight 400 alone.
  ['geist.woff2', 'f4634c3bc1fa7cb53247e1f2872adb5a'],
  ['geist-mono.woff2', '68bab961eff9f3a6688713c9c93497b6'],
  // shadcn's preview frames: Geist Mono with every weight, and the typeset faces.
  ['geist-mono-variable.woff2', 'cd5b25781181c5c03d99ac2cbf88016a'],
  ['dm-sans.woff2', 'd4c68940b772538be3593f0c646de4a0'],
  ['figtree.woff2', '392aed3eb1423f8bb5f11bc4ab5ab061'],
  ['ibm-plex-sans.woff2', 'd28498895ed7050c37c94ddd026a4670'],
  ['instrument-sans.woff2', 'e35fad09c70beb975a297c43c6af4e66'],
  ['inter.woff2', '65850a373e258f1c897a2b3d75eb74de'],
  ['jetbrains-mono.woff2', '782150e6836b9b074d1a798807adcb18'],
  ['lora.woff2', '662c56ecd8de96f417f0400559ab2ab9'],
  ['manrope.woff2', 'b222d83cc2747abdbac1b5b7b976194c'],
  ['merriweather.woff2', 'c355ec2df77a650bba34b592b711cb81'],
  ['montserrat.woff2', 'c154477b9affa3a0a47f894c8b80c03c'],
  ['noto-sans.woff2', '86d512f8885dcf964fa570ce49f19d65'],
  ['noto-serif.woff2', 'ea5d1d6ec3ac0830811e2b8d98d09077'],
  ['nunito-sans.woff2', 'e31445dff877bc9df37ab16c851db8b8'],
  ['outfit.woff2', '98ccc2b7f18991a5126a91ac56fbb1fc'],
  ['oxanium.woff2', '2a16eec1577c263f9057c9e1299326e9'],
  ['playfair-display.woff2', '6da252de0cbc8a69b5d5c2e0e3f67722'],
  ['public-sans.woff2', '45ac3f4b61c187a0e3d9e6ba1198df6a'],
  ['raleway.woff2', '5032e93bbe3d120bece5d4d3309d3b8b'],
  ['roboto.woff2', 'b7627e3c9663757d70121f2ad4c8d986'],
  ['roboto-slab.woff2', '479626dc09173ec7478c043e24082f41'],
  ['source-sans-3.woff2', '6e4bd172ce222a2a6c2a1669aa1905cc'],
  ['space-grotesk.woff2', '25ea4a783c12103f175f5b157b7d96aa'],
  // The configurator's preview: two faces the typeset builder does not offer.
  ['eb-garamond.woff2', '1a4b137019bd3e19c2a8c541e7f5fde3'],
  ['instrument-serif.woff2', 'c008db4e8a972ad72dcbd4251a98ac63'],
  // The RTL example's faces, each script's subset and latin.
  ['noto-sans-arabic.woff2', '593878768b809251b8aea93f1831e86c'],
  ['noto-sans-arabic-latin.woff2', 'c951ffe24f5553a61892ebf51132657b'],
  ['noto-sans-hebrew.woff2', 'd6b47ab839699c763b27a6a9bc6bc193'],
  ['noto-sans-hebrew-latin.woff2', '0a36c76bb624e627f3d367fe97264e19'],
];

test('the self-hosted fonts are byte for byte the files ui.shadcn.com serves', () => {
  const wrong = SHADCN_FILES.filter(([file, hash]) => md5(file) !== hash).map(([file]) => file);
  assert.deepEqual(wrong, []);
});

test('the /ui chrome sets mono in the 400-only face, as shadcn does', () => {
  const css = readFileSync(resolve(ROOT, 'public/ui-input.css'), 'utf8');
  assert.match(css, /font-family:'Geist Mono Regular';font-style:normal;font-weight:400;[^}]*geist-mono\.woff2/);
  assert.match(css, /font-family:'Geist Mono';font-style:normal;font-weight:100 900;[^}]*geist-mono-variable\.woff2/);
  assert.match(css, /--font-mono: 'Geist Mono Regular',/);
});

test('fetch-fonts asks Google with the user agent next/font sends', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/fetch-fonts.mjs'), 'utf8');
  assert.ok(src.includes(
    "'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'",
  ));
});

test('the configurator preview declares the two faces only it offers', () => {
  const css = readFileSync(resolve(ROOT, 'public/create-fonts.css'), 'utf8');
  assert.match(css, /font-family:'EB Garamond';font-style:normal;font-weight:400 800;[^}]*eb-garamond\.woff2/);
  assert.match(css, /font-family:'Instrument Serif';font-style:normal;font-weight:400;[^}]*instrument-serif\.woff2/);
  const page = readFileSync(resolve(ROOT, 'app/ui/preview/[name]/page.ts'), 'utf8');
  assert.match(page, /asset\('\/public\/create-fonts\.css'\)/, 'the preview frame links them');
  const typeset = readFileSync(resolve(ROOT, 'public/typeset-fonts.css'), 'utf8');
  assert.doesNotMatch(typeset, /EB Garamond|Instrument Serif/, 'and the typeset faces stay as they were');
});
