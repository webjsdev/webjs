import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

const spacingOptions = [
  { label: '16px', value: '4' },
  { label: '20px', value: '5' },
  { label: '24px', value: '6' },
  { label: '32px', value: '8' },
];

// The toggle group reflects pressed onto the chosen item, so the card reads
// the choice with :has() and sets --card-spacing from it, with no script.
const spacingFromChoice = [
  'group-has-[[value="5"][pressed]]/spacing:[--card-spacing:--spacing(5)]',
  'group-has-[[value="6"][pressed]]/spacing:[--card-spacing:--spacing(6)]',
  'group-has-[[value="8"][pressed]]/spacing:[--card-spacing:--spacing(8)]',
];

export default function CardSpacing() {
  return html`
    <div class="group/spacing mx-auto grid w-full max-w-sm gap-4">
      <ui-toggle-group type="single" value="4" variant="outline" size="sm" spacing="default" class="justify-center">
        ${spacingOptions.map((option) => html`
          <ui-toggle-group-item value=${option.value}>${option.label}</ui-toggle-group-item>
        `)}
      </ui-toggle-group>
      <div data-slot="card" data-size="default" class=${cn(cardClass(), spacingFromChoice)}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Login to your account</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Enter your email below to login to your account
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <button type="button" data-slot="button" data-variant="link" data-size="default" class=${buttonClass({ variant: 'link' })}>Sign Up</button>
          </div>
        </div>
        <div data-slot="card-content" class=${cardContentClass()}>
          <form>
            <div class="flex flex-col gap-6">
              <div class="grid gap-2">
                <label data-slot="label" for="email-spacing" class=${labelClass()}>Email</label>
                <input data-slot="input" id="email-spacing" type="email" placeholder="m@example.com" required class=${inputClass()}>
              </div>
              <div class="grid gap-2">
                <div class="flex items-center">
                  <label data-slot="label" for="password-spacing" class=${labelClass()}>Password</label>
                  <a href="#" class="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                    Forgot your password?
                  </a>
                </div>
                <input data-slot="input" id="password-spacing" type="password" required class=${inputClass()}>
              </div>
            </div>
          </form>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>
            Login
          </button>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>
            Login with Google
          </button>
        </div>
      </div>
    </div>
  `;
}
