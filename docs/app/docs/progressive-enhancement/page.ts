import { html } from '@webjskit/core';

export const metadata = {
  title: 'Progressive Enhancement — webjs',
  description:
    'webjs pages and components are SSR\'d to real HTML. Read-paths, navigation, and form submissions work without JavaScript. JS is opt-in per interactive behavior — only the click / setState / focus handlers require scripts, not the component\'s first paint.',
};

export default function ProgressiveEnhancement() {
  return html`
    <h1>Progressive Enhancement</h1>

    <p>
      <strong>webjs is HTML-first by design.</strong> Every page is server-rendered to real HTML. Every web component runs its <code>render()</code> on the server, so the component's initial markup is in the response before any script loads. With JavaScript disabled — slow networks, strict CSP, hostile proxies, user preference, ad-blockers, hydration races — the page still paints, content reads, links navigate, and forms submit.
    </p>

    <p>
      JavaScript is opt-in <em>per interactive behavior</em>, not per component. A counter custom element renders as "0" on the server; only the +/- click handling needs JS. A dropdown renders its trigger and closed state on the server; only the open/close toggle needs JS. The HTML is the floor; <code>@click</code>, <code>setState()</code>, and the client router are layered on top.
    </p>

    <h2>What works without JavaScript</h2>

    <ul>
      <li><strong>Page rendering.</strong> Every <code>page.ts</code> runs on the server and emits HTML. Layouts, metadata, OG tags, the page body — all in the first response.</li>
      <li><strong>Custom elements' initial markup.</strong> Every web component's <code>render()</code> runs server-side. Light-DOM components serialize as direct children; shadow-DOM components emit Declarative Shadow DOM so scoped styles paint before JS loads.</li>
      <li><strong>Navigation.</strong> <code>&lt;a href="..."&gt;</code> is a real link. The client router enhances it into a partial-swap when JS is active; with JS off, the browser performs a standard navigation.</li>
      <li><strong>Form submissions (write-paths).</strong> Server actions are reachable as plain HTML form POSTs:
        <pre>&lt;form action="/actions/createPost" method="post"&gt;
  &lt;input name="title"&gt;
  &lt;textarea name="body"&gt;&lt;/textarea&gt;
  &lt;button type="submit"&gt;Save&lt;/button&gt;
&lt;/form&gt;</pre>
        Submitting this form works whether or not JavaScript is enabled. The client router upgrades it to a partial-swap submission when active.
      </li>
      <li><strong>CSS-driven interactivity.</strong> Hover, focus, <code>:checked</code>, <code>:target</code>, <code>&lt;details&gt;</code>/<code>&lt;summary&gt;</code>, native dropdowns (<code>&lt;select&gt;</code>) — all work without JS by construction.</li>
      <li><strong>Suspense fallbacks.</strong> The fallback HTML is in the first chunk of the response. Without JS, the user sees the fallback content and won't see streamed-in updates — but the page is never blank.</li>
      <li><strong>Streaming-injected modulepreload hints.</strong> The server emits <code>&lt;link rel="modulepreload"&gt;</code> for every module the page needs; with JS off, those preloads are simply ignored.</li>
    </ul>

    <h2>What needs JavaScript</h2>

    <p>
      Only behaviors that <em>respond</em> to user input or update state in place:
    </p>

    <ul>
      <li><strong><code>@click</code> / <code>@input</code> / <code>@change</code> handlers on custom elements.</strong> The button is in the HTML, the handler isn't.</li>
      <li><strong><code>setState()</code> updates and re-renders.</strong> A counter starts at its server-rendered value; counting up requires JS.</li>
      <li><strong>Client-router partial-swap navigation.</strong> With JS off, links still navigate — they just trigger a full-page load instead of a swap. UX degrades to the standard browser experience.</li>
      <li><strong>Suspense streaming.</strong> The fallback paints without JS, but streamed-in updates need scripts to be applied.</li>
      <li><strong>WebSockets.</strong> No fallback; if you need realtime, you need JS.</li>
    </ul>

    <p>
      Notice the asymmetry: <em>showing</em> things works without JS; <em>reacting</em> to user input or external events requires it. This is the right asymmetry for the web platform.
    </p>

    <h2>The design rules</h2>

    <p>
      Build features so the first paint is the right content, and JavaScript only adds reactivity on top.
    </p>

    <h3>1. Use real <code>&lt;a&gt;</code> for navigation</h3>

    <p>
      Don't write JS-only click handlers for routing.
    </p>

    <pre>// ✅ works without JS — router enhances it
&lt;a href="/posts/${'${post.id}'}"&gt;${'${post.title}'}&lt;/a&gt;

// ❌ requires JS to navigate
&lt;button @click=${'${() => router.push(`/posts/${post.id}`)}'}&gt;
  ${'${post.title}'}
&lt;/button&gt;</pre>

    <h3>2. Use <code>&lt;form&gt;</code> + server actions for writes</h3>

    <p>
      A server action bound to a form's <code>action</code> attribute works as a plain HTML POST when JS is off, and as a partial-swap submission when JS is on. <strong>One piece of code covers both ends of the spectrum.</strong>
    </p>

    <pre>'use server';
// modules/posts/actions/create-post.server.ts
export async function createPost(input: FormData) {
  const post = await db.post.create({
    data: { title: input.get('title'), body: input.get('body') },
  });
  return redirect(\`/posts/\${post.id}\`);
}</pre>

    <pre>// page.ts
import { createPost } from '../modules/posts/actions/create-post.server.ts';

return html\`
  &lt;form action=\${createPost} method="post"&gt;
    &lt;input name="title" required&gt;
    &lt;textarea name="body" required&gt;&lt;/textarea&gt;
    &lt;button type="submit"&gt;Publish&lt;/button&gt;
  &lt;/form&gt;
\`;</pre>

    <p>
      Avoid the pattern of <code>fetch('/api/...')</code> + a click handler for write-paths. That's JS-required by construction.
    </p>

    <h3>3. Make components render correctly on the server</h3>

    <p>
      The component's <code>render()</code> output must be the right HTML, not a placeholder waiting for hydration. Bad:
    </p>

    <pre>// ❌ first paint is empty — relies on hydration
class PostList extends WebComponent {
  posts = [];
  render() { return html\`&lt;ul&gt;${'${this.posts.map(...)}'}&lt;/ul&gt;\`; }
  async firstUpdated() {
    this.posts = await fetchPosts();   // ← only runs in browser
    this.requestUpdate();
  }
}</pre>

    <p>Good — fetch on the server, render with real data, no client roundtrip:</p>

    <pre>// ✅ first paint has the data
// app/posts/page.ts
import { listPosts } from '../modules/posts/queries/list-posts.server.ts';
export default async function Posts() {
  const posts = await listPosts();
  return html\`&lt;post-list .posts=\${posts}&gt;&lt;/post-list&gt;\`;
}</pre>

    <h3>4. Don't gate read-paths on hydration</h3>

    <p>
      Static content (text, images, links, lists, marketing sections, layouts) should be plain HTML or a function returning an <code>html\`\`</code> template — not a custom element. Custom elements are for when you need <em>state</em> or <em>lifecycle</em>. If your component has no <code>@click</code>, no <code>setState()</code>, and no <code>firstUpdated()</code> doing anything, it should probably be a plain function.
    </p>

    <h3>5. Use <code>&lt;form&gt;</code>'s built-in validation before reaching for JS</h3>

    <p>
      <code>required</code>, <code>pattern</code>, <code>min</code>/<code>max</code>, <code>type="email"</code>, <code>type="url"</code> — all enforced by the browser without JS. Add custom JS validation only when these aren't enough.
    </p>

    <h3>6. Set SSR-meaningful defaults in the <em>constructor</em>, not <code>connectedCallback</code></h3>

    <p>
      The SSR pipeline constructs each web component (<code>new Cls()</code>), applies its attributes, and calls <code>render()</code>. <strong>It does <em>not</em> call <code>connectedCallback</code>, <code>firstUpdated</code>, or any other lifecycle hook</strong> — those run only in the browser, after the script loads. Whatever state your component should display on first paint must be set in the constructor (or be derivable from <code>static properties</code> on the element's attributes).
    </p>

    <pre>// ❌ first paint is empty — initial state set in browser-only hook
class Cart extends WebComponent {
  declare items: Item[];

  connectedCallback() {                       // ← server never runs this
    super.connectedCallback();
    this.items = readFromLocalStorage();
    this.requestUpdate();
  }

  render() { return html\`&lt;ul&gt;${'${this.items.map(...)}'}&lt;/ul&gt;\`; }
}</pre>

    <pre>// ✅ SSR-safe — sensible default in the constructor, browser hook
//    refines it after hydration
class Cart extends WebComponent {
  declare items: Item[];

  constructor() {
    super();
    this.items = [];                          // ← SSR uses this
  }

  connectedCallback() {
    super.connectedCallback();
    const stored = readFromLocalStorage();
    if (stored) this.setState({ items: stored }); // browser-only refinement
  }

  render() { return html\`&lt;ul&gt;${'${this.items.map(...)}'}&lt;/ul&gt;\`; }
}</pre>

    <p>
      For data that genuinely can't be known on the server (a user's <code>localStorage</code>, viewport size, online status, time zone, theme preference), one of three patterns works:
    </p>

    <ul>
      <li><strong>Sensible default + browser refinement.</strong> Constructor sets a safe value (<code>[]</code>, <code>'system'</code>, empty); <code>connectedCallback</code> reads the browser-only source and calls <code>setState</code>. Accept that the first paint may flash from the default to the real value once JS arrives. Often fine.</li>
      <li><strong>Synchronous bootstrap script.</strong> If the flash is unacceptable (theme color, RTL direction), emit a tiny inline <code>&lt;script&gt;</code> in the layout's <code>&lt;head&gt;</code> that reads <code>localStorage</code> and writes the value to <code>document.documentElement</code> (e.g. <code>data-theme</code> attribute). CSS reads from that attribute, so the page renders with the correct value before the component upgrades. This is how <code>&lt;theme-toggle&gt;</code> works in this docs site.</li>
      <li><strong>Send it from the server.</strong> If the data is available via a cookie or the request (session, accept-language), read it in the page function and pass it as an attribute or property on the component. The SSR pipeline applies attributes before <code>render()</code>, so the first paint has the right value.</li>
    </ul>

    <h2>Testing: run with JavaScript disabled</h2>

    <p>
      Before marking a feature done, exercise the user's read + write paths with JS turned off. In Chrome DevTools: <strong>Settings → Debugger → "Disable JavaScript"</strong>. Then:
    </p>

    <ul>
      <li>Reload the page. Content should paint. Look for an empty container, a stuck loading skeleton, or a JS-rendered widget showing nothing — those indicate a hydration-dependent first paint.</li>
      <li>Navigate via the page's links. Each should produce a full page load that lands on the right URL.</li>
      <li>Submit each form. Each should POST to its action URL and render the resulting page.</li>
      <li>Interactive widgets (counters, dropdowns) won't react — that's expected and fine. The widget's <em>initial</em> state should still be visible.</li>
    </ul>

    <p>
      A green run here means your feature degrades correctly. Your users on flaky networks, strict CSP, and Chrome's "data saver" mode will thank you.
    </p>

    <h2>Why this matters</h2>

    <ul>
      <li><strong>Resilience.</strong> Scripts can fail to load, be blocked, or hang. Networks drop. Edges return JS-stripped HTML through aggressive CDN transforms. With HTML-first, your page survives all of it.</li>
      <li><strong>Performance.</strong> Time-to-first-content is determined by HTML, not by waiting for a JS bundle to parse and execute. Even with JS available, the user reads earlier.</li>
      <li><strong>SEO and link previews.</strong> Crawlers and link-preview generators see real content, not a JS shell. Open Graph, Twitter cards, Discord embeds — all just work.</li>
      <li><strong>Accessibility.</strong> Real <code>&lt;a&gt;</code> and real <code>&lt;form&gt;</code> elements come with keyboard, screen-reader, and assistive-tech support out of the box. Reinvented JS-only equivalents almost never do.</li>
      <li><strong>Composability.</strong> Server actions can be called via RPC <em>and</em> via plain HTML forms with the same code. Routes work via the client router <em>and</em> via plain browser navigation with the same URLs. One implementation, two ends of the progressive-enhancement spectrum.</li>
    </ul>

    <p>
      Progressive enhancement isn't a feature you enable in webjs. It's the architecture. <a href="/docs/architecture">Architecture</a> walks through how the request lifecycle produces HTML-first responses; <a href="/docs/server-actions">Server Actions</a> shows the form-first pattern; <a href="/docs/client-router">Client Router</a> shows how the SPA-style transitions enhance plain links and forms.
    </p>
  `;
}
