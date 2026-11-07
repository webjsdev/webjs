import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  popoverContentClass, popoverHeaderClass, popoverTitleClass, popoverDescriptionClass,
} from '#modules/ui/components/popover.ts';

export default function PopoverBasic() {
  return html`
    <button type="button" popovertarget="popover-basic" aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open Popover</button>
    <div id="popover-basic" popover role="dialog" aria-labelledby="popover-basic-title" aria-describedby="popover-basic-description" data-slot="popover-content" data-side="bottom" data-align="start" class=${popoverContentClass({ align: 'start' })}>
      <div data-slot="popover-header" class=${popoverHeaderClass()}>
        <h3 id="popover-basic-title" data-slot="popover-title" class=${popoverTitleClass()}>Dimensions</h3>
        <p id="popover-basic-description" data-slot="popover-description" class=${popoverDescriptionClass()}>
          Set the dimensions for the layer.
        </p>
      </div>
    </div>
  `;
}
