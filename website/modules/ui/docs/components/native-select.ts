import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { InfoIcon } from '#lib/ui/lucide.ts';

/**
 * The Native Select docs page, ported from shadcn's
 * content/docs/components/radix/native-select.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
export const demo = 'native-select-demo';

const TABLE = 'typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full';

/** The Callout shadcn places before Installation. */
export async function intro(_toc: TocEntry[]) {
  return callout(
    html`For a styled select component, see the <a href="/ui/docs/components/select">Select</a> component.`,
    { variant: 'info', icon: InfoIcon('translate-y-[3px]!') },
  );
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  nativeSelectWrapperClass,
  nativeSelectClass,
  nativeSelectIconClass,
} from '#components/ui/native-select.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div class=\${nativeSelectWrapperClass()}>
  <select class=\${nativeSelectClass()} aria-label="Fruit">
    <option value="">Select a fruit</option>
    <option value="apple">Apple</option>
    <option value="banana">Banana</option>
    <option value="blueberry">Blueberry</option>
    <option value="pineapple">Pineapple</option>
  </select>
  <svg class=\${nativeSelectIconClass()} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}

    ${heading(toc, 3, 'Simple')}
    <p>Options placed directly under the <code>&lt;select&gt;</code> (no <code>&lt;optgroup&gt;</code>).</p>
    ${codeFigure(`nativeSelectWrapperClass()
├── nativeSelectClass() on <select>
│   ├── <option>
│   ├── <option>
│   ├── <option>
│   └── <option>
└── nativeSelectIconClass() on the chevron`, { lang: 'text' })}

    ${heading(toc, 3, 'With groups')}
    <p>Use a native <code>&lt;optgroup&gt;</code> to organize options into categories.</p>
    ${codeFigure(`nativeSelectWrapperClass()
├── nativeSelectClass() on <select>
│   ├── <optgroup>
│   │   ├── <option>
│   │   └── <option>
│   └── <optgroup>
│       ├── <option>
│       └── <option>
└── nativeSelectIconClass() on the chevron`, { lang: 'text' })}

    ${heading(toc, 2, 'Groups')}
    <p>Use a native <code>&lt;optgroup&gt;</code> to organize options into categories.</p>
    ${await componentPreview('native-select-groups')}

    ${heading(toc, 2, 'Disabled')}
    <p>Add the <code>disabled</code> attribute to the <code>&lt;select&gt;</code> to disable it. The wrapper dims itself while its select is disabled.</p>
    ${await componentPreview('native-select-disabled')}

    ${heading(toc, 2, 'Invalid')}
    <p>Use <code>aria-invalid</code> to show validation errors and the <code>data-invalid</code> attribute on the <a href="/ui/docs/components/field">Field</a> wrapper for styling.</p>
    ${await componentPreview('native-select-invalid')}

    ${heading(toc, 2, 'Native Select vs Select')}
    <ul>
      <li>Use Native Select for native browser behavior, better performance, or mobile-optimized dropdowns.</li>
      <li>Use <a href="/ui/docs/components/select">Select</a> for custom styling, animations, or complex interactions.</li>
    </ul>

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('native-select-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}

    ${heading(toc, 3, 'nativeSelectClass')}
    <p>The classes for the native <code>&lt;select&gt;</code> element. It hides the platform chevron, so wrap the select in an element with <code>nativeSelectWrapperClass()</code> and put the chevron icon after it with <code>nativeSelectIconClass()</code>. The chevron is decorative, so keep <code>aria-hidden="true"</code> on it. Every native attribute (<code>name</code>, <code>required</code>, <code>disabled</code>, <code>multiple</code>) works as usual, and the select submits with its form with no script.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Helper</th><th>Applies to</th></tr></thead>
        <tbody>
          <tr><td><code>nativeSelectWrapperClass()</code></td><td>The wrapper around the select and its chevron. Set <code>data-size="sm"</code> on the wrapper and the select for the small size.</td></tr>
          <tr><td><code>nativeSelectClass()</code></td><td>The <code>&lt;select&gt;</code> element.</td></tr>
          <tr><td><code>nativeSelectIconClass()</code></td><td>The chevron icon.</td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<div class=\${nativeSelectWrapperClass()}>
  <select class=\${nativeSelectClass()} aria-label="Option">
    <option value="option1">Option 1</option>
    <option value="option2">Option 2</option>
  </select>
  <svg class=\${nativeSelectIconClass()} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</div>`)}

    ${heading(toc, 3, 'nativeSelectOptionClass')}
    <p>An individual option is a native <code>&lt;option&gt;</code>. The theme stylesheet already gives every option the themed colours, so a bare <code>&lt;option&gt;</code> needs no class; <code>nativeSelectOptionClass()</code> applies the same colours explicitly.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'nativeSelectOptGroupClass')}
    <p>Groups related options together with a native <code>&lt;optgroup&gt;</code>. Its label is announced, so it is real structure rather than only a visual break. Like options, it takes the themed colours with no class; <code>nativeSelectOptGroupClass()</code> applies them explicitly.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>label</code></td><td><code>string</code></td><td></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<optgroup label="Fruits">
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
</optgroup>`)}
  `;
}
