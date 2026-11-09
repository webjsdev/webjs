/**
 * The muscle-memory corpus, "refused" half: Lit and Next.js habits WebJs cannot
 * honour. Each case is a component an agent plausibly writes, and each must be
 * refused LOUDLY with the WebJs fix: by `webjs check` (the `rule`, whose message
 * matches `fix`) and at load or render time in dev (`load`, matched against the
 * response body plus everything logged).
 *
 * `file` is written under the app beside a page that imports it and renders its
 * `tag`; `load.path` is the URL requested in dev.
 */

/** @typedef {{ id: string, idiom: string, file: string, tag: string, source: string, rule: string, fix: RegExp, load?: { path: string, match: RegExp }, serverLoadsOnBun?: boolean }} RefusedCase */

/** @type {RefusedCase[]} */
export const REFUSED = [
  {
    id: 'decorators',
    idiom: 'Lit decorators: @customElement and @property',
    file: 'components/deco-el.ts',
    tag: 'deco-el',
    source: [
      "import { WebComponent, html } from '@webjsdev/core';",
      '',
      "@customElement('deco-el')",
      'export class DecoEl extends WebComponent {',
      "  @property() name = '';",
      '  render() { return html`<p>${this.name}</p>`; }',
      '}',
      '',
    ].join('\n'),
    rule: 'no-non-erasable-typescript',
    fix: /\.register\('my-el'\)/,
    load: { path: '/components/deco-el.ts', match: /\.register\('my-el'\)/ },
  },
  {
    id: 'lit-element',
    idiom: 'extending LitElement',
    file: 'components/lit-el.ts',
    tag: 'lit-el',
    source: [
      "import { LitElement, html } from '@webjsdev/core';",
      '',
      'export class LitEl extends LitElement {',
      '  render() { return html`<p>lit</p>`; }',
      '}',
      "customElements.define('lit-el', LitEl);",
      '',
    ].join('\n'),
    rule: 'core-imports-exist',
    fix: /WebComponent/,
    load: { path: '/', match: /`LitElement` is not a runtime export of @webjsdev\/core[^\n]*WebComponent/ },
  },
  {
    id: 'type-as-value',
    idiom: 'importing a type such as PropertyValues as a value',
    file: 'components/typed-el.ts',
    tag: 'typed-el',
    source: [
      "import { WebComponent, html, PropertyValues } from '@webjsdev/core';",
      '',
      'export class TypedEl extends WebComponent {',
      '  updated(changed: PropertyValues<this>) { void changed; }',
      '  render() { return html`<p>typed</p>`; }',
      '}',
      "customElements.define('typed-el', TypedEl);",
      '',
    ].join('\n'),
    rule: 'core-imports-exist',
    fix: /import type/,
    load: { path: '/', match: /`PropertyValues` is not a runtime export of @webjsdev\/core[^\n]*import type/ },
    // Bun's own transpiler drops an import used only as a type, so a Bun server
    // renders this module and only the browser (served the import intact)
    // fails. There the check rule is the refusal.
    serverLoadsOnBun: true,
  },
  {
    id: 'light-dom-styles',
    idiom: 'static styles on a component, which Lit renders in shadow DOM',
    file: 'components/styled-el.ts',
    tag: 'styled-el',
    source: [
      "import { WebComponent, html, css } from '@webjsdev/core';",
      '',
      'export class StyledEl extends WebComponent {',
      '  static styles = css`p { color: red; }`;',
      '  render() { return html`<p>styled</p>`; }',
      '}',
      "customElements.define('styled-el', StyledEl);",
      '',
    ].join('\n'),
    rule: 'static-styles-need-shadow',
    fix: /static shadow = true/,
    load: { path: '/', match: /static styles[^\n]*static shadow = true/ },
  },
  {
    id: 'shadow-options-light',
    idiom: 'static shadowRootOptions on a component, which Lit renders in shadow DOM',
    file: 'components/focus-el.ts',
    tag: 'focus-el',
    source: [
      "import { WebComponent, html } from '@webjsdev/core';",
      '',
      'export class FocusEl extends WebComponent {',
      "  static shadowRootOptions = { mode: 'open' as const, delegatesFocus: true };",
      '  render() { return html`<button>focus</button>`; }',
      '}',
      "customElements.define('focus-el', FocusEl);",
      '',
    ].join('\n'),
    rule: 'shadow-options-need-shadow',
    fix: /static shadow = true/,
  },
];
