import { html } from '@webjsdev/core';
import '#components/async-greeting.ts';
import '#components/slow-fact.ts';

export const metadata = {
  title: 'Stream demo · WebJs Blog',
  description: 'async render() + <webjs-suspense> streaming, end to end.',
};

/**
 * `/stream-demo` exercises bare-await async render (#469) and component-level
 * `<webjs-suspense>` streaming (#471) on a real route, so the e2e can assert the
 * whole stack: the async-greeting data is in the first paint (no JS), the
 * slow-fact streams in behind a fallback (with JS), and both work on a
 * progressive soft navigation (#473).
 */
export default function StreamDemo() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Stream demo
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        The greeting below is fetched <strong class="text-foreground font-bold">inside the component</strong>
        with an async render(), so it is in the first paint with no fallback. The
        slow fact is wrapped in <code>&lt;webjs-suspense&gt;</code>, so its fallback
        shows immediately and the content streams in.
      </p>
      <async-greeting name="world"></async-greeting>
      <webjs-suspense .fallback=${html`<p class="fact-fallback">loading the fact…</p>`}>
        <slow-fact></slow-fact>
      </webjs-suspense>
    </section>
  `;
}
