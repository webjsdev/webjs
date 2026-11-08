import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { styleLinks } from '#lib/ui/style-links.ts';
import { uiPageHeader } from '#lib/ui/ui-page-header.ts';
import {
  getColors, getColorFormat, COLOR_FORMATS, DEFAULT_COLOR_FORMAT,
  type Color, type ColorPalette,
} from '#modules/ui/colors/colors.ts';
// The copy behaviour. A page never hydrates, so it imports the element its
// markup uses to register it.
import '#components/color-swatches.ts';

/**
 * /ui/colors, shadcn/ui's Tailwind colour page (#1666): apps/v4/app/(app)/
 * colors (layout and page), components/color-palette.tsx, color.tsx and
 * color-format-selector.tsx, over the palette data in modules/ui/colors/.
 *
 * Every palette, swatch and format menu is server markup, so the colours and
 * their names read with JavaScript off. <color-swatches> adds the copy: a
 * swatch copies its value in the chosen format, and the format menus share
 * one choice that persists. The menus are the kit's <ui-select> over a
 * native select, so with JavaScript off the native select shows.
 *
 * shadcn's ColorsNav sits in a hidden bar on its page, so it is left out.
 */

const TITLE = 'Tailwind Colors in Every Format';
const DESCRIPTION = 'The complete Tailwind color palette in HEX, RGB, HSL, CSS variables, and classes. Ready to copy and paste into your project.';

export const metadata: Metadata = {
  title: `${TITLE} | WebJs UI`,
  description: DESCRIPTION,
};

// lucide's clipboard, the swatch's resting icon.
const clipboardIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="group-hover:opacity-100 group-data-[last-copied=true]:hidden"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>`;

// lucide's check, shown on the swatch copied last.
const checkIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="hidden group-hover:opacity-100 group-data-[last-copied=true]:block group-data-[last-copied=true]:opacity-100"><path d="M20 6 9 17l-5-5"></path></svg>`;

/** shadcn's Color: one swatch, a button that copies its value. */
function swatch(color: Color) {
  return html`<button
    type="button"
    data-swatch
    data-last-copied="false"
    data-classname=${color.className}
    data-hex=${color.hex}
    data-rgb=${color.rgb}
    data-hsl=${color.hsl}
    data-oklch=${color.oklch}
    data-var=${color.var}
    aria-label=${`Copy ${color.className}`}
    class="group relative flex aspect-[3/1] w-full flex-1 cursor-pointer flex-col gap-2 text-(--text) sm:aspect-[2/3] sm:h-auto sm:w-auto [&>svg]:absolute [&>svg]:top-4 [&>svg]:right-4 [&>svg]:z-10 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-0 [&>svg]:transition-opacity"
    style=${`--bg: ${color.oklch}; --text: ${color.foreground}`}
  >
    ${clipboardIcon()}
    ${checkIcon()}
    <div class="border-ghost w-full flex-1 rounded-md bg-(--bg) after:rounded-lg after:border-input md:rounded-lg"></div>
    <div class="flex w-full flex-col items-center justify-center gap-1">
      <span class="font-mono text-xs text-muted-foreground tabular-nums transition-colors group-hover:text-foreground group-data-[last-copied=true]:text-primary sm:hidden xl:flex">${color.className}</span>
      <span class="hidden font-mono text-xs text-muted-foreground tabular-nums transition-colors group-hover:text-foreground group-data-[last-copied=true]:text-primary sm:flex xl:hidden">${color.scale}</span>
    </div>
  </button>`;
}

/**
 * shadcn's ColorFormatSelector, the format menu in a palette's header: the
 * trigger reads "Format: <format>", and each item shows the format beside its
 * value for the palette's first shade. With JS off the native select shows
 * the format names.
 */
function formatSelector(palette: ColorPalette) {
  const formats = getColorFormat(palette.colors[0]);
  return html`<span class="style-new-york contents">
    <ui-select size="sm" position="popper" align="end" content-class="rounded-xl" class="ml-auto">
      <template data-select-trigger><span class="font-medium">Format: </span><span class="font-mono text-muted-foreground" data-slot="select-value"></span></template>
      <select id=${`format-${palette.name}`} data-color-format aria-label="Format" class=${cn(selectTriggerClass(), 'border-secondary bg-secondary text-secondary-foreground shadow-none')}>
        ${COLOR_FORMATS.map((f) => html`<option value=${f} ?selected=${f === DEFAULT_COLOR_FORMAT} class="gap-2 rounded-lg [&>span]:flex [&>span]:items-center [&>span]:gap-2"><template><span class="font-medium">${f}</span><span class="font-mono text-xs text-muted-foreground">${formats[f]}</span></template>${f}</option>`)}
      </select>
    </ui-select>
  </span>`;
}

/** shadcn's ColorPalette: a palette's name and format menu over its swatches. */
function palette(p: ColorPalette) {
  return html`<div id=${p.name} class="scroll-mt-20 rounded-lg">
    <div class="flex items-center px-4">
      <div class="flex-1 pl-1 text-sm font-medium">
        <h2 class="capitalize">${p.name}</h2>
      </div>
      ${formatSelector(p)}
    </div>
    <div class="flex flex-col gap-4 py-4 sm:flex-row sm:gap-2">
      ${p.colors.map(swatch)}
    </div>
  </div>`;
}

export default function ColorsPage() {
  return html`
    ${styleLinks('/ui/colors')}
    <main id="main" tabindex="-1" class="flex flex-1 flex-col">
      ${uiPageHeader({
        title: TITLE,
        description: DESCRIPTION,
        actions: html`<span class="style-luma contents">
          <a href="#colors" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Browse Colors</a>
          <a href="/ui/docs/theming" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>Documentation</a>
        </span>`,
      })}
      <div class="container-wrapper">
        <div class="container py-6">
          <section id="colors" class="scroll-mt-20">
            <color-swatches class="grid gap-8 lg:gap-16 xl:gap-20">
              ${getColors().map(palette)}
            </color-swatches>
          </section>
        </div>
      </div>
    </main>
  `;
}
