import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass } from '#modules/ui/components/card.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { fieldClass, fieldContentClass } from '#modules/ui/components/field.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { Add01Icon } from '#lib/ui/hugeicons.ts';
import {
  Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter,
  Button, Badge, FieldGroup, FieldLabel, FieldDescription, Separator,
} from '../parts.ts';

/**
 * The cards of shadcn's fifth home column (apps/v4/app/(app)/(root)/cards/),
 * the one that appears from 1900px: empty-distribute-track.tsx,
 * analytics-card.tsx, notification-settings.tsx and power-usage.tsx.
 */

/** shadcn's EmptyDistributeTrack. */
export function emptyDistributeTrack() {
  return Card('', CardContent('', html`
    <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${Add01Icon('', 2)}</div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>Distribute Track</div>
        <p data-slot="empty-description" class=${emptyDescriptionClass()}>Upload your first master to start reaching listeners on Spotify, Apple Music, and more.</p>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        ${Button({}, 'Create Release')}
      </div>
    </div>`));
}

const AREA_PATH = 'M0 52L18 40L36 46L54 70L72 50L100 49V86H0Z';
const STROKE_PATH = 'M0 52L18 40L36 46L54 70L72 50L100 49';

/** shadcn's AnalyticsCard, a small card whose trend line runs to its edges. */
export function analyticsCard() {
  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-full max-w-sm data-[size=sm]:pb-0')}>
      ${CardHeader('', html`
        ${CardTitle('', 'Analytics')}
        ${CardDescription('', html`418.2K Visitors ${Badge('default', '', '+10%')}`)}
        ${CardAction(Button({ variant: 'outline', size: 'sm' }, 'View Analytics'))}
      `)}
      <svg viewBox="0 0 100 86" preserveAspectRatio="none" class="aspect-[1/0.35] w-full text-chart-1" role="img" aria-label="Visitor trend">
        <path d=${AREA_PATH} fill="currentColor" opacity="0.28"></path>
        <path d=${STROKE_PATH} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>
      </svg>
    </div>`;
}

const NOTIFICATIONS = [
  { id: 'transactions', label: 'Transaction alerts', description: 'Deposits, withdrawals, and transfers.', checked: true },
  { id: 'security', label: 'Security alerts', description: 'Login attempts and account changes.', checked: true },
  { id: 'goals', label: 'Goal milestones', description: 'Updates at 25%, 50%, 75%, and 100%.', checked: false },
  { id: 'market', label: 'Market updates', description: 'Daily portfolio summary and price alerts.', checked: false },
];

/** shadcn's NotificationSettings. */
export function notificationSettings() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Notifications')}
      ${CardDescription('', 'Choose which email and push alerts you want to receive.')}
    `)}
    ${CardContent('', FieldGroup(NOTIFICATIONS.map((n) => html`
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" id=${`notify-${n.id}`} ?checked=${n.checked} data-slot="checkbox" class=${checkboxClass()}>
        <div data-slot="field-content" class=${fieldContentClass()}>
          ${FieldLabel({ for: `notify-${n.id}` }, n.label)}
          ${FieldDescription(n.description)}
        </div>
      </div>`)))}
    ${CardFooter('', Button({ cls: 'w-full' }, 'Save Preferences'))}
  `);
}

const USAGE = [
  { hour: '6a', usage: 1.2 },
  { hour: '8a', usage: 2.8 },
  { hour: '10a', usage: 3.1 },
  { hour: '12p', usage: 2.4 },
  { hour: '2p', usage: 3.4 },
  { hour: '4p', usage: 2.9 },
  { hour: '6p', usage: 3.8 },
  { hour: '8p', usage: 3.2 },
];

/** shadcn's PowerUsage, an hourly bar chart drawn with plain boxes. */
export function powerUsage() {
  const max = Math.max(...USAGE.map((u) => u.usage));
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Power Usage')}
      ${CardDescription('', 'Whole Home')}
    `)}
    ${CardContent('flex flex-col gap-4', html`
      <div class="flex h-[140px] w-full items-end gap-2" role="img" aria-label="Power usage by hour">
        ${USAGE.map((u) => html`
          <div class="flex h-full flex-1 flex-col justify-end gap-1.5">
            <div class="min-h-2 rounded-t bg-chart-2" style=${`height: ${(u.usage / max) * 100}%`}></div>
            <span class="text-center text-xs text-muted-foreground">${u.hour}</span>
          </div>`)}
      </div>
      ${Separator()}
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-muted-foreground">Currently Using</span>
          <span class="text-lg font-semibold tabular-nums">3.4 kW</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-muted-foreground">Solar Gen</span>
          <span class="text-lg font-semibold tabular-nums">+1.2 kW</span>
        </div>
      </div>
    `)}
  `);
}
