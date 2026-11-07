/**
 * The preview block's anomaly alert card: an empty state with an upgrade
 * button. A fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/anomaly-alert.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyTitleClass,
} from '../../../components/empty.ts';

export function anomalyAlert() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'h-48')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Get alerted for anomalies</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>Automatically monitor your projects for anomalies and get notified.</div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Upgrade to Observability Plus</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
