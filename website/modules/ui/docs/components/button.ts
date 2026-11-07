import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Button docs page body, ported from shadcn's
 * content/docs/components/radix/button.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'button-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';`)}
    ${codeFigure(`<button class=\${buttonClass({ variant: 'outline' })}>Button</button>`)}

    ${heading(toc, 2, 'Cursor')}
    <p>Tailwind v4 <a href="https://tailwindcss.com/docs/upgrade-guide#buttons-use-the-default-cursor">switched</a> from <code>cursor: pointer</code> to <code>cursor: default</code> for the button component.</p>
    <p>If you want to keep the <code>cursor: pointer</code> behavior, add the following code to your CSS file:</p>
    ${codeFigure(`@layer base {
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}`, { title: 'styles/globals.css', lineNumbers: true, lang: 'css' })}

    ${heading(toc, 2, 'Size')}
    <p>Use the <code>size</code> option to change the size of the button.</p>
    ${await componentPreview('button-size')}

    ${heading(toc, 2, 'Default')}
    ${await componentPreview('button-default')}

    ${heading(toc, 2, 'Outline')}
    ${await componentPreview('button-outline')}

    ${heading(toc, 2, 'Secondary')}
    ${await componentPreview('button-secondary')}

    ${heading(toc, 2, 'Ghost')}
    ${await componentPreview('button-ghost')}

    ${heading(toc, 2, 'Destructive')}
    ${await componentPreview('button-destructive')}

    ${heading(toc, 2, 'Link')}
    ${await componentPreview('button-link')}

    ${heading(toc, 2, 'Icon')}
    ${await componentPreview('button-icon')}

    ${heading(toc, 2, 'With Icon')}
    <p>Remember to add the <code>data-icon="inline-start"</code> or <code>data-icon="inline-end"</code> attribute to the icon for the correct spacing.</p>
    ${await componentPreview('button-with-icon')}

    ${heading(toc, 2, 'Rounded')}
    <p>Use the <code>rounded-full</code> class to make the button rounded.</p>
    ${await componentPreview('button-rounded')}

    ${heading(toc, 2, 'Spinner')}
    <p>Render a <code>spinner()</code> inside the button to show a loading state, and mark the button <code>disabled</code> with <code>aria-busy="true"</code> while it waits.</p>
    ${await componentPreview('button-spinner')}

    ${heading(toc, 2, 'Button Group')}
    <p>To create a button group, use the <code>buttonGroupClass()</code> helper. See the <a href="/ui/docs/components/button-group">Button Group</a> documentation for more details.</p>

    ${heading(toc, 2, 'As Link')}
    <p>A class helper styles any element, so a link that looks like a button is a link with the button's classes. There is no wrapper and no <code>asChild</code>.</p>
    ${await componentPreview('button-aschild')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'buttonClass')}
    <p><code>buttonClass()</code> returns the classes for a button. Put them on a native <code>&lt;button&gt;</code>, or on any element that should look like one. <code>buttonVariants()</code> is an alias of <code>buttonClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "outline" | "ghost" | "destructive" | "secondary" | "link"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
