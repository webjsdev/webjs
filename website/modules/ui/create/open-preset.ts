import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import type { CreateParams } from './params.ts';

/**
 * The configurator's Open Preset dialog, shadcn's OpenPreset
 * (apps/v4/app/(app)/(create)/components/open-preset.tsx): paste a preset
 * code, or the `--preset <code>` flag Copy Preset copies, and open it.
 *
 * A native `<dialog>` holding a GET form to /ui/create, so opening a preset
 * is a plain navigation that works with no script (the server reads either
 * spelling, parsePresetInput in ./params.ts). The footer's Open Preset button
 * opens it with an invoker command; <create-customizer> opens it where those
 * are missing, from the menu and the O key too, keeps the Open button disabled
 * until the input parses, and applies the preset in place instead of
 * reloading. shadcn shows a drawer on a phone, so below md the dialog sits at
 * the bottom of the screen, full width.
 */

/** shadcn's example code, shown as the placeholder. */
const PRESET_EXAMPLE = 'b2D0wqNxT';

export function openPreset(params: CreateParams) {
  return html`<dialog id="create-open-preset" data-slot="open-preset" aria-labelledby="create-open-preset-title" aria-describedby="create-open-preset-description" class="m-auto w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-xl bg-card p-0 text-card-foreground shadow-xl ring-1 ring-foreground/10 [color-scheme:dark] backdrop:bg-black/50 max-md:mb-0 max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-2xl">
    <form method="get" action="/ui/create" class="grid gap-4 p-4 md:p-6">
      <input type="hidden" name="item" value=${params.item}>
      <div class="grid gap-1.5 max-md:text-center">
        <h2 id="create-open-preset-title" class="m-0 text-base font-medium max-md:text-xl">Open Preset</h2>
        <p id="create-open-preset-description" class="m-0 text-sm text-muted-foreground">Paste a preset code to load a saved configuration.</p>
      </div>
      <div data-slot="field" class="grid gap-2 max-md:py-2">
        <label for="preset-code" class="sr-only">Preset code</label>
        <input id="preset-code" name="preset" required autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder=${`${PRESET_EXAMPLE} or --preset ${PRESET_EXAMPLE}`} class="h-10 w-full min-w-0 rounded-md bg-transparent px-3 text-sm ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-ring aria-invalid:ring-destructive md:h-8">
      </div>
      <div class="flex gap-2 max-md:flex-col md:justify-end">
        <button type="submit" data-open-preset-submit class=${`${buttonClass()} max-md:h-10 md:order-2`}>Open</button>
        <button type="button" commandfor="create-open-preset" command="close" class=${`${buttonClass({ variant: 'outline' })} max-md:h-10`}>Cancel</button>
      </div>
    </form>
  </dialog>`;
}
