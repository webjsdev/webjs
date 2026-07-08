// async render() awaits server data directly in the leaf component. Three
// decoupled concerns to know (see AGENTS.md "Async render"):
//   1. SSR always BLOCKS, so the resolved data is in the first paint with no
//      fallback markup (progressive-enhancement safe, readable with JS off).
//   2. The client re-fetch default is stale-while-revalidate (old content stays
//      until the new render resolves, no blank flash).
//   3. renderFallback() is the OPTIONAL re-fetch loading UI, never first paint.
// Reach for async render() when request-time SERVER data belongs in the first
// paint; reach for a Task / signals for genuinely client-only data.
import { WebComponent, html } from '@webjsdev/core';
import { serverGreeting } from '../queries/server-greeting.server.ts';

export class ServerClock extends WebComponent {
  // A bare async-render component (no other client signal) is ELIDED, since its
  // SSR'd HTML is already the complete output. `static refresh = true` opts into
  // keeping the on-load re-fetch so the module ships (drop it for request-stable
  // data you are happy to leave server-rendered).
  static refresh = true;

  async render() {
    const info = await serverGreeting();
    return html`<p class="font-mono text-sm">server rendered this at
      <strong>${info.at}</strong> (pid ${info.pid})</p>`;
  }
}
ServerClock.register('server-clock');
