import { html, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { examplesShell } from '#lib/ui/examples-shell.ts';
import { rtlComponents } from '#modules/ui/example-apps/rtl/rtl.ts';
import { readLang } from '#modules/ui/example-apps/rtl/translations.ts';
// The example's interactive parts. A page never hydrates, so it imports the
// elements its markup uses to register them.
import '#modules/ui/components/command.ts';
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/select.ts';
import '#modules/ui/components/slider.ts';
import '#modules/ui/components/switch.ts';
import '#modules/ui/components/tooltip.ts';
import '#modules/ui/example-apps/example-bind.ts';
import '#components/theme-selector.ts';

/**
 * /ui/examples/rtl, shadcn/ui's apps/v4/app/(app)/examples/rtl (#1666): the
 * kit right to left, in Arabic or Hebrew (`?lang=he`). It renders in the nova
 * style, the base-nova components shadcn's example imports, and in the
 * Arabic and Hebrew faces shadcn loads for it, from public/rtl-fonts.css,
 * which only this page links (the pattern /ui/sera uses for its faces).
 */

export const metadata: Metadata = {
  title: 'RTL | WebJs UI',
  description: 'RTL example page with right-to-left language support.',
};

export default async function RtlPage({ url, searchParams }: Pick<PageProps, 'url' | 'searchParams'>) {
  const lang = readLang((await searchParams).lang);
  return examplesShell(new URL(url), 'rtl', html`
    <link rel="stylesheet" href=${asset('/rtl-fonts.css')}>
    ${rtlComponents(lang)}
  `, { style: 'nova' });
}
