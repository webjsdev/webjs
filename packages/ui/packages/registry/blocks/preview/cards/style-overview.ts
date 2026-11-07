/**
 * The preview block's style overview card: the style and font names over a
 * short specimen, and a swatch for each of the theme's colour tokens. A
 * fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/style-overview.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * shadcn reads the style and font names from the configurator's search
 * params. Pass them in (`styleOverview({ style, font })`) from the page that
 * knows them; the defaults name the kit's default style and the site font.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';

const TOKENS = [
  '--background',
  '--foreground',
  '--primary',
  '--secondary',
  '--muted',
  '--accent',
  '--border',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
];

export function styleOverview(opts: { style?: string; font?: string } = {}) {
  const style = opts.style ?? 'New York';
  const font = opts.font ?? 'Geist';
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-6 style-lyra:gap-4 style-mira:gap-4')}>
        <div class="flex flex-col gap-1">
          <div class="font-heading text-2xl font-medium style-lyra:text-lg style-mira:text-lg style-sera:text-lg style-sera:font-semibold style-sera:tracking-wide style-sera:uppercase">
            ${style} - ${font}
          </div>
          <div class="line-clamp-2 text-base text-muted-foreground style-lyra:text-sm style-mira:text-sm style-sera:text-sm style-sera:leading-relaxed">
            Designers love packing quirky glyphs into test phrases. This is a
            preview of the typography styles.
          </div>
        </div>
        <div class="grid grid-cols-6 gap-3">
          ${TOKENS.map((token) => html`
            <div class="flex flex-col flex-wrap items-center gap-2">
              <div
                class="relative aspect-square w-full rounded-lg bg-(--color) after:absolute after:inset-0 after:rounded-lg after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten style-sera:rounded-none style-sera:after:rounded-none"
                style=${`--color: var(${token})`}
              ></div>
              <div class="hidden max-w-14 truncate font-mono text-[0.60rem] md:block style-lyra:max-w-10 style-mira:max-w-10">${token}</div>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
