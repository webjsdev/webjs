import { html } from '@webjsdev/core';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '#components/ui/card.ts';

export const metadata = { title: 'Settings' };

export default async function Settings() {
  const user = await currentUser();
  return html`
    <h1 class="text-2xl font-semibold mb-6">Settings</h1>
    <div class=${cardClass()}>
      <div class=${cardHeaderClass()}>
        <h2 class=${cardTitleClass()}>Account</h2>
        <p class=${cardDescriptionClass()}>Your basic profile information.</p>
      </div>
      <div class=${cardContentClass()}>
        <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted-foreground">Email</dt>
          <dd>${user?.email}</dd>
          <dt class="text-muted-foreground">Name</dt>
          <dd>${user?.name || 'Not set'}</dd>
        </dl>
      </div>
    </div>
  `;
}
