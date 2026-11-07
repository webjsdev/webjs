import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';

export default function CardEdgeToEdge() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-full max-w-sm')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Terms of Service</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Review the terms before accepting the agreement.
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), '-mb-(--card-spacing)')}>
        <div class="-mx-(--card-spacing) max-h-48 space-y-4 overflow-y-scroll border-t bg-muted/50 px-(--card-spacing) py-4 text-sm leading-relaxed">
          <p>
            These terms govern your use of the workspace, including access to
            shared documents, project files, and collaboration tools.
          </p>
          <p>
            You are responsible for the content you upload and for ensuring that
            your team has the appropriate permissions to view or edit it.
          </p>
          <p>
            We may update features or limits as the service evolves. When those
            changes materially affect your workflow, we will notify your
            workspace administrators.
          </p>
          <p>
            By continuing, you agree to keep your account credentials secure and
            to follow your organization&apos;s acceptable use policies.
          </p>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-end gap-2')}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Decline</button>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Accept</button>
      </div>
    </div>
  `;
}
