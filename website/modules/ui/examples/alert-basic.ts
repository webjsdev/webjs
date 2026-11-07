import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import { CheckCircle2Icon } from '#lib/ui/lucide.ts';

export default function AlertBasic() {
  return html`
    <div data-slot="alert" role="alert" class=${cn(alertClass(), 'max-w-md')}>
      ${CheckCircle2Icon()}
      <div data-slot="alert-title" class=${alertTitleClass()}>Account updated successfully</div>
      <div data-slot="alert-description" class=${alertDescriptionClass()}>
        Your profile information has been saved. Changes will be reflected
        immediately.
      </div>
    </div>
  `;
}
