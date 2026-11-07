import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { Building2Icon, CreditCardIcon, WalletIcon } from '#lib/ui/lucide.ts';

export default function DropdownMenuRadioIcons() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Payment Method</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="min-w-56">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>Select Payment Method</ui-dropdown-menu-label>
          <ui-dropdown-menu-group aria-label="Select Payment Method">
            <ui-dropdown-menu-item type="radio" value="card" checked>
              ${CreditCardIcon()}
              Credit Card
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="radio" value="paypal">
              ${WalletIcon()}
              PayPal
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="radio" value="bank">
              ${Building2Icon()}
              Bank Transfer
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
