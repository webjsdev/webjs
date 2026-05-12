import { html } from '@webjskit/core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// app/docs/layout.ts is 2 levels deep inside the website (app → docs).
// Walk 3 levels up to reach packages/ui/packages/, then down into registry/r.
const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'registry', 'r');

/**
 * Shadcn-style docs shell: sidebar (component list, getting started) on the
 * left, content on the right. The sidebar is generated from the registry
 * index at request time so adding a new component to the registry shows up
 * here automatically.
 */
export default function DocsLayout({ children }: { children: unknown }) {
  const indexPath = join(REGISTRY_DIR, 'index.json');
  let components: Array<{ name: string; type: string }> = [];
  if (existsSync(indexPath)) {
    components = JSON.parse(readFileSync(indexPath, 'utf8')).filter((i: any) => i.type === 'registry:ui');
  }

  return html`
    <div class="grid lg:grid-cols-[220px_1fr] gap-8 -mt-10">
      <aside class="hidden lg:block sticky top-4 self-start h-[calc(100vh-2rem)] overflow-y-auto py-10 text-sm">
        <div class="font-semibold mb-2" style="color: var(--fg)">Getting Started</div>
        <nav class="flex flex-col gap-1 mb-6">
          <a href="/docs" style="color: var(--fg-muted)" class="py-1 hover:text-foreground">Introduction</a>
          <a href="/" style="color: var(--fg-muted)" class="py-1 hover:text-foreground">All components</a>
        </nav>
        <div class="font-semibold mb-2" style="color: var(--fg)">Components <span class="font-normal text-xs" style="color: var(--fg-subtle)">(${components.length})</span></div>
        <nav class="flex flex-col gap-0.5">
          ${components.map(
            (c) => html`
              <a
                href="/docs/components/${c.name}"
                style="color: var(--fg-muted)"
                class="py-1 px-2 -mx-2 rounded hover:bg-accent hover:text-foreground transition-colors"
              >${c.name}</a>
            `,
          )}
        </nav>
      </aside>
      <div class="min-w-0 py-10">${children}</div>
    </div>
  `;
}
