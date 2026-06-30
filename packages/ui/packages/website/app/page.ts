import { html } from '@webjsdev/core';
import { loadRegistryIndex } from './_lib/registry.server.ts';
import { splitByTier } from './_lib/tier.ts';

export default async function Home() {
  const items = await loadRegistryIndex();
  const ui = items.filter((i) => i.type === 'registry:ui');
  const { tier1, tier2 } = splitByTier(ui);

  return html`
    <!-- Hero -->
    <section class="pt-2 pb-20 md:pt-16">
      <div class="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elev px-3 py-1 text-xs font-medium text-fg-muted">
        <span class="size-1.5 rounded-full bg-accent"></span>
        AI-first component library
      </div>
      <h1
        class="mt-6 font-bold text-fg max-w-3xl"
        style="font-family: var(--font-serif); font-size: var(--fs-display); line-height: 1.05; letter-spacing: -0.03em; text-wrap: balance;"
      >
        A component library<br />written for AI agents.
      </h1>
      <p
        class="text-fg-muted max-w-[60ch]"
        style="margin-top: var(--sp-5); font-size: var(--fs-lede); line-height: 1.55;"
      >
        ${ui.length} primitives designed for the agent era: copy‑paste source code,
        full native HTML semantics, shadcn API parity, zero third‑party dependencies.
        Works in WebJs, Next, Astro, Vite, Lit, vanilla, any project with Tailwind v4.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a
          href="/docs"
          class="group inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-fg! transition-colors hover:bg-brand-hover"
        >
          Get started
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
        <a
          href="https://github.com/webjsdev/webjs"
          class="inline-flex items-center rounded-full border border-border-strong bg-transparent px-5 py-3 text-sm font-semibold text-fg-muted transition-colors hover:text-fg hover:border-fg-muted"
        >
          View on GitHub
        </a>
      </div>
    </section>

    <!-- AI-first principles -->
    <section class="py-16">
      <div class="grid md:grid-cols-3 gap-6">
        <div>
          <div class="text-xs font-mono font-semibold uppercase tracking-widest text-brand mb-3">01 · Composition</div>
          <h3 class="text-lg font-semibold mb-2">Class helpers, not wrappers</h3>
          <p class="text-sm text-fg-muted leading-relaxed">
            Tier‑1 components are pure functions returning Tailwind class strings. AI
            agents compose with raw native HTML they already know, with no DSL, no JSX
            translation, and no projection complexity.
          </p>
        </div>
        <div>
          <div class="text-xs font-mono font-semibold uppercase tracking-widest text-brand mb-3">02 · Native semantics</div>
          <h3 class="text-lg font-semibold mb-2">Real elements, real forms</h3>
          <p class="text-sm text-fg-muted leading-relaxed">
            A button is a real <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;button&gt;</code>.
            A checkbox is a real <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;input&gt;</code>.
            Form submission, autofill, browser validation, screen readers: all work
            natively, never proxied.
          </p>
        </div>
        <div>
          <div class="text-xs font-mono font-semibold uppercase tracking-widest text-brand mb-3">03 · Zero dependencies</div>
          <h3 class="text-lg font-semibold mb-2">Auditable in an afternoon</h3>
          <p class="text-sm text-fg-muted leading-relaxed">
            No Radix, no clsx, no tailwind‑merge, no Floating UI, no Sonner.
            Hand‑rolled <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">cn()</code>,
            positioning, focus trap, toast queue. Every line is yours to read and edit.
          </p>
        </div>
      </div>
    </section>

    <!-- Install -->
    <section class="py-16">
      <h2 class="text-2xl font-semibold mb-6">Install</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-lg border border-border bg-bg-elev p-5">
          <div class="text-xs font-mono uppercase tracking-widest text-fg-muted mb-3">Webjs users</div>
          <pre class="text-sm font-mono pre-bare"><code># shipped with @webjsdev/cli
webjs ui init
webjs ui add button card dialog</code></pre>
        </div>
        <div class="rounded-lg border border-border bg-bg-elev p-5">
          <div class="text-xs font-mono uppercase tracking-widest text-fg-muted mb-3">Next · Astro · Vite · Lit · vanilla</div>
          <pre class="text-sm font-mono pre-bare"><code>npm install -D @webjsdev/ui
npm install @webjsdev/core
npx webjsui init
npx webjsui add button card dialog</code></pre>
        </div>
      </div>
    </section>

    <!-- Examples preview -->
    <section class="py-16">
      <h2 class="text-2xl font-semibold mb-2">How agents write it</h2>
      <p class="text-sm text-fg-muted mb-6">
        Idiomatic HTML + a named class helper. No state to thread, no wrappers to decode.
      </p>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="min-w-0 flex flex-col rounded-lg border border-border bg-bg-elev p-5">
          <div class="text-xs font-mono uppercase tracking-widest text-fg-muted mb-3">A form field</div>
          <pre class="scrollbar-thin flex-1 min-h-0 text-xs font-mono overflow-x-auto leading-relaxed pre-bare"><code>&lt;form class=\${stackClass({ gap: 'sm' })}&gt;
  &lt;div class=\${fieldClass()}&gt;
    &lt;label class=\${labelClass()} for="email"&gt;Email&lt;/label&gt;
    &lt;input class=\${inputClass()} id="email" type="email" required /&gt;
    &lt;p class=\${hintClass()}&gt;We'll send a link.&lt;/p&gt;
  &lt;/div&gt;
  &lt;button class=\${buttonClass({ size: 'sm' })} type="submit"&gt;Subscribe&lt;/button&gt;
&lt;/form&gt;</code></pre>
        </div>
        <div class="min-w-0 flex flex-col rounded-lg border border-border bg-bg-elev p-5">
          <div class="text-xs font-mono uppercase tracking-widest text-fg-muted mb-3">A dialog</div>
          <pre class="scrollbar-thin flex-1 min-h-0 text-xs font-mono overflow-x-auto leading-relaxed pre-bare"><code>&lt;ui-dialog&gt;
  &lt;ui-dialog-trigger&gt;
    &lt;button class=\${buttonClass({ variant: 'outline' })}&gt;Edit&lt;/button&gt;
  &lt;/ui-dialog-trigger&gt;
  &lt;ui-dialog-content&gt;
    &lt;h2 class=\${dialogTitleClass()}&gt;Delete project?&lt;/h2&gt;
    &lt;div class=\${dialogFooterClass()}&gt;
      &lt;ui-dialog-close&gt;&lt;button class=\${buttonClass({ variant: 'ghost' })}&gt;Cancel&lt;/button&gt;&lt;/ui-dialog-close&gt;
      &lt;button class=\${buttonClass({ variant: 'destructive' })}&gt;Delete&lt;/button&gt;
    &lt;/div&gt;
  &lt;/ui-dialog-content&gt;
&lt;/ui-dialog&gt;</code></pre>
        </div>
      </div>
    </section>

    <!-- Two tiers -->
    <section class="py-16">
      <h2 class="text-2xl font-semibold mb-2">Two tiers, one mental model</h2>
      <p class="text-sm text-fg-muted mb-6">
        Visual primitives are composable. Stateful primitives are custom elements.
      </p>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-lg border border-border bg-bg-elev p-6">
          <div class="text-xs font-mono uppercase tracking-widest text-brand mb-2">Tier 1</div>
          <h3 class="text-lg font-semibold mb-2">Class‑helper functions</h3>
          <p class="text-sm text-fg-muted mb-4">
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">buttonClass</code>,
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">cardClass</code>,
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">inputClass</code>…
            Apply to any native element. Same variants and sizes as shadcn.
          </p>
          <div class="text-xs text-fg-subtle">
            23 components · button, card, badge, alert, input, textarea, label,
            checkbox, switch, radio, native‑select, avatar, separator, skeleton,
            aspect‑ratio, kbd, table, toggle, breadcrumb, pagination, popover,
            accordion, collapsible
          </div>
        </div>
        <div class="rounded-lg border border-border bg-bg-elev p-6">
          <div class="text-xs font-mono uppercase tracking-widest text-brand mb-2">Tier 2</div>
          <h3 class="text-lg font-semibold mb-2">Stateful custom elements</h3>
          <p class="text-sm text-fg-muted mb-4">
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;ui-dialog&gt;</code>,
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;ui-tabs&gt;</code>,
            <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;ui-dropdown-menu&gt;</code>…
            Manage what the platform doesn't: keyboard nav for menus + tabs,
            hover‑with‑delay for tooltips, toast queue.
          </p>
          <div class="text-xs text-fg-subtle">
            9 components · dialog, alert‑dialog, tooltip, hover‑card,
            tabs, dropdown‑menu, sonner, progress, toggle‑group
          </div>
        </div>
      </div>
    </section>

    <!-- Components grid (split by tier) -->
    <section class="py-16">
      <div class="flex items-baseline justify-between mb-2">
        <h2 class="text-2xl font-semibold">All components</h2>
        <span class="text-sm text-fg-muted">${ui.length} primitives</span>
      </div>
      <p class="text-sm text-fg-muted mb-8">
        Grouped by composition tier. Pick Tier 1 by default. Reach for Tier 2
        only when the browser doesn't ship the behavior natively.
      </p>

      <!-- Tier 1 -->
      <div class="flex items-baseline justify-between mb-3">
        <div class="flex items-baseline gap-3">
          <span class="text-xs font-mono uppercase tracking-widest text-brand">Tier 1</span>
          <h3 class="text-lg font-semibold">Class‑helper functions</h3>
        </div>
        <span class="text-xs text-fg-muted">${tier1.length} components</span>
      </div>
      <p class="text-sm text-fg-muted mb-4">
        Apply <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">*Class()</code> to a real <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;button&gt;</code> / <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;input&gt;</code> / <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;div&gt;</code>. Native semantics, native a11y, native form submission.
      </p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-12">
        ${tier1.map(
    (it) => html`
            <a
              href="/docs/components/${it.name}"
              class="block rounded-lg border border-border bg-bg-elev p-4 transition-colors hover:bg-bg-subtle hover:border-border-strong"
            >
              <div class="font-medium text-fg">${it.name}</div>
              ${it.description
        ? html`<div class="text-xs text-fg-muted mt-1 line-clamp-2 leading-relaxed">${it.description}</div>`
        : ''}
            </a>
          `,
  )}
      </div>

      <!-- Tier 2 -->
      <div class="flex items-baseline justify-between mb-3">
        <div class="flex items-baseline gap-3">
          <span class="text-xs font-mono uppercase tracking-widest text-brand">Tier 2</span>
          <h3 class="text-lg font-semibold">Stateful custom elements</h3>
        </div>
        <span class="text-xs text-fg-muted">${tier2.length} components</span>
      </div>
      <p class="text-sm text-fg-muted mb-4">
        <code class="text-xs bg-bg-subtle px-1 py-0.5 rounded">&lt;ui-X&gt;</code> tags that manage open/close, keyboard nav, focus trap, escape, click‑outside. Import once in your layout.
      </p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        ${tier2.map(
    (it) => html`
            <a
              href="/docs/components/${it.name}"
              class="block rounded-lg border border-border bg-bg-elev p-4 transition-colors hover:bg-bg-subtle hover:border-border-strong"
            >
              <div class="font-medium text-fg">${it.name}</div>
              ${it.description
        ? html`<div class="text-xs text-fg-muted mt-1 line-clamp-2 leading-relaxed">${it.description}</div>`
        : ''}
            </a>
          `,
  )}
      </div>
    </section>
  `;
}
