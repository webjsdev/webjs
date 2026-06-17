import { html } from '@webjsdev/core';
import '#/components/verb-greeting.ts';

export const metadata = {
  title: 'HTTP-verb actions · webjs blog',
  description: 'A GET action read (cached + seeded) and a POST mutation that invalidates it (#488).',
};

export default function Verbs() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">HTTP-verb actions</h1>
      <p class="text-lede leading-[1.5] text-fg-muted max-w-[56ch] m-0 mb-6">
        The greeting is read with a <strong class="text-fg font-bold">GET action</strong> (cacheable, seeded into
        the first paint). The button runs a <strong class="text-fg font-bold">POST mutation</strong> that
        invalidates the read's tag, so the next read fetches fresh (#488).
      </p>
      <verb-greeting></verb-greeting>
    </section>
  `;
}
