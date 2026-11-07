import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputBadge() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="input-badge" class=${fieldLabelClass()}>
        Webhook URL
        <span data-slot="badge" data-variant="secondary" class=${cn(badgeClass({ variant: 'secondary' }), 'ml-auto')}>
          Beta
        </span>
      </label>
      <input data-slot="input" id="input-badge" type="url" placeholder="https://api.example.com/webhook" class=${inputClass()}>
    </div>
  `;
}
