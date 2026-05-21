import { html } from '@webjsdev/core';
import { buttonClass } from '../../components/ui/button.ts';
import { badgeClass } from '../../components/ui/badge.ts';
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  cardDescriptionClass,
  cardContentClass,
  cardFooterClass,
} from '../../components/ui/card.ts';
import {
  alertClass,
  alertTitleClass,
  alertDescriptionClass,
} from '../../components/ui/alert.ts';
import { inputClass } from '../../components/ui/input.ts';
import { labelClass } from '../../components/ui/label.ts';
// Tier-2 components are real custom elements: register by side-effect import.
import '../../components/ui/dialog.ts';

export const metadata = {
  title: 'UI Demo · webjs',
  description: 'A showcase of the Webjs UI two-tier composition: class helpers on native elements + custom elements where state matters.',
};

export default function UiDemo() {
  return html`
    <section class="mx-auto max-w-3xl py-16 px-6">
      <h1 class="text-4xl font-bold tracking-tight mb-2">Webjs UI demo</h1>
      <p class="text-fg-muted mb-8">
        The component kit is split into two tiers. Tier-1 components
        (button, card, input, label, alert, badge, separator) are
        <strong>class-helper functions</strong> you apply to raw native
        elements. Tier-2 components (dialog, popover, tabs, …) are real
        <code class="font-mono text-sm bg-bg-subtle px-1.5 py-0.5 rounded">&lt;ui-X&gt;</code>
        custom elements for state the browser doesn't give you natively.
      </p>

      <h2 class="text-2xl font-semibold mb-4">Tier 1: class helpers on native elements</h2>

      <div class=${cardClass()}>
        <div class=${cardHeaderClass()}>
          <h3 class=${cardTitleClass()}>Sign in</h3>
          <p class=${cardDescriptionClass()}>Enter your email to receive a magic link.</p>
        </div>
        <div class="${cardContentClass()} flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class=${labelClass()} for="email">Email</label>
            <input class=${inputClass()} id="email" type="email" placeholder="you@example.com">
          </div>
          <div class=${alertClass()}>
            <h5 class=${alertTitleClass()}>Heads up</h5>
            <div class=${alertDescriptionClass()}>Magic link expires in 10 minutes.</div>
          </div>
        </div>
        <div class="${cardFooterClass()} gap-2">
          <button class=${buttonClass()}>Send link</button>
          <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
          <span class=${badgeClass({ variant: 'secondary' })}>Beta</span>
        </div>
      </div>

      <h2 class="text-2xl font-semibold mt-12 mb-4">Tier 2: stateful custom elements</h2>

      <ui-dialog>
        <ui-dialog-trigger>
          <button class=${buttonClass({ variant: 'outline' })}>Open dialog</button>
        </ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-header>
            <ui-dialog-title>Edit profile</ui-dialog-title>
            <ui-dialog-description>Make changes to your profile here.</ui-dialog-description>
          </ui-dialog-header>
          <div class="grid gap-3 my-4">
            <label class=${labelClass()} for="dialog-name">Name</label>
            <input class=${inputClass()} id="dialog-name" placeholder="Your name">
          </div>
          <ui-dialog-footer>
            <ui-dialog-close>
              <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
            </ui-dialog-close>
            <button class=${buttonClass()}>Save</button>
          </ui-dialog-footer>
        </ui-dialog-content>
      </ui-dialog>

      <p class="mt-12 text-sm text-fg-subtle">
        Tier-1 helpers compile to plain Tailwind class strings at SSR time -
        no client-side runtime. Tier-2 elements register with
        <code class="font-mono text-xs">customElements.define</code> and
        decorate their host (no shadow DOM by default), so Tailwind utilities
        on inner content still apply. Source lives in
        <code class="font-mono text-xs">components/ui/</code>; edit freely.
      </p>
    </section>
  `;
}
