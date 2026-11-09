import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Display-Only Elision | WebJs',
  description:
    'WebJs never downloads a component module that does no client work. Elision is automatic and biased toward shipping. Inspect the verdict per module with webjs elision, and prove it for your own app with webjs elision --verify.',
};

export default function Elision() {
  return html`
    <h1>Display-Only Elision</h1>

    <p>
      A component that does no client-side work renders the same HTML with or without its JavaScript. WebJs proves that statically and then acts on it: the component's import is stripped from the served source, its <code>modulepreload</code> hint and importmap entry go with it, and any vendor package reachable only through it is pruned too. The browser never downloads the module at all.
    </p>

    <p>
      This is the mechanism that makes progressive enhancement pay. A page whose whole subtree is display-only ships <strong>zero</strong> application JavaScript, while a page with one interactive leaf ships that leaf and nothing else.
    </p>

    <h2 id="route-modules">Pages, layouts and boundaries never ship</h2>

    <p>
      A page, layout, loading template or boundary (error, not-found, forbidden, unauthorized) runs only on the server, the way a Next.js server component does. Its module is never sent to the browser: the client boot imports the components it renders instead, and that set is called its frontier. This holds whether or not elision is on, and it is why a page can import a <code>.server.ts</code> utility, a database client or a <code>node:</code> module without any of it reaching the browser.
    </p>

    <p>
      The consequence is the one Next.js has for server components: anything that needs a browser belongs in a component. A component class defined inside a page, an <code>@click</code> binding on a page's template, a component importing a page file, and a Node builtin reached from a component are each refused by <code>webjs check</code> with the fix. For app-wide browser code that belongs to no component, use <code>instrumentation-client.ts</code>.
    </p>

    <p>
      Elision is automatic, and it stays automatic. There is no <code>'use client'</code> and no per-component annotation to remember, because a directive-based model puts the failure on the author with no compiler to catch a forgotten one. The analyser instead biases toward SHIPPING: a wrong "display-only" verdict breaks a page, a wrong "interactive" verdict only misses an optimization, so anything ambiguous or unreadable keeps its JavaScript.
    </p>

    <h2>What keeps a component shipping</h2>

    <p>
      A component stays elidable while it has <em>none</em> of the following. Any one of them is a client-work signal and the module ships.
    </p>

    <ul>
      <li>An <code>@event</code> binding, or a native handler property like <code>.onclick</code>.</li>
      <li>A declared reactive property.</li>
      <li>An overridden lifecycle hook, <code>renderFallback()</code> and <code>renderError()</code> included, and Lit's update-scheduling overrides <code>scheduleUpdate()</code> / <code>performUpdate()</code> / <code>enableUpdating()</code>. Overriding <code>createRenderRoot()</code> alone is not a signal, since <code>static shadow</code> already decides where the template commits.</li>
      <li>An imported <code>signal</code> / <code>computed</code> / <code>watch</code> / <code>Task</code> / <code>ref</code> / <code>ContextRoot</code>, a streaming directive, or a custom-directive primitive (<code>directive</code>, <code>Directive</code>, <code>AsyncDirective</code>), or a call to <code>addController</code> / <code>requestUpdate</code> / <code>performUpdate</code>.</li>
      <li>Code that runs at module load: a top-level call, a non-data <code>new</code>, a dynamic <code>import(...)</code>, a top-level <code>await</code>. Only declarations and the <code>register(...)</code> call are inert. A call inside a declaration does not run at load, so an arrow's expression body (<code>export const usd = (m) =&gt; Math.round(m) / MICROS</code>) and a function parameter default (<code>function relativeTime(when, now = Date.now())</code>) are inert too. TypeScript types are erased before the analyser reads a module, so an annotation is never a signal however call-shaped it looks: <code>readonly (readonly [number, number, number])[]</code> is inert data.</li>
      <li>A browser global at module scope, or a side-effect import of an npm package. A module-scope data value does not count: a <code>Set</code>, <code>Map</code>, <code>RegExp</code>, <code>URL</code>, typed array, an <code>Intl</code> formatter such as <code>new Intl.DateTimeFormat(...)</code>, or a pure builtin call such as <code>Array.from({ length: 24 }, (_, h) =&gt; h)</code>, <code>Math.max(...)</code> or <code>Object.freeze(...)</code>.</li>
      <li>The dynamic slot READ surface (<code>slotchange</code>, <code>assignedNodes</code> / <code>assignedElements</code> / <code>assignedSlot</code>). Merely rendering a <code>&lt;slot&gt;</code> does not ship, because the SSR output already carries the placed children.</li>
      <li>Being rendered or imported by a component that itself ships.</li>
      <li>Another module observing its registration: a <code>whenDefined('its-tag')</code>, a CSS <code>its-tag:defined</code> rule in a module the graph reaches, or an <code>instanceof TheClass</code>.</li>
    </ul>

    <p>
      A bare <code>async render()</code> is <em>not</em> a signal on its own. Its SSR pass bakes the resolved data into the first paint, so a light-DOM async leaf with no other signal is elided like any display-only component, which drops the module AND the redundant on-hydration re-fetch.
    </p>

    <h2>The two always-ship carve-outs</h2>

    <p>
      <code>static shadow = true</code> always ships. Declarative Shadow DOM attaches only during HTML parsing, so a shadow component that arrives through a soft-nav swap or a streamed boundary needs its module to re-run <code>attachShadow</code>.
    </p>

    <p>
      <code>static interactive = true</code> is the explicit author override. It forces the module to ship when the component's interactivity is invisible to static analysis:
    </p>

    <ul>
      <li><strong>An observer that computes the tag it waits for.</strong> <code>customElements.whenDefined(TAG)</code> with a variable does not name a tag the analyser can resolve, so the observed component is elided, its registration never runs, and the <code>await</code> never settles. Put the override on the OBSERVED component.</li>
      <li><strong>A <code>:defined</code> rule in an external stylesheet.</strong> A <code>public/app.css</code> is not in the module graph, so <code>my-badge:defined { ... }</code> is invisible. Same fix, on the component the rule names.</li>
      <li><strong>A consumer that reaches the element through a string selector.</strong> The analyser matches <code>whenDefined</code>, <code>:defined</code>, and <code>instanceof</code>, so a <code>document.querySelector('my-wrapper')</code> consumer escapes all three. Same fix, on the component being reached.</li>
    </ul>

    <h2>A computed registration tag is a different problem</h2>

    <p>
      <code>static interactive = true</code> does <strong>not</strong> rescue a component whose own registration tag is computed:
    </p>

    <code-block>// Broken: the component scanner requires a literal tag.
const TAG = buildTag();
Badge.register(TAG);          // invisible

// Correct:
Badge.register('my-badge');</code-block>

    <p>
      A custom-element tag must be a literal string anyway, but the consequence here is specific: the scanner never sees that component, so it gets no elision verdict at all, nothing consults the analyser for it, and the override has nothing to attach to. The registration itself still runs if the module reaches the browser, so what you always lose is the verdict, the tag-to-module registry entry, and the preload hint. Whether the element upgrades comes down to one thing: the importing module has to ship <strong>whole</strong>. An inert, import-only, or elided importer is dropped from the boot and takes the import with it, and then the element never registers at all. A page rendering a real component alongside the orphan is import-only unless it also does its own client work, so shipping whole is the narrower case: assume the element does not upgrade.
    </p>

    <p>
      <code>webjs dev</code> warns, and <code>webjs elision</code> and <code>webjs doctor</code> report it, as an <strong>orphan</strong>. That name covers <strong>two</strong> shapes and they fail differently. A computed tag is the case above. A class with no registration call anywhere in the app is the plainer one, someone forgot to register it, and that element never upgrades. The check is app-wide, so registering the class from a sibling module is fine and is not reported. Both lose the verdict, the registry entry, and the preload hint.
    </p>

    <h2>Inspecting the verdict</h2>

    <p>
      Elision is the one thing WebJs decides about your code that you did not write down, so it is inspectable rather than something to reason about from the rules above.
    </p>

    <code-block>webjs elision            # per-module verdict, and the evidence behind every ship
webjs elision --json     # the same object, for a tool or an agent</code-block>

    <p>
      Every component is reported as <code>elided</code> or <code>shipped</code>. A shipped one carries the <code>evidence</code> that forced it, first match wins:
    </p>

    <ul>
      <li><code>own</code> is its own source, and the <code>reason</code> names the exact signal.</li>
      <li><code>observed</code> means another module observes its registration; <code>by</code> names the observer.</li>
      <li><code>closure</code> means something it imports does client work; <code>by</code> names the import.</li>
      <li><code>render</code> means a shipping component can render its tag.</li>
      <li><code>import</code> means a shipping component imports it.</li>
      <li><code>unreadable</code> means its source could not be read, so it ships conservatively.</li>
    </ul>

    <p>
      An elided row carries no reason on purpose. Elision is the ABSENCE of every signal, so there is no positive fact to report.
    </p>

    <p>
      Every page, layout and boundary is reported too, with its kind and the components the boot loads in its place (none means the route costs the browser no JavaScript), plus a hint for any code in it that looks meant for the browser but will only ever run on the server. The same report is available to an agent as the MCP <code>list_elision</code> tool. <code>webjs doctor</code> carries it as a one-line inventory that warns only on an orphan, and warns (<code>ROUTE_BROWSER_CODE</code>) on a route-module hint.
    </p>

    <h2>Proving it for your own app</h2>

    <code-block>webjs elision --verify
webjs elision --verify --routes /,/blog/hello</code-block>

    <p>
      This renders every static page route with elision on and off in one process and diffs the served bytes with the JavaScript-loaded set masked out. It is the framework's own differential guard pointed at your route table, so your app proves the invariant locally instead of inheriting a guarantee it cannot check. It exits non-zero on a divergence <em>and</em> on a corpus where nothing could be compared, so it is safe to put in CI.
    </p>

    <p>
      The ON side is forced on with the environment override rather than left to your config, so <code>--verify</code> compares a real on-vs-off pair even in an app that has elision switched off. The run also reports how many modules elision actually dropped across the corpus, because a pass over a corpus where it dropped none is true but trivially so.
    </p>

    <p>
      <strong>What it proves, and what it does not.</strong> The mask covers the whole JS-loaded set by construction, so <code>--verify</code> proves elision did not change the bytes your app SERVES. It cannot prove post-hydration behaviour, because a wrongly dropped module shows up as a dead click, not as different bytes. Cover that half by running your own browser or e2e suite twice:
    </p>

    <code-block>WEBJS_ELIDE=1 npm run test:e2e
WEBJS_ELIDE=0 npm run test:e2e</code-block>

    <p>
      Dynamic routes are skipped by name, because rendering one would mean inventing param values; pass real ones with <code>--routes</code>. A route whose two same-side renders already differ is reported as nondeterministic and excluded, since a differential over live data proves nothing either way.
    </p>

    <h2>Turning it off</h2>

    <p>
      Elision is on by default. Disable it app-wide in <code>package.json</code>:
    </p>

    <code-block>{
  "webjs": {
    "elide": false
  }
}</code-block>

    <p>
      Or per-run with the environment override, which wins over the config key and is the seam <code>--verify</code> itself uses:
    </p>

    <code-block>WEBJS_ELIDE=0 npm run start</code-block>

    <p>
      With elision off, every component ships and <code>webjs elision</code> says so; pages, layouts and boundaries still run on the server only. Reach for the switch to isolate a bug, not as a permanent setting: everything it turns off is JavaScript your users would otherwise never download.
    </p>
  `;
}
