import { html } from '@webjsdev/core';

const items = [
  'Inbox triage',
  'Design review',
  'API contract',
  'QA pass',
  'Launch notes',
  'Metrics follow-up',
];

const tags = [
  'Design',
  'Engineering',
  'Marketing',
  'Product',
  'Research',
  'Sales',
  'Support',
  'Operations',
];

function scrollFadeEdgeItems() {
  return html`
    <div class="flex flex-col gap-1.5 p-1.5">
      ${items.map((item) => html`<div class="rounded-lg bg-muted px-3 py-2.5 text-sm">${item}</div>`)}
    </div>
  `;
}

function scrollFadeEdgeTags() {
  return html`
    <div class="flex w-max gap-1.5 p-1.5">
      ${tags.map((tag) => html`<div class="shrink-0 rounded-xl bg-muted px-4 py-2.5 text-sm">${tag}</div>`)}
    </div>
  `;
}

export default function ScrollFadeEdge() {
  return html`
    <div class="mx-auto flex max-w-xs min-w-0 flex-col gap-6">
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="h-36 scroll-fade-t no-scrollbar overflow-y-auto">${scrollFadeEdgeItems()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-t</p>
      </div>
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="h-36 scroll-fade-b no-scrollbar overflow-y-auto">${scrollFadeEdgeItems()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-b</p>
      </div>
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="scroll-fade-s no-scrollbar overflow-x-auto">${scrollFadeEdgeTags()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-s</p>
      </div>
      <div class="flex flex-col gap-3">
        <div class="overflow-hidden rounded-2xl border">
          <div class="scroll-fade-e no-scrollbar overflow-x-auto">${scrollFadeEdgeTags()}</div>
        </div>
        <p class="text-center font-mono text-xs text-muted-foreground">scroll-fade-e</p>
      </div>
    </div>
  `;
}
