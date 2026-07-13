import { html } from '@webjsdev/core';
import '#components/inline-quote.ts';

export const metadata = {
  title: 'Async leaf · WebJs Blog',
  description: 'A bare async-render leaf, elided yet present in the first paint.',
};

/**
 * `/async-leaf` renders ONLY a bare async-render display-only component
 * (`<inline-quote>`). It is the elision corpus's proof for #474: with elision
 * ON the `<inline-quote>` module is dropped from the browser, yet the SSR'd
 * quote is in the first paint (JS-off readable) and identical to the elision-OFF
 * render. Network-probed + differential-tested.
 */
export default function AsyncLeaf() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Async leaf
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        The quote below is fetched <strong class="text-foreground font-bold">inside the component</strong>
        with a bare async render() and no other client signal, so its module is
        elided and the quote is still in the first paint.
      </p>
      <inline-quote></inline-quote>
    </section>
  `;
}
