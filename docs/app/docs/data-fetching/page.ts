import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Data Fetching | webjs',
  description: 'When to reach for async render(), webjs-suspense streaming, Task and signals, or webjs-frame. The decision guide and anti-patterns.',
};

export default function DataFetching() {
  return html`
    <h1>Data Fetching</h1>
    <p>webjs gives a component four ways to get data into the page. This is the canonical guide to which one to reach for, and the anti-patterns to avoid. The headline is <strong>bare-await async render</strong>: a component fetches its own server data into the first paint, co-located, with no page orchestration.</p>

    <h2>The default: async render()</h2>
    <p>Make a component's <code>render()</code> async and call a <code>'use server'</code> action directly. Writing <code>await</code> makes the function async; webjs awaits a promise-returning <code>render()</code> automatically on both the server and the client. There is no flag.</p>
    <pre>// (a) blocking async render: real data in the first paint, the common case
class UserProfile extends WebComponent {
  static properties = { uid: { type: String } };
  declare uid: string;
  async render() {
    const u = await getUser(this.uid);   // real fn at SSR, RPC stub on the client
    return html\`&lt;h3&gt;${'${u.name}'}&lt;/h3&gt;\`;
  }
}
UserProfile.register('user-profile');</pre>
    <p>SSR awaits the render, so the resolved DATA is in the first paint with no fallback. A JS-off client reads it (a progressive-enhancement UPGRADE over a client-fetched <code>Task</code>, which shows nothing without JS). <code>getUser</code> is isomorphic: the real function during SSR, an RPC stub on the client.</p>

    <h2>The three concerns are decoupled (do not conflate them)</h2>
    <ol>
      <li><strong>SSR always blocks by default.</strong> The data is in the first paint, no fallback markup. This is the PE-safe baseline.</li>
      <li><strong>The client re-fetch default is stale-while-revalidate.</strong> A prop / dependency change re-runs <code>async render()</code>; the current content stays until the new render resolves (no blank, no flash).</li>
      <li><strong><code>renderFallback()</code> is the optional re-fetch loading UI.</strong> Shown ONLY during a client re-fetch, NEVER on the first paint, and it does NOT trigger SSR streaming.</li>
    </ol>

    <h2>Streaming a slow region with webjs-suspense</h2>
    <p>A bare <code>async render()</code> blocks the first byte. For a SLOW region where that wait hurts, wrap it in <code>&lt;webjs-suspense&gt;</code> to stream it. This is the ONLY way to show a first-paint fallback.</p>
    <pre>// (b) webjs-suspense-wrapped slow component that streams (first-paint fallback)
html\`
  &lt;webjs-suspense .fallback=${'${html`<p>Loading section…</p>`}'}&gt;
    &lt;user-profile uid="42"&gt;&lt;/user-profile&gt;
    &lt;user-activity uid="42"&gt;&lt;/user-activity&gt;
  &lt;/webjs-suspense&gt;
\`;</pre>
    <p>The fallback flushes on the first byte; the resolved content streams in. Multiple boundaries fetch concurrently (no server waterfall). One boundary groups several components under one fallback, and the boundary <code>.fallback</code> wins over a contained component's <code>renderFallback()</code>. On a client-router navigation the boundary streams progressively too (the shell with the fallback applies immediately, then the data streams in). A throwing component inside a boundary is isolated to its own error state while siblings stream.</p>

    <h2>The re-fetch loading state: renderFallback()</h2>
    <pre>// (c) renderFallback() as the client re-fetch loading state (re-fetch on a prop change)
class UserActivity extends WebComponent {
  static properties = { uid: { type: String } };
  declare uid: string;
  renderFallback() { return html\`&lt;div class="skeleton h-24"&gt;&lt;/div&gt;\`; }
  async render() {
    const items = await getActivity(this.uid);
    return html\`&lt;ul&gt;${'${items.map((i) => html`<li>${i.label}</li>`)}'}&lt;/ul&gt;\`;
  }
}</pre>
    <p>Define <code>renderFallback()</code> only when stale content during a re-fetch would mislead. It is a prop-aware method (not a static field), so it can branch on the component's current state. <code>Task</code> cannot cover this case: a <code>Task</code> renders its pending state at SSR, losing the first-paint data, and you cannot wrap a signal around your own <code>await</code> inside <code>render()</code>.</p>

    <h2>Errors are isolated by default</h2>
    <pre>// (d) the no-op error case: isolation works WITHOUT renderError()
class Report extends WebComponent {
  async render() { return html\`&lt;pre&gt;${'${await getReport()}'}&lt;/pre&gt;\`; }
  // no renderError() needed: a thrown await is isolated to THIS component,
  // siblings render, the page does not blank. Add renderError() only to
  // customize the error UI.
}</pre>
    <p>A thrown <code>await getData()</code> (or any render throw) renders a component-scoped error state while siblings render, never bubbling to the route <code>error.ts</code>. The default surfaces the tag and message in dev and renders a silent empty element in prod (no leak). This is a per-route-error-boundary experience at the component level, with no per-component routes.</p>

    <h2>Decision rules</h2>
    <ol>
      <li><strong>Server data knowable at request time.</strong> Fetch it IN the component with <code>async render()</code>. Co-located, no prop-drilling, data in the first paint. The default, simplest case.</li>
      <li><strong>Slow server data</strong> where blocking the first byte hurts. Wrap in <code>&lt;webjs-suspense&gt;</code> to stream it. Deliberately, for slow regions, not by default.</li>
      <li><strong>Client re-fetch where stale content would mislead.</strong> Add <code>renderFallback()</code> for a loading state during the re-fetch.</li>
      <li><strong>One fallback for a whole section</strong>, or a context-specific fallback. Use <code>&lt;webjs-suspense&gt;</code> around several components (override plus grouping).</li>
      <li><strong>Genuinely client-only data</strong> (depends on a click, viewport, localStorage, or live updates, not needed in the first paint). Use <code>Task</code> / signals plus an RPC action.</li>
      <li><strong>Errors.</strong> Do nothing by default. The framework isolates a failed async component automatically. Add <code>renderError()</code> ONLY to customize the error UI.</li>
    </ol>

    <h2>Anti-patterns</h2>
    <ul>
      <li>Do NOT prop-drill server data through layers when the leaf component can fetch it itself.</li>
      <li>Do NOT put <code>await getData()</code> in a page / layout function if it can live in a component: page / layout fetches run SEQUENTIALLY (a route-level waterfall), while component fetches run in PARALLEL via boundaries.</li>
      <li>Do NOT fetch in <code>connectedCallback</code> / <code>Task</code> for data that is knowable server-side (that yields a fallback-then-RPC, not first-paint data).</li>
      <li>Do NOT use a <code>&lt;webjs-frame src&gt;</code> for primary component data. It is a client second request (a waterfall), not first paint. Frames are for URL-addressable / deferred regions only.</li>
      <li>Do NOT expect <code>renderFallback()</code> to affect the first paint or trigger SSR streaming. It is the CLIENT re-fetch loading state. To show a first-paint fallback, wrap in <code>&lt;webjs-suspense&gt;</code>.</li>
      <li>Do NOT add <code>renderError()</code> on every component. Isolation is automatic.</li>
      <li>Do NOT wrap in <code>&lt;webjs-suspense&gt;</code> when a component <code>renderFallback()</code> already suffices (one layered model).</li>
    </ul>

    <p>See <a href="/docs/suspense">Streaming &amp; Suspense</a>, <a href="/docs/components">Components</a>, <a href="/docs/lifecycle">Lifecycle Hooks</a>, and <a href="/docs/error-handling">Error Handling</a>.</p>
  `;
}
