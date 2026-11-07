import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { progressClass } from '#modules/ui/components/progress.ts';

export default function ProgressWithLabel() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'w-full max-w-sm')}>
      <label data-slot="field-label" for="progress-upload" class=${fieldLabelClass()}>
        <span>Upload progress</span>
        <span class="ml-auto">66%</span>
      </label>
      <progress data-slot="progress" id="progress-upload" value="66" max="100" class=${progressClass()}></progress>
    </div>
  `;
}
