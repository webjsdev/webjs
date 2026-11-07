import { html, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { listCharts } from '#modules/ui/queries/charts.server.ts';
import { chartsShell, chartDisplay, CHART_TYPES, CHARTS_DESCRIPTION } from '#lib/ui/charts-shell.ts';

/**
 * /ui/charts/<type>, every chart of one type, ported from shadcn/ui's
 * apps/v4/app/(app)/charts/[type]/page.tsx (#1666): a three column grid of
 * chart displays in shadcn's order, the interactive chart spanning the row,
 * padded to twelve cells with dashed placeholders as shadcn's is. A type with
 * no chart shipped yet is a 404.
 */

export async function generateMetadata({ params }: PageProps<'/ui/charts/[type]'>) {
  const type = CHART_TYPES.find((t) => t.type === params.type);
  return type
    ? { title: `${params.type.charAt(0).toUpperCase() + params.type.slice(1)} Charts | WebJs UI`, description: CHARTS_DESCRIPTION }
    : {};
}

export default async function ChartTypePage({ params, url }: PageProps<'/ui/charts/[type]'>) {
  const type = CHART_TYPES.find((t) => t.type === params.type);
  if (!type) notFound();
  const shipped = new Set((await listCharts(type.type)).map((c) => c.name));
  const charts = type.charts.filter((c) => shipped.has(c.id));
  if (!charts.length) notFound();
  const displays = await Promise.all(charts.map((c) => chartDisplay(c.id, { fullWidth: c.fullWidth })));
  const label = `${type.type.charAt(0).toUpperCase() + type.type.slice(1)} Charts`;
  return chartsShell(new URL(url).pathname, type.type, html`
    <div class="grid flex-1 gap-12 lg:gap-24">
      <h2 class="sr-only">${label}</h2>
      <div class="grid flex-1 scroll-mt-20 items-stretch gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-10">
        ${Array.from({ length: Math.max(12, displays.length) }, (_, i) => displays[i]
          ?? html`<div class="hidden aspect-square w-full rounded-lg border border-dashed xl:block"></div>`)}
      </div>
    </div>
  `);
}
