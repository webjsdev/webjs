import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function HoverCardDemo() {
  return html`
    <ui-hover-card open-delay="10" close-delay="100">
      <ui-hover-card-trigger>
        <button type="button" data-slot="button" data-variant="link" data-size="default" class=${buttonClass({ variant: 'link' })}>Hover Here</button>
      </ui-hover-card-trigger>
      <ui-hover-card-content>
        <div class="flex w-64 flex-col gap-0.5">
          <div data-slot="hover-card-title" class="font-semibold">@nextjs</div>
          <div>The React Framework – created and maintained by @vercel.</div>
          <div class="mt-1 text-xs text-muted-foreground">Joined December 2021</div>
        </div>
      </ui-hover-card-content>
    </ui-hover-card>
  `;
}
