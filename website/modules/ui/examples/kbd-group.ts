import { html } from '@webjsdev/core';
import { kbdClass, kbdGroupClass } from '#modules/ui/components/kbd.ts';

export default function KbdGroupExample() {
  return html`
    <div class="flex flex-col items-center gap-4">
      <p class="text-sm text-muted-foreground">
        Use${' '}
        <kbd data-slot="kbd-group" class=${kbdGroupClass()}>
          <kbd data-slot="kbd" class=${kbdClass()}>Ctrl + B</kbd>
          <kbd data-slot="kbd" class=${kbdClass()}>Ctrl + K</kbd>
        </kbd>${' '}
        to open the command palette
      </p>
    </div>
  `;
}
