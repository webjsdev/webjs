import { html } from '@webjsdev/core';

export const metadata = { title: 'Docs, WebJs UI' };

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
      <h2>Install</h2>
      <p>
        Nothing to install. <code>@webjsdev/ui</code> is a hard dependency of <code>@webjsdev/cli</code>,
        so a global webjs install already includes it. Apps scaffolded with <code>webjs create</code>
        also list it in <code>devDependencies</code>.
      </p>
      <pre><code class="block bg-muted p-4 rounded">webjs ui init
webjs ui add button card dialog</code></pre>

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
      <pre><code class="block bg-muted p-4 rounded">import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '#components/ui/card.ts';
import { buttonClass } from '#components/ui/button.ts';

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
    &lt;h2 data-slot="dialog-title" class={dialogTitleClass()}&gt;Edit profile&lt;/h2&gt;
    &lt;form action="/profile" method="post"&gt;&hellip;&lt;/form&gt;
  &lt;/ui-dialog-content&gt;
&lt;/ui-dialog&gt;</code></pre>
      <h2>Accessibility</h2>
      <p>
        Tier-2 elements are accessible out of the box. Each one wires its own
        WAI-ARIA pattern, so you do not hand-add ARIA: tabs cross-links its triggers
        and panels and reports orientation, toggle-group uses a roving tabindex with
        Arrow / Home / End, dropdown-menu declares orientation and reflects
        <code>aria-disabled</code>, dialog and alert-dialog name themselves from their
        title (<code>data-slot="dialog-title"</code>) and description, tooltip wires
        <code>aria-describedby</code>, hover-card exposes
        <code>aria-haspopup</code> / <code>aria-expanded</code>, and sonner is a live region.
      </p>
      <p>
        Tier-1 class helpers return only classes, so the semantic element and ARIA are
        yours. Each helper's JSDoc carries an <code>A11y (required for accessible output)</code>
        block naming exactly what to supply: a name on an icon-only button, a role on an
        alert, <code>scope</code> on table headers, <code>alt</code> on an avatar image, a
        labelled <code>&lt;nav&gt;</code> with <code>aria-current="page"</code> on pagination
        and breadcrumb. Follow that block and the output is fully accessible.
      </p>
      <h2>Requirements</h2>
      <p>
        Tier-1 helpers are pure functions with no runtime dependency. Tier-2 custom elements
        extend <code>WebComponent</code> from <code>@webjsdev/core</code> (the lightweight
        reactive base class every WebJs app already ships). Tailwind v4 is the only required
        styling dependency.
      </p>
    </article>
  `;
}
