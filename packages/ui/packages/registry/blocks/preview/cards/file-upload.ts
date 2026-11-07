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
import { UploadCloudIcon } from '../../../lib/icons.ts';

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
