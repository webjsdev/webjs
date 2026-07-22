import { html } from '@webjsdev/core';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass } from '#components/ui/card.ts';
import { badgeClass } from '#components/ui/badge.ts';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const user = await currentUser();
  return html`
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      <span class=${badgeClass({ variant: 'secondary' })}>Signed in</span>
    </div>
    <div class=${cardClass()}>
      <div class=${cardHeaderClass()}>
        <h2 class=${cardTitleClass()}>Welcome, ${user?.name || user?.email}!</h2>
        <p class=${cardDescriptionClass()}>This route is gated by middleware.ts. Promote it into your product, or drop the whole auth card with gallery:clear.</p>
      </div>
    </div>
  `;
}
