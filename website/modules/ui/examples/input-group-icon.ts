import { html } from '@webjsdev/core';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import {
  CheckIcon, CreditCardIcon, InfoIcon, MailIcon, SearchIcon, StarIcon,
} from '#lib/ui/lucide.ts';

export default function InputGroupIcon() {
  return html`
    <div class="grid w-full max-w-sm gap-6">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-icon-search" placeholder="Search..." aria-label="Search" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-icon-search" class=${inputGroupAddonClass()}>
          ${SearchIcon()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-icon-email" type="email" placeholder="Enter your email" aria-label="Email" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-icon-email" class=${inputGroupAddonClass()}>
          ${MailIcon()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-icon-card" placeholder="Card number" aria-label="Card number" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-icon-card" class=${inputGroupAddonClass()}>
          ${CreditCardIcon()}
        </label>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-icon-card" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${CheckIcon()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-icon-card-2" placeholder="Card number" aria-label="Card number" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-icon-card-2" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${StarIcon()}
          ${InfoIcon()}
        </label>
      </div>
    </div>
  `;
}
