/**
 * The text of the typeset builder's Docs and Prompt tabs, ported from
 * shadcn/ui's apps/v4/app/(app)/(typeset)/components/docs-panel.tsx (#1666)
 * and made true for a WebJs app.
 *
 * Pure strings, no markup: the page renders them at SSR and
 * <typeset-customizer> regenerates the same strings in the browser when a
 * choice changes, so the two can never disagree.
 *
 * What changed from shadcn's, and why:
 *
 * - The stylesheet. A WebJs app compiles public/input.css to
 *   public/tailwind.css with the Tailwind CLI, so typeset.css goes beside
 *   public/input.css and is imported there.
 * - The fonts. shadcn's panel offers a framework select (Next.js loads with
 *   next/font, the rest with fontsource). A WebJs app has neither: there is
 *   no build step to run next/font, and fontsource's woff2 files sit in
 *   node_modules, which the server does not serve. So the select offers the
 *   two ways a WebJs app actually loads a font: a Google Fonts stylesheet link
 *   in the root layout, or the woff2 self-hosted from public/fonts/ (how this
 *   site loads every face it uses).
 * - The wrapper is an html template rather than JSX.
 */
import { findFont, type TypesetFont } from './fonts.ts';
import { headingFontId, measureWidth, type TypesetParams } from './params.ts';

export type FontSource = 'google' | 'self-hosted';

export const FONT_SOURCES: readonly { value: FontSource; label: string }[] = [
  { value: 'google', label: 'Google Fonts' },
  { value: 'self-hosted', label: 'Self-hosted' },
];

export const DEFAULT_FONT_SOURCE: FontSource = 'google';

export function isFontSource(value: string | null | undefined): value is FontSource {
  return value === 'google' || value === 'self-hosted';
}

/** The preset class a set of params names, shadcn's `typeset-<item>`. */
export const presetName = (params: TypesetParams) => `typeset-${params.item}`;

/** The fonts the preset uses, each once, in body, heading, mono order. */
export function pickedFonts(params: TypesetParams): TypesetFont[] {
  const ids = [params.body, params.heading, params.mono].filter((id) => id !== 'inherit');
  return [...new Set(ids)].map((id) => findFont(id)).filter((font): font is TypesetFont => !!font);
}

const generic = (font: TypesetFont) => (font.type === 'mono' ? 'monospace' : font.type === 'serif' ? 'serif' : 'sans-serif');

/** The preset class itself. */
export function presetCss(params: TypesetParams): string {
  return `.${presetName(params)} {
  --typeset-font-body: var(--font-${params.body});
  --typeset-font-heading: var(--font-${headingFontId(params)});
  --typeset-font-mono: var(--font-${params.mono});
  --typeset-size: ${params.scale}px;
  --typeset-leading: ${params.leading};
  --typeset-flow: ${params.flow};
}`;
}

/** Step 1's import. */
export const IMPORT_CSS = '@import "tailwindcss";\n@import "./typeset.css";';

/** Step 3: the preset, in the app's Tailwind input. */
export function presetCode(params: TypesetParams): string {
  return `/* public/input.css */
${IMPORT_CSS}

${presetCss(params)}`;
}

/** Step 4: the wrapper, as an html template body. */
export function usageCode(params: TypesetParams): string {
  return `<div class="typeset ${presetName(params)} max-w-[${measureWidth(params.measure)}]">
  \${content}
</div>`;
}

/** The --font-* names the preset reads, in public/input.css. */
function fontVariables(fonts: TypesetFont[]): string {
  return [':root {', ...fonts.map((font) => `  --font-${font.id}: '${font.name}', ${generic(font)};`), '}'].join('\n');
}

/** The Google Fonts css2 URL for these fonts, every weight of each. */
export function googleFontsUrl(fonts: TypesetFont[]): string {
  const families = fonts.map((font) => `family=${font.name.replace(/ /g, '+')}:wght@${font.range}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** The root layout's links, for the Google Fonts source. */
export function googleFontsLinks(fonts: TypesetFont[]): string {
  return `<!-- app/layout.ts, in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${googleFontsUrl(fonts)}">`;
}

/** The @font-face rules, for the self-hosted source. */
export function fontFaceCss(fonts: TypesetFont[]): string {
  const faces = fonts.map((font) => `@font-face {
  font-family: '${font.name}';
  font-style: normal;
  font-weight: ${font.range.replace('..', ' ')};
  font-display: swap;
  src: url('/fonts/${font.id}.woff2') format('woff2');
}`);
  return ['/* public/input.css */', ...faces, '', fontVariables(fonts)].join('\n');
}

/** Step 2, as the Docs tab shows it: a sentence and the code for each block. */
export function fontSteps(params: TypesetParams, source: FontSource): { prose: string; code: string }[] {
  const fonts = pickedFonts(params);
  if (source === 'google') {
    return [
      { prose: 'Link the fonts in your root layout:', code: googleFontsLinks(fonts) },
      { prose: 'Then name them in your CSS file:', code: `/* public/input.css */\n${fontVariables(fonts)}` },
    ];
  }
  return [
    {
      prose: 'Save each font\'s latin variable woff2 in public/fonts/, then declare it in your CSS file:',
      code: fontFaceCss(fonts),
    },
  ];
}

/** Where "Read the docs" and the prompt point. */
export const TYPESET_DOCS_URL = 'https://ui.shadcn.com/docs/typeset';

/** The Prompt tab: the whole setup as one prompt for a coding agent. */
export function promptText(params: TypesetParams, source: FontSource, origin: string): string {
  const name = presetName(params);
  const fonts = pickedFonts(params);
  const fontStep = source === 'google'
    ? `Load the fonts with a stylesheet link in the root layout, app/layout.ts, inside <head>:

${googleFontsLinks(fonts)}

Then name them in public/input.css:

${fontVariables(fonts)}`
    : `Download each font's latin variable woff2 from Google Fonts into public/fonts/ (${fonts.map((font) => `${font.id}.woff2`).join(', ')}), then declare them in public/input.css:

${fontFaceCss(fonts).replace('/* public/input.css */\n', '')}`;

  return `Install shadcn/typeset in this WebJs app.

Typeset is a single stylesheet that styles rendered markdown: wrap the output in a \`typeset\` container and everything inside (headings, lists, tables, code, blockquotes, math) is styled. Everything outside is untouched.

1. Download ${origin}/ui/typeset.css and save it as public/typeset.css, next to public/input.css (the Tailwind input the app compiles to public/tailwind.css). If the file already exists, replace it with the downloaded copy.

2. Import it in public/input.css, after the Tailwind import:

@import "./typeset.css";

3. ${fontStep}

4. Add this preset to public/input.css, after the typeset import. If a class named .${name} already exists, update its values in place. Leave any other typeset-* presets untouched: they are separate surfaces:

${presetCss(params)}

5. Do not apply the class anywhere yet. Search the project for surfaces that render markdown or rich content: unsafeHTML holes fed parsed markdown, markdown renderers (marked, markdown-it, remark), prose classes, CMS content renderers. Present the candidates you find as a short list and ask the user which surface should use typeset. Then wrap only the surface they pick, in its html template:

${usageCode(params)}

If the picked surface already has its own typography (a prose class, styled markdown elements), list those styles and let the user decide what to remove before wrapping.

Notes:

- To exclude an embedded component from typeset styles, add the not-typeset class or the data-not-typeset attribute to it.
- Verify on the surface the user picked: headings, lists, tables, and code inside the container should be styled with no classes on the content itself.
- Docs: ${TYPESET_DOCS_URL}`;
}
