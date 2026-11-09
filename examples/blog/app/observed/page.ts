import { html } from '@webjsdev/core';
import '#components/ssr-derived-badge.ts';

export const metadata = {
  title: 'Derived badge · WebJs Blog',
  description: 'Pins willUpdate-derived state and reflected props in the SSR HTML (#217).',
};

/**
 * `/observed` renders `<ssr-derived-badge>`, whose text is derived in
 * `willUpdate` and whose `ready` flag reflects to an attribute there. The e2e
 * probe asserts both are in the raw served HTML before any JS runs, and that
 * hydration leaves them unchanged.
 */
export default function Observed() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Derived badge
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        The badge below derives its text before the first render, on the
        server and in the browser alike, so the first paint already shows it.
      </p>
      <ssr-derived-badge seed="42"></ssr-derived-badge>
    </section>
  `;
}
