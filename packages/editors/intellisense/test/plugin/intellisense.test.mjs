/**
 * Unit tests for @webjsdev/intellisense: verifies the language-service decorator
 * returns a correct `getDefinitionAndBoundSpan` result for a cursor
 * positioned on a custom-element tag inside an html`` template.
 *
 * Builds a tiny in-memory TypeScript language service host, plants two
 * fixture files, and drives the plugin directly: no tsserver, no
 * editor.
 *
 * The plugin recognises the web-standard convention:
 *
 *     class Counter extends WebComponent { … }
 *     Counter.register('my-counter');
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let ts, createPlugin;
const files = {};

before(() => {
  ts = require('typescript');
  createPlugin = require('../../src/index.js');
});

/**
 * Create a minimal in-memory language service and wrap it with the plugin.
 * Returns the decorated service.
 */
function makeService(fileMap) {
  Object.assign(files, fileMap);
  const host = {
    getScriptFileNames: () => Object.keys(files),
    getScriptVersion: (f) => String(files[f]?.length ?? 0),
    getScriptSnapshot: (f) =>
      files[f] === undefined ? undefined : ts.ScriptSnapshot.fromString(files[f]),
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: false,
      noEmit: true,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    }),
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => files[f] !== undefined,
    readFile: (f) => files[f],
  };
  const inner = ts.createLanguageService(host, ts.createDocumentRegistry());
  const plugin = createPlugin({ typescript: ts });
  const proxy = plugin.create({
    languageService: inner,
    languageServiceHost: host,
    project: {
      projectService: { logger: { info: () => {} } },
    },
    serverHost: {},
    config: {},
  });
  return proxy;
}

/** Find the offset of `needle` in `files[file]` (first occurrence). */
function offsetOf(file, needle) {
  const i = files[file].indexOf(needle);
  if (i < 0) throw new Error(`"${needle}" not found in ${file}`);
  return i;
}

