import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Avatar docs page, ported from shadcn's
 * content/docs/components/radix/avatar.mdx (#1666): the same sections in the
 * same order, the prose rewritten where it describes React.
 */
export const demo = 'avatar-demo';

const noOptions = (slot: string, element: string) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr><th>Element</th><th>Attributes</th><th>Options</th></tr></thead>
      <tbody><tr><td><code>${element}</code></td><td><code>data-slot="${slot}"</code></td><td>none</td></tr></tbody>
    </table>
  </div>`;

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  avatarClass,
  avatarImageClass,
  avatarFallbackClass,
} from '#components/ui/avatar.ts';`, { lineNumbers: true })}
    ${codeFigure(`<span data-slot="avatar" data-size="default" class=\${avatarClass()}>
  <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=\${avatarImageClass()}>
  <span data-slot="avatar-fallback" class=\${avatarFallbackClass()}>VK</span>
</span>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an avatar:</p>
    ${codeFigure(`avatarClass()
├── avatarImageClass()
├── avatarFallbackClass()
└── avatarBadgeClass()`, { lang: 'text' })}
    <p>Use the following composition to build an avatar group:</p>
    ${codeFigure(`avatarGroupClass()
├── avatarClass()
│   ├── avatarImageClass()
│   ├── avatarFallbackClass()
│   └── avatarBadgeClass()
├── avatarClass()
│   ├── avatarImageClass()
│   ├── avatarFallbackClass()
│   └── avatarBadgeClass()
└── avatarGroupCountClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic avatar with an image and a fallback.</p>
    ${await componentPreview('avatar-basic')}

    ${heading(toc, 2, 'Badge')}
    <p>Use <code>avatarBadgeClass()</code> to add a badge to the avatar. The badge is positioned at the bottom right of the avatar.</p>
    ${await componentPreview('avatar-badge')}
    <p>Merge your own classes with the helper through <code>cn()</code> to add custom styles to the badge such as custom colors, sizes, etc.</p>
    ${codeFigure(`<span data-slot="avatar" data-size="default" class=\${avatarClass()}>
  <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=\${avatarImageClass()}>
  <span data-slot="avatar-fallback" class=\${avatarFallbackClass()}>VK</span>
  <span data-slot="avatar-badge" class=\${cn(avatarBadgeClass(), 'bg-green-600 dark:bg-green-800')}></span>
</span>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Badge with Icon')}
    <p>You can also put an icon inside the badge.</p>
    ${await componentPreview('avatar-badge-icon')}

    ${heading(toc, 2, 'Avatar Group')}
    <p>Use <code>avatarGroupClass()</code> to add a group of avatars.</p>
    ${await componentPreview('avatar-group')}

    ${heading(toc, 2, 'Avatar Group Count')}
    <p>Use <code>avatarGroupCountClass()</code> to add a count to the group.</p>
    ${await componentPreview('avatar-group-count')}

    ${heading(toc, 2, 'Avatar Group with Icon')}
    <p>You can also put an icon inside the group count.</p>
    ${await componentPreview('avatar-group-count-icon')}

    ${heading(toc, 2, 'Sizes')}
    <p>Use the <code>data-size</code> attribute to change the size of the avatar. The styles key on it, so set it to match the <code>size</code> you pass to <code>avatarClass()</code>.</p>
    ${await componentPreview('avatar-size')}

    ${heading(toc, 2, 'Dropdown')}
    <p>You can use an avatar inside the trigger of a <code>&lt;ui-dropdown-menu&gt;</code>.</p>
    ${await componentPreview('avatar-dropdown')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('avatar-rtl', { direction: 'rtl', previewClass: 'h-72' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper you put on a native element, with the <code>data-slot</code> its styles key on.</p>

    ${heading(toc, 3, 'avatarClass')}
    <p><code>avatarClass()</code> is the root that wraps the avatar image and fallback. Put it on a <code>&lt;span&gt;</code> and set <code>data-size</code>, which is what the styles read.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option / Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>size</code> / <code>data-size</code></td><td><code>"default" | "sm" | "lg"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'avatarImageClass')}
    <p><code>avatarImageClass()</code> styles the avatar image. Put it on an <code>&lt;img&gt;</code> with a <code>src</code> and an <code>alt</code> that names the person, or <code>alt=""</code> when a visible text fallback already names them.</p>
    ${noOptions('avatar-image', '<img>')}

    ${heading(toc, 3, 'avatarFallbackClass')}
    <p><code>avatarFallbackClass()</code> styles the fallback, shown when the image is missing or fails to load. Always include it so the avatar is still named.</p>
    ${noOptions('avatar-fallback', '<span>')}

    ${heading(toc, 3, 'avatarBadgeClass')}
    <p><code>avatarBadgeClass()</code> styles a badge indicator on the avatar, positioned at the bottom right (the inline end under <code>dir="rtl"</code>).</p>
    ${noOptions('avatar-badge', '<span>')}

    ${heading(toc, 3, 'avatarGroupClass')}
    <p><code>avatarGroupClass()</code> displays a group of avatars with overlapping styling.</p>
    ${noOptions('avatar-group', '<div>')}

    ${heading(toc, 3, 'avatarGroupCountClass')}
    <p><code>avatarGroupCountClass()</code> displays a count indicator in an avatar group, typically showing the number of additional avatars.</p>
    ${noOptions('avatar-group-count', '<div>')}
  `;
}
