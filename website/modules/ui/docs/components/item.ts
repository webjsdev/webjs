import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Item docs page body, ported from shadcn's
 * content/docs/components/radix/item.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'item-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  itemClass,
  itemActionsClass,
  itemContentClass,
  itemDescriptionClass,
  itemMediaClass,
  itemTitleClass,
} from '#components/ui/item.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="item" class=\${itemClass()}>
  <div data-slot="item-media" data-variant="icon" class=\${itemMediaClass({ variant: 'icon' })}>
    \${Icon()}
  </div>
  <div data-slot="item-content" class=\${itemContentClass()}>
    <div data-slot="item-title" class=\${itemTitleClass()}>Title</div>
    <p data-slot="item-description" class=\${itemDescriptionClass()}>Description</p>
  </div>
  <div data-slot="item-actions" class=\${itemActionsClass()}>
    <button class=\${buttonClass()}>Action</button>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an item:</p>
    ${codeFigure(`itemGroupClass
└── itemClass
    ├── itemHeaderClass
    ├── itemMediaClass
    ├── itemContentClass
    │   ├── itemTitleClass
    │   └── itemDescriptionClass
    ├── itemActionsClass
    └── itemFooterClass`, { lang: 'text' })}

    ${heading(toc, 2, 'Item vs Field')}
    <p>Use <a href="/ui/docs/components/field">Field</a> if you need to display a form input such as a checkbox, input, radio, or select.</p>
    <p>If you only need to display content such as a title, description, and actions, use Item.</p>

    ${heading(toc, 2, 'Variant')}
    <p>Use the <code>variant</code> option to change the visual style of the item.</p>
    ${await componentPreview('item-variant', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Size')}
    <p>Use the <code>size</code> option to change the size of the item. Available sizes are <code>default</code>, <code>sm</code>, and <code>xs</code>.</p>
    ${await componentPreview('item-size', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Icon')}
    <p>Use <code>itemMediaClass({ variant: 'icon' })</code> to display an icon.</p>
    ${await componentPreview('item-icon')}

    ${heading(toc, 2, 'Avatar')}
    <p>You can put an avatar inside the default <code>itemMediaClass()</code> media to display it.</p>
    ${await componentPreview('item-avatar')}

    ${heading(toc, 2, 'Image')}
    <p>Use <code>itemMediaClass({ variant: 'image' })</code> to display an image.</p>
    ${await componentPreview('item-image')}

    ${heading(toc, 2, 'Group')}
    <p>Use <code>itemGroupClass()</code> to group related items together. A group is a list, so give it <code>role="list"</code> and each item <code>role="listitem"</code>, or use <code>&lt;ul&gt;</code> and <code>&lt;li&gt;</code>.</p>
    ${await componentPreview('item-group', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Header')}
    <p>Use <code>itemHeaderClass()</code> to add a header above the item content.</p>
    ${await componentPreview('item-header', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Link')}
    <p>A class helper styles any element, so an item that is a link is an <code>&lt;a&gt;</code> with the item's classes. There is no wrapper and no <code>asChild</code>. The hover and focus states apply to the anchor element.</p>
    ${await componentPreview('item-link')}
    ${codeFigure(`<a href="/dashboard" data-slot="item" class=\${itemClass()}>
  <div data-slot="item-media" data-variant="icon" class=\${itemMediaClass({ variant: 'icon' })}>
    \${HomeIcon()}
  </div>
  <div data-slot="item-content" class=\${itemContentClass()}>
    <div data-slot="item-title" class=\${itemTitleClass()}>Dashboard</div>
    <p data-slot="item-description" class=\${itemDescriptionClass()}>Overview of your account and activity.</p>
  </div>
</a>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Dropdown')}
    ${await componentPreview('item-dropdown')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('item-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper. Set the part's <code>data-slot</code> on the element as well, since the styles use it to lay the parts out relative to each other.</p>

    ${heading(toc, 3, 'itemClass')}
    <p>The main part, for displaying content with media, title, description, and actions. Put it on a <code>&lt;div&gt;</code>, or on an <code>&lt;a&gt;</code> or <code>&lt;button&gt;</code> when the whole row acts. <code>itemVariants()</code> is an alias of <code>itemClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "outline" | "muted"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm" | "xs"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'itemGroupClass')}
    <p>A container that groups related items together with consistent styling.</p>
    ${codeFigure(`<div role="list" data-slot="item-group" class=\${itemGroupClass()}>
  <div role="listitem" data-slot="item" class=\${itemClass()}>...</div>
  <div role="listitem" data-slot="item" class=\${itemClass()}>...</div>
</div>`)}

    ${heading(toc, 3, 'itemSeparatorClass')}
    <p>A separator between items in a group.</p>
    ${codeFigure(`<div role="list" data-slot="item-group" class=\${itemGroupClass()}>
  <div role="listitem" data-slot="item" class=\${itemClass()}>...</div>
  <div role="separator" data-slot="item-separator" class=\${itemSeparatorClass()}></div>
  <div role="listitem" data-slot="item" class=\${itemClass()}>...</div>
</div>`)}

    ${heading(toc, 3, 'itemMediaClass')}
    <p>Use <code>itemMediaClass()</code> to display media content such as icons, images, or avatars. <code>itemMediaVariants()</code> is an alias of <code>itemMediaClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "icon" | "image"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<div data-slot="item-media" data-variant="icon" class=\${itemMediaClass({ variant: 'icon' })}>
  \${Icon()}
</div>`)}
    ${codeFigure(`<div data-slot="item-media" data-variant="image" class=\${itemMediaClass({ variant: 'image' })}>
  <img src="..." alt="...">
</div>`)}

    ${heading(toc, 3, 'itemContentClass')}
    <p>Wraps the title and description of the item.</p>
    ${codeFigure(`<div data-slot="item-content" class=\${itemContentClass()}>
  <div data-slot="item-title" class=\${itemTitleClass()}>Title</div>
  <p data-slot="item-description" class=\${itemDescriptionClass()}>Description</p>
</div>`)}

    ${heading(toc, 3, 'itemTitleClass')}
    <p>Displays the title of the item.</p>
    ${codeFigure(`<div data-slot="item-title" class=\${itemTitleClass()}>Item Title</div>`)}

    ${heading(toc, 3, 'itemDescriptionClass')}
    <p>Displays the description of the item.</p>
    ${codeFigure(`<p data-slot="item-description" class=\${itemDescriptionClass()}>Item description</p>`)}

    ${heading(toc, 3, 'itemActionsClass')}
    <p>Container for action buttons or other interactive elements.</p>
    ${codeFigure(`<div data-slot="item-actions" class=\${itemActionsClass()}>
  <button class=\${buttonClass()}>Action</button>
</div>`)}

    ${heading(toc, 3, 'itemHeaderClass')}
    <p>Displays a header above the item content.</p>
    ${codeFigure(`<div data-slot="item" class=\${itemClass()}>
  <div data-slot="item-header" class=\${itemHeaderClass()}>Header</div>
  <div data-slot="item-content" class=\${itemContentClass()}>...</div>
</div>`)}

    ${heading(toc, 3, 'itemFooterClass')}
    <p>Displays a footer below the item content.</p>
    ${codeFigure(`<div data-slot="item" class=\${itemClass()}>
  <div data-slot="item-content" class=\${itemContentClass()}>...</div>
  <div data-slot="item-footer" class=\${itemFooterClass()}>Footer</div>
</div>`)}
  `;
}
