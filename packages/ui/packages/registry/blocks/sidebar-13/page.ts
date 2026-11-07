/**
 * The sidebar-13 block's page: a settings dialog with a sidebar inside it,
 * open on load, centred on an otherwise empty page.
 *
 * Installed by `npx @webjsdev/ui add sidebar-13` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-13.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { settingsDialog } from './components/settings-dialog.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <div class="flex h-svh items-center justify-center">
      ${settingsDialog()}
    </div>
  `;
}