test('the plugin is standalone: no ts-lit-plugin dependency', () => {
  // Phase 3 (#386) removed the ts-lit-plugin runtime dependency. The plugin
  // must declare no dependencies and its source must never require it (a
  // historical mention in a comment is fine; an actual require is not).
  const pkg = require('../../package.json');
  assert.ok(!pkg.dependencies, 'no runtime dependencies');
  const src = require('node:fs').readFileSync(require.resolve('../../src/index.js'), 'utf8');
  assert.ok(!/require\(\s*['"`]ts-lit-plugin['"`]\s*\)/.test(src), 'source does not require ts-lit-plugin');
});

test('decorates the host service without crashing on a minimal info object', () => {
  // The suite passes a deliberately partial `info` (minimal logger, no
  // serverHost data). The decorator must never throw; LS methods stay
  // callable and fall back to the host service.
  const svc = makeService({
    '/empty.ts': `export const x = 1;\n`,
  });
  assert.doesNotThrow(() => svc.getSemanticDiagnostics('/empty.ts'));
  assert.doesNotThrow(() => svc.getDefinitionAndBoundSpan('/empty.ts', 0));
});

test('resolves <my-counter> inside html`` to the Counter class', () => {
  const svc = makeService({
    '/counter.ts':
      `import { WebComponent, html } from '@webjsdev/core';\n` +
      `export class Counter extends WebComponent {\n` +
      `  render() { return html\`<output></output>\`; }\n` +
      `}\n` +
      `Counter.register('my-counter');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './counter.ts';\n` +
      `export default function Page() {\n` +
      `  return html\`<my-counter count=\${3}></my-counter>\`;\n` +
      `}\n`,
  });

  const openIdx = offsetOf('/page.ts', '<my-counter');
  const pos = openIdx + 2;

  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def, 'should return a definition result');
  assert.equal(def.definitions.length, 1);
  const d = def.definitions[0];
  assert.equal(d.fileName, '/counter.ts');
  assert.equal(d.name, 'Counter');
  assert.equal(def.textSpan.length, 'my-counter'.length);
});

test('resolves closing tag </my-counter> just like the opening tag', () => {
  const svc = makeService({
    '/counter.ts':
      `export class Counter extends WebComponent {\n` +
      `  render() {}\n` +
      `}\n` +
      `Counter.register('my-counter');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<my-counter></my-counter>\`;\n` +
      `}\n`,
  });
  const closeIdx = offsetOf('/page.ts', '</my-counter');
  const pos = closeIdx + 3;

  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def && def.definitions.length === 1);
  assert.equal(def.definitions[0].name, 'Counter');
});

test('returns nothing for unknown tag names', () => {
  const svc = makeService({
    '/counter.ts':
      `export class Counter extends WebComponent {\n` +
      `  render() {}\n` +
      `}\n` +
      `Counter.register('my-counter');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<other-tag></other-tag>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<other-tag') + 2;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(!def || !def.definitions || def.definitions.length === 0);
});

test('ignores plain HTML tags (no hyphen → not a custom element)', () => {
  const svc = makeService({
    '/counter.ts':
      `export class Counter extends WebComponent {\n` +
      `  render() {}\n` +
      `}\n` +
      `Counter.register('my-counter');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<div></div>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<div') + 2;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(!def || !def.definitions || def.definitions.length === 0);
});

/* ================================================================
 * CSS class name → css`` rule navigation
 * ================================================================ */

test('resolves a class name inside html`class="…"` to the css`` rule', () => {
  const svc = makeService({
    '/page.ts':
      `import { html, css } from '@webjsdev/core';\n` +
      `const STYLES = css\`\n` +
      `  .page-home {\n` +
      `    .hero-title { font-size: 2rem; }\n` +
      `    .hero-lede  { color: gray; }\n` +
      `  }\n` +
      `\`;\n` +
      `export default function Home() {\n` +
      `  return html\`\n` +
      `    <style>\${STYLES.text}</style>\n` +
      `    <div class="page-home">\n` +
      `      <h1 class="hero-title">Hi</h1>\n` +
      `    </div>\n` +
      `  \`;\n` +
      `}\n`,
  });

  // Cursor on "hero-title" inside <h1 class="hero-title">.
  const idx = files['/page.ts'].indexOf('class="hero-title"');
  const pos = idx + 'class="'.length + 3; // inside 'hero-title'
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def && def.definitions.length >= 1, 'expected a css definition');
  assert.equal(def.definitions[0].fileName, '/page.ts');
  assert.equal(def.textSpan.length, 'hero-title'.length);
});

test('resolves a class name defined in ANOTHER file via program-wide index', () => {
  const svc = makeService({
    '/layout.ts':
      `import { html, css } from '@webjsdev/core';\n` +
      `const STYLES = css\`\n` +
      `  .banner { padding: 8px; background: lightyellow; }\n` +
      `\`;\n` +
      `export default function L({ children }) {\n` +
      `  return html\`<style>\${STYLES.text}</style><main>\${children}</main>\`;\n` +
      `}\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<p class="banner">hi</p>\`;\n` +
      `}\n`,
  });

  const idx = files['/page.ts'].indexOf('class="banner"');
  const pos = idx + 'class="'.length + 2;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def && def.definitions.length >= 1);
  assert.equal(def.definitions[0].fileName, '/layout.ts');
});

test('picks the correct class when class="a b c" has multiple tokens', () => {
  const svc = makeService({
    '/page.ts':
      `import { html, css } from '@webjsdev/core';\n` +
      `const STYLES = css\`\n` +
      `  .btn         { padding: 8px; }\n` +
      `  .btn-primary { background: orange; }\n` +
      `\`;\n` +
      `export default function Page() {\n` +
      `  return html\`<style>\${STYLES.text}</style><a class="btn btn-primary" href="/">Go</a>\`;\n` +
      `}\n`,
  });

  const attrStart = files['/page.ts'].indexOf('class="btn btn-primary"');
  const valueStart = attrStart + 'class="'.length;
  // Cursor on 'btn' (first token): offset valueStart + 1.
  const defFirst = svc.getDefinitionAndBoundSpan('/page.ts', valueStart + 1);
  assert.ok(defFirst);
  assert.equal(defFirst.textSpan.length, 'btn'.length);
  assert.equal(defFirst.definitions[0].name, '.btn');

  // Cursor on 'btn-primary' (second token): offset valueStart + 'btn '.length + 1.
  const defSecond = svc.getDefinitionAndBoundSpan('/page.ts', valueStart + 'btn '.length + 1);
  assert.ok(defSecond);
  assert.equal(defSecond.textSpan.length, 'btn-primary'.length);
  assert.equal(defSecond.definitions[0].name, '.btn-primary');
});

test('does not crash on unknown class names (returns no definition)', () => {
  const svc = makeService({
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<p class="nowhere-defined">x</p>\`;\n` +
      `}\n`,
  });
  const idx = files['/page.ts'].indexOf('class="nowhere-defined"');
  const pos = idx + 'class="'.length + 3;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(!def || !def.definitions || def.definitions.length === 0);
});

test('numeric decimals inside css`` are not mistaken for class names', () => {
  const svc = makeService({
    '/page.ts':
      `import { html, css } from '@webjsdev/core';\n` +
      `const STYLES = css\`\n` +
      `  .hero {\n` +
      `    padding: 1.5rem;\n` +
      `    margin: 2.25rem 0;\n` +
      `  }\n` +
      `\`;\n` +
      `export default function P() {\n` +
      `  return html\`<style>\${STYLES.text}</style><div class="hero">hi</div>\`;\n` +
      `}\n`,
    '/other.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export default function O() {\n` +
      `  return html\`<div class="5rem">x</div>\`;\n` +
      `}\n`,
  });
  // The class `.hero` should still be found.
  const idx = files['/page.ts'].indexOf('class="hero"');
  const pos = idx + 'class="'.length + 2;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def && def.definitions.length >= 1);
  // And a "class name" that looks like `5rem` shouldn't accidentally match
  // the `1.5rem` fragment in the css literal.
  const idx2 = files['/other.ts'].indexOf('class="5rem"');
  const pos2 = idx2 + 'class="'.length + 1;
  const def2 = svc.getDefinitionAndBoundSpan('/other.ts', pos2);
  assert.ok(!def2 || !def2.definitions || def2.definitions.length === 0);
});

