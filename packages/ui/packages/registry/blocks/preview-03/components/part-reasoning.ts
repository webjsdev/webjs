/**
 * The preview-03 reasoning part: one reasoning step of an assistant turn, its
 * text under the kit's shimmer. A fragment helper, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/part-reasoning.ts`. Ported from shadcn/ui's
 * preview-03.
 */
import { html, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';

const REASONING_LEVEL_LABELS = ['Understanding', 'Analyzing', 'Prioritizing', 'Refining'] as const;

/** The name of the nth reasoning step in a turn. */
export function getReasoningLevelLabel(index: number): string {
  return REASONING_LEVEL_LABELS[index] ?? `Reasoning ${index + 1}`;
}

export function partReasoning(opts: { text: string; label?: string; class?: string }) {
  return html`<div data-slot="part-reasoning" data-label=${opts.label ?? nothing} class=${cn('w-full max-w-full min-w-0', opts.class)}>
    <div class="w-full shimmer">
      <span class="whitespace-pre-wrap">${opts.text}</span>
    </div>
  </div>`;
}
