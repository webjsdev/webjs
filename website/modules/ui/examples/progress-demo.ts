import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { progressClass } from '#modules/ui/components/progress.ts';

// shadcn's demo starts at 13 and moves to 66 half a second after mount. A
// static demo shows the value the reader sees, 66.
export default function ProgressDemo() {
  return html`
    <progress data-slot="progress" value="66" max="100" aria-label="Progress" class=${cn(progressClass(), 'w-[60%]')}></progress>
  `;
}
