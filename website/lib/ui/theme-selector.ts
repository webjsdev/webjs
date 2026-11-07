import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { dialogHeaderClass, dialogTitleClass, dialogDescriptionClass } from '#modules/ui/components/dialog.ts';
import { buildThemeVars, getTheme } from '#modules/ui/design-system/themes.js';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { SELECTOR_THEMES } from '#lib/ui/selector-themes.ts';

/**
 * shadcn/ui's ThemeSelector and CopyCodeButton (apps/v4/components/
 * theme-selector.tsx, theme-customizer.tsx, #1666): the theme select at the
 * end of the examples and charts nav, which repaints the region below it, and
 * the button that shows the chosen theme's CSS to copy.
 *
 * The region wears a theme by class, `theme-<name>`, the `.theme-<name>`
 * rules scripts/build-ui-themes.mjs writes into public/ui.css. The choice is
 * the `?theme=` query string, so the select is a GET form: with JavaScript
 * off its Apply button reloads the page in the theme. <theme-selector>
 * (components/theme-selector.ts) applies a change in place instead, keeps the
 * links marked `data-theme-link` carrying it, and shows the chosen theme's
 * code in the dialog.
 */

export { SELECTOR_THEMES, DEFAULT_SELECTOR_THEME, readSelectorTheme, themeClass, withTheme } from '#lib/ui/selector-themes.ts';

const title = (name: string) => getTheme(name)?.title ?? name;

/** The theme as the CSS a reader pastes: its whole palette over neutral, as shadcn's dialog shows it. */
function themeCode(name: string): string {
  const { light, dark } = buildThemeVars({ baseColor: 'neutral', theme: name });
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`;
  const { radius, ...rest } = light;
  return `${block(':root', { radius, ...rest })}\n\n${block('.dark', dark)}`;
}

const copyIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg>`;

/** shadcn's CopyCodeButton: a dialog with the chosen theme's CSS, one block per theme. */
function copyCodeButton(current: string) {
  return html`<ui-dialog>
    <ui-dialog-trigger>
      <button type="button" data-slot="button" data-size="icon-sm" class=${cn(buttonClass({ variant: 'secondary', size: 'icon-sm' }), 'group/button rounded-lg border bg-transparent')}>
        ${copyIcon}<span class="group-data-[size=icon-sm]/button:sr-only">Copy Code</span>
      </button>
    </ui-dialog-trigger>
    <ui-dialog-content class="rounded-2xl border-none bg-clip-padding shadow-2xl ring-4 ring-neutral-200/80 outline-none md:max-w-2xl dark:bg-neutral-800 dark:ring-neutral-900">
      <div data-slot="dialog-header" class=${dialogHeaderClass()}>
        <h2 data-slot="dialog-title" class=${cn(dialogTitleClass(), 'capitalize')}><span data-theme-name>${current}</span></h2>
        <p data-slot="dialog-description" class=${dialogDescriptionClass()}>Copy and paste the following code into your CSS file.</p>
      </div>
      ${SELECTOR_THEMES.map((name) => {
        const code = themeCode(name);
        return html`<div data-theme-code=${name} ?hidden=${name !== current} class="relative min-w-0 [&_figure]:mx-0! [&_figure]:mt-0 [&_figure]:rounded-xl [&_pre]:max-h-[300px] md:[&_pre]:max-h-[450px]">
          <ui-code-block-copy-button value=${code} class="absolute top-12 right-2 z-10"></ui-code-block-copy-button>
          ${codeFigure(code, { title: 'styles/globals.css', lang: 'css', lineNumbers: true })}
        </div>`;
      })}
    </ui-dialog-content>
  </ui-dialog>`;
}

/**
 * shadcn's ThemeSelector: the select in nova and the copy button and dialog in
 * new-york, the styles shadcn's two components import.
 */
export function themeSelector(current: string, opts: { class?: string } = {}) {
  return html`<theme-selector class=${cn('style-nova flex items-center gap-2', opts.class)}>
    <form method="get" class="flex items-center gap-2">
      <label for="theme-selector" class="sr-only">Theme</label>
      <ui-select>
        <select id="theme-selector" name="theme" class=${cn(selectTriggerClass(), 'w-36')}>
          <optgroup label="Theme">
            ${SELECTOR_THEMES.map((name) => html`<option value=${name} ?selected=${name === current} class="data-[state=checked]:opacity-50">${title(name)}</option>`)}
          </optgroup>
        </select>
      </ui-select>
      <noscript><button class=${buttonClass({ variant: 'secondary', size: 'sm' })}>Apply</button></noscript>
    </form>
    <span class="style-new-york contents">${copyCodeButton(current)}</span>
  </theme-selector>`;
}
