import type { Metadata, PageProps } from '@webjsdev/core';
import type { ActionResult } from '@webjsdev/server';
import { examplesShell } from '#lib/ui/examples-shell.ts';
import { authenticationExample } from '#modules/ui/example-apps/authentication/authentication.ts';

/**
 * /ui/examples/authentication, shadcn/ui's apps/v4/app/(app)/examples/authentication
 * (#1666), inside the examples frame. The form posts to this page through its
 * bound action: a failure re-renders here with `actionData`, a success
 * redirects back with `?sent=1`.
 */

export const metadata: Metadata = {
  title: 'Authentication | WebJs UI',
  description: 'Authentication forms built using the components.',
};

export default function AuthenticationExample({ url, actionData }: Pick<PageProps, 'url'> & { actionData?: ActionResult }) {
  const u = new URL(url);
  return examplesShell(u.pathname, 'authentication', authenticationExample({
    actionData,
    sent: u.searchParams.get('sent') === '1',
  }));
}
