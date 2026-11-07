/**
 * Render a marketing page the way the server does: inside the `(site)` route
 * group's layout, inside the root layout.
 *
 * The root layout is the document shell only. The header, footer, glow and
 * skip link belong to `app/(site)/layout.ts`, so a test asserting on chrome
 * has to render both layouts, in the order the router nests them.
 */
import type { TemplateResult } from '@webjsdev/core';
import RootLayout from '#app/layout.ts';
import SiteLayout from '#app/(site)/layout.ts';
import { layoutProps } from '#test/helpers/layout-props.ts';

type Overrides = Parameters<typeof layoutProps>[1];

export function siteShell(children: TemplateResult, overrides: Overrides = {}) {
  return RootLayout(layoutProps(SiteLayout(layoutProps(children, overrides)), overrides));
}
