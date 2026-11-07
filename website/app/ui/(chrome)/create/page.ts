import { html } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { parseCreateParams } from '#modules/ui/create/params.ts';
import { customizer } from '#modules/ui/create/customizer.ts';
import { previewFrame } from '#modules/ui/create/preview-frame.ts';
import { projectForm } from '#modules/ui/create/project-form.ts';
import { welcomeDialog } from '#modules/ui/create/welcome-dialog.ts';
import { openPreset } from '#modules/ui/create/open-preset.ts';
import { explorerItems } from '#modules/ui/queries/create-items.server.ts';
// The behaviour around the server's markup. A page never hydrates, so it
// imports the element to register it.
import '#components/create-customizer.ts';

/**
 * /ui/create, the design-system configurator, ported from shadcn/ui's
 * apps/v4/app/(app)/(create)/create/page.tsx (#1666).
 *
 * shadcn's layout and classes: the dark customizer on the left, the framed
 * preview filling the rest. The state is the query string (`?preset=<code>`,
 * or the fields one by one, modules/ui/create/params.ts), parsed here, so both
 * panels are right on the first paint and a link to a design system is a link
 * to this page. The customizer is a GET form, so the page works with
 * JavaScript off; <create-customizer> applies a choice the moment it is made.
 *
 * What it builds is installed by the command in its footer,
 * `npx @webjsdev/ui init --preset <code>`, from the same theme data the
 * preview is painted with (packages/ui/packages/registry/themes/).
 *
 * `data-slot="designer"` makes the /ui chrome take exactly the viewport with
 * no footer, as on the typeset builder.
 */

export const metadata: Metadata = {
  title: 'New Project',
  description: 'Customize everything. Pick your style, base color, theme, fonts, radius and icons, and create your own version of WebJs UI.',
};

export default async function CreatePage({ searchParams }: PageProps) {
  const params = parseCreateParams(await searchParams);
  const groups = await explorerItems();
  return html`
    <main id="main" tabindex="-1" class="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <create-customizer data-slot="designer" class="style-nova flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        ${previewFrame(params, groups)}
        ${customizer(params)}
        ${projectForm(params)}
        ${openPreset(params)}
        ${welcomeDialog()}
      </create-customizer>
    </main>
  `;
}
