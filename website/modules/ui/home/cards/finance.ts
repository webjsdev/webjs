import { html } from '@webjsdev/core';
import {
  Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter,
  Button, Badge, ItemGroup, Item, ItemContent, ItemTitle, ItemDescription, ItemFooter,
  Progress, Separator,
} from '../parts.ts';
import { Cancel01Icon } from '#lib/ui/hugeicons.ts';

/**
 * shadcn's finance cards from apps/v4/app/(app)/(root)/cards/:
 * savings-targets, contribution-history, claimable-balance and
 * dividend-income. Display only, so each is a plain fragment.
 */

function target(label: string, amount: string, pct: number, saved: string, aria: string) {
  return Item({ variant: 'muted', role: 'listitem', cls: 'flex-col items-stretch' }, html`
    ${ItemContent('gap-3', html`
      ${ItemDescription('cn-font-heading text-xs font-medium tracking-wider text-muted-foreground uppercase', label)}
      <span class="text-3xl font-semibold tabular-nums">${amount}</span>
      ${Progress(pct, { label: aria })}
    `)}
    ${ItemFooter(html`
      <span class="text-sm text-muted-foreground">${pct}% achieved</span>
      <span class="text-sm font-medium tabular-nums">${saved}</span>
    `)}
  `);
}

export function savingsTargets() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Savings Targets')}
      ${CardDescription('', 'Active milestones for 2024 across your portfolio. Monitor how close you are to each savings goal.')}
    `)}
    ${CardContent('', ItemGroup('gap-3', html`
      ${target('Retirement', '$420,000', 65, '$273,000', 'Retirement savings progress')}
      ${target('Real Estate', '$85,000', 32, '$27,200', 'Real estate savings progress')}
    `))}
    ${CardFooter('', CardDescription('text-center', 'You have not met your targets for this year.'))}
  `);
}

const CONTRIBUTIONS = [
  { month: 'Dec', amount: 800 },
  { month: 'Jan', amount: 1100 },
  { month: 'Feb', amount: 900 },
  { month: 'Mar', amount: 1300 },
  { month: 'Apr', amount: 750 },
];

function stat(label: string, value: string, note: string, cls = '') {
  return Item({ variant: 'muted', cls: `flex-col items-stretch ${cls}` }, ItemContent('gap-1', html`
    ${ItemDescription('text-xs font-medium tracking-wider text-muted-foreground uppercase', label)}
    <span class="cn-font-heading text-base font-semibold">${value}</span>
    <span class="text-sm text-muted-foreground">${note}</span>
  `));
}

export function contributionHistory() {
  const max = Math.max(...CONTRIBUTIONS.map((c) => c.amount));
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Contribution History')}
      ${CardDescription('', 'Last 6 months of activity')}
    `)}
    ${CardContent('', html`
      <div class="flex h-[200px] w-full items-end gap-3" role="img" aria-label="Last 6 months of contribution activity">
        ${CONTRIBUTIONS.map((c, i) => html`
          <div class="flex h-full flex-1 flex-col justify-end gap-2">
            <div data-index=${i} class="min-h-2 rounded-lg data-[index=0]:bg-chart-1 data-[index=1]:bg-chart-2 data-[index=2]:bg-chart-3 data-[index=3]:bg-chart-4 data-[index=4]:bg-chart-5" style=${`height: ${(c.amount / max) * 100}%`}></div>
            <span class="text-center text-xs text-muted-foreground">${c.month}</span>
          </div>`)}
      </div>
    `)}
    ${CardContent('', html`
      <div class="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
        ${stat('Upcoming', 'May 2024', 'Scheduled')}
        ${stat('Savings Plan', 'Accelerated', 'Recurring', 'hidden xl:flex')}
      </div>
    `)}
    ${CardFooter('', Button({ cls: 'w-full' }, 'View Full Report'))}
  `);
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function claimableBalance() {
  const net = 1248.75;
  const fee = 37.46;
  const total = net - fee;
  const row = (label: string, value: string, strong = false) => html`
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">${label}</span>
      <span class=${strong ? 'text-sm font-semibold tabular-nums' : 'text-sm font-medium tabular-nums'}>${value}</span>
    </div>`;
  return Card('', html`
    ${CardHeader('', html`
      ${CardDescription('', 'Claimable Balance')}
      ${CardTitle('text-4xl tabular-nums', `$${money(total)}`)}
      ${Badge('outline', '', html`<span class="size-2 rounded-full bg-yellow-500"></span>Pending Setup`)}
    `)}
    ${CardContent('flex flex-1 flex-col justify-end', Item({ variant: 'muted', cls: 'flex-col items-stretch' }, ItemContent('gap-3', html`
      ${row('Net Royalties', `$${money(net)}`)}
      ${row('Processing Fee', `-$${money(fee)}`)}
      ${Separator()}
      ${row('Total Ready to Claim', `$${money(total)} USD`, true)}
    `)))}
    ${CardFooter('', CardDescription('', 'Once your bank is connected, balances over $10.00 are automatically eligible for monthly distribution on the 15th of each month.'))}
  `);
}

const HOLDINGS = [
  { name: 'Vanguard', shares: '450 Shares', data: [380, 420, 390, 652] },
  { name: 'S&P 500 VOO', shares: '112 Shares', data: [180, 210, 320, 218] },
  { name: 'Apple AAPL', shares: '85 Shares', data: [60, 70, 120, 90] },
  { name: 'Realty Income', shares: '320 Shares', data: [240, 260, 280, 360] },
];

export function dismissButton(label: string) {
  return CardAction(Button({ variant: 'ghost', size: 'icon-sm', cls: 'bg-muted', label }, Cancel01Icon('', 2)));
}

export function dividendIncome() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Q2 Dividend Income')}
      ${CardDescription('', 'Quarterly dividend payouts across your portfolio holdings.')}
      ${dismissButton('Dismiss dividend income')}
    `)}
    ${CardContent('', ItemGroup('', HOLDINGS.map((h) => {
      const max = Math.max(...h.data);
      return Item({ variant: 'muted', role: 'listitem' }, html`
        ${ItemContent('', html`${ItemTitle(h.name)}${ItemDescription('', h.shares)}`)}
        <div class="hidden h-8 w-24 items-end gap-1 md:flex" role="img" aria-label=${`${h.name} quarterly dividends`}>
          ${h.data.map((v) => html`<div class="min-h-1 flex-1 rounded-t-sm bg-chart-2" style=${`height: ${(v / max) * 100}%`}></div>`)}
        </div>
      `);
    })))}
  `);
}
