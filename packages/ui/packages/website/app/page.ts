import { html } from '@webjskit/core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    <section class="mb-12">
      <h1 class="text-4xl font-bold tracking-tight">Web components, shadcn style.</h1>
      <p class="mt-4 text-lg text-muted-foreground max-w-2xl">
        A registry of beautifully designed web components. Copy-paste into any project that supports
        Tailwind v4 and custom elements — webjs, Next.js, Astro, Vite, Lit, vanilla HTML.
      </p>
      <div class="mt-6 flex gap-3">
        <a href="/docs" class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Get started</a>
        <a href="https://github.com/vivek7405/webjs" class="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">GitHub</a>
      </div>

      <div class="mt-8 grid md:grid-cols-2 gap-4">
        <div class="border rounded-lg p-4">
          <div class="text-sm font-semibold mb-2">Webjs users</div>
          <pre class="text-xs p-3 rounded overflow-x-auto"><code># included with @webjskit/cli
webjs ui init
webjs ui add button card dialog</code></pre>
        </div>
        <div class="border rounded-lg p-4">
          <div class="text-sm font-semibold mb-2">Next / Astro / Vite / Lit / anything else</div>
          <pre class="text-xs p-3 rounded overflow-x-auto"><code>npm install -D @webjskit/ui
npm install @webjskit/core
npx webjsui init
npx webjsui add button card dialog</code></pre>
        </div>
      </div>
    </section>
    <section>
      <h2 class="text-2xl font-semibold mb-6">Components <span class="text-sm font-normal text-muted-foreground">(${ui.length})</span></h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        ${ui.map(
          (it) => html`
            <a href="/docs/components/${it.name}" class="block border rounded-lg p-4 hover:bg-accent transition">
              <div class="font-medium">${it.name}</div>
              ${it.description ? html`<div class="text-sm text-muted-foreground mt-1">${it.description}</div>` : ''}
            </a>
          `
        )}
      </div>
    </section>
  `;
}
