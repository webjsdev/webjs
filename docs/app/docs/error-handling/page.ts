import { html } from '@webjsdev/core';

export const metadata = { title: 'Error Handling | webjs' };

export default function ErrorHandling() {
  return html`
    <h1>Error Handling</h1>
    <p>webjs provides nested error boundaries via <code>error.js</code>/<code>error.ts</code> files, plus component-level error handling via <code>renderError()</code>. Errors are caught at the nearest boundary and rendered without crashing the entire page.</p>

    <h2>When to use</h2>
    <ul>
      <li>Show a user-friendly error page when a route or layout throws during rendering.</li>
      <li>Isolate failures in one section of the page from the rest (e.g. a broken sidebar shouldn't crash the whole layout).</li>
      <li>Catch errors from async page functions, server actions, or database queries.</li>
    </ul>

    <h2>When NOT to use</h2>
    <ul>
      <li>For 404 pages: use <code>not-found.ts</code> instead, or throw <code>notFound()</code> from a page function.</li>
      <li>
        For form validation errors there are two valid patterns, neither of which uses error boundaries:
        <ul>
          <li><strong>JS-side</strong>: handle validation in the component's submit handler, keep errors in component state.</li>
          <li><strong>Server-rendered (Rails / Django / Laravel style)</strong>: have the server return <code>422 Unprocessable Entity</code> with the form re-rendered, errors visible inline. The client router applies any HTML response in place regardless of status code, so the user sees the validated form without a full page reload and without losing their typed values. See the <a href="/docs/client-router">client router</a> docs for the rendering behavior.</li>
        </ul>
      </li>
    </ul>

    <h2>Route-level error boundaries</h2>
    <p>Place an <code>error.ts</code> file at any level in the <code>app/</code> directory. When a page or layout at that level (or deeper) throws, the nearest <code>error.ts</code> is rendered instead.</p>

    <pre>// app/error.ts: root error boundary
import { html } from '@webjsdev/core';

export default function ErrorPage({ error }: { error: Error }) {
  return html${'`'}
    &lt;h1&gt;Something went wrong&lt;/h1&gt;
    &lt;p&gt;${'${error.message}'}&lt;/p&gt;
    &lt;a href="/"&gt;Go home&lt;/a&gt;
  ${'`'};
}</pre>

    <h3>Nesting</h3>
    <p>Error boundaries are nested. The framework walks from the throwing component outward until it finds the nearest <code>error.ts</code>:</p>
    <pre>app/
  error.ts              ← catches errors from any page
  blog/
    error.ts            ← catches errors from /blog/* pages only
    [slug]/page.ts      ← if this throws, blog/error.ts handles it</pre>

    <p>If <code>blog/error.ts</code> also throws, the parent <code>app/error.ts</code> catches it.</p>

    <h2>not-found.ts</h2>
    <p>A special error boundary for 404 responses. Place <code>not-found.ts</code> at any route level, and the nearest one wins:</p>

    <pre>// app/not-found.ts
import { html } from '@webjsdev/core';

export default function NotFound() {
  return html${'`'}
    &lt;h1&gt;Page not found&lt;/h1&gt;
    &lt;p&gt;The page you're looking for doesn't exist.&lt;/p&gt;
    &lt;a href="/"&gt;Go home&lt;/a&gt;
  ${'`'};
}</pre>

    <p>Trigger a 404 programmatically from any page function or server action:</p>

    <pre>import { notFound } from '@webjsdev/core';

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();  // renders nearest not-found.ts
  return html${'`'}...&lt;/h1&gt;${'`'};
}</pre>

    <h2>Component-level error handling</h2>
    <p>Override <code>renderError(error)</code> in any <code>WebComponent</code> to catch errors from that component's <code>render()</code> method:</p>

    <pre>class MyWidget extends WebComponent {

  render() {
    // If this throws, renderError() is called instead
    return html${'`'}&lt;div&gt;${'${this.riskyComputation()}'}&lt;/div&gt;${'`'};
  }

  renderError(error: Error) {
    return html${'`'}&lt;p class="error"&gt;Widget failed: ${'${error.message}'}&lt;/p&gt;${'`'};
  }
}</pre>

    <p>If <code>renderError()</code> is not defined, the error is logged to the console and the component's shadow root shows the last successful render (or nothing on first render).</p>

    <h2>Server action errors</h2>
    <p>Errors thrown from server actions are sanitized in production: only the <code>message</code> property is sent to the client, never the stack trace. Internal errors (no message) are collapsed to "Internal server error". The full error is always logged server-side.</p>

    <h2>Dev error overlay</h2>
    <p>In development, an SSR render crash, a non-erasable-TypeScript strip failure, and a failed rebuild each push a rich error overlay to the open tab over the live-reload channel, without a manual refresh. The overlay shows the message, the offending <code>file:line:column</code>, and a source code frame of the failing line with context. A TypeScript strip failure also shows the erasable-syntax hint inline (a non-erasable <code>enum</code> / <code>namespace</code> breaks only the client module fetch, so the page still server-renders but hydration is dead; the overlay surfaces that instead of burying the hint in a console comment). The overlay dismisses on the next successful rebuild, and the frame is replayed to a tab opened after the breaking edit.</p>
    <p>This is strictly a development feature. In production the error response stays terse (only <code>message</code>, never the stack or any file path), and the overlay client is never served, so nothing about your source leaks. An embedding host can observe the same frames via the <code>onDevError</code> option on <code>createRequestHandler</code> / <code>startServer</code>.</p>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a>: file conventions for pages, layouts, and error boundaries</li>
      <li><a href="/docs/loading-states">Loading States</a>: <code>loading.ts</code> for Suspense boundaries</li>
      <li><a href="/docs/server-actions">Server Actions</a>: error handling in RPC calls</li>
    </ul>
  `;
}
