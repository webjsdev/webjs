import { html } from '@webjsdev/core';
import '#components/seeded-user.ts';

export const metadata = {
  title: 'Seeded user · WebJs Blog',
  description: 'SSR action-seeding fixture: async render data is seeded so hydration does not re-fetch (#472).',
};

/**
 * `/seeded` renders a single shipping `<seeded-user>` whose `async render()`
 * awaits a `'use server'` action. The e2e network-probes that NO action RPC
 * fires on hydration (the result was seeded) and that a prop bump DOES fetch.
 */
export default function Seeded() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Seeded user
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        <code>&lt;seeded-user&gt;</code> fetches its data with a bare
        <strong class="text-foreground font-bold">async render()</strong> that awaits a
        <code>'use server'</code> action. The result is baked into the first paint
        AND seeded into the page (#472), so on hydration the component does
        <strong class="text-foreground font-bold">not</strong> re-issue the action over RPC.
        Bump the id to fetch a fresh (unseeded) user, which does hit the network.
      </p>
      <seeded-user uid="1"></seeded-user>
    </section>
  `;
}
