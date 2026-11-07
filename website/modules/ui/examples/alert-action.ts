import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';

// The alert makes room for any child marked data-slot="alert-action"; the
// action itself is positioned in the top corner.
export default function AlertActionExample() {
  return html`
    <div data-slot="alert" role="alert" class=${cn(alertClass(), 'max-w-md')}>
      <div data-slot="alert-title" class=${alertTitleClass()}>Dark mode is now available</div>
      <div data-slot="alert-description" class=${alertDescriptionClass()}>
        Enable it under your profile settings to get started.
      </div>
      <div data-slot="alert-action" class="absolute top-2 right-2">
        <button type="button" data-slot="button" data-variant="default" data-size="xs" class=${buttonClass({ size: 'xs' })}>
          Enable
        </button>
      </div>
    </div>
  `;
}
