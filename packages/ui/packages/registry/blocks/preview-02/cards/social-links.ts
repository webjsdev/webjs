/**
 * The preview-02 Social Links card: an artist's profile links, each an input
 * with its service's icon. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/social-links.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${saveSocialLinks}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputGroupAddonClass, inputGroupClass, inputGroupInputClass } from '../../../components/input-group.ts';
import { cn } from '../../../lib/utils.ts';

const CirclePlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>`;
const CameraIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg>`;
const CloudIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`;
const GlobeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`;

const LINKS: { id: string; label: string; icon: (cls?: string) => TemplateResult; value?: string; placeholder?: string }[] = [
  { id: 'spotify-url', label: 'Spotify Artist URL', icon: CirclePlusIcon, value: 'spotify.com/artist/3j...2k' },
  { id: 'instagram-handle', label: 'Instagram Handle', icon: CameraIcon, value: '@julianduryea_music' },
  { id: 'soundcloud-url', label: 'SoundCloud URL', icon: CloudIcon, placeholder: 'soundcloud.com/username' },
  { id: 'website-url', label: 'Website', icon: GlobeIcon, placeholder: 'https://yoursite.com' },
];

export function socialLinks() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Social Links</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          ${LINKS.map((link) => html`
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for=${link.id} class=${fieldLabelClass()}>${link.label}</label>
              <div data-slot="input-group" role="group" class=${inputGroupClass()}>
                <input data-slot="input-group-control" id=${link.id} name=${link.id} value=${link.value ?? null} placeholder=${link.placeholder ?? null} class=${inputGroupInputClass()}>
                <label data-slot="input-group-addon" data-align="inline-start" for=${link.id} class=${inputGroupAddonClass()}>${link.icon()}</label>
              </div>
            </div>
          `)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-end gap-2 style-sera:justify-center')}>
        <button type="reset" data-slot="button" data-variant="secondary" data-size="default" class=${cn(buttonClass({ variant: 'secondary' }), 'style-sera:flex-1')}>Discard</button>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:flex-1')}>Save Changes</button>
      </div>
    </form>
  `;
}
