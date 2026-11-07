import { html, asset } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

/**
 * The configurator's welcome, shadcn's WelcomeDialog
 * (apps/v4/app/(app)/(create)/components/welcome-dialog.tsx): shown once, on
 * the first visit, and never again once dismissed.
 *
 * A native `<dialog>`, closed in the markup. "First visit" is a fact only the
 * browser holds (shadcn keeps it in localStorage too), so <create-customizer>
 * opens it when the key is absent and writes the key when it closes. With
 * JavaScript off it never shows, as shadcn's does not.
 */

/** The localStorage key that records the dismissal. */
export const WELCOME_STORAGE_KEY = 'webjs-ui-create-welcome-dialog';

export function welcomeDialog() {
  return html`<dialog id="create-welcome" data-slot="welcome-dialog" aria-labelledby="create-welcome-title" aria-describedby="create-welcome-description" class="m-auto w-[calc(100vw-2rem)] max-w-92 min-w-0 overflow-hidden rounded-xl bg-card p-0 text-card-foreground shadow-xl ring-1 ring-foreground/10 backdrop:bg-black/50 sm:max-w-sm dark:bg-neutral-900">
    <div class="flex aspect-[2/1.2] w-full items-center justify-center rounded-t-xl bg-neutral-950 text-center text-neutral-100 sm:aspect-2/1">
      <img src=${asset('/public/brand/webjs-mark-on-dark.svg')} alt="" class="block h-12 w-auto">
    </div>
    <div class="grid gap-1 p-4">
      <h2 id="create-welcome-title" class="m-0 text-left text-base font-medium">Build your own WebJs UI</h2>
      <p id="create-welcome-description" class="m-0 text-left text-sm leading-relaxed text-foreground">Customize everything from the ground up. Pick your style, base color, theme, fonts, radius and icons.</p>
      <p class="m-0 mt-2 text-left text-sm leading-relaxed font-medium text-foreground">One command installs it into any WebJs app.</p>
    </div>
    <form method="dialog" class="p-4 pt-0">
      <button type="submit" class=${`${buttonClass()} w-full`}>Get Started</button>
    </form>
  </dialog>`;
}
