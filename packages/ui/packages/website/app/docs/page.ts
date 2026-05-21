import { html } from '@webjskit/core';

export const metadata = { title: 'Docs, Webjs UI' };

export default function Docs() {
  return html`
    <article class="prose max-w-3xl">
      <h1>Getting started</h1>
      <p>
        Webjs UI is an <strong>AI-first component library</strong> with two tiers:
      </p>
      <p>
        <strong>Tier 1</strong> is pure class-helper functions (<code>buttonClass()</code>,
        <code>cardClass()</code>, <code>inputClass()</code>) that you apply to native HTML.
        Most tier-1 helpers target a plain element (<code>&lt;button&gt;</code>,
        <code>&lt;input&gt;</code>, <code>&lt;label&gt;</code>, <code>&lt;table&gt;</code>);
        a few wrap a platform primitive: <code>accordion</code> and <code>collapsible</code>
        on <code>&lt;details&gt;</code>, <code>progress</code> on
        <code>&lt;progress value max&gt;</code>, <code>popover</code> on the
        <code>popover</code> attribute.
      </p>
      <p>
        <strong>Tier 2</strong> is a small set of stateful custom elements for behavior native
        HTML still lacks. Today: <code>&lt;ui-dialog&gt;</code>,
        <code>&lt;ui-alert-dialog&gt;</code>, <code>&lt;ui-tabs&gt;</code>,
        <code>&lt;ui-dropdown-menu&gt;</code>, <code>&lt;ui-tooltip&gt;</code>,
        <code>&lt;ui-hover-card&gt;</code>, <code>&lt;ui-toggle-group&gt;</code>,
        <code>&lt;ui-sonner&gt;</code>. Each wraps the closest platform primitive it can
        (<code>&lt;ui-dialog&gt;</code> drives a native <code>&lt;dialog&gt;</code>;
        <code>&lt;ui-tooltip&gt;</code> and <code>&lt;ui-hover-card&gt;</code> use
        <code>popover="manual"</code>) and adds the open-state tracking, focus trap, or
        toast queue on top.
      </p>
      <p>
        You install the CLI once and add components to your project as you need them.
        Component source is copied into your repo, so you own it and can edit it freely.
        Variant names and <code>data-state</code> / <code>data-orientation</code> conventions
        mirror shadcn so existing shadcn knowledge maps directly.
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
      <p>Two npm installs, the CLI and the runtime base class, then run the CLI:</p>
      <pre><code class="block bg-muted p-4 rounded">npm install -D @webjskit/ui
npm install @webjskit/core
npx webjsui init
npx webjsui add button card dialog</code></pre>
      <p>
        The <code>webjsui</code> binary is standalone, it does NOT require <code>@webjskit/cli</code>.
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
        Components are dependency-free, positioning, focus trap, toast queue are all hand-rolled.
      </p>
      <h2>Usage</h2>
      <p>Tier 1, apply helpers to native elements:</p>
      <pre><code class="block bg-muted p-4 rounded">import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, buttonClass }
  from './components/ui';

&lt;div class={cardClass()}&gt;
  &lt;div class={cardHeaderClass()}&gt;
    &lt;h3 class={cardTitleClass()}&gt;Hello&lt;/h3&gt;
    &lt;p class={cardDescriptionClass()}&gt;A card from a class helper.&lt;/p&gt;
  &lt;/div&gt;
  &lt;div class={cardContentClass()}&gt;
    &lt;button class={buttonClass({ variant: 'default' })}&gt;Click me&lt;/button&gt;
  &lt;/div&gt;
&lt;/div&gt;</code></pre>
      <p>Tier 2, use the custom element where state matters:</p>
      <pre><code class="block bg-muted p-4 rounded">&lt;ui-dialog&gt;
  &lt;ui-dialog-trigger&gt;
    &lt;button class={buttonClass({ variant: 'outline' })}&gt;Edit profile&lt;/button&gt;
  &lt;/ui-dialog-trigger&gt;
  &lt;ui-dialog-content&gt;
    &lt;h2 class={dialogTitleClass()}&gt;Edit profile&lt;/h2&gt;
    &lt;form action="/profile" method="post"&gt;&hellip;&lt;/form&gt;
  &lt;/ui-dialog-content&gt;
&lt;/ui-dialog&gt;</code></pre>
      <h2>Framework support</h2>
      <p>
        Tier-1 helpers are pure functions, no runtime dependency. Tier-2 custom elements
        extend <code>WebComponent</code> from <code>@webjskit/core</code> (the lightweight
        reactive base class). Both work in webjs, Next.js, Astro, Vite, Remix, SvelteKit,
        Nuxt, SolidStart, Lit projects, and plain HTML. Tailwind v4 is the only required
        styling dependency.
      </p>
    </article>
  `;
}
