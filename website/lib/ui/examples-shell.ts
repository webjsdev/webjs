import { html, asset } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { styleLinks } from '#lib/ui/style-links.ts';
import { uiPageHeader, pageNav } from '#lib/ui/ui-page-header.ts';
import { EXAMPLE_IMAGES } from '#modules/ui/example-apps/images.ts';
import { themeSelector, readSelectorTheme, themeClass, withTheme } from '#lib/ui/theme-selector.ts';

/**
 * The /ui/examples page chrome, shadcn/ui's apps/v4/app/(app)/examples/layout.tsx
 * and components/examples-nav.tsx (#1666): the page header, the examples nav,
 * and the bordered frame each example renders inside.
 *
 * A fragment each example page renders rather than a layout, for the reason
 * lib/ui/blocks-shell.ts gives: the nav marks the current example, and a
 * layout is not re-rendered on a soft navigation between two examples.
 *
 * shadcn's PageNav also carries its ThemeSelector, which recolours the
 * example from the configurator's themes. The site has no theme picker yet,
 * so the slot is left out.
 */

export const EXAMPLES_TITLE = 'The Foundation for your Design System';
export const EXAMPLES_DESCRIPTION =
  'A set of beautifully designed components that you can customize, extend, and build on. Start here then make it your own. Open Source. Open Code.';

/** shadcn's examples list, in its order. */
export const EXAMPLES = [
  { name: 'Dashboard', slug: 'dashboard' },
  { name: 'Tasks', slug: 'tasks' },
  { name: 'Playground', slug: 'playground' },
  { name: 'Authentication', slug: 'authentication' },
  { name: 'RTL', slug: 'rtl' },
] as const;

export type ExampleSlug = (typeof EXAMPLES)[number]['slug'];

const NAV_LINK = 'flex h-7 items-center justify-center gap-2 px-4 text-center text-base font-medium text-muted-foreground no-underline transition-colors hover:text-primary data-[active=true]:text-primary';

/** shadcn's ExamplesNav: "Examples" (the home page) then one link per example. */
function examplesNav(current: ExampleSlug, theme: string) {
  return html`<nav aria-label="Examples" class="flex h-8 flex-1 items-center overflow-hidden">
    <div class="no-scrollbar max-w-[96%] overflow-x-auto md:max-w-[600px] lg:max-w-none">
      <div class="flex items-center">
        <a href="/ui" class=${NAV_LINK} data-active="false">Examples</a>
        ${EXAMPLES.map((e) => {
          const active = e.slug === current;
          return html`<a href=${withTheme(`/ui/examples/${e.slug}`, theme)} data-theme-link class=${NAV_LINK} data-active=${active ? 'true' : 'false'} aria-current=${active ? 'page' : null}>${e.name}${e.slug === 'rtl'
            ? html`<span class="flex size-2 rounded-full bg-blue-500" title="New"></span>`
            : ''}</a>`;
        })}
      </div>
    </div>
  </nav>`;
}

/**
 * Below md shadcn shows a picture of an example rather than the example
 * itself, one per theme, and so does this (scripts/shoot-example-images.mjs
 * takes them from the examples). The live example is hidden there with a
 * display: contents wrapper, which adds no box at md and up.
 */
function mobilePicture(name: ExampleSlug) {
  const size = EXAMPLE_IMAGES[name];
  if (!size) return '';
  const [width, height] = size;
  const title = EXAMPLES.find((e) => e.slug === name)?.name ?? name;
  return html`<div class="md:hidden">
    <img src=${asset(`/public/images/examples/${name}-light.png`)} width=${String(width)} height=${String(height)} alt=${title} class="block h-auto w-full dark:hidden">
    <img src=${asset(`/public/images/examples/${name}-dark.png`)} width=${String(width)} height=${String(height)} alt=${title} class="hidden h-auto w-full dark:block">
  </div>`;
}

/**
 * An example page: the header, the nav with `current` active and the theme
 * selector, then the example inside shadcn's frame. The frame drops its border
 * and background when the example is the RTL one (`data-slot="rtl-components"`),
 * as shadcn's does. `style` is the kit style the example renders in (new-york,
 * which shadcn's examples import, unless an example says otherwise). The
 * region below the nav wears the `?theme=` the selector chose, as shadcn's
 * `.theme-container` does.
 */
export function examplesShell(url: URL, current: ExampleSlug, content: unknown, opts: { style?: string } = {}) {
  const { pathname } = url;
  const theme = readSelectorTheme(url.searchParams);
  return html`
    ${styleLinks(pathname)}
    <main id="main" class="flex flex-1 flex-col">
      ${uiPageHeader({
        headingClass: 'max-w-4xl',
        title: EXAMPLES_TITLE,
        description: EXAMPLES_DESCRIPTION,
        actions: html`<span class="style-luma contents">
          <a href="/ui/docs/installation" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Get Started</a>
          <a href="/ui/docs/components" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>View Components</a>
        </span>`,
      })}
      ${pageNav(html`${examplesNav(current, theme)}${themeSelector(theme, { class: 'mr-4 hidden md:flex' })}`, { id: 'examples', class: 'hidden md:flex' })}
      <div class="container-wrapper flex flex-1 flex-col section-soft pb-6">
        <div data-theme-target class=${cn('container flex flex-1 scroll-mt-20 flex-col theme-container', themeClass(theme))}>
          <div data-example-frame class=${cn('flex flex-col overflow-hidden rounded-lg border bg-background bg-clip-padding has-[[data-slot=rtl-components]]:overflow-visible has-[[data-slot=rtl-components]]:border-0 has-[[data-slot=rtl-components]]:bg-transparent md:flex-1 xl:rounded-xl', `style-${opts.style ?? 'new-york'}`)}>
            ${EXAMPLE_IMAGES[current]
              ? html`${mobilePicture(current)}<div class="contents max-md:hidden">${content}</div>`
              : content}
          </div>
        </div>
      </div>
    </main>
  `;
}
