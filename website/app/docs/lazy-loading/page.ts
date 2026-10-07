import { html } from '@webjsdev/core';

export const metadata = { title: 'Lazy Loading | WebJs' };

export default function LazyLoading() {
  return html`
    <h1>Lazy Loading</h1>
    <p>Components marked with <code>static lazy = true</code> are loaded only when they are first visible. The SSR-rendered HTML is visible immediately. The JavaScript module is fetched in the background when the user scrolls near the component, opens the tab panel it sits in, or opens the dialog that holds it.</p>

    <h2>When to use</h2>
    <ul>
      <li>Below-the-fold components that don't need interactivity on initial load (charts, comment threads, image galleries).</li>
      <li>Heavy components with large dependencies that would slow down the initial page load.</li>
      <li>Components that most users never scroll to (footer widgets, "load more" sections).</li>
      <li>Panels and dialogs that are hidden at first paint: a second tab of a tab strip, a settings dialog, an editor pane behind a "Code" tab. A <code>hidden</code> element (or one inside a closed <code>&lt;dialog&gt;</code>) is not visible, so its module waits until the panel opens.</li>
    </ul>

    <h2>When NOT to use</h2>
    <ul>
      <li>For above-the-fold components, since they need to be interactive immediately.</li>
      <li>For critical UI like navigation, auth forms, or CTAs, since these must hydrate eagerly.</li>
      <li>For tiny components with negligible JS cost, where the overhead of lazy loading isn't worth it.</li>
    </ul>

    <h2>Basic usage</h2>
    <p>Add <code>static lazy = true</code> to your component class:</p>

    <code-block>import { WebComponent, html, css } from '@webjsdev/core';

class HeavyChart extends WebComponent {
  static lazy = true;  // ← module loaded on scroll, not on page load
  static styles = css${'`'}:host { display: block; min-height: 400px; }${'`'};

  render() {
    return html${'`'}&lt;canvas&gt;&lt;/canvas&gt;${'`'};
  }
}
HeavyChart.register('heavy-chart');</code-block>

    <h2>How it works</h2>
    <ol>
      <li>During SSR, the component is rendered normally as full HTML with Declarative Shadow DOM. The user sees the content immediately.</li>
      <li>The SSR pipeline skips the <code>&lt;link rel="modulepreload"&gt;</code> for lazy components (no eager download).</li>
      <li>Instead, the tag is registered with the lazy loader: by a small inline script for a component the page rendered, and by the importing module itself when another component imports it (see below).</li>
      <li>An <code>IntersectionObserver</code> (with 200px root margin) watches for the element.</li>
      <li>When the element enters the viewport, the module is fetched via <code>import()</code>.</li>
      <li>The custom element class registers itself, upgrading the element so event listeners bind and state initializes.</li>
    </ol>

    <h2>Importing a lazy component</h2>
    <p>A lazy component is usually imported by the component that renders it, for example a workspace shell that renders its editor pane hidden until the user opens the Code tab. That import stays lazy. The server keeps it, so SSR renders the pane and knows it is lazy, and the browser copy of the shell is served with that one line rewritten to a lazy-loader registration:</p>

    <code-block>// components/workspace-shell.ts, as you write it
import './code-pane.ts';

// as the browser receives it
import('@webjsdev/core/lazy-loader').then((m) => m.observeLazy({ 'code-pane': '/components/code-pane.ts' }));</code-block>

    <p>The shell no longer waits for the pane (or anything only the pane imports) before it runs, and no <code>modulepreload</code> hint is emitted for that subtree. The pane loads the first time a <code>&lt;code-pane&gt;</code> is visible, including one the shell renders later on the client.</p>
    <p>Only a side-effect import is deferred. A binding import such as <code>import { CodePane } from './code-pane.ts'</code> stays eager, because the importer needs the value when it runs, and then the component is eager everywhere (it keeps its preload hint). Code that calls a method on the element should allow for it not being upgraded yet (<code>this.pane?.save?.()</code>, or <code>await customElements.whenDefined('code-pane')</code> once the element is visible).</p>
    <p>Browser tests (<code>webjs test --browser</code>) are served every import as written, so a test that imports a lazy component has it defined as soon as the import resolves.</p>
    <p>The loader looks for lazy tags in the light DOM, so a lazy tag rendered inside another component's shadow root is not found. Render it in light DOM (the default) or import it eagerly.</p>

    <h2>Selective hydration</h2>
    <p>For even more control, use <code>static hydrate = 'visible'</code>. This defers the component's <code>connectedCallback</code> activation (not just the module load) until the element is visible:</p>

    <code-block>class LazyComments extends WebComponent {
  static hydrate = 'visible';  // ← activation deferred until visible
  // ...
}</code-block>

    <p>The difference: <code>lazy</code> defers the module download. <code>hydrate = 'visible'</code> defers the component's activation even if the module is already loaded. Use both together for maximum deferral.</p>

    <h2>MutationObserver</h2>
    <p>The lazy loader automatically watches for dynamically added elements via <code>MutationObserver</code>. If a lazy component is added to the DOM after page load (e.g. via client-side navigation), it will still be observed and loaded when visible.</p>

    <h2>Fallback</h2>
    <p>In environments without <code>IntersectionObserver</code> (SSR-only, older browsers), all lazy components are loaded immediately as graceful degradation.</p>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/components">Components</a>: component lifecycle and properties</li>
      <li><a href="/docs/ssr">Server-Side Rendering</a>: how DSD preserves visual content before hydration</li>
      <li><a href="/docs/lifecycle">Lifecycle Hooks</a>: <code>connectedCallback</code>, <code>firstUpdated</code>, etc.</li>
    </ul>
  `;
}
