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

export interface FilePart {
  url: string;
  mediaType: string;
  filename?: string;
}

const ImageIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`;
const FileTextIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`;
const ExternalLinkIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;

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