test('ignores code inside ${...} holes (not part of the template markup)', () => {
  const svc = makeService({
    '/counter.ts':
      `export class Counter extends WebComponent {\n` +
      `  render() {}\n` +
      `}\n` +
      `Counter.register('my-counter');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `const label = 'my-counter';\n` +
      `export default function P() {\n` +
      `  return html\`<span>\${label}</span>\`;\n` +
      `}\n`,
  });
  const insideHole = offsetOf('/page.ts', "'my-counter'") + 2;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', insideHole);
  if (def && def.definitions && def.definitions.length > 0) {
    for (const d of def.definitions) {
      assert.notEqual(
        d.name,
        'Counter',
        'should not treat code inside ${...} as template markup'
      );
    }
  }
});

/* ================================================================
 * Attribute-name auto-complete inside `<webjs-tag …>`
 * ================================================================ */

test('completes static-properties keys after typing `<webjs-tag `', () => {
  const svc = makeService({
    '/auth.ts':
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String }, then: { type: String } };\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms ></auth-forms>\`;\n` +
      `}\n`,
  });
  // Cursor right after the space following the tag name: `<auth-forms |>`.
  const pos = offsetOf('/page.ts', '<auth-forms ') + '<auth-forms '.length;

  const completions = svc.getCompletionsAtPosition('/page.ts', pos, undefined);
  assert.ok(completions, 'should return completions');
  const names = completions.entries.map((e) => e.name);
  assert.ok(names.includes('mode'), `expected "mode" in ${JSON.stringify(names)}`);
  assert.ok(names.includes('then'), `expected "then" in ${JSON.stringify(names)}`);
});

