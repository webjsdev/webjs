import { html } from '@webjsdev/core';
import { uiElements } from './cards/ui-elements.ts';
import { sidebarNav } from './cards/sidebar-nav.ts';
import { savingsTargets, contributionHistory, claimableBalance, dividendIncome } from './cards/finance.ts';
import { newMilestone, payoutThreshold, accountAccess, qrConnect, payments } from './cards/forms.ts';
import { emptyDistributeTrack, analyticsCard, notificationSettings, powerUsage } from './cards/insights.ts';

/**
 * The home page's card grid, shadcn's CardsDemo
 * (apps/v4/app/(app)/(root)/cards/index.tsx), rendered in the rhea style
 * under the neutral theme as shadcn renders it.
 *
 * Columns appear with the viewport exactly as shadcn's do: one column on a
 * phone, two from md, three from lg, four from 1400px and five from 1900px,
 * with fades at the top and bottom.
 */
export function cardsDemo() {
  return html`
    <div data-slot="demo" class="theme-neutral relative flex w-full max-w-none flex-col gap-(--gap) overflow-hidden bg-muted p-12 pb-0! [--gap:--spacing(8)] min-[1900px]:p-12 min-[1900px]:[--gap:--spacing(10)]! lg:p-6 lg:[--gap:--spacing(6)] dark:bg-background">
      <div class="relative z-10 mx-auto grid gap-(--gap) **:data-[slot=card]:w-full min-[1400px]:grid-cols-4! min-[1900px]:grid-cols-5! md:max-w-3xl md:grid-cols-2 lg:max-w-none lg:grid-cols-3 xl:max-w-[1600px] 2xl:max-w-[1900px]">
        <div class="flex flex-col items-start gap-(--gap)">
          ${uiElements()}
          ${sidebarNav()}
          ${savingsTargets()}
        </div>
        <div class="hidden flex-col gap-(--gap) lg:flex">
          ${contributionHistory()}
          ${claimableBalance()}
          ${dividendIncome()}
        </div>
        <div class="hidden flex-col gap-(--gap) min-[1400px]:flex">
          ${newMilestone()}
          ${payoutThreshold()}
          ${accountAccess()}
        </div>
        <div class="hidden flex-col gap-(--gap) md:flex">
          ${qrConnect()}
          <div class="**:[.text-center.text-xs]:hidden">
            <message-scroller-demo></message-scroller-demo>
          </div>
          ${payments()}
        </div>
        <div class="hidden flex-col gap-(--gap) min-[1900px]:flex">
          ${emptyDistributeTrack()}
          ${analyticsCard()}
          ${notificationSettings()}
          ${powerUsage()}
        </div>
      </div>
      <div class="absolute inset-x-0 top-0 z-1 h-120 bg-linear-to-b from-background via-muted to-transparent dark:hidden"></div>
      <div class="absolute inset-x-0 bottom-0 z-20 h-48 bg-linear-to-t from-background via-muted/80 to-transparent lg:h-80 xl:h-64 dark:via-background/80"></div>
    </div>
  `;
}
