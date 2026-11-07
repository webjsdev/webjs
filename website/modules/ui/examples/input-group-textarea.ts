import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass,
  inputGroupTextClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import {
  IconBrandJavascript, IconCopy, IconCornerDownLeft, IconRefresh,
} from '#lib/ui/tabler.ts';

export default function InputGroupTextareaExample() {
  return html`
    <div class="grid w-full max-w-md gap-4">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <textarea data-slot="input-group-control" id="textarea-code-32" placeholder="console.log('Hello, world!');" aria-label="Code" class=${cn(inputGroupTextareaClass(), 'min-h-[200px]')}></textarea>
        <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'border-t')}>
          <span class=${inputGroupTextClass()}>Line 1, Column 1</span>
          <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'sm' }), 'ml-auto')}>
            Run ${IconCornerDownLeft()}
          </button>
        </div>
        <div role="group" data-slot="input-group-addon" data-align="block-start" class=${cn(inputGroupAddonClass({ align: 'block-start' }), 'border-b')}>
          <span class=${cn(inputGroupTextClass(), 'font-mono font-medium')}>
            ${IconBrandJavascript()}
            script.js
          </span>
          <button type="button" aria-label="Refresh" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'ml-auto')}>
            ${IconRefresh()}
          </button>
          <button type="button" aria-label="Copy" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ variant: 'ghost', size: 'icon-xs' })}>
            ${IconCopy()}
          </button>
        </div>
      </div>
    </div>
  `;
}
