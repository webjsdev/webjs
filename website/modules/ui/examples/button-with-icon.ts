import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { GitBranchIcon } from '#lib/ui/lucide.ts';

export default function ButtonWithIcon() {
  return html`
    <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline', size: 'sm' })}>${GitBranchIcon()} New Branch</button>
  `;
}
