import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardContentClass, cardFooterClass, cardActionClass,
} from '#modules/ui/components/card.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

/**
 * The /ui home page's skeleton rails, shadcn's CardsSkeletonRails
 * (apps/v4/app/(app)/(root)/cards/index.tsx and cards/skeleton/): two faded
 * columns of card-shaped skeletons either side of the grid, shown from
 * 2200px, where the five real columns stop filling the width. Decoration,
 * so the whole rail is aria-hidden.
 *
 * Each card is ported from its skeleton/<name>.tsx, in the same order, with
 * shadcn's markup and classes; the module-scope arrays are the TSX's own,
 * prefixed with the card name since they share one module here.
 */

// skeleton/ui-elements.tsx
function uiElementsSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-6')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-8 w-full rounded-2xl')}></div>
        <div class="flex flex-wrap gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-20 rounded-lg')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-24 rounded-lg')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-20 rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-3">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-20 w-full rounded-lg')}></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex gap-2">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-12 rounded-full')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-16 rounded-full')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'hidden h-5 w-14 rounded-full 4xl:block')}></div>
          </div>
          <div class="ml-auto flex gap-3">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-full')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-full')}></div>
          </div>
          <div class="flex gap-3">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-sm')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'hidden size-4 rounded-sm 4xl:block')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'ml-auto h-5 w-9 rounded-full 4xl:hidden')}></div>
        </div>
        <div class="flex items-center gap-4">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-24 rounded-lg')}></div>
          <div class="flex">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-28 rounded-l-lg rounded-r-none')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'ml-px h-9 w-9 rounded-l-none rounded-r-lg')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'ml-auto hidden h-5 w-9 rounded-full 4xl:block')}></div>
        </div>
      </div>
    </div>`;
}

// skeleton/sidebar-nav.tsx
const sidebarNavGroupA = [0, 1, 2, 3, 4];
const sidebarNavGroupB = [0, 1, 2, 3, 4];

function navSkeleton(groups: number[][]) {
  return html`
    <div class="flex flex-col gap-1 p-2">
      ${groups.map((items, gi) => html`
        <div class="flex flex-col gap-1 px-2 py-1.5">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'mb-1 h-3 w-20 rounded-md')}></div>
          ${items.map((item) => html`
            <div class="flex items-center gap-2 px-2 py-2">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-md')}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md')}></div>
            </div>
          `)}
          ${gi < groups.length - 1 ? html`
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'my-1 h-px w-full rounded-none')}></div>
          ` : ''}
        </div>
      `)}
    </div>`;
}

function sidebarNavSkeleton() {
  return html`
    <div class="grid w-full items-start gap-4 xl:grid-cols-2 xl:gap-6">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full overflow-hidden rounded-3xl py-0')}>
        ${navSkeleton([sidebarNavGroupA, sidebarNavGroupB])}
      </div>
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'hidden w-full overflow-hidden rounded-3xl py-0 xl:flex')}>
        ${navSkeleton([sidebarNavGroupA, sidebarNavGroupB])}
      </div>
    </div>`;
}

// skeleton/savings-targets.tsx
const savingsTargetsRows = [0, 1];

function savingsTargetsSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-36 rounded-md')}></div>
        <div class="flex flex-col gap-1.5">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-full max-w-64 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-48 rounded-md')}></div>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col gap-3">
          ${savingsTargetsRows.map((row) => html`
            <div class="flex flex-col gap-3 rounded-xl bg-muted p-4">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md bg-muted-foreground/15')}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-8 w-36 rounded-md bg-muted-foreground/15')}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-2 w-full rounded-full bg-muted-foreground/15')}></div>
              <div class="flex items-center justify-between">
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md bg-muted-foreground/15')}></div>
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md bg-muted-foreground/15')}></div>
              </div>
            </div>
          `)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-center')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-56 rounded-md')}></div>
      </div>
    </div>`;
}

// skeleton/contribution-history.tsx
const contributionHistoryBars = [60, 80, 65, 95, 50, 100];

function contributionHistorySkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-44 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-52 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex h-[200px] w-full items-end gap-3">
          ${contributionHistoryBars.map((height, i) => html`
            <div class="flex h-full flex-1 flex-col justify-end gap-2">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'w-full rounded-t-md rounded-b-none')} style=${`height: ${height}%`}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'mx-auto h-3 w-6 rounded-md')}></div>
            </div>
          `)}
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
          <div class="flex flex-col gap-2 rounded-xl bg-muted p-4">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-28 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md bg-muted-foreground/15')}></div>
          </div>
          <div class="hidden flex-col gap-2 rounded-xl bg-muted p-4 xl:flex">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-32 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-28 rounded-md bg-muted-foreground/15')}></div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
      </div>
    </div>`;
}

// skeleton/claimable-balance.tsx
function claimableBalanceSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-3')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-36 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-12 w-56 rounded-lg')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-6 w-32 rounded-full')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 flex-col justify-end')}>
        <div class="flex flex-col gap-3 rounded-xl bg-muted p-4">
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-28 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-20 rounded-md bg-muted-foreground/15')}></div>
          </div>
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-32 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-16 rounded-md bg-muted-foreground/15')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-px w-full rounded-none bg-muted-foreground/15')}></div>
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-36 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24 rounded-md bg-muted-foreground/15')}></div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-full rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-11/12 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-3/4 rounded-md')}></div>
      </div>
    </div>`;
}

// skeleton/dividend-income.tsx
const dividendIncomeRows = [0, 1, 2, 3];
const dividendIncomeMiniBars = [40, 60, 80, 50];

function dividendIncomeSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-48 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-64 rounded-md')}></div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-8 rounded-md')}></div>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col gap-2">
          ${dividendIncomeRows.map((row) => html`
            <div class="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div class="flex flex-1 flex-col gap-2">
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-28 rounded-md bg-muted-foreground/15')}></div>
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md bg-muted-foreground/15')}></div>
              </div>
              <div class="hidden h-8 w-24 items-end gap-1 md:flex">
                ${dividendIncomeMiniBars.map((h, i) => html`
                  <div data-slot="skeleton" class=${cn(skeletonClass(), 'flex-1 rounded-t-sm rounded-b-none bg-muted-foreground/15')} style=${`height: ${h}%`}></div>
                `)}
              </div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'hidden h-4 w-16 rounded-md bg-muted-foreground/15 md:block')}></div>
            </div>
          `)}
        </div>
      </div>
    </div>`;
}

// skeleton/new-milestone.tsx
function newMilestoneSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-44 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-72 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
          </div>
          <div class="flex flex-col gap-2">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
      </div>
    </div>`;
}

// skeleton/payout-threshold.tsx
function payoutThresholdSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-44 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-72 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-32 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-40 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-7 w-24 rounded-md')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-2 w-full rounded-full')}></div>
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-16 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md')}></div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-16 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-[100px] w-full rounded-lg')}></div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
      </div>
    </div>`;
}

// skeleton/account-access.tsx
function accountAccessSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-36 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-64 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-6')}>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-32 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-12 rounded-md')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-4')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-14 w-full rounded-xl')}></div>
      </div>
    </div>`;
}

// skeleton/qr-connect.tsx
function qrConnectSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex justify-center pt-6')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-44 rounded-xl')}></div>
      </div>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center gap-2 text-center')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-56 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-64 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-48 rounded-md')}></div>
      </div>
    </div>`;
}

// skeleton/transfer-funds.tsx
function transferFundsSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-36 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-64 rounded-md')}></div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-8 rounded-md')}></div>
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-32 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
        </div>
        <div class="flex flex-col gap-3 rounded-xl bg-muted p-4">
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-28 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24 rounded-md bg-muted-foreground/15')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-px w-full rounded-none bg-muted-foreground/15')}></div>
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-28 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-12 rounded-md bg-muted-foreground/15')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-px w-full rounded-none bg-muted-foreground/15')}></div>
          <div class="flex items-center justify-between">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24 rounded-md bg-muted-foreground/15')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-20 rounded-md bg-muted-foreground/15')}></div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
      </div>
    </div>`;
}

// skeleton/payments.tsx
const paymentsRows = [0, 1, 2];

function paymentsSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'flex flex-col gap-3')}>
        <div class="flex items-center gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-12 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-1.5 rounded-full')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-7 rounded-md')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-1.5 rounded-full')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-20 rounded-md')}></div>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col gap-2">
          ${paymentsRows.map((row) => html`
            <div class="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-9 rounded-lg bg-muted-foreground/15')}></div>
              <div class="flex flex-1 flex-col gap-2">
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-40 rounded-md bg-muted-foreground/15')}></div>
                <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-56 rounded-md bg-muted-foreground/15')}></div>
              </div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-md bg-muted-foreground/15')}></div>
            </div>
          `)}
        </div>
      </div>
    </div>`;
}

// skeleton/empty-distribute-track.tsx
function emptyDistributeTrackSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col items-center gap-4 p-4">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-12 rounded-xl')}></div>
          <div class="flex flex-col items-center gap-2">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-40 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-64 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-48 rounded-md')}></div>
          </div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-32 rounded-lg')}></div>
        </div>
      </div>
    </div>`;
}

