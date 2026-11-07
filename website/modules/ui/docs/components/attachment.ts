import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview, type PreviewOptions } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Attachment docs page, ported from shadcn's
 * content/docs/components/radix/attachment.mdx (#1666): the same sections in
 * the same order, every preview in the rhea style shadcn shows it in, the
 * prose rewritten where it describes React.
 */
export const demo = 'attachment-demo';

const RHEA: PreviewOptions = { style: 'rhea', previewClass: 'h-auto theme-blue bg-surface dark:bg-background' };

/** The paragraph shadcn puts between the lead demo and Installation. */
export function intro(_toc: TocEntry[]) {
  return html`
    <p>The attachment helpers display a file or image attachment, its media, name, and metadata, with optional actions and upload state. Use them for files and images in chat composers, message threads, and upload lists.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  attachmentClass,
  attachmentMediaClass,
  attachmentContentClass,
  attachmentTitleClass,
  attachmentDescriptionClass,
  attachmentActionsClass,
  attachmentActionClass,
} from '#components/ui/attachment.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=\${attachmentClass()}>
  <div data-slot="attachment-media" data-variant="icon" class=\${attachmentMediaClass()}>
    \${FileTextIcon()}
  </div>
  <div data-slot="attachment-content" class=\${attachmentContentClass()}>
    <span data-slot="attachment-title" class=\${attachmentTitleClass()}>sales-dashboard.pdf</span>
    <span data-slot="attachment-description" class=\${attachmentDescriptionClass()}>PDF · 2.4 MB</span>
  </div>
  <div data-slot="attachment-actions" class=\${attachmentActionsClass()}>
    <button type="button" data-slot="attachment-action" aria-label="Remove sales-dashboard.pdf"
      class=\${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
      \${XIcon()}
    </button>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an attachment:</p>
    ${codeFigure(`Attachment
├── AttachmentMedia
├── AttachmentContent
│   ├── AttachmentTitle
│   └── AttachmentDescription
├── AttachmentActions
│   └── AttachmentAction
└── AttachmentTrigger`, { lang: 'text' })}
    <p>Each part is a plain element carrying its helper's classes and its <code>data-slot</code>, which the styles key on. Use <code>attachmentGroupClass()</code> to lay out multiple attachments in a scrollable row:</p>
    ${codeFigure(`AttachmentGroup
├── Attachment
└── Attachment`, { lang: 'text' })}

    ${heading(toc, 2, 'Features')}
    <ul>
      <li>Icon and image media through <code>attachmentMediaClass()</code></li>
      <li>Upload states: <code>idle</code>, <code>uploading</code>, <code>processing</code>, <code>error</code>, and <code>done</code> with built-in styling and a shimmer while in progress</li>
      <li>Three sizes and horizontal or vertical orientation</li>
      <li>A full-card trigger that opens a link or dialog while the actions stay independently clickable</li>
      <li>A scrollable, snapping group with an edge fade</li>
      <li>Customizable styling by merging your own classes into any part with <code>cn()</code></li>
    </ul>

    ${heading(toc, 2, 'Image')}
    <p>Pass <code>variant: 'image'</code> to <code>attachmentMediaClass()</code> (with <code>data-variant="image"</code>) and render an <code>&lt;img&gt;</code> inside it. Use <code>orientation: 'vertical'</code> to stack the media above the content.</p>
    ${await componentPreview('attachment-image', RHEA)}

    ${heading(toc, 2, 'States')}
    <p>Set <code>data-state</code> to reflect the upload lifecycle. <code>uploading</code> and <code>processing</code> shimmer the title, and <code>error</code> switches to a destructive treatment.</p>
    ${await componentPreview('attachment-states', RHEA)}

    ${heading(toc, 2, 'Sizes')}
    <p>Use the <code>size</code> option (with a matching <code>data-size</code>) to switch between <code>default</code>, <code>sm</code>, and <code>xs</code>.</p>
    ${await componentPreview('attachment-sizes', RHEA)}

    ${heading(toc, 2, 'Group')}
    <p>Wrap attachments in an element with <code>attachmentGroupClass()</code> to lay them out in a horizontally scrollable, snapping row with an edge fade.</p>
    ${await componentPreview('attachment-group', RHEA)}

    ${heading(toc, 2, 'Trigger')}
    <p>Add a trigger to make the whole card open a link or dialog. <code>attachmentTriggerClass()</code> fills the card behind the actions, so the actions stay clickable.</p>
    ${await componentPreview('attachment-trigger', RHEA)}
    ${codeFigure(`<ui-dialog>
  <div data-slot="attachment" class=\${attachmentClass()}>
    <!-- media, content, actions -->
    <ui-dialog-trigger>
      <button type="button" data-slot="attachment-trigger" aria-label="Preview research-summary.pdf"
        class=\${attachmentTriggerClass()}></button>
    </ui-dialog-trigger>
  </div>
  <ui-dialog-content><!-- ... --></ui-dialog-content>
</ui-dialog>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Accessibility')}
    <p>An action is a native <code>&lt;button&gt;</code> with the button classes, and the trigger is a real <code>&lt;button&gt;</code> or <code>&lt;a&gt;</code>. Follow the guidance below so both are operable and announced.</p>

    ${heading(toc, 3, 'Label icon-only actions')}
    <p>An action is usually icon-only, so give each one an <code>aria-label</code> describing the action and its target.</p>
    ${codeFigure(`<button type="button" data-slot="attachment-action" aria-label="Remove sales-dashboard.pdf"
  class=\${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
  \${XIcon()}
</button>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Label the trigger')}
    <p>The trigger covers the card with no text of its own, so give it an <code>aria-label</code> for what activating it does.</p>
    ${codeFigure(`<a
  data-slot="attachment-trigger"
  href=\${url}
  target="_blank"
  rel="noreferrer"
  aria-label="Open workspace.png"
  class=\${attachmentTriggerClass()}
></a>`, { lineNumbers: true })}
    <p>The trigger sits behind the actions in the stacking order, so an action and the trigger never trap each other. Both remain separately focusable and clickable.</p>

    ${heading(toc, 3, 'Keyboard scrolling')}
    <p>A group scrolls horizontally. When its attachments are interactive (a trigger or actions), keyboard users reach off-screen items by tabbing to them. For a row of presentational attachments, make the group itself focusable and scrollable by adding <code>tabindex="0"</code>, <code>role="group"</code>, and an <code>aria-label</code>.</p>

    ${heading(toc, 3, 'Meaning beyond color')}
    <p>The <code>error</code> state uses a destructive color. Keep the failure reason in the description so the state is not conveyed by color alone.</p>

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a helper that returns classes for a plain element. Set the part's <code>data-slot</code>, and the <code>data-state</code>, <code>data-size</code>, <code>data-orientation</code> and <code>data-variant</code> attributes that match the options you pass, since the styles key on them.</p>

    ${heading(toc, 3, 'attachmentClass')}
    <p>The root attachment container, on <code>data-slot="attachment"</code>. <code>attachmentVariants()</code> is an alias of <code>attachmentClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option or attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>data-state</code></td><td><code>"idle" | "uploading" | "processing" | "error" | "done"</code></td><td><code>"done"</code></td><td>The upload state. Drives styling and the shimmer.</td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm" | "xs"</code></td><td><code>"default"</code></td><td>The attachment size. Mirror it in <code>data-size</code>.</td></tr>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td><td>Lay the media beside or above the content. Mirror it in <code>data-orientation</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'attachmentMediaClass')}
    <p>The media slot for an icon or image preview, on <code>data-slot="attachment-media"</code>. <code>attachmentMediaVariants()</code> is an alias of <code>attachmentMediaClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"icon" | "image"</code></td><td><code>"icon"</code></td><td>Whether the media holds an icon or an <code>&lt;img&gt;</code>. Mirror it in <code>data-variant</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'attachmentContentClass')}
    <p>Wraps the title and description, on <code>data-slot="attachment-content"</code>. It takes no options.</p>

    ${heading(toc, 3, 'attachmentTitleClass')}
    <p>The attachment name, on <code>data-slot="attachment-title"</code>. Shimmers while the attachment is <code>uploading</code> or <code>processing</code>. It takes no options.</p>

    ${heading(toc, 3, 'attachmentDescriptionClass')}
    <p>Secondary metadata such as the file type, size, or upload status, on <code>data-slot="attachment-description"</code>. It takes no options.</p>

    ${heading(toc, 3, 'attachmentActionsClass')}
    <p>A container for one or more actions, aligned to the end of the attachment, on <code>data-slot="attachment-actions"</code>. It takes no options.</p>

    ${heading(toc, 3, 'attachmentActionClass')}
    <p>An action button, on <code>data-slot="attachment-action"</code>. Merge it with <code>buttonClass({ variant: 'ghost', size: 'icon-xs' })</code> on a native <code>&lt;button&gt;</code>; any other <a href="/ui/docs/components/button">Button</a> variant and size work too.</p>

    ${heading(toc, 3, 'attachmentTriggerClass')}
    <p>A full-card overlay that activates the attachment, on <code>data-slot="attachment-trigger"</code>. Put it on a <code>&lt;button&gt;</code> (inside a <code>&lt;ui-dialog-trigger&gt;</code> to open a dialog) or on an <code>&lt;a&gt;</code> to open a link. It takes no options.</p>

    ${heading(toc, 3, 'attachmentGroupClass')}
    <p>Lays out attachments in a horizontally scrollable, snapping row, on <code>data-slot="attachment-group"</code>. It takes no options.</p>
  `;
}
