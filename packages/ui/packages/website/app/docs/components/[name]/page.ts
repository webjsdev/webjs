import { html, unsafeHTML, notFound } from '@webjskit/core';
import { getExample, getVariantExamples, getSizeExamples } from './examples.ts';
import { getComponentApi, type ComponentApi } from './component-api.ts';
import { loadRegistryItem } from '../../../_lib/registry.server.ts';

// ---------------------------------------------------------------------------
// Side-effect imports — load every ui-* component module so the custom
// elements register, and the preview pane can render any of them. Modules
// are copied from the registry into `components/ui/` at prestart
// (see `scripts/copy-registry.js`), so the same source webjs serves to the
// browser is what SSR uses.
// ---------------------------------------------------------------------------
import '../../../../components/ui/accordion.ts';
import '../../../../components/ui/alert.ts';
import '../../../../components/ui/alert-dialog.ts';
import '../../../../components/ui/aspect-ratio.ts';
import '../../../../components/ui/avatar.ts';
import '../../../../components/ui/badge.ts';
import '../../../../components/ui/breadcrumb.ts';
import '../../../../components/ui/button.ts';
// NOTE: calendar.ts is intentionally NOT imported here — its `default` import
// of `date-fns` doesn't round-trip through webjs's auto-vendor bundler, and
// its SSR path calls DOM APIs that aren't available in linkedom. The
// calendar example renders a static visual scaffold instead.
import '../../../../components/ui/card.ts';
import '../../../../components/ui/checkbox.ts';
import '../../../../components/ui/collapsible.ts';
import '../../../../components/ui/dialog.ts';
import '../../../../components/ui/dropdown-menu.ts';
import '../../../../components/ui/hover-card.ts';
import '../../../../components/ui/input.ts';
import '../../../../components/ui/kbd.ts';
import '../../../../components/ui/label.ts';
import '../../../../components/ui/native-select.ts';
import '../../../../components/ui/pagination.ts';
import '../../../../components/ui/popover.ts';
import '../../../../components/ui/progress.ts';
import '../../../../components/ui/radio-group.ts';
import '../../../../components/ui/separator.ts';
import '../../../../components/ui/skeleton.ts';
import '../../../../components/ui/sonner.ts';
import '../../../../components/ui/switch.ts';
import '../../../../components/ui/table.ts';
import '../../../../components/ui/tabs.ts';
import '../../../../components/ui/textarea.ts';
import '../../../../components/ui/toggle.ts';
import '../../../../components/ui/toggle-group.ts';
import '../../../../components/ui/tooltip.ts';

export function generateMetadata({ params }: { params: { name: string } }) {
  return { title: `${params.name} — Webjs UI` };
}

// Helper — renders a single preview pane around an example snippet.
// Used by the hero preview, the per-variant cards, and the per-size cards.
// Light DOM is required because ui-* custom elements capture their innerHTML
// in connectedCallback (which doesn't run during SSR). unsafeHTML defers
// rendering to the browser where the upgrade fires correctly.
function previewPane(snippet: string, opts: { minH?: string } = {}) {
  const minH = opts.minH ?? '160px';
  return html`
    <div
      class="rounded-lg border p-8 flex items-center justify-center gap-4 bg-background text-foreground"
      style="min-height: ${minH}"
    >
      ${unsafeHTML(snippet)}
    </div>
  `;
}

function startCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ComponentDoc({ params }: { params: { name: string } }) {
  const item = await loadRegistryItem(params.name);
  if (!item) throw notFound();

  const source = item.files?.[0]?.content || '';
  const npmDeps = (item.dependencies || []).filter((d: string) => d !== '@webjskit/core');
  const registryDeps = item.registryDependencies || [];
  const example = getExample(params.name);
  const api: ComponentApi | null = getComponentApi(params.name);
  const variantExamples = getVariantExamples(params.name);
  const sizeExamples = getSizeExamples(params.name);

  return html`
    <a href="/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path>
      </svg>
      All components
    </a>

    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight" style="color: var(--fg)">${item.name}</h1>
      ${item.description ? html`<p class="mt-2 text-base text-muted-foreground">${item.description}</p>` : ''}
      <div class="mt-4 flex flex-wrap gap-2 text-xs">
        <span class="rounded-md border px-2 py-1" style="color: var(--fg-muted)">${item.type.replace('registry:', '')}</span>
        ${registryDeps.map((d: string) => html`<a href="/docs/components/${d}" class="rounded-md border px-2 py-1 hover:bg-accent" style="color: var(--fg-muted)">↳ ${d}</a>`)}
        ${npmDeps.map((d: string) => html`<code class="rounded-md px-2 py-1 text-[11px]" style="background: var(--bg-subtle); color: var(--fg-muted)">${d}</code>`)}
      </div>
    </header>

    ${
      example
        ? html`
          <section class="mb-12">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-medium" style="color: var(--fg-muted)">Preview</h2>
            </div>
            <!--
              The preview is injected client-side rather than SSR'd because the
              ui-* components capture their innerHTML in connectedCallback (which
              doesn't run during webjs SSR). SSR would emit an empty inner button
              followed by stray child text. By writing the example template into
              the DOM client-side, the custom-element parser instantiates each
              component fresh, connectedCallback captures innerHTML correctly, and
              the rendered output looks right.
            -->
            ${previewPane(example, { minH: '280px' })}
          </section>
        `
        : html`
          <section class="mb-12">
            <div class="rounded-lg border p-8 text-sm text-muted-foreground" style="background: var(--bg-subtle)">
              No live preview available for this component yet. The source code below shows
              the full implementation; <code>webjs ui add ${item.name}</code> copies it into your project.
            </div>
          </section>
        `
    }

    <section class="mb-12">
      <h2 class="text-base font-medium mb-3" style="color: var(--fg-muted)">Installation</h2>
      <pre class="rounded-lg p-4 overflow-x-auto"><code>npx webjsui add ${item.name}</code></pre>
      <p class="mt-3 text-sm text-muted-foreground">Webjs users — also available as:</p>
      <pre class="rounded-lg p-4 overflow-x-auto mt-1"><code>webjs ui add ${item.name}</code></pre>
    </section>

    ${
      api?.variants && variantExamples
        ? html`
          <section class="mb-12">
            <h2 class="text-base font-medium mb-3" style="color: var(--fg-muted)">Variants</h2>
            <div class="grid gap-4">
              ${api.variants.map((v: string) =>
                variantExamples[v]
                  ? html`
                      <div>
                        <h3 class="text-sm font-medium mb-2" style="color: var(--fg)">${startCase(v)}</h3>
                        ${previewPane(variantExamples[v])}
                      </div>
                    `
                  : '',
              )}
            </div>
          </section>
        `
        : ''
    }

    ${
      api?.sizes && sizeExamples
        ? html`
          <section class="mb-12">
            <h2 class="text-base font-medium mb-3" style="color: var(--fg-muted)">Sizes</h2>
            <div class="grid gap-4">
              ${api.sizes.map((s: string) =>
                sizeExamples[s]
                  ? html`
                      <div>
                        <h3 class="text-sm font-medium mb-2" style="color: var(--fg)">${startCase(s)}</h3>
                        ${previewPane(sizeExamples[s])}
                      </div>
                    `
                  : '',
              )}
            </div>
          </section>
        `
        : ''
    }

    ${
      api && (api.props?.length || api.subcomponents?.length || api.events?.length)
        ? html`
          <section class="mb-12">
            <h2 class="text-base font-medium mb-3" style="color: var(--fg-muted)">API Reference</h2>

            ${
              api.subcomponents?.length
                ? html`
                  <div class="mb-6">
                    <h3 class="text-sm font-medium mb-2" style="color: var(--fg)">Parts</h3>
                    <div class="rounded-lg border overflow-hidden">
                      <table class="w-full text-sm">
                        <thead style="background: var(--bg-subtle)">
                          <tr class="text-left">
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Name</th>
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${api.subcomponents.map(
                            (p) => html`
                              <tr class="border-t">
                                <td class="px-3 py-2 align-top"><code class="text-xs">${p.name}</code></td>
                                <td class="px-3 py-2 align-top text-muted-foreground">${p.description}</td>
                              </tr>
                            `,
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `
                : ''
            }

            ${
              api.props?.length
                ? html`
                  <div class="mb-6">
                    <h3 class="text-sm font-medium mb-2" style="color: var(--fg)">Props</h3>
                    <div class="rounded-lg border overflow-hidden">
                      <table class="w-full text-sm">
                        <thead style="background: var(--bg-subtle)">
                          <tr class="text-left">
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Prop</th>
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Type</th>
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Default</th>
                            ${api.props.some((p) => p.description)
                              ? html`<th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Description</th>`
                              : ''}
                          </tr>
                        </thead>
                        <tbody>
                          ${api.props.map(
                            (p) => html`
                              <tr class="border-t">
                                <td class="px-3 py-2 align-top"><code class="text-xs">${p.name}</code></td>
                                <td class="px-3 py-2 align-top"><code class="text-xs">${p.type}</code></td>
                                <td class="px-3 py-2 align-top text-muted-foreground">${p.default ?? '—'}</td>
                                ${api.props!.some((q) => q.description)
                                  ? html`<td class="px-3 py-2 align-top text-muted-foreground">${p.description ?? ''}</td>`
                                  : ''}
                              </tr>
                            `,
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `
                : ''
            }

            ${
              api.events?.length
                ? html`
                  <div>
                    <h3 class="text-sm font-medium mb-2" style="color: var(--fg)">Events</h3>
                    <div class="rounded-lg border overflow-hidden">
                      <table class="w-full text-sm">
                        <thead style="background: var(--bg-subtle)">
                          <tr class="text-left">
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Name</th>
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Detail</th>
                            <th class="px-3 py-2 font-medium" style="color: var(--fg-muted)">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${api.events.map(
                            (e) => html`
                              <tr class="border-t">
                                <td class="px-3 py-2 align-top"><code class="text-xs">${e.name}</code></td>
                                <td class="px-3 py-2 align-top"><code class="text-xs">${e.detail ?? '—'}</code></td>
                                <td class="px-3 py-2 align-top text-muted-foreground">${e.description ?? ''}</td>
                              </tr>
                            `,
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `
                : ''
            }
          </section>
        `
        : ''
    }

    <section>
      <h2 class="text-base font-medium mb-3" style="color: var(--fg-muted)">Source — <code class="text-xs px-1.5 py-0.5 rounded" style="background: var(--bg-subtle)">components/ui/${item.name}.ts</code></h2>
      <pre class="rounded-lg p-4 overflow-x-auto text-xs max-h-[480px] overflow-y-auto"><code>${source}</code></pre>
    </section>
  `;
}
