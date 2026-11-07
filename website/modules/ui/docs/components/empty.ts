import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Empty docs page body, ported from shadcn's
 * content/docs/components/radix/empty.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'empty-demo';

const table = (rows: unknown) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyMediaClass,
  emptyTitleClass,
} from '#components/ui/empty.ts';`)}
    ${codeFigure(`<div data-slot="empty" class=\${emptyClass()}>
  <div data-slot="empty-header" class=\${emptyHeaderClass()}>
    <div data-slot="empty-icon" data-variant="icon" class=\${emptyMediaClass({ variant: 'icon' })}>
      <svg aria-hidden="true">...</svg>
    </div>
    <h3 data-slot="empty-title" class=\${emptyTitleClass()}>No data</h3>
    <p data-slot="empty-description" class=\${emptyDescriptionClass()}>No data found</p>
  </div>
  <div data-slot="empty-content" class=\${emptyContentClass()}>
    <button class=\${buttonClass()}>Add data</button>
  </div>
</div>`)}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an empty state:</p>
    ${codeFigure(`emptyClass
├── emptyHeaderClass
│   ├── emptyMediaClass
│   ├── emptyTitleClass
│   └── emptyDescriptionClass
└── emptyContentClass`, { lang: 'text' })}

    ${heading(toc, 2, 'Outline')}
    <p>Use the <code>border</code> utility class to create an outline empty state.</p>
    ${await componentPreview('empty-outline', { previewClass: 'h-96 p-6 md:p-10' })}

    ${heading(toc, 2, 'Background')}
    <p>Use the <code>bg-*</code> and <code>bg-gradient-*</code> utilities to add a background to the empty state.</p>
    ${await componentPreview('empty-background', { previewClass: 'h-96 p-0' })}

    ${heading(toc, 2, 'Avatar')}
    <p>Use <code>emptyMediaClass()</code> to display an avatar in the empty state.</p>
    ${await componentPreview('empty-avatar', { previewClass: 'h-96 p-0' })}

    ${heading(toc, 2, 'Avatar Group')}
    <p>Use <code>emptyMediaClass()</code> to display an avatar group in the empty state.</p>
    ${await componentPreview('empty-avatar-group', { previewClass: 'h-96 p-0' })}

    ${heading(toc, 2, 'InputGroup')}
    <p>You can add an <a href="/ui/docs/components/input-group">Input Group</a> to the element with <code>emptyContentClass()</code>.</p>
    ${await componentPreview('empty-input-group', { previewClass: 'h-96 p-0' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('empty-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper you put on a native element. None takes options except <code>emptyMediaClass()</code>; merge your own classes with <code>cn()</code>.</p>

    ${heading(toc, 3, 'emptyClass')}
    <p>The root of the empty state. Wraps the header and the content. It carries <code>border-dashed</code> but no border width, so it renders borderless until you add <code>border</code>. When the empty state appears in response to a search or a filter, put <code>role="status"</code> on it so the change is announced.</p>
    ${codeFigure(`<div data-slot="empty" class=\${emptyClass()}>
  <div data-slot="empty-header" class=\${emptyHeaderClass()}>...</div>
  <div data-slot="empty-content" class=\${emptyContentClass()}>...</div>
</div>`)}

    ${heading(toc, 3, 'emptyHeaderClass')}
    <p>Wraps the empty media, title, and description.</p>
    ${codeFigure(`<div data-slot="empty-header" class=\${emptyHeaderClass()}>
  <div data-slot="empty-icon" class=\${emptyMediaClass()}>...</div>
  <h3 data-slot="empty-title" class=\${emptyTitleClass()}>...</h3>
  <p data-slot="empty-description" class=\${emptyDescriptionClass()}>...</p>
</div>`)}

    ${heading(toc, 3, 'emptyMediaClass')}
    <p>Displays the media of the empty state, such as an icon or an image. You can also use it to display other components such as an avatar. Set <code>data-variant</code> to the same variant. The media is decorative, so mark the icon <code>aria-hidden="true"</code>.</p>
    ${table(html`<tr><td><code>variant</code></td><td><code>"default" | "icon"</code></td><td><code>"default"</code></td></tr>`)}
    ${codeFigure(`<div data-slot="empty-icon" data-variant="icon" class=\${emptyMediaClass({ variant: 'icon' })}>
  <svg aria-hidden="true">...</svg>
</div>`)}
    ${codeFigure(`<div data-slot="empty-icon" data-variant="default" class=\${emptyMediaClass()}>
  <span data-slot="avatar" class=\${avatarClass()}>
    <img data-slot="avatar-image" src="..." alt="" class=\${avatarImageClass()}>
    <span data-slot="avatar-fallback" class=\${avatarFallbackClass()}>CN</span>
  </span>
</div>`)}

    ${heading(toc, 3, 'emptyTitleClass')}
    <p>Displays the title of the empty state. Put it on a real heading, at the level the surrounding document wants.</p>
    ${codeFigure(`<h3 data-slot="empty-title" class=\${emptyTitleClass()}>No data</h3>`)}

    ${heading(toc, 3, 'emptyDescriptionClass')}
    <p>Displays the description of the empty state. A link inside it is underlined.</p>
    ${codeFigure(`<p data-slot="empty-description" class=\${emptyDescriptionClass()}>You do not have any notifications.</p>`)}

    ${heading(toc, 3, 'emptyContentClass')}
    <p>Displays the content of the empty state, such as a button, an input or a link.</p>
    ${codeFigure(`<div data-slot="empty-content" class=\${emptyContentClass()}>
  <button class=\${buttonClass()}>Add Project</button>
</div>`)}
  `;
}
