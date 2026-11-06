import { html } from '@webjsdev/core';
import { kbdClass, kbdGroupClass } from '#modules/ui/components/kbd.ts';

export default function KbdDemo() {
  return html`
    <div class="flex flex-col items-center gap-4">
      <kbd data-slot="kbd-group" role="img" aria-label="Command Shift Option Control" class=${kbdGroupClass()}>
        <kbd data-slot="kbd" class=${kbdClass()}>⌘</kbd>
        <kbd data-slot="kbd" class=${kbdClass()}>⇧</kbd>
        <kbd data-slot="kbd" class=${kbdClass()}>⌥</kbd>
        <kbd data-slot="kbd" class=${kbdClass()}>⌃</kbd>
      </kbd>
      <kbd data-slot="kbd-group" role="img" aria-label="Control plus B" class=${kbdGroupClass()}>
        <kbd data-slot="kbd" class=${kbdClass()}>Ctrl</kbd>
        <span>+</span>
        <kbd data-slot="kbd" class=${kbdClass()}>B</kbd>
      </kbd>
    </div>
  `;
}