test('a camelCase prop completes as a hyphenated attribute; state props are excluded', () => {
  const svc = makeService({
    '/box.ts':
      `export class Box extends WebComponent {\n` +
      `  static properties = { maxLength: { type: Number }, internal: { state: true } };\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box ></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<my-box ') + '<my-box '.length;
  const names = svc.getCompletionsAtPosition('/page.ts', pos, undefined).entries.map((e) => e.name);
  assert.ok(names.includes('max-length'), `plain attr is hyphenated: ${JSON.stringify(names)}`);
  assert.ok(!names.includes('maxLength'), 'camelCase prop is not offered as a plain attribute');
  assert.ok(!names.includes('internal'), 'state prop has no attribute');
});

test('`.` triggers property-name completions (camelCase, includes state props)', () => {
  const svc = makeService({
    '/box.ts':
      `export class Box extends WebComponent {\n` +
      `  static properties = { maxLength: { type: Number }, internal: { state: true } };\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box .></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<my-box .') + '<my-box .'.length;
  const names = svc.getCompletionsAtPosition('/page.ts', pos, undefined).entries.map((e) => e.name);
  assert.ok(names.includes('maxLength'), `property binding uses prop name: ${JSON.stringify(names)}`);
  assert.ok(names.includes('internal'), 'state props are valid .prop targets');
});

test('completes reachable custom-element tag names after `<`', () => {
  const svc = makeService({
    '/box.ts':
      `export class Box extends WebComponent {\n` +
      `  static properties = {};\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my></my>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<my') + '<my'.length;
  const completions = svc.getCompletionsAtPosition('/page.ts', pos, undefined);
  const names = completions.entries.map((e) => e.name);
  assert.ok(names.includes('my-box'), `expected tag completion: ${JSON.stringify(names)}`);
});

test('does not complete attributes for an UNREACHABLE (not imported) tag', () => {
  const svc = makeService({
    '/box.ts':
      `export class Box extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` + // NOT importing ./box.ts
      `export default function P() {\n` +
      `  return html\`<my-box ></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<my-box ') + '<my-box '.length;
  const completions = svc.getCompletionsAtPosition('/page.ts', pos, undefined);
  const names = (completions?.entries || []).map((e) => e.name);
  assert.ok(!names.includes('mode'), 'unreachable tag offers no webjs attributes');
});

/* ================================================================
 * Hover + attribute go-to-definition inside html`` templates
 * ================================================================ */

test('go-to-definition on an attribute name resolves to the declared member', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = { maxLength: { type: Number } };\n` +
      `  declare maxLength: number;\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box max-length=\${5}></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', 'max-length') + 1;
  const def = svc.getDefinitionAndBoundSpan('/page.ts', pos);
  assert.ok(def && def.definitions.length === 1, 'resolves the attribute');
  assert.equal(def.definitions[0].fileName, '/box.ts');
  assert.equal(def.definitions[0].name, 'maxLength');
  assert.equal(def.textSpan.length, 'max-length'.length);
});

test('hover on a custom-element tag shows its component class', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = {};\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<my-box') + 2;
  const qi = svc.getQuickInfoAtPosition('/page.ts', pos);
  assert.ok(qi, 'returns quick info');
  const text = qi.displayParts.map((p) => p.text).join('');
  assert.ok(/my-box/.test(text) && /Box/.test(text), `unexpected hover: ${text}`);
});

test('hover on a property binding shows its declared type', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = { count: { type: Number } };\n` +
      `  declare count: number;\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box .count=\${1}></my-box>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '.count') + 2;
  const qi = svc.getQuickInfoAtPosition('/page.ts', pos);
  assert.ok(qi, 'returns quick info');
  const text = qi.displayParts.map((p) => p.text).join('');
  assert.ok(/property/.test(text) && /count/.test(text) && /number/.test(text), `unexpected hover: ${text}`);
});

/* ================================================================
 * Attribute-value type-check on `<webjs-tag attr=${expr}>` interpolations
 * ================================================================ */

test('flags number passed where string is declared', () => {
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `  declare mode: string;\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `const x: number = 42;\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=\${x}></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 1, `expected one webjs diagnostic, got ${ours.length}`);
  const m = ours[0].messageText;
  assert.ok(/'number'/.test(m) && /'mode'/.test(m) && /'string'/.test(m),
    `unexpected message: ${m}`);
});

test('passes when interpolated value is assignable to declared string type', () => {
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `  declare mode: string;\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `const m: string = 'login';\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=\${m}></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 0, `unexpected diagnostics: ${ours.map((d) => d.messageText).join('; ')}`);
});

test('flags an incompatible `.prop` binding against the declared property type', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = { count: { type: Number } };\n` +
      `  declare count: number;\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `const s: string = 'x';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box .count=\${s}></my-box>\`;\n` +
      `}\n`,
  });
  const ours = svc.getSemanticDiagnostics('/page.ts').filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 1, `expected one .prop type diagnostic, got ${ours.length}`);
  assert.ok(/property 'count'/.test(ours[0].messageText), `unexpected message: ${ours[0].messageText}`);
});

test('flags a quoted binding (invariant 4) as code 9002', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = { count: { type: Number } };\n` +
      `  declare count: number;\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `const fn = () => {};\n` +
      `export default function P() {\n` +
      `  return html\`<my-box @click="\${fn}"></my-box>\`;\n` +
      `}\n`,
  });
  const ours = svc.getSemanticDiagnostics('/page.ts').filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 1);
  assert.equal(ours[0].code, 9002);
  assert.ok(/must be unquoted/.test(ours[0].messageText));
});

