import { html } from '@webjsdev/core';

export const metadata = { title: 'Directives | WebJs' };

export default function Directives() {
  return html`
    <h1>Directives</h1>
    <p>WebJs ships the lit-html directives under their Lit names and with Lit's behaviour, so code written from Lit muscle memory works as written. That includes the attribute helpers <code>classMap</code>, <code>styleMap</code>, and <code>ifDefined</code>, the <code>nothing</code> / <code>noChange</code> sentinels, the <code>when</code> / <code>choose</code> / <code>map</code> / <code>join</code> / <code>range</code> helpers, and static expressions from <code>@webjsdev/core/static-html</code>. The implementations live in <code>packages/core/src/directives.js</code> and the renderers (<code>render-server/walk.js</code>, <code>render-client/parts.js</code>). Lit's import paths map one to one: <code>lit/directives/*.js</code> is <code>@webjsdev/core/directives</code>, <code>lit/static-html.js</code> is <code>@webjsdev/core/static-html</code>.</p>

    <code-block>import { html, svg, mathml, repeat, nothing, noChange, isServer } from '@webjsdev/core';
import {
  classMap, styleMap, ifDefined, unsafeHTML, unsafeSVG, unsafeMathML, live,
  keyed, guard, templateContent, ref, createRef,
  cache, until, asyncAppend, asyncReplace,
  when, choose, map, join, range, watch,
} from '@webjsdev/core/directives';
import { literal, unsafeStatic, html as staticHtml } from '@webjsdev/core/static-html';</code-block>

    <h2>repeat(items, keyFn, templateFn)</h2>
    <p>Keyed list reconciliation. Without it, an array updates position by position: the DOM for item N is reused for whatever is now at index N, so on a reorder or an insert, focus, scroll position and component state stay with the position rather than the item. <code>repeat()</code> moves each item's DOM with its key.</p>
    <code-block>html\`&lt;ul&gt;
  \${repeat(
    items,
    (item) =&gt; item.id,
    (item) =&gt; html\`&lt;li&gt;\${item.name}&lt;/li&gt;\`
  )}
&lt;/ul&gt;\`;</code-block>
    <p>Use for any list where items can be added, removed, or reordered and you need to preserve DOM identity (animated lists, forms with inputs, draggable items). For static lists, plain <code>\${items.map(...)}</code> works.</p>
    <p>Lit's two-argument form, <code>repeat(items, (item, i) =&gt; html\`...\`)</code>, works too. With no key function each item is keyed by its index, so it updates positionally like a plain array; pass a key function whenever DOM identity has to follow the data.</p>

    <h2>watch(signal)</h2>
    <p>Binds one hole to a signal: when the signal changes, only that text node or attribute updates, without re-running the host's <code>render()</code> or its lifecycle hooks. A bare <code>\${signal}</code> in a hole does the same thing, as in Lit's signals package; <code>watch()</code> is the explicit spelling, also exported from <code>@webjsdev/core/signals</code>.</p>
    <code-block>html\`&lt;p&gt;Unread: \${watch(unread)}&lt;/p&gt;\`;</code-block>

    <h2>unsafeHTML(htmlString)</h2>
    <p>Renders a raw HTML string without escaping. The only way to inject pre-built HTML (CMS content, markdown output) into a template.</p>
    <code-block>html\`&lt;article&gt;\${unsafeHTML(markdownToHtml(post.body))}&lt;/article&gt;\`;</code-block>

    <h2>unsafeSVG(svgString) / unsafeMathML(mathString)</h2>
    <p>The SVG and MathML twins of <code>unsafeHTML</code>. The client parses the string in that namespace, so a <code>&lt;circle&gt;</code> or a <code>&lt;mi&gt;</code> becomes a real SVG or MathML element; the server emits the markup verbatim. Put the hole inside the <code>&lt;svg&gt;</code> or <code>&lt;math&gt;</code> element. The same rule as <code>unsafeHTML</code> applies: never pass user input.</p>
    <code-block>html\`&lt;svg viewBox="0 0 24 24"&gt;\${unsafeSVG(iconPaths)}&lt;/svg&gt;\`;</code-block>
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
    <p>As in Lit, it works at every binding position, not only as a child: <code>src=\${until(this.avatar, '/placeholder.png')}</code> writes the placeholder now and the resolved url later, and the same holds inside an interpolated attribute and for <code>.prop</code>, <code>?bool</code> and <code>@event</code> bindings. <code>guard</code>, <code>keyed</code> and <code>cache</code> unwrap in those positions too.</p>
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

    <h2>when / choose / map / join / range</h2>
    <p>Lit's control-flow helpers, with Lit's signatures. They are plain functions, so they behave the same on the server and the client. <code>when(condition, trueCase, falseCase?)</code> calls the case it picks with the condition value; <code>choose(value, cases, defaultCase?)</code> matches keys with <code>===</code>; <code>map</code>, <code>join</code>, and <code>range</code> return generators.</p>
    <code-block>html\`
  \${when(this.user, (u) =&gt; html\`&lt;p&gt;Hi \${u.name}&lt;/p&gt;\`, () =&gt; html\`&lt;a href="/login"&gt;Sign in&lt;/a&gt;\`)}
  \${choose(this.tab, [
    ['home', () =&gt; html\`&lt;home-tab&gt;&lt;/home-tab&gt;\`],
    ['about', () =&gt; html\`&lt;about-tab&gt;&lt;/about-tab&gt;\`],
  ], () =&gt; html\`&lt;p&gt;Not found&lt;/p&gt;\`)}
  &lt;ol&gt;\${map(range(3), (i) =&gt; html\`&lt;li&gt;Step \${i + 1}&lt;/li&gt;\`)}&lt;/ol&gt;
  &lt;p&gt;\${join(this.tags, html\`&lt;span&gt;, &lt;/span&gt;\`)}&lt;/p&gt;
\`;</code-block>
    <p>A ternary, a <code>switch</code>, and <code>Array</code> methods work just as well; pick whichever reads better.</p>

    <h3>Any iterable renders like an array</h3>
    <p>A child hole accepts any iterable, not only an array: a generator (which is what <code>map</code>, <code>join</code>, and <code>range</code> return), a <code>Set</code>, a <code>Map</code>'s <code>values()</code>. Each item renders in order, exactly as the items of an array do. A string is the one exception: it renders as text, never character by character.</p>

    <h2>svg / mathml template tags</h2>
    <p>An <code>html</code> template is parsed as HTML on the client, so a fragment built for the inside of an <code>&lt;svg&gt;</code> or <code>&lt;math&gt;</code> element (a <code>&lt;rect&gt;</code> per data point, a <code>&lt;mi&gt;</code> a helper returns) needs the <code>svg</code> or <code>mathml</code> tag from <code>@webjsdev/core</code>. The client then parses it in that namespace. The server renders all three tags alike. A whole <code>&lt;svg&gt;</code> element still belongs in <code>html</code>.</p>
    <code-block>const bar = (v, i) =&gt; svg\`&lt;rect x=\${i * 10} height=\${v} width="8"&gt;&lt;/rect&gt;\`;
html\`&lt;svg&gt;\${values.map(bar)}&lt;/svg&gt;\`;</code-block>

    <h2>Static expressions (@webjsdev/core/static-html)</h2>
    <p>Lit's <code>lit/static-html.js</code> under a WebJs path. A static value is spliced into the template's strings before it renders, so it can stand where an ordinary hole cannot, most often a tag name chosen at runtime. <code>literal</code> takes a template literal whose own holes must be static values; <code>unsafeStatic</code> trusts any string as markup, so never pass user input to it. The merged strings are cached by their text, so the same static shape reuses one template and updates in place.</p>
    <code-block>import { html, literal, unsafeStatic } from '@webjsdev/core/static-html';

const tag = literal\`my-button\`;
html\`&lt;\${tag} label="Save"&gt;&lt;/\${tag}&gt;\`;
html\`&lt;\${unsafeStatic(level)}&gt;Title&lt;/\${unsafeStatic(level)}&gt;\`;</code-block>
    <p><code>withStatic(tag)</code> wraps any other template tag the same way, and <code>svg</code> / <code>mathml</code> come pre-wrapped.</p>

    <h2>Writing your own directive</h2>
    <p>Lit's directive authoring API, from <code>@webjsdev/core/directive</code> (Lit's <code>lit/directive.js</code>) and <code>@webjsdev/core/async-directive</code> (Lit's <code>lit/async-directive.js</code>). Subclass <code>Directive</code>, implement <code>render()</code>, and wrap the class with <code>directive()</code>. The constructor receives the part info (<code>type</code> is a <code>PartType</code>; an attribute part also has <code>name</code>, <code>tagName</code>, and, when interpolated, its static <code>strings</code>), so a directive can refuse a position it does not support.</p>
    <code-block>import { directive, Directive, PartType } from '@webjsdev/core/directive';

class Uppercase extends Directive {
  constructor(partInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD) throw new Error('uppercase() only works in a child position');
  }
  render(text) {
    return String(text).toUpperCase();
  }
}
export const uppercase = directive(Uppercase);

html\`&lt;p&gt;\${uppercase(name)}&lt;/p&gt;\`;</code-block>
    <p>The lifecycle is Lit's. One instance lives per part for as long as the same directive class renders there (per piece of an interpolated attribute); a different class or a plain value replaces it. In the browser every render calls <code>update(part, values)</code>, whose default forwards to <code>render(...values)</code>; override it for DOM access (<code>part.element</code> for an element or attribute part, <code>part.parentNode</code> for a child part, <code>part.options.host</code> for the component). On the server only <code>render()</code> runs, since there is no DOM. Whatever comes back renders like any other value, so a directive may return a template, <code>nothing</code>, <code>noChange</code>, or another directive. Inside an array item a directive has no part of its own, so it renders through <code>render()</code> each time.</p>
    <p>An <code>AsyncDirective</code> can also push a value outside a render with <code>setValue()</code>, and hears <code>disconnected()</code> when its component leaves the document (or its part is torn down) and <code>reconnected()</code> when the component comes back. Release subscriptions in the first and restore them in the second.</p>
    <code-block>import { AsyncDirective, directive } from '@webjsdev/core/async-directive';

class Clock extends AsyncDirective {
  render() {
    this.start();
    return new Date().toLocaleTimeString();
  }
  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() =&gt; this.setValue(new Date().toLocaleTimeString()), 1000);
  }
  disconnected() { clearInterval(this.timer); }
  reconnected() { this.start(); }
}
export const clock = directive(Clock);</code-block>

    <h2>isServer</h2>
    <p>Lit's flag, from <code>@webjsdev/core</code>: <code>true</code> during SSR on Node or Bun, <code>false</code> in a browser. Use it to guard browser-only work in code that runs on both sides (a constructor, <code>render()</code>, <code>willUpdate()</code>, a controller's <code>hostUpdate()</code>).</p>
    <code-block>if (!isServer) this.width = window.innerWidth;</code-block>
  `;
}
