import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { RefreshCwIcon } from '#lib/ui/lucide.ts';

// The slot hosts sit inside the group's rendered box, so the size rule
// reaches them with ** (any descendant) where shadcn writes *.
const GROUP = '**:data-[slot=input-otp-slot]:h-12 **:data-[slot=input-otp-slot]:w-11 **:data-[slot=input-otp-slot]:text-xl';

export default function InputOTPForm() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto max-w-md')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Verify your login</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Enter the verification code we sent to your email address:${' '}
          <span class="font-medium">m@example.com</span>.
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <div class="flex items-center justify-between">
            <label data-slot="field-label" for="otp-verification" class=${fieldLabelClass()}>
              Verification code
            </label>
            <button type="button" data-slot="button" data-variant="outline" data-size="xs" class=${buttonClass({ variant: 'outline', size: 'xs' })}>
              ${RefreshCwIcon()}
              Resend Code
            </button>
          </div>
          <ui-input-otp>
            <input id="otp-verification" name="otp" required class=${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
            <ui-input-otp-group class=${GROUP}>
              <ui-input-otp-slot index="0"></ui-input-otp-slot>
              <ui-input-otp-slot index="1"></ui-input-otp-slot>
              <ui-input-otp-slot index="2"></ui-input-otp-slot>
            </ui-input-otp-group>
            <ui-input-otp-separator class="mx-2"></ui-input-otp-separator>
            <ui-input-otp-group class=${GROUP}>
              <ui-input-otp-slot index="3"></ui-input-otp-slot>
              <ui-input-otp-slot index="4"></ui-input-otp-slot>
              <ui-input-otp-slot index="5"></ui-input-otp-slot>
            </ui-input-otp-group>
          </ui-input-otp>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            <a href="#">I no longer have access to this email address.</a>
          </p>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>
            Verify
          </button>
          <div class="text-sm text-muted-foreground">
            Having trouble signing in?${' '}
            <a href="#" class="underline underline-offset-4 transition-colors hover:text-primary">
              Contact support
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