test('flags an expressionless `.prop` binding as code 9003', () => {
  const svc = makeService({
    '/box.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Box extends WebComponent {\n` +
      `  static properties = { value: { type: String } };\n` +
      `  declare value: string;\n` +
      `}\n` +
      `Box.register('my-box');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<my-box .value="hi"></my-box>\`;\n` +
      `}\n`,
  });
  const ours = svc.getSemanticDiagnostics('/page.ts').filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 1);
  assert.equal(ours[0].code, 9003);
});

test('flags a tag registered in two files as code 9004, naming the other file', () => {
  // Program-wide and NOT import-graph gated: neither file imports the other,
  // yet the collision is flagged. Globally-unique tag/file names avoid the
  // accumulated-`files` contamination the harness carries across tests.
  const svc = makeService({
    '/dup-a.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class DupA extends WebComponent {}\n` +
      `DupA.register('dup-widget');\n`,
    '/dup-b.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class DupB extends WebComponent {}\n` +
      `customElements.define('dup-widget', DupB);\n`,
  });
  const a = svc.getSemanticDiagnostics('/dup-a.ts').filter((d) => d.code === 9004);
  assert.equal(a.length, 1, `expected one 9004 on /dup-a.ts, got ${a.length}`);
  assert.equal(a[0].source, 'webjsdev-intellisense');
  assert.ok(/dup-widget/.test(a[0].messageText), 'message names the tag');
  assert.ok(/dup-b\.ts/.test(a[0].messageText), 'message names the other file');
  // The underline lands on the tag string literal, not the whole call.
  assert.equal(files['/dup-a.ts'].slice(a[0].start, a[0].start + a[0].length), `'dup-widget'`);

  // The other file is flagged too, naming dup-a.ts.
  const b = svc.getSemanticDiagnostics('/dup-b.ts').filter((d) => d.code === 9004);
  assert.equal(b.length, 1, `expected one 9004 on /dup-b.ts, got ${b.length}`);
  assert.ok(/dup-a\.ts/.test(b[0].messageText), 'message names the other file');
});

test('does not flag a tag registered exactly once (code 9004 counterfactual)', () => {
  const svc = makeService({
    '/solo.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class Solo extends WebComponent {}\n` +
      `Solo.register('solo-widget');\n`,
  });
  const ours = svc.getSemanticDiagnostics('/solo.ts').filter((d) => d.code === 9004);
  assert.equal(ours.length, 0, `unexpected 9004: ${ours.map((d) => d.messageText).join('; ')}`);
});

