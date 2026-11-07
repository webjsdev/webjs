import { html } from '@webjsdev/core';

export default function ScrollFadeOverflow() {
  return html`
    <div class="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border">
      <div class="scroll-fade no-scrollbar overflow-y-auto">
        <div class="flex flex-col gap-1.5 p-1.5">
          ${Array.from({ length: 3 }, (_, index) => html`
            <div class="rounded-lg bg-muted px-3 py-2.5 text-sm">Item ${index + 1}</div>
          `)}
        </div>
      </div>
    </div>
  `;
}
