import { html } from '@webjskit/core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// app/docs/components/page.ts — 3 levels deep inside website/.
// Walk 4 ups to packages/ui/packages/, then down into registry/r.
const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'registry', 'r');

export const metadata = { title: 'Components — @webjskit/ui' };

export default function ComponentsIndex() {
  const indexPath = join(REGISTRY_DIR, 'index.json');
  let items: Array<{ name: string; type: string; description?: string }> = [];
  if (existsSync(indexPath)) {
    items = JSON.parse(readFileSync(indexPath, 'utf8'));
  }
  const ui = items.filter((i) => i.type === 'registry:ui').sort((a, b) => a.name.localeCompare(b.name));

  return html`
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight" style="color: var(--fg)">Components</h1>
      <p class="mt-2 text-base text-muted-foreground">
        All ${ui.length} components in the registry. Click any to see the live preview, install
        command, and full source.
      </p>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${ui.map(
        (it) => html`
          <a href="/docs/components/${it.name}" class="block border rounded-lg p-4 hover:bg-accent transition">
            <div class="font-medium" style="color: var(--fg)">${it.name}</div>
            ${it.description ? html`<div class="text-sm text-muted-foreground mt-1">${it.description}</div>` : ''}
          </a>
        `,
      )}
    </div>
  `;
}
