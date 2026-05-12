import { html, unsafeHTML } from '@webjskit/core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Side-effect imports — register the ui-* tags used in the hero demo.
import '../components/ui/button.ts';
import '../components/ui/card.ts';
import '../components/ui/input.ts';
import '../components/ui/label.ts';
import '../components/ui/badge.ts';
import '../components/ui/switch.ts';
import '../components/ui/separator.ts';
import '../components/ui/avatar.ts';
import '../components/ui/tabs.ts';
import '../components/ui/skeleton.ts';

const REGISTRY_DIR = resolveRegistryDir();

function resolveRegistryDir(): string {
  // packages/ui/packages/website/app/page.ts → ../../registry/r
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'registry', 'r');
}

export default function Home() {
  const indexPath = join(REGISTRY_DIR, 'index.json');
  let items: Array<{ name: string; type: string; description?: string }> = [];
  if (existsSync(indexPath)) {
    items = JSON.parse(readFileSync(indexPath, 'utf8'));
  }
  const ui = items.filter((i) => i.type === 'registry:ui');

  return html`
    <section class="mb-16 text-center max-w-3xl mx-auto">
      <h1 class="text-4xl sm:text-5xl font-bold tracking-tight" style="color: var(--fg)">
        Web components, shadcn style.
      </h1>
      <p class="mt-4 text-lg text-muted-foreground">
        A registry of beautifully designed web components — drop into webjs, Next, Astro, Vite,
        SvelteKit, Lit, or vanilla HTML. Source-copied into your project, you own it, you edit it.
      </p>
      <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
        <a href="/docs" class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Get started</a>
        <a href="/docs/components" class="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Browse components</a>
        <a href="https://github.com/vivek7405/webjs" class="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">GitHub</a>
      </div>
    </section>

    <!-- Live playground — composed components showing what you get out of the box -->
    <section class="mb-16">
      <div class="mb-4 text-sm font-medium" style="color: var(--fg-muted)">Live playground — these are real web components, rendered on this page.</div>
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Card 1: Sign-up form -->
        <ui-card class="w-full">
          <ui-card-header>
            <ui-card-title>Create an account</ui-card-title>
            <ui-card-description>Get started with @webjskit/ui. No build step required.</ui-card-description>
          </ui-card-header>
          <ui-card-content class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <ui-label for="demo-email">Email</ui-label>
              <ui-input id="demo-email" type="email" placeholder="m@example.com"></ui-input>
            </div>
            <div class="flex flex-col gap-2">
              <ui-label for="demo-password">Password</ui-label>
              <ui-input id="demo-password" type="password" placeholder="••••••••"></ui-input>
            </div>
            <div class="flex items-center gap-2">
              <ui-switch id="demo-newsletter"></ui-switch>
              <ui-label for="demo-newsletter">Send me product updates</ui-label>
            </div>
          </ui-card-content>
          <ui-card-footer class="flex flex-col gap-2 items-stretch">
            <ui-button>Create account</ui-button>
            <ui-button variant="outline">Continue with GitHub</ui-button>
          </ui-card-footer>
        </ui-card>

        <!-- Card 2: Profile / team summary -->
        <ui-card class="w-full">
          <ui-card-header>
            <ui-card-title>Team</ui-card-title>
            <ui-card-description>Invite your team members to collaborate.</ui-card-description>
          </ui-card-header>
          <ui-card-content class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <ui-avatar>
                <ui-avatar-image src="https://github.com/vivek7405.png" alt="Vivek"></ui-avatar-image>
                <ui-avatar-fallback>V</ui-avatar-fallback>
              </ui-avatar>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium" style="color: var(--fg)">Vivek</div>
                <div class="text-xs text-muted-foreground">vivek@webjs.dev</div>
              </div>
              <ui-badge>Owner</ui-badge>
            </div>
            <ui-separator></ui-separator>
            <div class="flex items-center gap-3">
              <ui-avatar><ui-avatar-fallback>AS</ui-avatar-fallback></ui-avatar>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium" style="color: var(--fg)">Aarav S.</div>
                <div class="text-xs text-muted-foreground">aarav@example.com</div>
              </div>
              <ui-badge variant="secondary">Editor</ui-badge>
            </div>
            <div class="flex items-center gap-3">
              <ui-avatar><ui-avatar-fallback>RG</ui-avatar-fallback></ui-avatar>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium" style="color: var(--fg)">Rhea G.</div>
                <div class="text-xs text-muted-foreground">rhea@example.com</div>
              </div>
              <ui-badge variant="outline">Viewer</ui-badge>
            </div>
          </ui-card-content>
          <ui-card-footer>
            <ui-button variant="outline" class="w-full">Invite member</ui-button>
          </ui-card-footer>
        </ui-card>
      </div>

      <!-- Tabs row -->
      <ui-card class="w-full mt-6">
        <ui-card-content class="py-6">
          <ui-tabs value="overview">
            <ui-tabs-list>
              <ui-tabs-trigger value="overview">Overview</ui-tabs-trigger>
              <ui-tabs-trigger value="analytics">Analytics</ui-tabs-trigger>
              <ui-tabs-trigger value="reports">Reports</ui-tabs-trigger>
            </ui-tabs-list>
            <ui-tabs-content value="overview" class="text-sm text-muted-foreground mt-4">
              All 55 shadcn components ported to web components. Buttons, cards, inputs, dialogs,
              forms, calendars, charts — every primitive your app needs, rendered as standards-compliant
              custom elements.
            </ui-tabs-content>
            <ui-tabs-content value="analytics" class="text-sm text-muted-foreground mt-4">
              Visual parity with shadcn-react. Tailwind utility classes, light/dark themes, the same
              data-attribute hooks (data-state, data-orientation) — your existing Tailwind overrides
              keep working.
            </ui-tabs-content>
            <ui-tabs-content value="reports" class="text-sm text-muted-foreground mt-4">
              Framework agnostic. Works in webjs, Next.js, Astro, Vite, SvelteKit, Nuxt, SolidStart,
              Lit projects, and plain HTML. One install of @webjskit/core (~12KB gzip), components
              copy-pasted into your repo.
            </ui-tabs-content>
          </ui-tabs>
        </ui-card-content>
      </ui-card>
    </section>

    <!-- Install snippets -->
    <section class="mb-16">
      <div class="mb-4 text-sm font-medium" style="color: var(--fg-muted)">Install</div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="border rounded-lg p-4">
          <div class="text-sm font-semibold mb-2" style="color: var(--fg)">Webjs users</div>
          <pre class="text-xs p-3 rounded overflow-x-auto"><code># included with @webjskit/cli
webjs ui init
webjs ui add button card dialog</code></pre>
        </div>
        <div class="border rounded-lg p-4">
          <div class="text-sm font-semibold mb-2" style="color: var(--fg)">Next / Astro / Vite / Lit / anything else</div>
          <pre class="text-xs p-3 rounded overflow-x-auto"><code>npm install -D @webjskit/ui
npm install @webjskit/core
npx webjsui init
npx webjsui add button card dialog</code></pre>
        </div>
      </div>
    </section>

    <!-- Browse all -->
    <section>
      <div class="flex items-end justify-between mb-4">
        <h2 class="text-2xl font-semibold" style="color: var(--fg)">Browse all <span class="text-sm font-normal" style="color: var(--fg-muted)">(${ui.length})</span></h2>
        <a href="/docs/components" class="text-sm hover:underline" style="color: var(--accent)">See all components →</a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        ${ui.slice(0, 12).map(
          (it) => html`
            <a href="/docs/components/${it.name}" class="block border rounded-lg p-3 hover:bg-accent transition">
              <div class="font-medium text-sm" style="color: var(--fg)">${it.name}</div>
            </a>
          `,
        )}
      </div>
    </section>
  `;
}
