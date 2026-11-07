import type { Metadata, PageProps } from '@webjsdev/core';
import { examplesShell } from '#lib/ui/examples-shell.ts';
import { playground } from '#modules/ui/example-apps/playground/playground.ts';
// The example's interactive parts. A page never hydrates, so it imports the
// elements its markup uses to register them.
import '#modules/ui/components/alert-dialog.ts';
import '#modules/ui/components/command.ts';
import '#modules/ui/components/dialog.ts';
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/hover-card.ts';
import '#modules/ui/components/slider.ts';
import '#modules/ui/components/sonner.ts';
import '#modules/ui/components/switch.ts';
import '#modules/ui/components/tabs.ts';
import '#modules/ui/example-apps/example-bind.ts';

/**
 * /ui/examples/playground, shadcn/ui's apps/v4/app/(app)/examples/playground
 * (#1666): the OpenAI playground, built from the kit's components.
 */

export const metadata: Metadata = {
  title: 'Playground | WebJs UI',
  description: 'The OpenAI Playground built using the components.',
};

export default function PlaygroundPage({ url }: Pick<PageProps, 'url'>) {
  return examplesShell(new URL(url).pathname, 'playground', playground());
}
