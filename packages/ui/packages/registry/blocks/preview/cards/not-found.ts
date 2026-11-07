/**
 * The preview block's not-found card: a 404 empty state with a search field
 * and a way home. A fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/not-found.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * The search field is a placeholder: put it in a GET `<form>` aimed at your
 * search route.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyTitleClass,
} from '../../../components/empty.ts';
import { inputGroupAddonClass, inputGroupClass, inputGroupInputClass } from '../../../components/input-group.ts';
import { kbdClass } from '../../../components/kbd.ts';
import { SearchIcon } from '../../../lib/icons.ts';

export function notFound() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'h-72')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-title" class=${emptyTitleClass()}>404 Not Found</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>The page you're looking for doesn't exist. Try searching for what you need below.</div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <div role="group" data-slot="input-group" class=${cn(inputGroupClass(), 'w-3/4')}>
              <input data-slot="input-group-control" name="q" aria-label="Search pages" placeholder="Try searching for pages..." class=${inputGroupInputClass()}>
              <div role="group" data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass()}>${SearchIcon()}</div>
              <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}><kbd data-slot="kbd" class=${kbdClass()}>/</kbd></div>
            </div>
            <a href="/" data-slot="button" data-variant="link" data-size="default" class=${buttonClass({ variant: 'link' })}>Go to homepage</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
