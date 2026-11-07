import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import { AlertTriangleIcon } from '#lib/ui/lucide.ts';

export default function AlertColors() {
  return html`
    <div data-slot="alert" role="alert" class=${cn(alertClass(), 'max-w-md border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50')}>
      ${AlertTriangleIcon()}
      <div data-slot="alert-title" class=${alertTitleClass()}>Your subscription will expire in 3 days.</div>
      <div data-slot="alert-description" class=${alertDescriptionClass()}>
        Renew now to avoid service interruption or upgrade to a paid plan to
        continue using the service.
      </div>
    </div>
  `;
}
