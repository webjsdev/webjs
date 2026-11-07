import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';

/**
 * The Button Group docs page, ported from shadcn's
 * content/docs/components/radix/button-group.mdx (#1666): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
export const demo = 'button-group-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  buttonGroupClass,
  buttonGroupSeparatorClass,
  buttonGroupTextClass,
} from '#components/ui/button-group.ts';`)}
    ${codeFigure(`<div role="group" data-slot="button-group" data-orientation="horizontal" class=\${buttonGroupClass()}>
  <button class=\${buttonClass({ variant: 'outline' })}>Button 1</button>
  <button class=\${buttonClass({ variant: 'outline' })}>Button 2</button>
</div>`)}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a button group:</p>
    ${codeFigure(`buttonGroupClass()
├── a button or an input
├── buttonGroupSeparatorClass()
└── buttonGroupTextClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Accessibility')}
    <ul>
      <li>Put <code>role="group"</code> on the element that carries <code>buttonGroupClass()</code>. The helper returns classes only, so the role is yours to write.</li>
      <li>Use <kbd data-slot="kbd" class=${kbdClass()}>Tab</kbd> to navigate between the buttons in the group.</li>
      <li>Use <code>aria-label</code> or <code>aria-labelledby</code> to label the button group.</li>
    </ul>
    ${codeFigure(`<div role="group" aria-label="Button group" class=\${buttonGroupClass()}>
  <button class=\${buttonClass({ variant: 'outline' })}>Button 1</button>
  <button class=\${buttonClass({ variant: 'outline' })}>Button 2</button>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'ButtonGroup vs ToggleGroup')}
    <ul>
      <li>Use a button group when you want to group buttons that perform an action.</li>
      <li>Use the <a href="/ui/docs/components/toggle-group">Toggle Group</a> when you want to group buttons that toggle a state.</li>
    </ul>

    ${heading(toc, 2, 'Orientation')}
    <p>Pass the <code>orientation</code> option to <code>buttonGroupClass()</code>, and set the matching <code>data-orientation</code>, to change the button group layout.</p>
    ${await componentPreview('button-group-orientation')}

    ${heading(toc, 2, 'Size')}
    <p>Control the size of buttons using the <code>size</code> option of <code>buttonClass()</code> on individual buttons.</p>
    ${await componentPreview('button-group-size')}

    ${heading(toc, 2, 'Nested')}
    <p>Nest button groups to create button groups with spacing.</p>
    ${await componentPreview('button-group-nested')}

    ${heading(toc, 2, 'Separator')}
    <p><code>buttonGroupSeparatorClass()</code> visually divides buttons within a group. Compose it with the separator helper, <code>cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass())</code>.</p>
    <p>Buttons with variant <code>outline</code> do not need a separator since they have a border. For other variants, a separator is recommended to improve the visual hierarchy.</p>
    ${await componentPreview('button-group-separator')}

    ${heading(toc, 2, 'Split')}
    <p>Create a split button group by adding two buttons separated by a separator.</p>
    ${await componentPreview('button-group-split')}

    ${heading(toc, 2, 'Input')}
    <p>Wrap an <a href="/ui/docs/components/input">Input</a> with buttons.</p>
    ${await componentPreview('button-group-input')}

    ${heading(toc, 2, 'Input Group')}
    <p>Wrap an <a href="/ui/docs/components/input-group">Input Group</a> to create complex input layouts.</p>
    ${await componentPreview('button-group-input-group')}

    ${heading(toc, 2, 'Dropdown Menu')}
    <p>Create a split button group with a <a href="/ui/docs/components/dropdown-menu">Dropdown Menu</a>. The menu names its trigger with <code>trigger="&lt;id&gt;"</code>, so the button stays a direct child of the group.</p>
    ${await componentPreview('button-group-dropdown')}

    ${heading(toc, 2, 'Select')}
    <p>Pair with a <a href="/ui/docs/components/select">Select</a>.</p>
    ${await componentPreview('button-group-select')}

    ${heading(toc, 2, 'Popover')}
    <p>Use with a <a href="/ui/docs/components/popover">Popover</a>.</p>
    ${await componentPreview('button-group-popover')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('button-group-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'buttonGroupClass')}
    <p><code>buttonGroupClass()</code> returns the classes for a container that groups related buttons together with consistent styling. Put them on an element with <code>role="group"</code>, <code>data-slot="button-group"</code> and a <code>data-orientation</code> matching the option. <code>buttonGroupVariants()</code> is an alias of <code>buttonGroupClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<div role="group" data-slot="button-group" data-orientation="horizontal" class=\${buttonGroupClass()}>
  <button class=\${buttonClass()}>Button 1</button>
  <button class=\${buttonClass()}>Button 2</button>
</div>`)}
    <p>Nest multiple button groups to create complex layouts with spacing. See the <a href="#nested">nested</a> example for more details.</p>
    ${codeFigure(`<div role="group" data-slot="button-group" class=\${buttonGroupClass()}>
  <div role="group" data-slot="button-group" class=\${buttonGroupClass()}></div>
  <div role="group" data-slot="button-group" class=\${buttonGroupClass()}></div>
</div>`)}

    ${heading(toc, 3, 'buttonGroupSeparatorClass')}
    <p><code>buttonGroupSeparatorClass()</code> visually divides buttons within a group. It takes no options: compose it with <code>separatorClass()</code> and set the orientation on the element with <code>data-orientation</code>, which is <code>"vertical"</code> for a horizontal group.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>data-orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"vertical"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<div role="group" data-slot="button-group" class=\${buttonGroupClass()}>
  <button class=\${buttonClass()}>Button 1</button>
  <div
    role="none"
    data-slot="button-group-separator"
    data-orientation="vertical"
    class=\${cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass())}
  ></div>
  <button class=\${buttonClass()}>Button 2</button>
</div>`)}

    ${heading(toc, 3, 'buttonGroupTextClass')}
    <p>Use this helper to display text within a button group. It takes no options.</p>
    ${codeFigure(`<div role="group" data-slot="button-group" class=\${buttonGroupClass()}>
  <div class=\${buttonGroupTextClass()}>Text</div>
  <button class=\${buttonClass()}>Button</button>
</div>`)}
    <p>A class helper styles any element, so there is no <code>asChild</code>: to render the text as a label, put the classes on a <code>&lt;label&gt;</code>.</p>
    ${codeFigure(`import { buttonGroupClass, buttonGroupTextClass } from '#components/ui/button-group.ts';
import { inputClass } from '#components/ui/input.ts';

export function ButtonGroupTextDemo() {
  return html\`
    <div role="group" data-slot="button-group" class=\${buttonGroupClass()}>
      <label for="name" class=\${buttonGroupTextClass()}>Text</label>
      <input id="name" placeholder="Type something here..." class=\${inputClass()}>
    </div>
  \`;
}`, { lineNumbers: true })}
  `;
}
