import { html } from '@webjskit/core';

export const metadata = { title: 'Lifecycle Hooks | webjs' };

export default function Lifecycle() {
  return html`
    <h1>Lifecycle Hooks</h1>
    <p>webjs ships the full lit-aligned component lifecycle. AI coding agents have substantial training data on lit, so adopting lit's hook names and semantics lets agents write idiomatic webjs code without framework-specific translation.</p>

    <h2>The Update Cycle</h2>
    <p>Every render goes through this pipeline. Each hook receives a <code>changedProperties</code> Map where keys are property names and values are the previous value before the change. Signal reads inside <code>render()</code> are tracked separately by the built-in SignalWatcher; signal changes schedule the next update but don't appear in this Map.</p>
    <ol>
      <li><code>shouldUpdate(changedProperties)</code> returns <code>false</code> to skip this update entirely.</li>
      <li><code>willUpdate(changedProperties)</code> is the pre-render hook. Safe to set reactive properties; assignments fold into this cycle.</li>
      <li>Controllers' <code>hostUpdate()</code></li>
      <li><code>update(changedProperties)</code> is the render-and-commit step. The default implementation calls <code>render()</code> and commits to the render root.</li>
      <li>Controllers' <code>hostUpdated()</code></li>
      <li><code>firstUpdated(changedProperties)</code> runs once, on the first render only.</li>
      <li><code>updated(changedProperties)</code> runs after every render commit.</li>
      <li><code>updateComplete</code> Promise resolves.</li>
    </ol>

    <h2>render()</h2>
    <p>The template the component should produce for the current state. Returns a <code>TemplateResult</code> via the <code>html</code> tag.</p>
    <pre>render() {
  return html\`
    &lt;p&gt;\${this.filtered.length} active items&lt;/p&gt;
    &lt;ul&gt;\${this.filtered.map(i =&gt; html\`&lt;li&gt;\${i.name}&lt;/li&gt;\`)}&lt;/ul&gt;
  \`;
}</pre>

    <h2>shouldUpdate(changedProperties)</h2>
    <p>Decide whether to render at all. Default returns <code>true</code>. Use to skip expensive renders when only irrelevant properties changed.</p>
    <pre>shouldUpdate(cp) {
  return cp.has('items') || cp.has('mode');
}</pre>

    <h2>willUpdate(changedProperties)</h2>
    <p>Compute derived values from inputs before <code>render()</code> reads them. Property assignments inside <code>willUpdate</code> fold into the current cycle without triggering another update.</p>
    <pre>willUpdate(cp) {
  if (cp.has('items')) {
    this.totalCount = this.items.length;
  }
}</pre>

    <h2>update(changedProperties)</h2>
    <p>The render-and-commit step. The default implementation calls <code>render()</code> and commits to the render root. Override only when you need to wrap or short-circuit the commit. Most users override <code>render()</code> instead.</p>

    <h2>updated(changedProperties)</h2>
    <p>Post-render DOM work. Runs after every commit (both the first render and all subsequent ones). Inspect <code>changedProperties</code> to branch on what changed this cycle. This is the right place for ad-hoc DOM work that previously needed <code>requestAnimationFrame</code> shims.</p>
    <pre>updated(cp) {
  if (cp.has('open') && this.open) {
    this.querySelector('input')?.focus();
  }
}</pre>

    <h2>firstUpdated(changedProperties)</h2>
    <p>Runs once, after the first render. Use for one-time DOM-dependent setup: focus, measurements, third-party library init on a DOM node. The <code>changedProperties</code> Map on the first render contains every reactive property that has a value, with <code>undefined</code> as the old value.</p>
    <pre>firstUpdated() {
  this.shadowRoot?.querySelector('input')?.focus();
  this._chart = new Chart(this.shadowRoot.querySelector('canvas'));
}</pre>
    <p><code>connectedCallback</code> fires <em>before</em> the first render, so shadow children don't exist there yet. <code>firstUpdated</code> is the post-render equivalent.</p>

    <h2>updateComplete (and getUpdateComplete)</h2>
    <p>A Promise that resolves after the next render commit. <code>await el.updateComplete</code> in tests or in code that needs to read the post-render DOM after triggering an update. Override <code>getUpdateComplete()</code> to chain additional async work.</p>
    <pre>el.count = 5;
await el.updateComplete;
// DOM now reflects count = 5</pre>

    <h2>State mutation</h2>
    <p>Signals are the default state primitive. Mutating a signal that the render() reads schedules a microtask-batched re-render via the component's built-in SignalWatcher. Multiple <code>signal.set</code> calls in the same microtask coalesce into one render. Reactive properties (declared in <code>static properties</code>) follow the same scheduler and surface their own entries in <code>changedProperties</code>.</p>
    <pre>this.count.set(this.count.get() + 1);
this.name = 'updated';                       // reactive property assignment
// One render. changedProperties.has('name') is true; signal change drove the watcher.</pre>

    <h2>requestUpdate(name, oldValue)</h2>
    <p>Manually schedule a re-render. Optionally record a property change so hooks see it in <code>changedProperties</code>. Used by controllers and code that mutates outside the reactive property system.</p>
    <pre>this.requestUpdate('items', oldItems);</pre>

    <h2>renderError(error)</h2>
    <p>Runs when <code>update()</code>/<code>render()</code> throws. Return a fallback template to show instead of crashing the page.</p>
    <pre>renderError(error) {
  return html\`&lt;p style="color:red"&gt;Error: \${error.message}&lt;/p&gt;\`;
}</pre>
    <p>Without this, one broken component would crash the entire page. The default implementation renders nothing and logs to console.</p>

    <h2>Native Web Component Callbacks</h2>
    <p>These are provided by <code>HTMLElement</code> itself and work as normal in webjs components:</p>
    <ul>
      <li><code>connectedCallback()</code> fires when the element is added to DOM (call <code>super.connectedCallback()</code>)</li>
      <li><code>disconnectedCallback()</code> fires when the element is removed from DOM</li>
      <li><code>attributeChangedCallback(name, old, new)</code> fires when an observed attribute changes</li>
      <li><code>static observedAttributes</code>: declares which attributes to watch</li>
    </ul>

    <h2>SSR vs Browser: which hooks run where</h2>

    <p>The SSR pipeline runs each component to produce its first-paint HTML. It calls a deliberately narrow subset of the lifecycle. Everything else runs only in the browser after the script loads.</p>

    <table>
      <thead>
        <tr><th>Hook</th><th>Server (SSR)</th><th>Browser</th></tr>
      </thead>
      <tbody>
        <tr><td><code>constructor()</code></td><td>✅</td><td>✅</td></tr>
        <tr><td>attribute application (via <code>static properties</code> converters)</td><td>✅</td><td>✅</td></tr>
        <tr><td><code>render()</code></td><td>✅</td><td>✅</td></tr>
        <tr><td><code>connectedCallback()</code></td><td>❌</td><td>✅</td></tr>
        <tr><td><code>disconnectedCallback()</code></td><td>❌</td><td>✅</td></tr>
        <tr><td><code>firstUpdated()</code></td><td>❌</td><td>✅</td></tr>
        <tr><td><code>attributeChangedCallback()</code></td><td>❌</td><td>✅</td></tr>
        <tr><td>controllers' <code>hostUpdate</code> / <code>hostUpdated</code></td><td>❌</td><td>✅</td></tr>
      </tbody>
    </table>

    <p><strong>Practical rule:</strong> set SSR-meaningful defaults in the <em>constructor</em>, or as the initial value of an instance signal (class-field initializer). Use <code>connectedCallback</code> only for browser-only data (<code>localStorage</code>, viewport, <code>navigator.*</code>, observers, timers). Read the value and write the signal to refine the initial render after hydration.</p>

    <p>See <a href="/docs/progressive-enhancement">Progressive Enhancement</a> for the full pattern, including how to push server-known data through the page function instead of fetching in browser-only hooks.</p>
  `;
}
