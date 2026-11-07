/**
 * The preview block's file upload card: an empty state inviting a drop or a
 * browse. A fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/file-upload.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * "Browse Files" is a placeholder: make it a `<label>` for an
 * `<input type="file">` inside a form bound to your upload action.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyMediaClass,
  emptyTitleClass,
} from '../../../components/empty.ts';

const UploadCloudIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"></path><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="m8 17 4-4 4 4"></path></svg>`;

export function fileUpload() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>File Upload</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Drag and drop or browse</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'border')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${UploadCloudIcon()}</div>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Upload files</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>PNG, JPG, PDF up to 10MB</div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Browse Files</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
