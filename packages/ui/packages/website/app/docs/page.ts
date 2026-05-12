import { html } from '@webjskit/core';

export const metadata = { title: 'Docs — Webjs UI' };

export default function Docs() {
  return html`
    <article class="prose max-w-3xl">
      <h1>Getting started</h1>
      <p>
        Webjs UI is an <strong>AI-first component library</strong>. Two tiers: pure class-helper
        functions (<code>buttonClass()</code>, <code>cardClass()</code>, <code>inputClass()</code>)
        you spread onto raw native elements, plus a small set of stateful custom elements
        (<code>&lt;ui-dialog&gt;</code>, <code>&lt;ui-tabs&gt;</code>, <code>&lt;ui-popover&gt;</code>)
        for state the browser doesn't give you natively. You install the CLI once and add components
        to your project as you need them — the source is copied into your repo, so you own it and
        can edit it freely. Variant names and data-attribute conventions mirror shadcn so existing
        shadcn knowledge maps directly.
      </p>
      <h2>For webjs users</h2>
      <p>
        Nothing to install. <code>@webjskit/ui</code> is a hard dependency of <code>@webjskit/cli</code>,
        so a global webjs install already includes it. Apps scaffolded with <code>webjs create</code>
        also list it in <code>devDependencies</code>.
      </p>
      <pre><code class="block bg-muted p-4 rounded">webjs ui init
webjs ui add button card dialog</code></pre>

      <h2>For everyone else (Next, Astro, Vite, SvelteKit, Lit, vanilla, …)</h2>
      <p>Two npm installs — the CLI and the runtime base class — then run the CLI:</p>
      <pre><code class="block bg-muted p-4 rounded">npm install -D @webjskit/ui
npm install @webjskit/core
npx webjsui init
npx webjsui add button card dialog</code></pre>
      <p>
        The <code>webjsui</code> binary is standalone — it does NOT require <code>@webjskit/cli</code>.
        It auto-detects your project type (Next / Astro / Vite / Lit / plain) and picks sensible defaults.
      </p>

      <h2>What happens</h2>
      <p>
        <code>init</code> writes <code>components.json</code> to your project root, copies <code>lib/utils.ts</code>
        (the <code>cn()</code> class-merge helper), and adds CSS variables to your global Tailwind
        stylesheet.
      </p>
      <p>
        <code>add &lt;name&gt;</code> copies the component source to <code>components/ui/&lt;name&gt;.ts</code>.
        Components are dependency-free — positioning, focus trap, toast queue are all hand-rolled.
      </p>
      <h2>Usage</h2>
      <pre><code class="block bg-muted p-4 rounded">&lt;ui-card&gt;
  &lt;ui-card-header&gt;
    &lt;ui-card-title&gt;Hello&lt;/ui-card-title&gt;
    &lt;ui-card-description&gt;A web component card.&lt;/ui-card-description&gt;
  &lt;/ui-card-header&gt;
  &lt;ui-card-content&gt;
    &lt;ui-button variant="default"&gt;Click me&lt;/ui-button&gt;
  &lt;/ui-card-content&gt;
&lt;/ui-card&gt;</code></pre>
      <h2>Framework support</h2>
      <p>
        Every component is a standards-compliant custom element. They work in webjs, Next.js, Astro,
        Vite, Remix, SvelteKit, Nuxt, SolidStart, Lit projects, and plain HTML. The only runtime
        dependency is <code>@webjskit/core</code> (the lightweight reactive base class).
      </p>
    </article>
  `;
}
