/**
 * The preview block's environment variables card: three variables with their
 * values masked or shown, and edit and deploy buttons. A fragment helper,
 * rendered by the server. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/environment-variables.ts`. Ported from shadcn/ui's
 * preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const VARIABLES = [
  { key: 'DATABASE_URL', masked: true },
  { key: 'NEXT_PUBLIC_API', masked: false },
  { key: 'STRIPE_SECRET', masked: true },
];

export function environmentVariables() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Environment Variables</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Production · 8 variables</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-2')}>
        ${VARIABLES.map((env) => html`
          <div class="flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-xs ring ring-border">
            <span class="font-medium">${env.key}</span>
            <span class="ml-auto text-muted-foreground">${env.masked ? '••••••••' : 'https://api.example.com'}</span>
          </div>
        `)}
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Edit</button>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'ml-auto')}>Deploy</button>
      </div>
    </div>
  `;
}
