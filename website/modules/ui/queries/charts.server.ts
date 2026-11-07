'use server';

import { renderToString } from '@webjsdev/core/server';
import { loadRegistryIndex } from './registry.server.ts';
import { blockDisplay } from './blocks.server.ts';

/**
 * The chart blocks the /ui/charts pages show (#1666): which charts a chart
 * type has, and one chart rendered with its source.
 *
 * A chart is a `registry:block` whose categories are `chart` plus its type
 * (`["chart", "area"]`). Its page renders the site's mirror of the block
 * (modules/ui/blocks/charts/<name>.ts, written by scripts/copy-registry.mjs
 * with its kit imports pointed at the site's one kit instance), so a chart
 * on these pages is exactly the source `add` installs, and the code shown
 * is that file as `add` writes it. The same details as render-demo.server.ts
 * hold: custom elements are left unexpanded (`ssr: false`) so the page's own
 * render expands each once, and the name is checked against the registry
 * before anything is imported, since an RPC-callable function must not be a
 * path traversal.
 */

export interface ChartSummary {
  name: string;
  title: string;
  description: string;
  type: string;
}

export interface RenderedChart extends ChartSummary {
  html: string;
  /** The block's file as `add` writes it. */
  source: string;
  /** Where `add` writes it. */
  target: string;
}

/** Every chart block, optionally of one type, in registry order. */
export async function listCharts(type?: string): Promise<ChartSummary[]> {
  const index = await loadRegistryIndex();
  return index
    .filter((it) => it.type === 'registry:block' && (it.categories || []).includes('chart'))
    .map((it) => ({
      name: it.name,
      title: it.title ?? it.name,
      description: it.description ?? '',
      type: (it.categories || []).find((c) => c !== 'chart') ?? '',
    }))
    .filter((c) => !type || c.type === type);
}

/** One chart block rendered, with its source, or null for a name that is not one. */
export async function renderChart(name: string): Promise<RenderedChart | null> {
  if (typeof name !== 'string') return null;
  const summary = (await listCharts()).find((c) => c.name === name);
  if (!summary) return null;
  const display = await blockDisplay(name);
  const file = display?.files[0];
  if (!file) return null;
  const mod = await import(`../blocks/charts/${name}.ts`);
  const html = await renderToString(mod.default(), { ssr: false });
  return { ...summary, html, source: file.source, target: file.target };
}
