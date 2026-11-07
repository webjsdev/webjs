import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { progressClass } from '#modules/ui/components/progress.ts';

const usage = {
  input: 8420,
  output: 1260,
  reasoning: 980,
  limit: 128000,
};

const used = usage.input + usage.output + usage.reasoning;
const percent = Math.round((used / usage.limit) * 100);

function formatTokens(value: number) {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

const rows = [
  { label: 'Input', value: usage.input },
  { label: 'Output', value: usage.output },
  { label: 'Reasoning', value: usage.reasoning },
];

// The class on <ui-hover-card-content> lands on the card panel, as shadcn's
// className on HoverCardContent does.
export default function ContextDemo() {
  return html`
    <div class="flex justify-center py-12">
      <ui-hover-card open-delay="10" close-delay="100">
        <ui-hover-card-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
            ${percent}% context
          </button>
        </ui-hover-card-trigger>
        <ui-hover-card-content class="flex w-64 flex-col gap-3">
          <div class="flex items-center justify-between gap-3 text-sm">
            <span data-slot="hover-card-title" class="font-medium">Context</span>
            <span class="text-muted-foreground">${formatTokens(used)} / ${formatTokens(usage.limit)}</span>
          </div>
          <progress data-slot="progress" value=${percent} max="100" aria-label="Context used" class=${progressClass()}></progress>
          <div class="flex flex-col gap-1 text-sm">
            ${rows.map((row) => html`
              <div class="flex justify-between gap-3">
                <span class="text-muted-foreground">${row.label}</span>
                <span>${formatTokens(row.value)}</span>
              </div>
            `)}
          </div>
        </ui-hover-card-content>
      </ui-hover-card>
    </div>
  `;
}
