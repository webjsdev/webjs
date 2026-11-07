import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import {
  popoverContentClass, popoverHeaderClass, popoverTitleClass, popoverDescriptionClass,
} from '#modules/ui/components/popover.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import { BotIcon, ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function ButtonGroupPopover() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        ${BotIcon()} Copilot
      </button>
      <button type="button" popovertarget="button-group-popover" aria-haspopup="dialog" aria-expanded="false" aria-label="Open Popover" data-slot="button" data-variant="outline" data-size="icon" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
        ${ChevronDownIcon()}
      </button>
    </div>
    <div id="button-group-popover" popover role="dialog" aria-labelledby="button-group-popover-title" aria-describedby="button-group-popover-description" data-slot="popover-content" data-side="bottom" data-align="end" class=${cn(popoverContentClass({ side: 'bottom', align: 'end' }), 'rounded-xl text-sm')}>
      <div data-slot="popover-header" class=${popoverHeaderClass()}>
        <h3 id="button-group-popover-title" data-slot="popover-title" class=${popoverTitleClass()}>Start a new task with Copilot</h3>
        <p id="button-group-popover-description" data-slot="popover-description" class=${popoverDescriptionClass()}>
          Describe your task in natural language.
        </p>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="button-group-popover-task" class=${cn(fieldLabelClass(), 'sr-only')}>Task Description</label>
        <textarea data-slot="textarea" id="button-group-popover-task" placeholder="I need to..." class=${cn(textareaClass(), 'resize-none')}></textarea>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Copilot will open a pull request for review.
        </p>
      </div>
    </div>
  `;
}
