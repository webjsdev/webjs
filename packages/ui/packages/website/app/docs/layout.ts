import { html } from '@webjskit/core';
import { loadRegistryIndex } from '../_lib/registry.server.ts';

/**
 * Shadcn-style docs shell: sidebar (component list, getting started) on the
 * left, content on the right. The sidebar is generated from the registry
 * index at request time so adding a new component to the registry shows up
 * here automatically.
 */
export default async function DocsLayout({ children }: { children: unknown }) {
  const all = await loadRegistryIndex();
  const components = all.filter((i) => i.type === 'registry:ui');

  // Shared link styling: padded, rounded, with a noticeable hover background.
  // The negative -mx-2 + matching px-2 extends the hover hit-area without
  // shifting the text. Using `bg-fg/10` (semi-transparent foreground) instead
  // of `bg-accent` because shadcn's accent in light mode is oklch(0.97 0 0) —
  // near-white against a white page background, almost invisible on hover.
  const linkClass =
    'block py-1.5 px-2 -mx-2 rounded-md text-fg-muted hover:bg-fg/10 hover:text-fg transition-colors';

  return html`
    <div class="grid lg:grid-cols-[220px_1fr] gap-8 -mt-10">
      <aside class="hidden lg:block sticky top-4 self-start h-[calc(100vh-2rem)] overflow-y-auto py-10 text-sm">
        <div class="font-semibold mb-2 text-fg">Getting Started</div>
        <nav class="flex flex-col gap-0.5 mb-6">
          <a href="/docs" class=${linkClass}>Introduction</a>
          <a href="/" class=${linkClass}>All components</a>
        </nav>
        <div class="font-semibold mb-2 text-fg">Components <span class="font-normal text-xs text-fg-subtle">(${components.length})</span></div>
        <nav class="flex flex-col gap-0.5">
          ${components.map(
            (c) => html`<a href="/docs/components/${c.name}" class=${linkClass}>${c.name}</a>`,
          )}
        </nav>
      </aside>
      <div class="min-w-0 py-10">${children}</div>
    </div>
  `;
}
