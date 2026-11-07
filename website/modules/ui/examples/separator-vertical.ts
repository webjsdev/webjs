import { html } from '@webjsdev/core';
import { separatorClass } from '#modules/ui/components/separator.ts';

export default function SeparatorVertical() {
  return html`
    <div class="flex h-5 items-center gap-4 text-sm">
      <div>Blog</div>
      <div role="none" data-slot="separator" data-orientation="vertical" class=${separatorClass({ orientation: 'vertical' })}></div>
      <div>Docs</div>
      <div role="none" data-slot="separator" data-orientation="vertical" class=${separatorClass({ orientation: 'vertical' })}></div>
      <div>Source</div>
    </div>
  `;
}
