import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { ArrowUpIcon, PlusIcon } from '#lib/ui/lucide.ts';

const suggestions = [
  'Add a dark mode toggle',
  'Fix the failing build',
  'Write tests for the form',
  'Upgrade to Next.js 16',
  'Add a loading state',
  'Find unused dependencies',
];

// Before anything is sent: the row of suggestions above an empty prompt
// field. Sending a suggestion is the app's to wire, as the AI SDK section
// below shows.
export default function SuggestionDemo() {
  return html`
    <div class="mx-auto flex w-full max-w-lg flex-col gap-6 py-6 text-sm">
      <div class="flex flex-col gap-2">
        <div class="flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain">
          ${suggestions.map((suggestion) => html`
            <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
              ${suggestion}
            </button>
          `)}
        </div>
        <form>
          <div data-slot="input-group" role="group" class=${inputGroupClass()}>
            <textarea data-slot="input-group-control" name="prompt" aria-label="Prompt" placeholder="Ask the agent to change your code..." class=${cn(inputGroupTextareaClass(), 'p-3')}></textarea>
            <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
              <button type="button" data-slot="input-group-button" data-variant="outline" data-size="icon-sm" aria-label="Attach files" class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'outline' }), 'rounded-full')}>
                ${PlusIcon()}
              </button>
              <button type="submit" data-slot="input-group-button" data-variant="default" data-size="icon-sm" aria-label="Send" disabled class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'default' }), 'ml-auto rounded-full')}>
                ${ArrowUpIcon()}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}
