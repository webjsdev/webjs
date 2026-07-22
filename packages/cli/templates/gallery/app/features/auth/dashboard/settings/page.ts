import { html } from '@webjsdev/core';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';

export const metadata = { title: 'Settings' };

export default async function Settings() {
  const user = await currentUser();
  return html`
    <h1 class="text-2xl font-semibold mb-6">Settings</h1>
    <div class="p-6 rounded-2xl bg-card border border-border">
      <h2 class="text-lg font-semibold text-foreground m-0 mb-1">Account</h2>
      <p class="text-sm text-muted-foreground m-0 mb-4">Your basic profile information.</p>
      <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt class="text-muted-foreground">Email</dt>
        <dd>${user?.email}</dd>
        <dt class="text-muted-foreground">Name</dt>
        <dd>${user?.name || 'Not set'}</dd>
      </dl>
    </div>
  `;
}
