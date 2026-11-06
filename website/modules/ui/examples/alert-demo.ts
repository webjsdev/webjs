import { html } from '@webjsdev/core';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import { CheckCircle2Icon, InfoIcon } from '#lib/ui/lucide.ts';

export default function AlertDemo() {
  return html`
    <div class="grid w-full max-w-md items-start gap-4">
      <div data-slot="alert" role="alert" class=${alertClass()}>
        ${CheckCircle2Icon()}
        <div data-slot="alert-title" class=${alertTitleClass()}>Payment successful</div>
        <div data-slot="alert-description" class=${alertDescriptionClass()}>
          Your payment of $29.99 has been processed. A receipt has been sent to
          your email address.
        </div>
      </div>
      <div data-slot="alert" role="alert" class=${alertClass()}>
        ${InfoIcon()}
        <div data-slot="alert-title" class=${alertTitleClass()}>New feature available</div>
        <div data-slot="alert-description" class=${alertDescriptionClass()}>
          We've added dark mode support. You can enable it in your account
          settings.
        </div>
      </div>
    </div>
  `;
}
