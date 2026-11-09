/**
 * The muscle-memory corpus, "refused" half: Lit and Next.js habits WebJs cannot
 * honour. Each case is a component an agent plausibly writes, and each must be
 * refused LOUDLY with the WebJs fix: by `webjs check` (the `rule`, whose message
 * matches `fix`) and at load or render time in dev (`load`, matched against the
 * response body plus everything logged).
 *
 * `file` is written under the app beside a page that imports it and renders its
 * `tag`. A case with no `tag` is itself the app shape (a page, a layout, a
 * route file), so no page is written for it; `extra` adds further files.
 * `load.path` is the URL requested in dev.
 */

/** @typedef {{ id: string, idiom: string, file: string, tag?: string, source: string, extra?: Record<string, string>, rule: string, fix: RegExp, load?: { path: string, match: RegExp }, serverLoadsOnBun?: boolean }} RefusedCase */

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
  {
    id: 'next-navigation',
    idiom: "importing redirect from 'next/navigation'",
    file: 'app/page.ts',
    source: [
      "import { html } from '@webjsdev/core';",
      "import { redirect } from 'next/navigation';",
      'export default function Page() { if (Date.now() < 0) redirect(\'/\'); return html`<main>page</main>`; }',
      '',
    ].join('\n'),
    rule: 'no-foreign-framework-import',
    fix: /import \{ redirect, permanentRedirect, notFound[^\n]*from '@webjsdev\/core'/,
    load: { path: '/', match: /\[no-foreign-framework-import\][^\n]*'next\/navigation'[^\n]*from '@webjsdev\/core'/ },
  },
  {
    id: 'react-hooks',
    idiom: "a component built with React's useState",
    file: 'components/react-el.ts',
    tag: 'react-el',
    source: [
      "import { useState } from 'react';",
      "import { WebComponent, html } from '@webjsdev/core';",
      'export class ReactEl extends WebComponent {',
      '  render() { void useState; return html`<p>react</p>`; }',
      '}',
      "ReactEl.register('react-el');",
      '',
    ].join('\n'),
    rule: 'no-foreign-framework-import',
    fix: /useState becomes a reactive property or signal\(\)/,
    load: { path: '/', match: /\[no-foreign-framework-import\][^\n]*'react'[^\n]*useState becomes a reactive property/ },
  },
  {
    id: 'lit-package',
    idiom: "importing from the lit package",
    file: 'components/lit-pkg.ts',
    tag: 'lit-pkg',
    source: [
      "import { LitElement, html } from 'lit';",
      'export class LitPkg extends LitElement {',
      '  render() { return html`<p>lit</p>`; }',
      '}',
      "customElements.define('lit-pkg', LitPkg);",
      '',
    ].join('\n'),
    rule: 'no-foreign-framework-import',
    fix: /LitElement is WebComponent/,
    load: { path: '/', match: /\[no-foreign-framework-import\][^\n]*'lit'[^\n]*LitElement is WebComponent/ },
  },
  {
    id: 'jsx-attributes',
    idiom: 'JSX attribute spellings (className, onClick) in an html template',
    file: 'components/jsx-el.ts',
    tag: 'jsx-el',
    source: [
      "import { WebComponent, html } from '@webjsdev/core';",
      'export class JsxEl extends WebComponent {',
      '  render() { return html`<button className="btn" onClick=${() => {}}>go</button>`; }',
      '}',
      "JsxEl.register('jsx-el');",
      '',
    ].join('\n'),
    rule: 'no-jsx-attributes',
    fix: /Write `class=` instead/,
    // The failure is isolated to the element, so the page answers 200 and the
    // dev status carries it as a `component` entry.
    load: { path: '/', match: /"kind":"component","message":"<jsx-el> failed to render during SSR[^\n]*Write `class=` instead/ },
  },
  {
    id: 'tsx-route',
    idiom: 'a page written as page.tsx',
    file: 'app/about/page.tsx',
    source: "export default function About() { return 'about'; }\n",
    extra: { 'app/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
      '',
    ].join('\n') },
    rule: 'no-jsx-route-file',
    fix: /Rename it to app\/about\/page\.ts/,
    load: { path: '/', match: /\[no-jsx-route-file\][^\n]*Rename it to app\/about\/page\.ts/ },
  },
  {
    id: 'css-import',
    idiom: "importing a stylesheet in the root layout (import './globals.css')",
    file: 'app/layout.ts',
    source: [
      "import { html } from '@webjsdev/core';",
      "import './globals.css';",
      'export default function RootLayout({ children }: { children: unknown }) { return html`${children}`; }',
      '',
    ].join('\n'),
    extra: {
      'app/globals.css': 'body { margin: 0; }\n',
      'app/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
        '',
      ].join('\n'),
    },
    rule: 'no-css-import',
    fix: /<link rel="stylesheet"/,
    load: { path: '/', match: /\[no-css-import\][^\n]*globals\.css[^\n]*<link rel=/ },
  },
  {
    id: 'inline-use-server',
    idiom: "an inline 'use server' function inside a page",
    file: 'app/page.ts',
    source: [
      "import { html } from '@webjsdev/core';",
      'export default function Page() {',
      '  async function save(data: FormData) {',
      "    'use server';",
      '    void data;',
      '  }',
      '  return html`<form action=${save}><button>Save</button></form>`;',
      '}',
      '',
    ].join('\n'),
    rule: 'no-inline-use-server',
    fix: /Move the function into its own module, e\.g\. modules\/<feature>\/actions\/<name>\.server\.ts/,
    load: { path: '/', match: /A 'use server' directive inside a function body \(Next\.js's inline action\) is not one/ },
  },
  {
    id: 'next-public-env',
    idiom: 'reading NEXT_PUBLIC_ env vars in a component',
    file: 'components/env-el.ts',
    tag: 'env-el',
    source: [
      "import { WebComponent, html } from '@webjsdev/core';",
      'export class EnvEl extends WebComponent {',
      '  render() { return html`<button @click=${() => {}}>${process.env.NEXT_PUBLIC_SITE_NAME}</button>`; }',
      '}',
      "EnvEl.register('env-el');",
      '',
    ].join('\n'),
    rule: 'no-server-env-in-components',
    fix: /WEBJS_PUBLIC_/,
  },
  {
    id: 'next-runtime-guard',
    idiom: "a process.env.NEXT_RUNTIME guard",
    file: 'instrumentation.ts',
    source: [
      'export async function register() {',
      "  if (process.env.NEXT_RUNTIME === 'nodejs') {",
      '    // set up tracing',
      '  }',
      '}',
      '',
    ].join('\n'),
    extra: { 'app/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
      '',
    ].join('\n') },
    rule: 'no-next-runtime-guard',
    // Nothing fails at runtime (the guarded code just never runs), so the check
    // is the only place this can be refused.
    fix: /process\.versions\.bun/,
  },
  {
    id: 'next-url',
    idiom: 'reading request.nextUrl in middleware',
    file: 'middleware.ts',
    source: [
      'export function middleware(request: Request & { nextUrl: URL }) {',
      "  if (request.nextUrl.pathname === '/old') return Response.redirect(new URL('/', request.url), 307);",
      '}',
      '',
    ].join('\n'),
    extra: { 'app/page.ts': [
      "import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
      '',
    ].join('\n') },
    rule: 'no-next-url',
    fix: /new URL\(request\.url\)/,
    load: { path: '/', match: /request\.nextUrl[^\n]*new URL\(request\.url\)/ },
  },
  {
    id: 'page-and-route',
    idiom: 'a page.ts and a route.ts in one folder',
    file: 'app/about/route.ts',
    source: "export async function GET() { return Response.json({ ok: true }); }\n",
    extra: {
      'app/about/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
        '',
      ].join('\n'),
      'app/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
        '',
      ].join('\n'),
    },
    rule: 'no-page-route-conflict',
    fix: /move the route handler to its own folder/,
    load: { path: '/', match: /\[no-page-route-conflict\][^\n]*both answer \/about/ },
  },
  {
    id: 'public-route-conflict',
    idiom: 'a public/ file at the same URL as a page',
    file: 'public/about',
    source: 'static about\n',
    extra: {
      'app/about/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
        '',
      ].join('\n'),
      'app/page.ts': ["import { html } from '@webjsdev/core';",
      'export default function Page() { return html`<main>page</main>`; }',
        '',
      ].join('\n'),
    },
    rule: 'no-public-route-conflict',
    fix: /public files are served at the url root/,
    load: { path: '/', match: /\[no-public-route-conflict\][^\n]*public\/about is served at \/about/ },
  },
];

/**
 * The files of the app a case is tested in, keyed by app-relative path: a
 * minimal app, the case's file, a page that renders its `tag` (when it has
 * one), and its `extra` files.
 * @param {RefusedCase} c
 * @returns {Record<string, string>}
 */
export function caseFiles(c) {
  /** @type {Record<string, string>} */
  const files = {
    'package.json': JSON.stringify({ name: `refused-${c.id}`, private: true, type: 'module' }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, erasableSyntaxOnly: true, verbatimModuleSyntax: true } }),
  };
  if (c.tag) {
    files['app/page.ts'] = `import { html } from '@webjsdev/core';\nimport '../${c.file}';\nexport default function Page() { return html\`<main><${c.tag}></${c.tag}></main>\`; }\n`;
  }
  Object.assign(files, c.extra || {});
  files[c.file] = c.source;
  return files;
}
