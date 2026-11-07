import { WebComponent, html } from '@webjsdev/core';
import { THEME_STORAGE_KEY, type Theme } from '#lib/theme.ts';

/**
 * `<ui-mode-switcher>`: the /ui header's light / dark switch, shadcn's
 * ModeSwitcher (apps/v4/components/mode-switcher.tsx).
 *
 * Two states, as shadcn's: a click flips the RESOLVED theme, so on a page
 * following the OS it writes the opposite of what the OS shows. The value
 * goes where the marketing header's three-state <theme-toggle> writes it
 * (lib/theme.ts), so the root layout's bootstrap restores it and a choice
 * holds across the two sections. The icon is the same in both states, so the
 * button renders nothing that depends on the state and needs no signal.
 *
 * Same-origin frames on the page (the /ui/create and /ui/typeset previews,
 * the block viewer) take the new value too, the way shadcn's frames follow
 * next-themes.
 */
export class UiModeSwitcher extends WebComponent {
  toggle(): void {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    root.dataset.theme = next;
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        const doc = frame.contentDocument;
        if (doc) doc.documentElement.dataset.theme = next;
      } catch {}
    }
  }

  render() {
    return html`
      <button type="button" data-slot="button" class="group/toggle extend-touch-target inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50" @click=${() => this.toggle()}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4.5" aria-hidden="true">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
          <path d="M12 3l0 18"></path>
          <path d="M12 9l4.65 -4.65"></path>
          <path d="M12 14.3l7.37 -7.37"></path>
          <path d="M12 19.6l8.85 -8.85"></path>
        </svg>
        <span class="sr-only">Toggle theme</span>
      </button>
    `;
  }
}

UiModeSwitcher.register('ui-mode-switcher');
