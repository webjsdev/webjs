import { html } from '@webjskit/core';

export const metadata = { title: 'Client Router — webjs' };

export default function ClientRouter() {
  return html`
    <h1>Client Router</h1>
    <p>webjs ships a nested-layout-aware client router that intercepts same-origin <code>&lt;a&gt;</code> clicks <strong>and</strong> <code>&lt;form&gt;</code> submissions, fetches the target HTML, and swaps only the deepest layout boundary the two pages don't share. Outer layout DOM is preserved — sidenav scroll, input values, <code>&lt;details&gt;</code> open state, mounted custom elements all survive navigation without authors writing anything.</p>
    <p>The router auto-enables when <code>@webjskit/core/client-router</code> is imported (the scaffold's root layout does this for you). For 99% of apps the contract is "write standard HTML; navigation gets faster." The advanced primitives below — frames, revalidation, programmatic navigation — exist for the cases where you need to take over.</p>

    <h2>How it works (auto-magic, no opt-in)</h2>
    <ol>
      <li>SSR emits <code>&lt;!--wj:children:&lt;segment-path&gt;--&gt;</code> comment markers around each layout's <code>\${children}</code> interpolation. One pair per layout in the chain. Derived from folder structure; layout authors write nothing.</li>
      <li>On a click or form submit, the router walks both the live DOM and the incoming HTML for these markers, picks the <strong>longest shared marker path</strong>, and swaps only the nodes between that marker pair.</li>
      <li>The diff inside the swap region is keyed by <code>data-key</code> or <code>id</code> — matched elements are reused with in-place attribute updates. <strong>Live attributes</strong> (<code>value</code>, <code>checked</code>, <code>selected</code>, <code>indeterminate</code>, <code>disabled</code>, <code>open</code>, <code>popover</code>) are never overwritten, so user input and disclosure state survive the swap.</li>
      <li>The <code>&lt;head&gt;</code> is add-only merged (preserves runtime-injected styles like Tailwind's), <code>&lt;script&gt;</code> tags re-execute, custom elements upgrade, URL updates via <code>pushState</code>.</li>
      <li>A <code>webjs:navigate</code> event fires on <code>document</code> with the final URL.</li>
    </ol>
    <p><strong>Wire-byte optimization</strong>: the router sends an <code>X-Webjs-Have</code> request header listing the marker paths it already has. The server walks the target page's layout chain innermost-to-outermost, short-circuits at the first match, and returns only the divergent fragment wrapped in that layout's marker pair. Outer layouts are never re-serialized for same-shell navigations.</p>

    <h2>Form submissions</h2>
    <p><code>&lt;form action="/x" method="post"&gt;</code> works exactly per the HTML spec — webjs intercepts the <code>submit</code> event in capture phase (before user handlers) and routes the same fetch the browser would have sent through the partial-swap pipeline. Submitter attributes (<code>formmethod</code>, <code>formaction</code>, <code>formenctype</code> on a clicked <code>&lt;button&gt;</code>) take precedence over the form's own per HTML5.</p>
    <ul>
      <li><strong>GET forms</strong> — <code>FormData</code> is promoted to the URL query string (replacing any existing query on <code>action</code>); the URL is then fetched and applied like a link click.</li>
      <li><strong>POST / PUT / PATCH / DELETE forms</strong> — <code>FormData</code> is sent as the request body. After a successful response the snapshot cache is cleared (other cached URLs may reflect stale server state).</li>
    </ul>
    <p>Forms that handle submission in JavaScript (<code>@submit=\${e =&gt; { e.preventDefault(); /* RPC */ }}</code>) are untouched — the router only intercepts when <code>event.defaultPrevented</code> is false.</p>

    <p><strong>Auto-skipped</strong> (no opt-out needed):</p>
    <ul>
      <li><code>method="dialog"</code> — browser-native <code>&lt;dialog&gt;</code> dismissal</li>
      <li><code>target</code> / <code>formtarget</code> ≠ <code>_self</code> — iframes, popups, named windows</li>
      <li>Cross-origin <code>action</code></li>
      <li>Non-HTML extensions on the <code>action</code> URL</li>
    </ul>

    <h2>Non-2xx HTML responses render in place</h2>
    <p>Any response with a <code>text/html</code> body is applied to the DOM regardless of status code. This makes the standard server-rendered validation pattern work end-to-end:</p>
    <ul>
      <li><strong>2xx</strong> — normal navigation.</li>
      <li><strong>4xx (e.g. 422)</strong> — server re-renders the form with <code>value</code> attributes preserving what the user typed, inline error messages visible, no full-page reload. The Rails / Django / Laravel / Phoenix server-side validation flow.</li>
      <li><strong>5xx with HTML</strong> — error page rendered in place (not a flash of blank then reload).</li>
    </ul>
    <p>Non-HTML responses (JSON error envelopes, downloads, opaque types) fall back to <code>location.href = url</code> and let the browser handle them.</p>
    <p><strong>204 No Content</strong> — DOM untouched; history records the requested URL ("stay on current page" pattern for autosave-style submissions).</p>
    <p><strong>3xx redirects</strong> — <code>fetch()</code> follows them automatically; the <em>final</em> URL after redirects is recorded in history (Post-Redirect-Get pattern works correctly).</p>

    <h2><code>&lt;webjs-frame&gt;</code> — escape hatch for non-layout regions</h2>
    <p>The marker mechanism scopes swaps to the deepest shared <strong>layout</strong>. When you need a swap region <em>smaller</em> than the deepest layout — typically a widget inside a page that should swap independently of the rest of the page — wrap it in <code>&lt;webjs-frame id="..."&gt;</code>.</p>
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
    <p>When the user clicks "Load more", the router's <code>closest('webjs-frame')</code> from the click target finds <code>#comments</code>. The fetched response is expected to contain a <code>&lt;webjs-frame id="comments"&gt;</code> too; only its children swap into the live frame, leaving the article body — and any reading scroll position, video playback, etc. — fully intact.</p>
    <p>This takes precedence over the layout-marker mechanism. Most apps never need it — only reach for it when you've identified that the auto-marker swap is wider than the actual change.</p>

    <h2>Snapshot cache + back/forward</h2>
    <p>The router maintains a URL-keyed LRU cache of page snapshots (capacity 16). On back/forward via <code>popstate</code>, the cached DOM is applied instantly and the captured window-scroll position is restored. A background refetch then revalidates the snapshot quietly.</p>
    <p>After a server action mutates data that a cached page depends on, call <code>revalidate()</code>:</p>
    <pre>import { revalidate } from '@webjskit/core';

// Invalidate one cached URL — next visit refetches
revalidate('/products/123');

// Clear the entire cache — useful after broad mutations
revalidate();</pre>
    <p>Mutating form submissions (POST / PUT / PATCH / DELETE) clear the cache automatically on success — you only need <code>revalidate()</code> when the mutation happens via JS / RPC and didn't go through a form.</p>

    <h2>Per-segment loading skeletons</h2>
    <p>Each <code>loading.{js,ts}</code> in the route chain is rendered into a hidden <code>&lt;template id="wj-loading:&lt;segment-path&gt;"&gt;</code> at body end. On nav-start, the client clones the deepest matching template into the swap slot — users see an instant per-segment skeleton during the fetch instead of stale content.</p>

    <h2>Concurrent navigations + cancellation</h2>
    <p>Each click / submit <code>abort()</code>s any in-flight fetch from the prior one (Turbo Drive's <code>navigator.stop()</code> pattern). Rapid clicks won't produce N parallel requests competing to be applied last. A monotonic nav-token additionally short-circuits any response that arrives after a newer navigation has settled, so a slow first request that races past its abort cannot revert the newer page.</p>

    <h2>Programmatic navigation</h2>
    <pre>import { navigate } from '@webjskit/core';

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
      <li><strong>Auth flows</strong> — <code>/logout</code>, <code>/auth/google</code>, OAuth redirect chains. A full reload wipes in-memory module state (cached user data, auth tokens) that an SPA-style swap would leave behind.</li>
      <li><strong>Print views / embed pages</strong> — anywhere you want a clean-slate render without the existing layout.</li>
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
    <p>During navigation, <code>&lt;html&gt;</code> gets a <code>data-navigating</code> attribute — deferred by 150ms so quick navs (sub-150ms) never trigger it. Use it for a subtle progress indicator:</p>
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
    <pre>import { disableClientRouter } from '@webjskit/core/client-router';
disableClientRouter();</pre>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a> — file-based route conventions</li>
      <li><a href="/docs/loading-states">Loading states</a> — <code>loading.ts</code> per segment</li>
      <li><a href="/docs/server-actions">Server actions</a> — for forms handled via JS / RPC</li>
      <li><a href="/docs/ssr">Server-Side Rendering</a> — the SSR pipeline that emits the markers this router walks</li>
    </ul>
  `;
}
