import { html } from '@webjsdev/core';
import '../../components/seeded-user.ts';

export const metadata = {
  title: 'Seeded user · webjs blog',
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
      <h1 class="font-serif text-display font-bold m-0 mb-4">Seeded user</h1>
      <seeded-user uid="1"></seeded-user>
    </section>
  `;
}
