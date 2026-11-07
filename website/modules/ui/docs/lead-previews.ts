import type { PreviewOptions } from '#lib/ui/docs/preview.ts';

/**
 * How each component page shows its lead demo (#1666): the props shadcn's
 * content/docs/components/radix/<slug>.mdx passes to its first
 * <ComponentPreview> (styleName, align, previewClassName, className,
 * hideCode, direction), generated from the clone. A page not listed takes
 * the defaults: the nova style, centred, at h-72.
 *
 * A docs module's own `demoOptions` overrides an entry here. A style other
 * than nova and new-york needs its stylesheet, which website/lib/ui/style-links.ts
 * links for these pages from the same table.
 */
export const LEAD_PREVIEWS: Record<string, PreviewOptions> = {
  'accordion': { align: "start", previewClass: "*:data-[slot=accordion]:max-w-sm h-[300px]" },
  'alert': { previewClass: "h-auto sm:h-72 p-6" },
  'alert-dialog': { previewClass: "h-56" },
  'attachment': { style: "rhea", previewClass: "h-auto theme-blue bg-surface dark:bg-background" },
  'breadcrumb': { previewClass: "p-2" },
  'bubble': { style: "rhea", previewClass: "h-auto theme-blue" },
  'calendar': { previewClass: "h-96" },
  'card': { previewClass: "h-[30rem]" },
  'carousel': { previewClass: "h-80 sm:h-[32rem]" },
  'chart': { className: "theme-blue [&_.preview]:h-auto [&_.preview]:p-0 [&_.preview]:lg:min-h-[404px] [&_.preview>div]:w-full [&_.preview>div]:border-none [&_.preview>div]:shadow-none", hideCode: true },
  'checkbox': { previewClass: "h-80" },
  'code-block': { style: "rhea", previewClass: "h-auto" },
  'collapsible': { align: "start" },
  'command': { align: "start", previewClass: "h-[24.5rem]" },
  'data-table': { align: "start", previewClass: "items-start h-auto px-4 md:px-8", hideCode: true },
  'direction': { previewClass: "h-auto", hideCode: true, direction: "rtl" },
  'empty': { previewClass: "h-96 p-0" },
  'field': { previewClass: "h-[800px] p-6 md:h-[850px]" },
  'hover-card': { previewClass: "h-80" },
  'input': { previewClass: "*:max-w-xs" },
  'input-group': { previewClass: "h-[26rem]" },
  'marker': { style: "rhea", previewClass: "h-auto theme-blue" },
  'message': { style: "rhea", previewClass: "h-auto theme-blue" },
  'message-scroller': { style: "rhea", previewClass: "h-auto theme-blue bg-surface dark:bg-background p-4 min-[480px]:p-8 min-[560px]:p-10 sm:px-10 sm:py-16", className: "rounded-[34px] sm:rounded-4xl" },
  'navigation-menu': { previewClass: "h-96", className: "overflow-visible" },
  'questionnaire': { align: "end", previewClass: "min-h-[560px] p-4 sm:p-8" },
  'resizable': { previewClass: "h-80" },
  'scroll-area': { previewClass: "h-96" },
  'table': { previewClass: "h-[30rem]" },
  'tabs': { previewClass: "h-96" },
  'textarea': { previewClass: "*:max-w-xs" },
  'trace': { style: "rhea", previewClass: "h-auto" },
  'typography': { className: "[&_.preview]:h-auto!", hideCode: true },
};
