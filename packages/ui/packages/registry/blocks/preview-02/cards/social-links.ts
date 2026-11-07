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
import { CameraIcon, CirclePlusIcon, CloudIcon, GlobeIcon } from '../../../lib/icons.ts';

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