// skeleton/analytics-card.tsx
function analyticsCardSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-full max-w-sm data-[size=sm]:pb-0')} size="sm">
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-24 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-40 rounded-md')}></div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-7 w-28 rounded-lg')}></div>
        </div>
      </div>
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'mx-6 mb-6 aspect-[1/0.35] w-auto rounded-lg')}></div>
    </div>`;
}

// skeleton/notification-settings.tsx
const notificationSettingsRows = [0, 1, 2, 3];

function notificationSettingsSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-32 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-64 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        ${notificationSettingsRows.map((row) => html`
          <div class="flex items-start gap-3">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-4 rounded-sm')}></div>
            <div class="flex flex-1 flex-col gap-2">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-40 rounded-md')}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-56 rounded-md')}></div>
            </div>
          </div>
        `)}
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-9 w-full rounded-lg')}></div>
      </div>
    </div>`;
}

// skeleton/power-usage.tsx
const powerUsageBars = [30, 70, 80, 60, 90, 75, 100, 85];

function powerUsageSkeleton() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-32 rounded-md')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24 rounded-md')}></div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex h-[140px] w-full items-end gap-2">
          ${powerUsageBars.map((height, i) => html`
            <div class="flex h-full flex-1 flex-col justify-end gap-1.5">
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'w-full rounded-t rounded-b-none')} style=${`height: ${height}%`}></div>
              <div data-slot="skeleton" class=${cn(skeletonClass(), 'mx-auto h-3 w-5 rounded-md')}></div>
            </div>
          `)}
        </div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-px w-full rounded-none')}></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-28 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-20 rounded-md')}></div>
          </div>
          <div class="flex flex-col gap-1.5">
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-20 rounded-md')}></div>
            <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-5 w-24 rounded-md')}></div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-start gap-2')}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-24 rounded-md')}></div>
        <div class="flex w-full items-center gap-2">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-2 flex-1 rounded-full')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-3 w-10 rounded-md')}></div>
        </div>
      </div>
    </div>`;
}


/** The two rails, shadcn's CardsSkeletonRails, absolutely placed beside the grid. */
export function cardsSkeletonRails() {
  return html`
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-12 z-10 hidden min-[2200px]:block [&_[data-slot=skeleton]:nth-child(even)]:hidden">
      <div class="absolute top-0 left-[calc(50%-950px-var(--rail-width)-var(--gap))] grid w-(--rail-width) grid-cols-[repeat(2,var(--rail-column))] gap-(--gap) opacity-50 [--rail-column:20rem] [--rail-width:calc(var(--rail-column)*2+var(--gap))]">
        <div class="flex flex-col gap-(--gap)">
          ${contributionHistorySkeleton()}
          ${claimableBalanceSkeleton()}
          ${dividendIncomeSkeleton()}
          ${payoutThresholdSkeleton()}
        </div>
        <div class="flex flex-col gap-(--gap)">
          ${uiElementsSkeleton()}
          ${savingsTargetsSkeleton()}
          ${newMilestoneSkeleton()}
          ${payoutThresholdSkeleton()}
          ${accountAccessSkeleton()}
        </div>
      </div>
      <div class="absolute top-0 right-[calc(50%-950px-var(--rail-width)-var(--gap))] grid w-(--rail-width) grid-cols-[repeat(2,var(--rail-column))] gap-(--gap) opacity-50 [--rail-column:20rem] [--rail-width:calc(var(--rail-column)*2+var(--gap))]">
        <div class="flex flex-col gap-(--gap)">
          ${newMilestoneSkeleton()}
          ${payoutThresholdSkeleton()}
          ${accountAccessSkeleton()}
          ${qrConnectSkeleton()}
          ${transferFundsSkeleton()}
          ${paymentsSkeleton()}
          ${emptyDistributeTrackSkeleton()}
        </div>
        <div class="flex flex-col gap-(--gap)">
          ${qrConnectSkeleton()}
          ${transferFundsSkeleton()}
          ${paymentsSkeleton()}
          ${emptyDistributeTrackSkeleton()}
          ${analyticsCardSkeleton()}
          ${notificationSettingsSkeleton()}
          ${powerUsageSkeleton()}
        </div>
      </div>
    </div>`;
}
