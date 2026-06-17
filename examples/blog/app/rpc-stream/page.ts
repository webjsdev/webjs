import { html } from '@webjsdev/core';
import '#components/token-stream.ts';

export const metadata = {
  title: 'Streaming RPC · webjs blog',
  description: 'An async-generator server action streams tokens over RPC (#489).',
};

/**
 * `/rpc-stream` exercises streaming RPC results (#489) end to end: `<token-stream>`
 * calls an async-generator action and appends each token as it arrives, so the
 * e2e can assert the count climbs incrementally in a real browser.
 */
export default function RpcStream() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Streaming RPC
      </h1>
      <p class="text-lede leading-[1.5] text-fg-muted max-w-[56ch] m-0 mb-6">
        The button below calls an <strong class="text-fg font-bold">async-generator</strong>
        server action. Each yielded token streams over the single RPC response and
        is appended as it arrives.
      </p>
      <token-stream></token-stream>
    </section>
  `;
}
