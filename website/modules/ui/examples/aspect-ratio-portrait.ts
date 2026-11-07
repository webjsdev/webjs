import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { aspectRatioClass } from '#modules/ui/components/aspect-ratio.ts';

export default function AspectRatioPortrait() {
  return html`
    <div class="w-full max-w-[10rem]">
      <div data-slot="aspect-ratio" style="aspect-ratio: 9 / 16" class=${cn(aspectRatioClass(), 'rounded-lg bg-muted')}>
        <img
          src="https://avatar.vercel.sh/shadcn1"
          alt="Photo"
          class="absolute inset-0 h-full w-full rounded-lg object-cover grayscale dark:brightness-20"
        >
      </div>
    </div>
  `;
}
