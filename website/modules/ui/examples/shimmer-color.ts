import { html } from '@webjsdev/core';

export default function ShimmerColor() {
  return html`
    <div class="flex flex-col items-center gap-2 text-sm text-muted-foreground">
      <p class="shimmer shimmer-color-blue-500/60">Generating response&hellip;</p>
      <p class="shimmer shimmer-color-[#378ADD]">Generating response&hellip;</p>
    </div>
  `;
}