test('flags a non-callable `@event` handler; accepts a function', () => {
  const base =
    `import { WebComponent } from '@webjsdev/core';\n` +
    `export class Box extends WebComponent {\n` +
    `  static properties = {};\n` +
    `}\n` +
    `Box.register('my-box');\n`;
  const bad = makeService({
    '/box.ts': base,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `const notFn: number = 1;\n` +
      `export default function P() {\n` +
      `  return html\`<my-box @click=\${notFn}></my-box>\`;\n` +
      `}\n`,
  });
  const badOurs = bad.getSemanticDiagnostics('/page.ts').filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(badOurs.length, 1, 'non-callable handler flagged');
  assert.ok(/not callable/.test(badOurs[0].messageText));

  const good = makeService({
    '/box.ts': base,
    '/ok.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './box.ts';\n` +
      `const fn = (e: Event) => {};\n` +
      `export default function P() {\n` +
      `  return html\`<my-box @click=\${fn}></my-box>\`;\n` +
      `}\n`,
  });
  const goodOurs = good.getSemanticDiagnostics('/ok.ts').filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(goodOurs.length, 0, 'a function handler is accepted');
});

test('flags string-or-number against a string-literal-union type', () => {
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `type Mode = 'login' | 'signup';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `  declare mode: Mode;\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `declare const x: string | number;\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=\${x}></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 1, `expected one diagnostic for string|number against Mode`);
});

test('does not type-check static (non-interpolated) attribute values', () => {
  // <auth-forms mode=123> is plain template text: at runtime it's just
  // the string "123", not a number. We deliberately don't flag it.
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `  declare mode: string;\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=123></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 0, 'static attribute value should not produce a webjs diagnostic');
});

test('skips check when component is reachable but the prop has no `declare` annotation', () => {
  // If the user hasn't typed the prop, we can't check: fall back to
  // silence rather than noise.
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `}\n` + // no `declare mode: …`
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      `import { html } from '@webjsdev/core';\n` +
      `import './auth.ts';\n` +
      `declare const x: number;\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=\${x}></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 0, 'no declare → no check, no diagnostic');
});

test('does not check tags that are not reachable through imports', () => {
  // The component class exists in the program but page.ts forgets to
  // import it. Reachability gating means we don't synthesise a value
  // diagnostic for an unreachable tag (the missing side-effect import is
  // the real problem to surface).
  const svc = makeService({
    '/auth.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `  declare mode: string;\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      // No import './auth.ts'.
      `import { html } from '@webjsdev/core';\n` +
      `declare const x: number;\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms mode=\${x}></auth-forms>\`;\n` +
      `}\n`,
  });
  const diags = svc.getSemanticDiagnostics('/page.ts');
  const ours = diags.filter((d) => d.source === 'webjsdev-intellisense');
  assert.equal(ours.length, 0, 'unreachable tag → no value-check (lit-plugin keeps its own "unknown tag" warning)');
});

test('attribute completions are NOT offered when the component is not imported', () => {
  const svc = makeService({
    '/auth.ts':
      `export class AuthForms extends WebComponent {\n` +
      `  static properties = { mode: { type: String } };\n` +
      `}\n` +
      `AuthForms.register('auth-forms');\n`,
    '/page.ts':
      // No `import './auth.ts'` here.
      `import { html } from '@webjsdev/core';\n` +
      `export default function P() {\n` +
      `  return html\`<auth-forms ></auth-forms>\`;\n` +
      `}\n`,
  });
  const pos = offsetOf('/page.ts', '<auth-forms ') + '<auth-forms '.length;
  const completions = svc.getCompletionsAtPosition('/page.ts', pos, undefined);
  if (completions) {
    const names = completions.entries.map((e) => e.name);
    assert.ok(!names.includes('mode'),
      `should not suggest props of unimported component, got: ${JSON.stringify(names)}`);
  }
});
