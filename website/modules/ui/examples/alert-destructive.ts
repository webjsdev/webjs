import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import { AlertCircleIcon } from '#lib/ui/lucide.ts';

export default function AlertDestructive() {
  return html`
    <div data-slot="alert" role="alert" class=${cn(alertClass({ variant: 'destructive' }), 'max-w-md')}>
      ${AlertCircleIcon()}
      <div data-slot="alert-title" class=${alertTitleClass()}>Payment failed</div>
      <div data-slot="alert-description" class=${alertDescriptionClass()}>
        Your payment could not be processed. Please check your payment method
        and try again.
      </div>
    </div>
  `;
}
