import { html } from '@webjsdev/core';
import { separatorClass } from '#modules/ui/components/separator.ts';

export default function SeparatorDemo() {
  return html`
    <div class="flex max-w-sm flex-col gap-4 text-sm">
      <div class="flex flex-col gap-1.5">
        <div class="leading-none font-medium">shadcn/ui</div>
        <div class="text-muted-foreground">
          The Foundation for your Design System
        </div>
      </div>
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
      <div>
        A set of beautifully designed components that you can customize, extend,
        and build on.
      </div>
    </div>
  `;
}
