import { html } from '@webjskit/core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notFound } from '@webjskit/core';

// app/docs/components/[name]/page.ts is 5 levels deep inside website/
// (app → docs → components → [name] → page.ts). We need to reach
// packages/ui/packages/registry/r/. From here that's five `..` to land in
// `packages/ui/packages/`, then down into `registry/r`.
const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'registry', 'r');

export function generateMetadata({ params }: { params: { name: string } }) {
  return { title: `${params.name} — @webjskit/ui` };
}

export default function ComponentDoc({ params }: { params: { name: string } }) {
  const p = join(REGISTRY_DIR, `${params.name}.json`);
  if (!existsSync(p)) throw notFound();

  const item = JSON.parse(readFileSync(p, 'utf8'));
  const source = item.files?.[0]?.content || '';
  const deps = [...(item.dependencies || []), ...(item.registryDependencies || [])];

  return html`
    <a href="/" class="text-sm text-muted-foreground hover:text-foreground">← All components</a>
    <h1 class="text-3xl font-bold tracking-tight mt-4">${item.name}</h1>
    ${item.description ? html`<p class="text-muted-foreground mt-2">${item.description}</p>` : ''}

    <div class="mt-6 flex flex-wrap gap-2 text-sm">
      <span class="rounded-md border px-2 py-1">${item.type}</span>
      ${(deps || []).map((d: string) => html`<code class="rounded-md bg-muted px-2 py-1 text-xs">${d}</code>`)}
    </div>

    <section class="mt-10">
      <h2 class="text-xl font-semibold mb-3">Install</h2>
      <pre class="bg-muted p-4 rounded-md overflow-x-auto"><code>npx webjsui add ${item.name}</code></pre>
    </section>

    <section class="mt-10">
      <h2 class="text-xl font-semibold mb-3">Source</h2>
      <pre class="bg-muted p-4 rounded-md overflow-x-auto text-xs"><code>${source}</code></pre>
    </section>
  `;
}
