import { html } from '@webjsdev/core';

function scrollFadeSizeItems() {
  return html`
    <div class="flex flex-col gap-1.5 p-1.5">
      ${Array.from({ length: 8 }, (_, index) => html`
        <div class="rounded-lg bg-muted px-3 py-2.5 text-sm">Item ${index + 1}</div>
      `)}
    </div>
  `;
}

export default function ScrollFadeSize() {
  return html`
    <div class="mx-auto flex w-full max-w-xs flex-col gap-6">
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="h-48 scroll-fade no-scrollbar overflow-y-auto scroll-fade-4">${scrollFadeSizeItems()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-4</p>
      </div>
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="h-48 scroll-fade no-scrollbar overflow-y-auto scroll-fade-24">${scrollFadeSizeItems()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-24</p>
      </div>
    </div>
  `;
}
