/**
 * The sidebar-06 newsletter card: a title, a line of copy and an email
 * opt-in form, sized for the sidebar's footer. A fragment helper, so it
 * renders on the server and ships no JavaScript. Ported from shadcn/ui's
 * sidebar-06.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${subscribe}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { sidebarInputClass } from '../../../components/sidebar.ts';

export function sidebarOptInForm() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'gap-2 py-4 shadow-none')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'px-4')}>
        <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-sm')}>Subscribe to our newsletter</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Opt-in to receive updates and news about the sidebar.
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-4')}>
        <form>
          <div class="grid gap-2.5">
            <input type="email" name="email" autocomplete="email" placeholder="Email" aria-label="Email" required data-slot="sidebar-input" data-sidebar="input" class=${sidebarInputClass()}>
            <button type="submit" data-slot="button" class=${cn(buttonClass(), 'w-full bg-sidebar-primary text-sidebar-primary-foreground shadow-none')}>Subscribe</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
