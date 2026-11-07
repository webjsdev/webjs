/**
 * The preview-03 file part: a file attached to a chat message, as the kit's
 * attachment. An image shows its preview above its name and type; any other
 * file shows an icon, its name and its media type. The whole attachment links
 * to the file. A fragment helper, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/part-file.ts`. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  attachmentActionClass,
  attachmentActionsClass,
  attachmentClass,
  attachmentContentClass,
  attachmentDescriptionClass,
  attachmentMediaClass,
  attachmentTitleClass,
  attachmentTriggerClass,
} from '../../../components/attachment.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import { ExternalLinkIcon, FileTextIcon, ImageIcon } from '../../../lib/icons.ts';

export interface FilePart {
  url: string;
  mediaType: string;
  filename?: string;
}

/** The file's name, else the last segment of its url, else a generic one. */
function filenameOf(part: FilePart): string {
  if (part.filename) return part.filename;
  try {
    const last = new URL(part.url).pathname.split('/').filter(Boolean).pop();
    if (last?.includes('.')) return decodeURIComponent(last);
  } catch {
    const last = part.url.split('?')[0]?.split('/').pop();
    if (last?.includes('.')) return last;
  }
  return part.mediaType.startsWith('image/') ? 'Image file' : 'File';
}

export function partFile(opts: { part: FilePart; class?: string }) {
  const { part } = opts;
  const filename = filenameOf(part);
  const trigger = html`<a data-slot="attachment-trigger" class=${attachmentTriggerClass()} href=${part.url} target="_blank" rel="noreferrer" aria-label=${`Open ${filename}`}></a>`;

  if (part.mediaType.startsWith('image/')) {
    return html`<div data-slot="attachment" data-size="default" data-orientation="vertical" class=${cn(attachmentClass({ orientation: 'vertical' }), 'group/file w-full max-w-72', opts.class)}>
      <div data-slot="attachment-media" data-variant="image" class=${cn(attachmentMediaClass({ variant: 'image' }), 'aspect-[4/3] w-full')}>
        <img src=${part.url} alt=${filename}>
      </div>
      <div data-slot="attachment-content" class=${cn(attachmentContentClass(), 'flex items-center gap-2')}>
        <div data-slot="attachment-media" data-variant="icon" class=${cn(attachmentMediaClass(), 'size-7')}>${ImageIcon()}</div>
        <span class="min-w-0 flex-1">
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>${filename}</span>
        </span>
        <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'shrink-0')}>${part.mediaType.replace('image/', '').toUpperCase()}</span>
      </div>
      ${trigger}
    </div>`;
  }

  return html`<div data-slot="attachment" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-full max-w-80', opts.class)}>
    <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>${FileTextIcon()}</div>
    <div data-slot="attachment-content" class=${attachmentContentClass()}>
      <span data-slot="attachment-title" class=${attachmentTitleClass()}>${filename}</span>
      <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>${part.mediaType}</span>
    </div>
    <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
      <span data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-hidden="true" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>${ExternalLinkIcon()}</span>
    </div>
    ${trigger}
  </div>`;
}
