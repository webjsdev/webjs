import { html } from '@webjskit/core';

export const metadata = { title: 'Directives | webjs' };

export default function Directives() {
  return html`
    <h1>Directives</h1>
    <p>webjs ships the full lit-html directive set. AI agents writing lit-shaped directive code land on familiar names; the implementations live in <code>packages/core/src/directives.js</code> and the renderers (<code>render-server.js</code>, <code>render-client.js</code>).</p>

    <pre>import { html, repeat } from '@webjskit/core';
import {
  unsafeHTML, live,
  keyed, guard, templateContent, ref, createRef,
  cache, until, asyncAppend, asyncReplace,
} from '@webjskit/core/directives';</pre>

    <h2>repeat(items, keyFn, templateFn)</h2>
    <p>Keyed list reconciliation. Without it, re-rendering an array destroys and recreates all DOM nodes, losing focus, scroll position, and component state.</p>
    <pre>html\`&lt;ul&gt;
  \${repeat(
    items,
    (item) =&gt; item.id,
    (item) =&gt; html\`&lt;li&gt;\${item.name}&lt;/li&gt;\`
  )}
&lt;/ul&gt;\`;</pre>
    <p>Use for any list where items can be added, removed, or reordered and you need to preserve DOM identity (animated lists, forms with inputs, draggable items). For static lists, plain <code>\${items.map(...)}</code> works.</p>

    <h2>unsafeHTML(htmlString)</h2>
    <p>Renders a raw HTML string without escaping. The only way to inject pre-built HTML (CMS content, markdown output) into a template.</p>
    <pre>html\`&lt;article&gt;\${unsafeHTML(markdownToHtml(post.body))}&lt;/article&gt;\`;</pre>
    <p><strong>Security:</strong> NEVER use with user-supplied input. This is an XSS vector.</p>

    <h2>live(value)</h2>
    <p>Dirty-checks against the live DOM value instead of the last rendered value. Solves the input desync problem where the user types between renders.</p>
    <pre>html\`&lt;input .value=\${live(this.state.query)}
       @input=\${(e) =&gt; this.setState({ query: e.target.value })}&gt;\`;</pre>

    <h2>keyed(key, template)</h2>
    <p>Wrap a template with a key. When the key changes between renders, the renderer discards the prior DOM and creates fresh. Useful for forcing a remount when the logical identity of the rendered content changes.</p>
    <pre>html\`\${keyed(this.userId, html\`&lt;edit-form .user=\${this.user}&gt;&lt;/edit-form&gt;\`)}\`;</pre>

    <h2>guard(deps, fn)</h2>
    <p>Memoize a sub-template by its dependencies. The client renderer skips re-evaluating <code>fn()</code> when the deps array is shallow-equal to the prior call. On the server (one-shot render) <code>fn()</code> is always invoked.</p>
    <pre>html\`&lt;header&gt;
  \${guard([this.title], () =&gt; html\`&lt;h1&gt;\${this.title}&lt;/h1&gt;\`)}
&lt;/header&gt;\`;</pre>

    <h2>templateContent(tpl)</h2>
    <p>Render the content of a native <code>&lt;template&gt;</code> element. The content is cloned on the client; on the server, its <code>innerHTML</code> is emitted verbatim. The HTML inside the template is trusted (not escaped).</p>
    <pre>const tpl = document.querySelector('#my-tpl');
html\`&lt;div&gt;\${templateContent(tpl)}&lt;/div&gt;\`;</pre>

    <h2>ref(refOrCallback) + createRef()</h2>
    <p>Bind a Ref object or callback to the element at this position. The Ref's <code>value</code> is populated after the first client-side render. SSR is a no-op (no DOM yet).</p>
    <pre>class MyForm extends WebComponent {
  _input = createRef();
  render() { return html\`&lt;input \${ref(this._input)}&gt;\`; }
  firstUpdated() { this._input.value?.focus(); }
}</pre>
    <p>Pass a callback instead of a Ref object to receive the element directly: <code>\${ref((el) =&gt; this._captureEl(el))}</code>.</p>

    <h2>cache(value)</h2>
    <p>Currently an identity pass-through. Future versions will retain detached DOM for fast template switching (so swapping back to a previously-rendered template restores input state, scroll position, focus). For today, use CSS <code>display: none</code> if you need to preserve DOM across "tab" toggles:</p>
    <pre>html\`
  &lt;div style=\${\`display:\${tab === 'a' ? 'block' : 'none'}\`}&gt;Tab A&lt;/div&gt;
  &lt;div style=\${\`display:\${tab === 'b' ? 'block' : 'none'}\`}&gt;Tab B&lt;/div&gt;
\`;</pre>

    <h2>until(...args)</h2>
    <p>Render the first synchronous candidate from a list. On the server, awaits <code>Promise.race</code> when all candidates are Promises. On the client, renders the first sync value and does NOT re-render when promises later resolve.</p>
    <pre>html\`&lt;div&gt;\${until(this.dataPromise, html\`&lt;p&gt;Loading…&lt;/p&gt;\`)}&lt;/div&gt;\`;</pre>
    <p>For component-scoped async data with full pending/error states, prefer the <code>Task</code> controller from <code>@webjskit/core/task</code>.</p>

    <h2>asyncAppend(iterable, mapper?) / asyncReplace(iterable, mapper?)</h2>
    <p>Stream values from an AsyncIterable. Current implementation renders empty on the first paint; full streaming (append every value, support disconnection cleanup) lands with the AsyncDirective infrastructure work. For page-level streaming today, use <code>Suspense({ fallback, children })</code>. For component-scoped streams, use <code>connectWS</code> + a controller that calls <code>setState</code> per chunk.</p>

    <h2>Native patterns (no directive needed)</h2>
    <p>For conditional classes, inline styles, optional attributes, conditional rendering, async data with full lifecycle, the lit-html directive set has classMap/styleMap/ifDefined/when/choose/until/etc. webjs ships these as runtime exports for parity, but the framework's preference for these specific cases is native JavaScript inside <code>render()</code>. AI agents emit either form correctly; the native form has no runtime overhead and shows up directly in the template.</p>

    <h3>Conditional CSS classes</h3>
    <pre>html\`&lt;div class=\${[x &amp;&amp; 'active', y &amp;&amp; 'error'].filter(Boolean).join(' ')}&gt;\`;</pre>

    <h3>Dynamic inline styles</h3>
    <pre>html\`&lt;div style=\${\`color:\${c};font-size:\${s}\`}&gt;\`;</pre>

    <h3>Optional attributes</h3>
    <pre>html\`&lt;img src=\${src ?? null}&gt;\`;  // null removes the attribute</pre>

    <h3>Conditional rendering</h3>
    <pre>html\`\${loggedIn ? html\`&lt;p&gt;Welcome&lt;/p&gt;\` : html\`&lt;a href="/login"&gt;Sign in&lt;/a&gt;\`}\`;</pre>
  `;
}
