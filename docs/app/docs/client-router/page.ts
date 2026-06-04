import { html } from '@webjsdev/core';

export const metadata = { title: 'Client Router | webjs' };

export default function ClientRouter() {
  return html`
    <h1>Client Router</h1>
    <p>webjs ships a nested-layout-aware client router that intercepts same-origin <code>&lt;a&gt;</code> clicks <strong>and</strong> <code>&lt;form&gt;</code> submissions, fetches the target HTML, and swaps only the deepest layout boundary the two pages don't share. Outer layout DOM is preserved: sidenav scroll, input values, <code>&lt;details&gt;</code> open state, mounted custom elements all survive navigation without authors writing anything.</p>
    <p>The router auto-enables when <code>@webjsdev/core/client-router</code> is imported (the scaffold's root layout does this for you). For 99% of apps the contract is "write standard HTML, navigation gets faster." The advanced primitives below (frames, revalidation, programmatic navigation) exist for the cases where you need to take over.</p>

    <h2>How it works (auto-magic, no opt-in)</h2>
    <ol>
      <li>SSR emits <code>&lt;!--wj:children:&lt;segment-path&gt;--&gt;</code> comment markers around each layout's <code>\${children}</code> interpolation. One pair per layout in the chain. Derived from folder structure, with layout authors writing nothing.</li>
      <li>On a click or form submit, the router walks both the live DOM and the incoming HTML for these markers, picks the <strong>longest shared marker path</strong>, and swaps only the nodes between that marker pair.</li>
      <li>The diff inside the swap region is keyed by <code>data-key</code> or <code>id</code>. Matched elements are reused with in-place attribute updates. <strong>Live attributes</strong> (<code>value</code>, <code>checked</code>, <code>selected</code>, <code>indeterminate</code>, <code>disabled</code>, <code>open</code>, <code>popover</code>) are never overwritten, so user input and disclosure state survive the swap.</li>
      <li>The <code>&lt;head&gt;</code> is add-only merged (preserves runtime-injected styles like Tailwind's), <code>&lt;script&gt;</code> tags re-execute, custom elements upgrade, URL updates via <code>pushState</code>.</li>
      <li>A <code>webjs:navigate</code> event fires on <code>document</code> with the final URL.</li>
    </ol>
    <p><strong>Wire-byte optimization</strong>: the router sends an <code>X-Webjs-Have</code> request header listing the marker paths it already has. The server walks the target page's layout chain innermost-to-outermost, short-circuits at the first match, and returns only the divergent fragment wrapped in that layout's marker pair. Outer layouts are never re-serialized for same-shell navigations.</p>

    <h2>Form submissions</h2>
    <p><code>&lt;form action="/x" method="post"&gt;</code> works exactly per the HTML spec. webjs intercepts the <code>submit</code> event in the bubble phase (after a component's own <code>@submit</code> handler) and routes the same fetch the browser would have sent through the partial-swap pipeline. Because it runs after, a component that calls <code>e.preventDefault()</code> in <code>@submit</code> keeps the form to itself and the router leaves it alone; the same applies to <code>@click</code> on links. Submitter attributes (<code>formmethod</code>, <code>formaction</code>, <code>formenctype</code> on a clicked <code>&lt;button&gt;</code>) take precedence over the form's own per HTML5.</p>
    <ul>
      <li><strong>GET forms</strong>: <code>FormData</code> is promoted to the URL query string (replacing any existing query on <code>action</code>). The URL is then fetched and applied like a link click.</li>
      <li><strong>POST / PUT / PATCH / DELETE forms</strong>: <code>FormData</code> is sent as the request body. After a successful response the snapshot cache is cleared (other cached URLs may reflect stale server state).</li>
    </ul>
    <p>Forms that handle submission in JavaScript (<code>@submit=\${e =&gt; { e.preventDefault(); /* RPC */ }}</code>) are untouched. The router only intercepts when <code>event.defaultPrevented</code> is false.</p>

    <p><strong>Auto-skipped</strong> (no opt-out needed):</p>
    <ul>
      <li><code>method="dialog"</code>: browser-native <code>&lt;dialog&gt;</code> dismissal</li>
      <li><code>target</code> / <code>formtarget</code> ≠ <code>_self</code>: iframes, popups, named windows</li>
      <li>Cross-origin <code>action</code></li>
      <li>Non-HTML extensions on the <code>action</code> URL</li>
    </ul>

    <h2>Non-2xx HTML responses render in place</h2>
    <p>Any response with a <code>text/html</code> body is applied to the DOM regardless of status code. This makes the standard server-rendered validation pattern work end-to-end:</p>
    <ul>
      <li><strong>2xx</strong>: normal navigation.</li>
      <li><strong>4xx (e.g. 422)</strong>: server re-renders the form with <code>value</code> attributes preserving what the user typed, inline error messages visible, no full-page reload. The Rails / Django / Laravel / Phoenix server-side validation flow.</li>
      <li><strong>5xx with HTML</strong>: error page rendered in place (not a flash of blank then reload).</li>
    </ul>
    <p>Non-HTML <em>error</em> responses (a JSON error envelope from a 500), and transport/parse failures, recover in place via the <code>webjs:navigation-error</code> event below rather than a destructive full reload.</p>
    <p><strong>204 No Content</strong>: DOM untouched. History records the requested URL ("stay on current page" pattern for autosave-style submissions).</p>
    <p><strong>3xx redirects</strong>: <code>fetch()</code> follows them automatically. The <em>final</em> URL after redirects is recorded in history (Post-Redirect-Get pattern works correctly).</p>

    <h2>Failed navigations recover in place (<code>webjs:navigation-error</code>)</h2>
    <p>A successful swap and an HTML error body of any status both apply in place (above). The remaining failure cases are a <strong>non-HTML error response</strong> (a 500 carrying a JSON body) and a <strong>transport/parse failure</strong> (the <code>fetch</code> rejected, or the body claimed HTML but did not parse). For those the router no longer abandons the SPA with a destructive full <code>location.href</code> reload (which would discard the partial-swap shell, scroll, focus, and in-flight client state, and eat a second round-trip that may itself fail to the browser's default error page).</p>
    <p>Instead the router dispatches a cancelable, bubbling <code>webjs:navigation-error</code> event on <code>document</code>, with detail <code>{ url, status, error }</code>: <code>status</code> is the HTTP status when a response arrived (else <code>null</code>), and <code>error</code> is the <code>Error</code> for a transport/parse failure (else <code>null</code>).</p>
    <ul>
      <li><strong><code>preventDefault()</code></strong> hands recovery to your app. The router does nothing further, so the current page is left exactly as it is (shell, scroll, focus, and client state preserved). Show a toast, retry, or navigate elsewhere.</li>
      <li><strong>Not cancelled (the default)</strong> renders a minimal in-place error surface, a <code>&lt;div role="alert"&gt;</code> carrying a generic message plus the status, into the deepest layout children slot (the same target a normal partial swap writes to, so outer chrome and nav are preserved).</li>
      <li><strong>Last-resort hard load</strong> happens only when there is no shared layout marker to render into (a genuine cross-document nav), and only after the event was not cancelled.</li>
    </ul>
    <p>An <strong>AbortError</strong> (a newer navigation superseding this one) is a normal supersede, not an error, and never fires <code>webjs:navigation-error</code>.</p>
    <pre>document.addEventListener('webjs:navigation-error', (e) =&gt; {
  // e.detail = { url, status, error }
  e.preventDefault();                 // app handles recovery; page left intact
  showToast(\`Could not load \${e.detail.url} (status \${e.detail.status})\`);
});</pre>

    <h2><code>&lt;webjs-frame&gt;</code>: escape hatch for non-layout regions</h2>
    <p>The marker mechanism scopes swaps to the deepest shared <strong>layout</strong>. When you need a swap region <em>smaller</em> than the deepest layout (typically a widget inside a page that should swap independently of the rest of the page) wrap it in <code>&lt;webjs-frame id="..."&gt;</code>.</p>
    <pre>// app/posts/[slug]/page.ts
export default async function PostPage({ params }) {
  const post = await getPost(params.slug);
  return html\`
    &lt;article&gt;\${post.body}&lt;/article&gt;

    &lt;webjs-frame id="comments"&gt;
      \${await renderComments(post.id, /* page */ 1)}
      &lt;a href="/posts/\${params.slug}/comments?page=2"&gt;Load more&lt;/a&gt;
    &lt;/webjs-frame&gt;
  \`;
}</pre>
    <p>When the user clicks "Load more", the router's <code>closest('webjs-frame')</code> from the click target finds <code>#comments</code>. The fetched response is expected to contain a <code>&lt;webjs-frame id="comments"&gt;</code> too. Only its children swap into the live frame, leaving the article body (and any reading scroll position, video playback, etc.) fully intact.</p>
    <p>This takes precedence over the layout-marker mechanism. Most apps never need it. Only reach for it when you've identified that the auto-marker swap is wider than the actual change.</p>

    <h3>External targeting (<code>data-webjs-frame</code>) and <code>_top</code></h3>
    <p>A trigger does not have to be nested inside the frame it drives. Mirroring Turbo's <code>data-turbo-frame</code>, an <code>&lt;a&gt;</code> or <code>&lt;form&gt;</code> (or any ancestor of it) carrying <code>data-webjs-frame="&lt;id&gt;"</code> drives the frame with that id from anywhere in the document, resolved via <code>getElementById</code>. So an external nav/sidebar link or a filter form can drive a content frame it does not enclose.</p>
    <pre>&lt;nav data-webjs-frame="results"&gt;
  &lt;a href="/products?sort=new"&gt;Newest&lt;/a&gt;
  &lt;a href="/products?sort=top"&gt;Top rated&lt;/a&gt;
&lt;/nav&gt;
&lt;form action="/products" data-webjs-frame="results"&gt;…filters…&lt;/form&gt;

&lt;webjs-frame id="results"&gt;…current results…&lt;/webjs-frame&gt;</pre>
    <p>An explicit <code>data-webjs-frame</code> WINS over the closest-enclosing-frame default. The reserved token <code>data-webjs-frame="_top"</code> on a trigger INSIDE a frame breaks OUT to a full-page navigation. An id that does not resolve to a live <code>&lt;webjs-frame&gt;</code> warns once and falls back to a normal navigation (it never throws). With JS disabled the attribute is inert on a plain <code>&lt;a href&gt;</code>, so the click is a normal full navigation, the correct progressive-enhancement fallback.</p>

    <h3>Busy state (<code>aria-busy</code> + <code>webjs:frame-busy</code>)</h3>
    <p>While a frame's navigation is in flight the router sets the native <code>aria-busy="true"</code> on the frame element and clears it (to <code>"false"</code>) on every exit, a successful swap, a frame-missing response, an HTTP/transport error, or an abort by a newer navigation. So assistive tech announces the loading state, and CSS can style the busy region with <code>webjs-frame[aria-busy="true"]</code>. The router also dispatches a bubbling <code>webjs:frame-busy</code> event on the frame at both edges (detail <code>{ frameId, busy }</code>, <code>true</code> at start then <code>false</code> at finish) for app-level hooks.</p>

    <h3>Self-loading frames (<code>src</code> + <code>loading</code>)</h3>
    <p>A frame can fetch its OWN content instead of waiting for a click or a form. Give it a <code>src</code> and it self-fetches that URL as a frame nav and applies the matching <code>&lt;webjs-frame id&gt;</code> subtree from the response into itself, through the same frame-swap path (so the busy lifecycle, the navigation-error recovery, and the frame-missing fallback all apply). The <code>loading</code> attribute picks when: <code>eager</code> (or absent) fetches on connect, <code>lazy</code> fetches when the frame first scrolls into view (reusing the same IntersectionObserver budget as a <code>static lazy = true</code> component).</p>
    <pre>&lt;webjs-frame id="comments" src="/posts/42/comments" loading="lazy"&gt;
  &lt;p&gt;Loading comments...&lt;/p&gt;
&lt;/webjs-frame&gt;</pre>
    <p>A <code>src</code> change after connect re-loads; eager connect, the lazy observer, and a <code>src</code> mutation never double-fetch the same URL. Because the request carries the <code>x-webjs-frame</code> header, the <strong>server returns only the matched subtree</strong> (byte-equivalent to what the client would slice from a full-page render, but far fewer bytes), falling back to the full page when the frame is absent.</p>
    <p><strong>Progressive-enhancement caveat:</strong> a <code>src</code>-driven frame is JS-dependent. The browser does not natively fetch a <code>&lt;webjs-frame src&gt;</code> (unlike an <code>&lt;iframe&gt;</code>), so with JS off the frame shows only whatever children were server-rendered into it. Use <code>src</code> / <code>loading</code> for deferred content (comments, a recommendations rail, an expensive card) where a JS-off placeholder is acceptable; for content that must exist without JS, render it server-side into the frame instead.</p>

    <h2>Snapshot cache + back/forward</h2>
    <p>The router maintains a URL-keyed LRU cache of page snapshots (capacity 16). On back/forward via <code>popstate</code>, the cached DOM is applied instantly and the captured window-scroll position is restored. A background refetch then revalidates the snapshot quietly.</p>
    <p>After a server action mutates data that a cached page depends on, call <code>revalidate()</code>:</p>
    <pre>import { revalidate } from '@webjsdev/core';

// Invalidate one cached URL, next visit refetches
revalidate('/products/123');

// Clear the entire cache, useful after broad mutations
revalidate();</pre>
    <p>Mutating form submissions (POST / PUT / PATCH / DELETE) clear the cache automatically on success. You only need <code>revalidate()</code> when the mutation happens via JS / RPC and didn't go through a form.</p>

    <h2>Link prefetch (on by default)</h2>
    <p>Same-origin in-app links are prefetched speculatively, so a click resolves from a warm cache with no round-trip. The default strategy is <strong>intent</strong>: a brief hover, focus, or touch (after a short dwell) fetches the page with the same headers a real navigation sends, and the click then consumes that fragment. No attribute is needed; it is on for every internal <code>&lt;a href&gt;</code>, the way Next, Nuxt, and SvelteKit ship auto-prefetch.</p>
    <p>Choose a different strategy per link with <code>data-prefetch</code> (a valid-HTML <code>data-*</code> attribute, since webjs has no Link component). Next-style aliases are accepted:</p>
    <pre>&lt;a href="/dashboard"&gt;intent: hover / focus / touch (default)&lt;/a&gt;
&lt;a href="/dashboard" data-prefetch="render"&gt;eager, on insert (alias: true)&lt;/a&gt;
&lt;a href="/dashboard" data-prefetch="viewport"&gt;on scroll into view (alias: auto)&lt;/a&gt;
&lt;a href="/dashboard" data-prefetch="none"&gt;never (alias: false)&lt;/a&gt;</pre>
    <p>Only internal links qualify, using the same eligibility as a click: cross-origin, <code>download</code>, <code>target</code> other than <code>_self</code>, non-HTML extensions, <code>data-no-router</code>, and pure hash jumps are skipped. Opt out with <code>data-prefetch="none"</code>, <code>data-no-prefetch</code>, or <code>rel="external"</code>. Speculation is bounded (a concurrency cap with a draining queue, in-flight de-dupe, an LRU + TTL cache) and is disabled under <code>Save-Data</code> or <code>prefers-reduced-data</code>. A mutating form submission and <code>revalidate()</code> evict the prefetch cache too, so a fragment prefetched before a mutation is never served stale.</p>
    <p><strong>Prefetch issues a real GET</strong>, so a non-idempotent action (logout, anything that mutates) must be a POST or a <code>&lt;form&gt;</code>, never a GET link. This matches every framework that auto-prefetches. A native <code>&lt;link rel="prefetch"&gt;</code> in the document head is the browser's own mechanism and is left untouched.</p>

    <h2>Per-segment loading skeletons</h2>
    <p>Each <code>loading.{js,ts}</code> in the route chain is rendered into a hidden <code>&lt;template id="wj-loading:&lt;segment-path&gt;"&gt;</code> at body end. On nav-start, the client clones the deepest matching template into the swap slot, so users see an instant per-segment skeleton during the fetch instead of stale content.</p>


    <h2>Concurrent navigations + cancellation</h2>
    <p>Each click / submit <code>abort()</code>s any in-flight fetch from the prior one (Turbo Drive's <code>navigator.stop()</code> pattern). Rapid clicks won't produce N parallel requests competing to be applied last. A monotonic nav-token additionally short-circuits any response that arrives after a newer navigation has settled, so a slow first request that races past its abort cannot revert the newer page.</p>

    <h2>Programmatic navigation</h2>
    <pre>import { navigate } from '@webjsdev/core';

// Push history entry
await navigate('/about');

// Replace current history entry
await navigate('/login', { replace: true });</pre>

    <h2>Opt-out per link / form</h2>
    <pre>&lt;a href="/logout" data-no-router&gt;Log out&lt;/a&gt;
&lt;form action="/legacy" data-no-router&gt;...&lt;/form&gt;
&lt;form action="/x"&gt;&lt;button data-no-router&gt;Full reload&lt;/button&gt;&lt;/form&gt;</pre>
    <p>Use <code>data-no-router</code> for:</p>
    <ul>
      <li><strong>Auth flows</strong>: <code>/logout</code>, <code>/auth/google</code>, OAuth redirect chains. A full reload wipes in-memory module state (cached user data, auth tokens) that an SPA-style swap would leave behind.</li>
      <li><strong>Print views / embed pages</strong>: anywhere you want a clean-slate render without the existing layout.</li>
      <li><strong>Experimental routes</strong> backed by a different client runtime that needs a full boot.</li>
    </ul>

    <h2>Auto-skipped (no <code>data-no-router</code> needed)</h2>
    <ul>
      <li>Cross-origin hrefs.</li>
      <li>Links with a <code>download</code> attribute, a <code>target</code> other than <code>_self</code>, or clicked with a modifier key (⌘/Ctrl/Shift/Alt).</li>
      <li>Pure hash fragments on the same page (browser jumps to the anchor).</li>
      <li>Hrefs whose path ends in a non-HTML extension: <code>.pdf</code>, <code>.zip</code>, <code>.json</code>, <code>.xml</code>, images, media, archives, documents.</li>
      <li>Responses whose <code>Content-Type</code> isn't <code>text/html</code>.</li>
    </ul>

    <h2>Loading indicator</h2>
    <p>During navigation, <code>&lt;html&gt;</code> gets a <code>data-navigating</code> attribute, deferred by 150ms so quick navs (sub-150ms) never trigger it. Use it for a subtle progress indicator:</p>
    <pre>html[data-navigating] {
  cursor: progress;
}
html[data-navigating]::after {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--accent);
  animation: progress 1s ease-in-out infinite;
}</pre>

    <h2>Listening for navigations</h2>
    <pre>document.addEventListener('webjs:navigate', (e) =&gt; {
  console.log('Navigated to:', e.detail.url);
  // Track page view, update active nav indicator, etc.
});</pre>

    <h2>Disabling the router entirely</h2>
    <pre>import { disableClientRouter } from '@webjsdev/core/client-router';
disableClientRouter();</pre>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a>: file-based route conventions</li>
      <li><a href="/docs/loading-states">Loading states</a>: <code>loading.ts</code> per segment</li>
      <li><a href="/docs/server-actions">Server actions</a>: for forms handled via JS / RPC</li>
      <li><a href="/docs/ssr">Server-Side Rendering</a>: the SSR pipeline that emits the markers this router walks</li>
    </ul>
  `;
}
