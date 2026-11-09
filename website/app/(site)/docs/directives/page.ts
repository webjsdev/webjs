import { html } from '@webjsdev/core';

export const metadata = { title: 'Directives | WebJs' };

export default function Directives() {
  return html`
    <h1>Directives</h1>
    <p>WebJs ships the lit-html directives under their Lit names and with Lit's behaviour, so code written from Lit muscle memory works as written. That includes the attribute helpers <code>classMap</code>, <code>styleMap</code>, and <code>ifDefined</code>, and the <code>nothing</code> / <code>noChange</code> sentinels. Only <code>when</code> / <code>choose</code> / <code>map</code> / <code>join</code> / <code>range</code> are left to plain JavaScript (see below). The implementations live in <code>packages/core/src/directives.js</code> and the renderers (<code>render-server.js</code>, <code>render-client.js</code>).</p>

    <code-block>import { html, repeat, nothing, noChange } from '@webjsdev/core';
import {
  classMap, styleMap, ifDefined, unsafeHTML, live,
  keyed, guard, templateContent, ref, createRef,
  cache, until, asyncAppend, asyncReplace,
} from '@webjsdev/core/directives';</code-block>

    <h2>repeat(items, keyFn, templateFn)</h2>
    <p>Keyed list reconciliation. Without it, re-rendering an array destroys and recreates all DOM nodes, losing focus, scroll position, and component state.</p>
    <code-block>html\`&lt;ul&gt;
  \${repeat(
    items,
    (item) =&gt; item.id,
    (item) =&gt; html\`&lt;li&gt;\${item.name}&lt;/li&gt;\`
  )}
&lt;/ul&gt;\`;</code-block>
    <p>Use for any list where items can be added, removed, or reordered and you need to preserve DOM identity (animated lists, forms with inputs, draggable items). For static lists, plain <code>\${items.map(...)}</code> works.</p>

    <h2>unsafeHTML(htmlString)</h2>
    <p>Renders a raw HTML string without escaping. The only way to inject pre-built HTML (CMS content, markdown output) into a template.</p>
    <code-block>html\`&lt;article&gt;\${unsafeHTML(markdownToHtml(post.body))}&lt;/article&gt;\`;</code-block>
    <p><strong>Security:</strong> NEVER use with user-supplied input. This is an XSS vector.</p>

    <h2>live(value)</h2>
    <p>Dirty-checks against the live DOM value instead of the last rendered value. Solves the input desync problem where the user types between renders.</p>
    <code-block>html\`&lt;input .value=\${live(this.query.get())}
       @input=\${(e) =&gt; this.query.set(e.target.value)}&gt;\`;</code-block>
    <p>Client-only behaviour. The server renders one shot, so there is no prior value to dirty-check against and <code>live()</code> is fully transparent there, resolving to the value it wraps in every hole position (a child, a plain attribute, a <code>?bool</code>, a <code>.prop</code>). A falsy boolean stays absent, so <code>?open=\${live(false)}</code> serves the same bytes as <code>?open=\${false}</code>.</p>

    <h2>keyed(key, template)</h2>
    <p>Wrap a template with a key. When the key changes between renders, the renderer discards the prior DOM and creates fresh. Useful for forcing a remount when the logical identity of the rendered content changes.</p>
    <code-block>html\`\${keyed(this.userId, html\`&lt;edit-form .user=\${this.user}&gt;&lt;/edit-form&gt;\`)}\`;</code-block>

    <h2>guard(deps, fn)</h2>
    <p>Memoize a sub-template by its dependencies. The client renderer skips re-evaluating <code>fn()</code> when the deps array is shallow-equal to the prior call. On the server (one-shot render) <code>fn()</code> is always invoked.</p>
    <code-block>html\`&lt;header&gt;
  \${guard([this.title], () =&gt; html\`&lt;h1&gt;\${this.title}&lt;/h1&gt;\`)}
&lt;/header&gt;\`;</code-block>

    <h2>templateContent(tpl)</h2>
    <p>Render the content of a native <code>&lt;template&gt;</code> element. The content is cloned on the client; on the server, its <code>innerHTML</code> is emitted verbatim. The HTML inside the template is trusted (not escaped).</p>
    <code-block>const tpl = document.querySelector('#my-tpl');
html\`&lt;div&gt;\${templateContent(tpl)}&lt;/div&gt;\`;</code-block>

    <h2>ref(refOrCallback) + createRef()</h2>
    <p>Bind a Ref object or callback to the element at this position. The Ref's <code>value</code> is populated after the first client-side render. SSR is a no-op (no DOM yet).</p>
    <code-block>class MyForm extends WebComponent {
  _input = createRef();
  render() { return html\`&lt;input \${ref(this._input)}&gt;\`; }
  firstUpdated() { this._input.value?.focus(); }
}</code-block>
    <p>Pass a callback instead of a Ref object to receive the element directly: <code>\${ref((el) =&gt; this._captureEl(el))}</code>.</p>

    <h2>cache(value)</h2>
    <p>Retain detached DOM when toggling between sub-templates. When the inner value's template <code>strings</code> match a previously-rendered template at this position, the renderer re-attaches the stashed nodes and reconciles values instead of creating fresh DOM. Preserves input state, scroll position, and focus across "tab"-style toggles.</p>
    <code-block>render() {
  return html\`
    &lt;nav&gt;
      &lt;button @click=\${() =&gt; this.tab = 'a'}&gt;A&lt;/button&gt;
      &lt;button @click=\${() =&gt; this.tab = 'b'}&gt;B&lt;/button&gt;
    &lt;/nav&gt;
    \${cache(this.tab === 'a' ? html\`&lt;panel-a&gt;&lt;/panel-a&gt;\` : html\`&lt;panel-b&gt;&lt;/panel-b&gt;\`)}
  \`;
}</code-block>
    <p>On the server, <code>cache</code> is a pass-through (one-shot render, no DOM to cache).</p>

    <h2>until(...args)</h2>
    <p>Render the highest-priority resolved candidate. Priority is left-to-right: <code>args[0]</code> is highest. The highest-priority synchronous candidate renders immediately; higher-priority Promises that later resolve replace the rendered value. Lower-priority Promises are ignored once a higher-priority candidate is in place.</p>
    <code-block>html\`&lt;div&gt;\${until(this.dataPromise, html\`&lt;p&gt;Loading…&lt;/p&gt;\`)}&lt;/div&gt;\`;</code-block>
    <p>When the marker is torn down (a re-render replaces the directive), in-flight Promise tracking is aborted so late resolves cannot overwrite newer DOM. On the server, <code>until</code> awaits <code>Promise.race</code> when all candidates are Promises, or renders the highest-priority synchronous candidate.</p>
    <p>For component-scoped async data with full pending/error states, prefer the <code>Task</code> controller from <code>@webjsdev/core/task</code>.</p>

    <h2>asyncAppend(iterable, mapper?) / asyncReplace(iterable, mapper?)</h2>
    <p>Stream values from an <code>AsyncIterable</code>. Each yielded value is mapped (optional) and rendered as a node group. <code>asyncAppend</code> accumulates the rendered groups before the marker; <code>asyncReplace</code> swaps out the previous output each yield. Iteration aborts when the directive is replaced (so leaked iterators don't hold references to detached DOM).</p>
    <code-block>async function* logTail() {
  for await (const line of socket) yield line;
}

html\`&lt;ul&gt;\${asyncAppend(logTail(), (line, i) =&gt; html\`&lt;li&gt;\${i}: \${line}&lt;/li&gt;\`)}&lt;/ul&gt;\`;</code-block>
    <p>On the server, both directives render empty (no iteration on a one-shot render). For page-level streaming, prefer <code>Suspense({ fallback, children })</code>.</p>

    <h2>classMap(classes) / styleMap(styles) / ifDefined(value)</h2>
    <p>The same helpers as Lit. <code>classMap</code> toggles the classes whose value is truthy and keeps any static classes written beside it; <code>styleMap</code> sets inline style properties (camelCase or <code>--custom</code> names) and drops a nullish one; <code>ifDefined</code> omits the attribute when the value is <code>null</code> or <code>undefined</code>. All three render on the server too, so the first paint carries the classes and styles.</p>
    <code-block>html\`&lt;div class="card \${classMap({ active: isActive, error: hasError })}"&gt;\`;
html\`&lt;div style=\${styleMap({ color: c, fontSize: size, '--gap': gap })}&gt;\`;
html\`&lt;img src=\${ifDefined(src)}&gt;\`;</code-block>

    <h2>nothing / noChange</h2>
    <p>Lit's sentinels. <code>nothing</code> renders nothing in a child position, removes an attribute (the whole attribute when it is one piece of an interpolated value), and assigns <code>undefined</code> to a property. <code>noChange</code> leaves the last committed value in place. Like Lit, a plain attribute hole renders <code>null</code> and <code>undefined</code> as an EMPTY attribute and a boolean as text, so write <code>attr=\${value ?? nothing}</code> to omit one and <code>?checked=\${on}</code> for a boolean attribute.</p>
    <code-block>html\`&lt;a href=\${url} aria-current=\${active ? 'page' : nothing}&gt;\`;
html\`\${error ? html\`&lt;p role="alert"&gt;\${error}&lt;/p&gt;\` : nothing}\`;</code-block>

    <h2>Native patterns (no directive needed)</h2>
    <p>Lit's <code>when</code>, <code>choose</code>, <code>map</code>, <code>join</code>, and <code>range</code> are sugar over plain JavaScript, so WebJs leaves them to the language: a ternary, a <code>switch</code>, and <code>Array</code> methods inside <code>render()</code>.</p>

    <h3>Conditional rendering</h3>
    <code-block>html\`\${loggedIn ? html\`&lt;p&gt;Welcome&lt;/p&gt;\` : html\`&lt;a href="/login"&gt;Sign in&lt;/a&gt;\`}\`;</code-block>
  `;
}
