import { html } from '@webjsdev/core';
import '#components/inline-quote.ts';

export const metadata = {
  title: 'Async leaf · WebJs Blog',
  description: 'A bare async-render leaf, present in the first paint with JS on or off.',
};

/**
 * `/async-leaf` renders ONLY a bare async-render display-only component
 * (`<inline-quote>`). It is the proof for #474: the SSR'd quote is in the first
 * paint (JS-off readable) and stays on screen through hydration with no page
 * error. E2e-probed with JS off and on.
 */
export default function AsyncLeaf() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Async leaf
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        The quote below is fetched <strong class="text-foreground font-bold">inside the component</strong>
        with a bare async render(), so the quote is in the first paint and stays
        there when the component hydrates.
      </p>
      <inline-quote></inline-quote>
    </section>
  `;
}
