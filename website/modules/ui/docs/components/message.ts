import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Message docs page, ported from shadcn's
 * content/docs/components/radix/message.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React. Every preview
 * renders in rhea, as shadcn's do.
 */
/** The demo shown above the Installation section. */
export const demo = 'message-demo';

const RHEA = { style: 'rhea', previewClass: 'h-auto theme-blue' };

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { avatarClass, avatarFallbackClass, avatarImageClass } from '#components/ui/avatar.ts';
import { bubbleClass, bubbleContentClass } from '#components/ui/bubble.ts';
import { messageClass, messageAvatarClass, messageContentClass } from '#components/ui/message.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="message" data-align="start" class=\${messageClass()}>
  <div data-slot="message-avatar" class=\${messageAvatarClass()}>
    <span data-slot="avatar" class=\${avatarClass()}>
      <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=\${avatarImageClass()}>
    </span>
  </div>
  <div data-slot="message-content" class=\${messageContentClass()}>
    <div data-slot="bubble" data-variant="default" class=\${bubbleClass()}>
      <div data-slot="bubble-content" class=\${bubbleContentClass()}>How can I help you today?</div>
    </div>
  </div>
</div>`, { lineNumbers: true })}
    ${callout(html`<strong>Note:</strong> the message owns the row layout: avatar, alignment, header, and footer. Render the visible message surface inside it with <a href="/ui/docs/components/bubble">Bubble</a>. For the scroll container around a conversation, use <a href="/ui/docs/components/message-scroller">Message Scroller</a>.`)}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a message:</p>
    ${codeFigure(`messageClass()
├── messageAvatarClass()
└── messageContentClass()
    ├── messageHeaderClass()
    ├── bubbleClass()
    └── messageFooterClass()`, { lang: 'text' })}
    <p>Use <code>messageGroupClass()</code> to stack consecutive messages from the same sender:</p>
    ${codeFigure(`messageGroupClass()
├── messageClass()
└── messageClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Features')}
    <ul>
      <li>Start and end alignment for sender and receiver rows via the <code>data-align</code> attribute</li>
      <li>Avatar slot that anchors to the bottom of the message and stays clear of the footer</li>
      <li>Header and footer slots for sender names, status, and message actions</li>
      <li>Footer follows the message side; actions stay aligned on <code>data-align="end"</code> rows</li>
      <li>Group wrapper for stacking consecutive messages from the same sender</li>
      <li>Customizable styling by merging classes into each helper's result with <code>cn</code></li>
    </ul>

    ${heading(toc, 2, 'Avatar')}
    <p>Use <code>messageAvatarClass()</code> to render an avatar next to the message. Set <code>data-align="end"</code> on the message to align the avatar to the end of the message.</p>
    ${await componentPreview('message-avatar', RHEA)}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>data-align</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>start</code></td><td>Align the message to the start of the conversation.</td></tr>
          <tr><td><code>end</code></td><td>Align the message to the end of the conversation.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 2, 'Group')}
    <p>Use <code>messageGroupClass()</code> to stack consecutive messages from the same sender. Render an empty avatar slot on the earlier messages to keep them aligned with the avatar on the last one.</p>
    ${await componentPreview('message-group', RHEA)}

    ${heading(toc, 2, 'Header and Footer')}
    <p>Use <code>messageHeaderClass()</code> for a sender name and <code>messageFooterClass()</code> for metadata such as a delivery or read status.</p>
    ${await componentPreview('message-header-footer', RHEA)}

    ${heading(toc, 2, 'Actions')}
    <p>Place message-level actions in the footer, such as copy, retry, or feedback buttons.</p>
    ${await componentPreview('message-actions', RHEA)}

    ${heading(toc, 2, 'Attachment')}
    ${await componentPreview('message-attachment', RHEA)}

    ${heading(toc, 2, 'Accessibility')}
    <p>A message is a presentational layout wrapper. Accessibility comes from the content you place inside it.</p>

    ${heading(toc, 3, 'Label icon-only actions')}
    <p>Action buttons in the footer are usually icon-only, so give each one an <code>aria-label</code>.</p>
    ${codeFigure(`<div data-slot="message-footer" class=\${messageFooterClass()}>
  <button type="button" aria-label="Copy" class=\${buttonClass({ variant: 'ghost', size: 'icon' })}>
    \${CopyIcon()}
  </button>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Status updates')}
    <p>For in-progress messages, use a <a href="/ui/docs/components/marker">Marker</a> with <code>role="status"</code> so assistive tech announces the update as it appears.</p>
    ${codeFigure(`<div data-slot="message" data-align="start" class=\${messageClass()}>
  <div data-slot="marker" data-variant="default" role="status" class=\${markerClass()}>
    <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
      \${spinner({ decorative: true })}
    </span>
    <span data-slot="marker-content" class=\${markerContentClass()}>Checking the logs...</span>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper that takes no options. Put its classes on a plain element, and merge your own classes into the result with <code>cn</code>.</p>

    ${heading(toc, 3, 'messageClass')}
    <p>The message row wrapper.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>data-align</code></td><td><code>"start" | "end"</code></td><td><code>"start"</code></td><td>The alignment of the message in the conversation. Alignment is logical, so it flips under <code>dir="rtl"</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'messageGroupClass')}
    <p>Groups consecutive messages from the same sender.</p>

    ${heading(toc, 3, 'messageAvatarClass')}
    <p>The avatar slot, aligned to the bottom of the message. When the message has a footer, the avatar shifts up to stay aligned with the message surface instead of the footer.</p>

    ${heading(toc, 3, 'messageContentClass')}
    <p>Wraps the header, message surface, and footer.</p>

    ${heading(toc, 3, 'messageHeaderClass')}
    <p>Displays content above the message, such as a sender name. Stays aligned to the start regardless of <code>data-align</code>.</p>

    ${heading(toc, 3, 'messageFooterClass')}
    <p>Displays content below the message, such as status or actions. Aligns to the message side.</p>
  `;
}
