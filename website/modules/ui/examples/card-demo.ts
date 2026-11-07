import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function CardDemo() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full max-w-sm')}>
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
              <label data-slot="label" for="email" class=${labelClass()}>Email</label>
              <input
                data-slot="input"
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                class=${inputClass()}
              >
            </div>
            <div class="grid gap-2">
              <div class="flex items-center">
                <label data-slot="label" for="password" class=${labelClass()}>Password</label>
                <a
                  href="#"
                  class="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
              <input data-slot="input" id="password" type="password" required class=${inputClass()}>
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
  `;
}
