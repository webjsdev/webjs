import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Direction docs page, ported from shadcn's
 * content/docs/components/radix/direction.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React. The kit has
 * no provider component: the platform's dir attribute is the provider.
 */
export const demo = 'card-rtl';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>There is no provider component to wrap your app in. Every kit component styles itself with logical properties (<code>ps-*</code>, <code>ms-*</code>, <code>start-*</code>, <code>text-start</code>), which the browser resolves from the nearest <code>dir</code> attribute, so setting <code>dir="rtl"</code> on an ancestor is the whole of it. Set <code>lang</code> on the same element, since a screen reader picks its voice from <code>lang</code>.</p>
    ${codeFigure(`<html lang="ar" dir="rtl">
  <body>
    <!-- Your app content -->
  </body>
</html>`, { lineNumbers: true, lang: 'html' })}
    <p>One region of a page can carry its own direction the same way:</p>
    ${codeFigure(`<section lang="ar" dir="rtl">
  <button type="button" data-slot="button" class=\${buttonClass()}>حفظ</button>
</section>`, { lineNumbers: true })}

    ${heading(toc, 2, 'useDirection')}
    <p>The <code>readDirection()</code> helper returns the direction in effect for an element: the nearest ancestor's <code>dir</code>, else <code>ltr</code>. It reads attributes only, so it also runs during server rendering. Reach for it in code that must branch on the direction itself, such as a keyboard handler mapping ArrowLeft to next in RTL.</p>
    ${codeFigure(`import { readDirection } from '#components/ui/direction.ts';

class MyComponent extends WebComponent {
  render() {
    const direction = readDirection(this);
    return html\`<div>Current direction: \${direction}</div>\`;
  }
}`, { lineNumbers: true })}
  `;
}
