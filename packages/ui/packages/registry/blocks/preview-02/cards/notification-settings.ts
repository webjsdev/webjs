/**
 * The preview-02 Notifications card: a "Select all" checkbox over one
 * checkbox per kind of alert. Installed by `npx @webjsdev/ui add preview-02`
 * at `components/preview-02/notification-settings.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The markup is a fragment the server renders with each box at its default.
 * `<preview-02-notification-settings>` adds what shadcn keeps in React state:
 * "Select all" is indeterminate while only some boxes are checked, and
 * checking it checks or clears them all. The `<form>` has no `action` yet:
 * bind a server action from a `'use server'` file
 * (`<form action=${saveNotificationSettings}>`) and each checked box submits
 * as `notify=<id>`.
 */
import { WebComponent, html } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { checkboxClass } from '../../../components/checkbox.ts';
import {
  fieldClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
} from '../../../components/field.ts';
import { cn } from '../../../lib/utils.ts';

const NOTIFICATIONS = [
  { id: 'transactions', label: 'Transaction alerts', description: 'Deposits, withdrawals, and transfers.', defaultChecked: true },
  { id: 'security', label: 'Security alerts', description: 'Login attempts and account changes.', defaultChecked: true },
  { id: 'goals', label: 'Goal milestones', description: 'Updates at 25%, 50%, 75%, and 100%.', defaultChecked: false },
  { id: 'market', label: 'Market updates', description: 'Daily portfolio summary and price alerts.', defaultChecked: false },
];

/** Keeps "Select all" in step with the boxes it governs. */
export class Preview02NotificationSettings extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
  }

  // The server cannot render the indeterminate state, which is a property, so
  // it is set once the element has rendered (and its slot has settled).
  firstUpdated(changedProperties: Map<string, unknown>) {
    super.firstUpdated?.(changedProperties);
    requestAnimationFrame(() => this._sync());
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    super.disconnectedCallback();
  }

  _all(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('input[data-select-all]');
  }

  _items(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll<HTMLInputElement>('input[name="notify"]'));
  }

  _sync(): void {
    const all = this._all();
    const items = this._items();
    if (!all || !items.length) return;
    const checked = items.filter((i) => i.checked).length;
    all.checked = checked === items.length;
    all.indeterminate = checked > 0 && checked < items.length;
  }

  _onChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    if (target.hasAttribute('data-select-all')) {
      for (const item of this._items()) item.checked = target.checked;
    }
    this._sync();
  };

  render() {
    return html`<slot></slot>`;
  }
}
Preview02NotificationSettings.register('preview-02-notification-settings');

export function notificationSettings() {
  const allChecked = NOTIFICATIONS.every((n) => n.defaultChecked);
  return html`
    <preview-02-notification-settings>
      <form data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Notifications</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Choose what you want to be notified about.</div>
        </div>
        <div data-slot="card-content" class=${cardContentClass()}>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
              <input type="checkbox" data-slot="checkbox" data-select-all id="notify-all" ?checked=${allChecked} class=${checkboxClass()}>
              <div data-slot="field-content" class=${fieldContentClass()}>
                <label data-slot="field-label" for="notify-all" class=${fieldLabelClass()}>Select all</label>
              </div>
            </div>
            ${NOTIFICATIONS.map((n) => html`
              <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                <input type="checkbox" data-slot="checkbox" id=${`notify-${n.id}`} name="notify" value=${n.id} ?checked=${n.defaultChecked} class=${checkboxClass()}>
                <div data-slot="field-content" class=${fieldContentClass()}>
                  <label data-slot="field-label" for=${`notify-${n.id}`} class=${fieldLabelClass()}>${n.label}</label>
                  <p data-slot="field-description" class=${fieldDescriptionClass()}>${n.description}</p>
                </div>
              </div>
            `)}
          </div>
        </div>
        <div data-slot="card-footer" class=${cardFooterClass()}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Save Preferences</button>
        </div>
      </form>
    </preview-02-notification-settings>
  `;
}
