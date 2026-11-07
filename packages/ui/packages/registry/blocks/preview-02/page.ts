/**
 * The preview-02 block's page: thirty-odd finance, music-catalog and
 * smart-home cards laid out in seven columns, a preview of the kit's
 * components working together.
 *
 * Installed by `npx @webjsdev/ui add preview-02` at `app/preview-02/page.ts`,
 * with each card at `components/preview-02/<card>.ts`. It is app code you
 * own, so keep the cards you want and delete the rest. Ported from
 * shadcn/ui's preview-02, the page its design-system configurator previews.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { accountAccess } from './cards/account-access.ts';
import { cardOverview } from './cards/card-overview.ts';
import { claimableBalance } from './cards/claimable-balance.ts';
import { contributionHistory } from './cards/contribution-history.ts';
import { coverArt } from './cards/cover-art.ts';
import { dividendIncome } from './cards/dividend-income.ts';
import { emptyConnectBank } from './cards/empty-connect-bank.ts';
import { emptyDistributeTrack } from './cards/empty-distribute-track.ts';
import { emptyExploreCatalog } from './cards/empty-explore-catalog.ts';
import { faq } from './cards/faq.ts';
import { frontDoor } from './cards/front-door.ts';
import { indexInvesting } from './cards/index-investing.ts';
import { kitchenIsland } from './cards/kitchen-island.ts';
import { loadingCard } from './cards/loading-card.ts';
import { newMilestone } from './cards/new-milestone.ts';
import { notificationSettings } from './cards/notification-settings.ts';
import { payments } from './cards/payments.ts';
import { payoutThreshold } from './cards/payout-threshold.ts';
import { powerUsage } from './cards/power-usage.ts';
import { preferences } from './cards/preferences.ts';
import { qrConnect } from './cards/qr-connect.ts';
import { receivingMethod } from './cards/receiving-method.ts';
import { recentTransactions } from './cards/recent-transactions.ts';
import { releaseCatalog } from './cards/release-catalog.ts';
import { rollerShades } from './cards/roller-shades.ts';
import { savingsProgress } from './cards/savings-progress.ts';
import { savingsTargets } from './cards/savings-targets.ts';
import { sidebarNav } from './cards/sidebar-nav.ts';
import { socialLinks } from './cards/social-links.ts';
import { stockPerformance } from './cards/stock-performance.ts';
import { syncingState } from './cards/syncing-state.ts';
import { transferFunds } from './cards/transfer-funds.ts';
import { upcomingPayments } from './cards/upcoming-payments.ts';

export const metadata: Metadata = { title: 'Preview' };

const COLUMN = 'flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]';

export default function Preview02Page() {
  return html`
    <div class="overflow-x-auto overflow-y-hidden bg-muted contain-[paint] [--gap:--spacing(4)] 3xl:[--gap:--spacing(12)] md:[--gap:--spacing(10)] dark:bg-background style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div class="flex w-full min-w-max justify-center">
        <div data-slot="capture-target" class="grid w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] dark:bg-background style-lyra:md:w-[2600px] style-mira:md:w-[2600px] *:[div]:gap-(--gap)">
          <div class=${COLUMN}>
            ${contributionHistory()}
            ${emptyDistributeTrack()}
            ${qrConnect()}
            ${dividendIncome()}
            ${indexInvesting()}
            ${syncingState()}
          </div>
          <div class=${COLUMN}>
            ${payoutThreshold()}
            ${claimableBalance()}
            ${preferences()}
            ${savingsProgress()}
            ${kitchenIsland()}
          </div>
          <div class="col-span-2 flex flex-col p-1 [contain-intrinsic-size:760px_1200px] [content-visibility:auto]">
            ${savingsTargets()}
            ${recentTransactions()}
            <div class="grid grid-cols-2 items-start gap-(--gap)">
              <div class="flex flex-col gap-(--gap)">
                ${sidebarNav()}
                ${faq()}
              </div>
              <div class="flex flex-col gap-(--gap)">
                ${payments()}
                ${frontDoor()}
              </div>
            </div>
            ${releaseCatalog()}
          </div>
          <div class=${COLUMN}>
            ${accountAccess()}
            ${cardOverview()}
            ${transferFunds()}
            ${coverArt()}
            ${loadingCard()}
          </div>
          <div class=${COLUMN}>
            ${receivingMethod()}
            ${powerUsage()}
            ${emptyConnectBank()}
            ${upcomingPayments()}
            ${rollerShades()}
          </div>
          <div class=${COLUMN}>
            ${stockPerformance()}
            ${emptyExploreCatalog()}
            ${newMilestone()}
            ${socialLinks()}
            ${notificationSettings()}
          </div>
        </div>
      </div>
    </div>
  `;
}
