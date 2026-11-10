import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { checkConventions, RULES } from '../../src/check.js';

async function makeTempApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-check-'));
  return dir;
}

async function writeFileEnsureDir(filePath, contents) {
  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, contents);
}

/**
 * Tests for the no-non-erasable-typescript rule. Scans .ts source
 * for the four constructs the framework's type-stripper rejects:
 * enum, namespace with values, constructor parameter properties,
 * `import = require`. Each test plants one offender and asserts
 * the rule flags it.
 */

test('no-non-erasable-typescript: flags enum declaration', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'modules', 'auth', 'types.ts'),
      `export enum Status { Active = 'active', Inactive = 'inactive' }\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('types.ts'));
    assert.ok(v, 'expected enum to be flagged');
    assert.ok(v.message.includes('enum'), 'message should name the pattern');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: flags constructor parameter property', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'box.ts'),
      `export class Box {
  constructor(public readonly width: number, public readonly height: number) {}
}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('box.ts'));
    assert.ok(v, 'expected parameter property to be flagged');
    assert.ok(v.message.includes('parameter property'), 'message should name the pattern');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: flags namespace with values', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'ns.ts'),
      `export namespace Utils {
  export const VERSION = '1.0';
  export function bump() { return VERSION; }
}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('ns.ts'));
    assert.ok(v, 'expected namespace with values to be flagged');
    assert.ok(v.message.includes('namespace'), 'message should name the pattern');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: flags import = require', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'legacy.ts'),
      `import legacy = require('legacy-module');\nexport { legacy };\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('legacy.ts'));
    assert.ok(v, 'expected import = require to be flagged');
    assert.ok(v.message.includes('import = require'), 'message should name the pattern');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: passes for clean erasable .ts file', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'clean.ts'),
      `export type Status = 'active' | 'inactive';
export interface Box { width: number; height: number; }
export const STATUS: Record<Status, number> = { active: 1, inactive: 0 };
export class Counter {
  count: number;
  constructor(initial: number) { this.count = initial; }
  increment(): void { this.count++; }
}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('clean.ts'));
    assert.equal(v, undefined, 'clean erasable code should not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: flags a Lit decorator with its WebJs fix', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'components', 'counter.ts'),
      `import { WebComponent, html } from '@webjsdev/core';
export class MyCounter extends WebComponent {
  @property({ type: Number }) count = 0;
  render() { return html\`<p>\${this.count}</p>\`; }
}
MyCounter.register('my-counter');\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('counter.ts'));
    assert.ok(v, 'expected the decorator to be flagged');
    assert.match(v.message, /`@property` at line 3/);
    assert.match(v.message, /SyntaxError/);
    assert.match(v.fix, /static properties/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: flags @customElement in a plain .js file', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'components', 'el.js'),
      `import { WebComponent } from '@webjsdev/core';
@customElement('my-el')
export class MyEl extends WebComponent {}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.includes('el.js'));
    assert.ok(v, 'expected the .js decorator to be flagged');
    assert.match(v.fix, /MyEl\.register\('my-el'\)/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: @state and @query each get their own fix', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'components', 's.ts'), `class S {\n  @state()\n  private open = false;\n}\n`);
    await writeFileEnsureDir(join(appDir, 'components', 'q.ts'), `class Q {\n  @query('#x') el!: HTMLElement;\n}\n`);
    const violations = await checkConventions(appDir);
    const s = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('s.ts'));
    const q = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('q.ts'));
    assert.match(s.fix, /state: true/);
    assert.match(q.fix, /this\.renderRoot\.querySelector/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: an @ in a template, css, JSDoc or string is not a decorator', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'components', 'clean.ts'),
      `import { WebComponent, html, css } from '@webjsdev/core';
/**
 * A button.
 * @param {string} label the label
 * @returns {void}
 */
export class CleanBtn extends WebComponent {
  static styles = css\`
@media (min-width: 40rem) { :host { display: block; } }
\`;
  render() {
    return html\`<button
      @click=\${() => this.go()}>go</button>\`;
  }
  go() { return 'a@b.com' + /@x/.source; }
}
CleanBtn.register('clean-btn');\n`,
    );
    await writeFileEnsureDir(join(appDir, 'public', 'vendor.js'), `@decorated\nclass V {}\n`);
    const violations = await checkConventions(appDir);
    const hits = violations.filter((v) => v.rule === 'no-non-erasable-typescript');
    assert.deepEqual(hits, [], JSON.stringify(hits));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: skips node_modules and _private folders', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'node_modules', 'somepkg', 'index.ts'),
      `export enum Skip { A, B }\n`,
    );
    await writeFileEnsureDir(
      join(appDir, '_private', 'helper.ts'),
      `export enum AlsoSkip { A, B }\n`,
    );
    await writeFileEnsureDir(
      join(appDir, 'lib', 'caught.ts'),
      `export enum Caught { A, B }\n`,
    );
    const violations = await checkConventions(appDir);
    const all = violations.filter((v) => v.rule === 'no-non-erasable-typescript');
    assert.equal(all.length, 1, `expected one violation, got ${all.length}: ${all.map(v => v.file).join(', ')}`);
    assert.ok(all[0].file.includes('caught.ts'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});


test('tag-name-has-hyphen: flags component without hyphen in tag', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.js'),
      `import { WebComponent } from '@webjsdev/core';
class BadComp extends WebComponent {}
BadComp.register('badcomp');
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen');
    assert.ok(v, 'expected tag-name-has-hyphen violation');
    assert.ok(v.message.includes('badcomp'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tag-name-has-hyphen: passes for valid hyphenated tag', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'good.js'),
      `import { WebComponent } from '@webjsdev/core';
class GoodComp extends WebComponent {}
GoodComp.register('good-comp');
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen');
    assert.equal(v, undefined, 'should not flag hyphenated tag');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-duplicate-tag: flags the same tag registered in two files, naming both', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'a.js'),
      `import { WebComponent } from '@webjsdev/core';
class A extends WebComponent {}
A.register('like-button');
`,
    );
    await writeFile(
      join(appDir, 'components', 'b.js'),
      `import { WebComponent } from '@webjsdev/core';
class B extends WebComponent {}
customElements.define('like-button', B);
`,
    );

    const violations = await checkConventions(appDir);
    const dups = violations.filter((v) => v.rule === 'no-duplicate-tag');
    // One violation per colliding file (both a.js and b.js).
    assert.equal(dups.length, 2, 'expected a violation on each colliding file');
    const filesFlagged = dups.map((v) => v.file).sort();
    assert.ok(filesFlagged.some((f) => f.endsWith('a.js')) && filesFlagged.some((f) => f.endsWith('b.js')),
      'both files flagged');
    assert.ok(dups.every((v) => v.message.includes('like-button')), 'message names the tag');
    // Each violation names the OTHER file.
    const aViol = dups.find((v) => v.file.endsWith('a.js'));
    assert.ok(aViol.message.includes('b.js'), 'a.js violation names b.js');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-duplicate-tag: flags a collision across non-component directories (not gated on components/)', async () => {
  // A register/define call can live in a page, a lib, or a module, not only
  // under components/. A duplicate is a runtime hazard regardless, so the rule
  // scans every source file (keeping it in lockstep with the editor's
  // project-wide 9004 diagnostic).
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app'), { recursive: true });
    await mkdir(join(appDir, 'lib'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'page.js'),
      `import { WebComponent } from '@webjsdev/core';
class Widget extends WebComponent {}
Widget.register('app-widget');
export default function P() {}
`,
    );
    await writeFile(
      join(appDir, 'lib', 'extra.js'),
      `import { WebComponent } from '@webjsdev/core';
class Widget2 extends WebComponent {}
customElements.define('app-widget', Widget2);
`,
    );

    const violations = await checkConventions(appDir);
    const dups = violations.filter((v) => v.rule === 'no-duplicate-tag');
    assert.equal(dups.length, 2, 'both non-component files flagged');
    const filesFlagged = dups.map((v) => v.file);
    assert.ok(filesFlagged.some((f) => f.endsWith('page.js')), 'app/page.js flagged');
    assert.ok(filesFlagged.some((f) => f.endsWith('extra.js')), 'lib/extra.js flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-duplicate-tag: ignores a gitignored generated copy (no false positive)', async () => {
  // The website gitignores its `webjs ui add`-regenerated `components/` dir.
  // A generated copy colliding with the committed component must NOT fail
  // check; only committed source is policed.
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    await writeFile(join(appDir, '.gitignore'), '/components/\n');
    await mkdir(join(appDir, 'app', '_components'), { recursive: true });
    await mkdir(join(appDir, 'components', 'site'), { recursive: true });
    await writeFile(
      join(appDir, 'app', '_components', 'theme-toggle.ts'),
      `import { WebComponent } from '@webjsdev/core';
class T extends WebComponent {}
T.register('theme-toggle');
`,
    );
    // Gitignored generated copy of the same tag.
    await writeFile(
      join(appDir, 'components', 'site', 'theme-toggle.ts'),
      `import { WebComponent } from '@webjsdev/core';
class T2 extends WebComponent {}
T2.register('theme-toggle');
`,
    );

    const violations = await checkConventions(appDir);
    assert.equal(
      violations.filter((v) => v.rule === 'no-duplicate-tag').length,
      0,
      'a gitignored generated copy must not trigger a duplicate-tag violation',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-duplicate-tag: passes when each tag is registered once (counterfactual)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'a.js'),
      `import { WebComponent } from '@webjsdev/core';
class A extends WebComponent {}
A.register('like-button');
`,
    );
    await writeFile(
      join(appDir, 'components', 'b.js'),
      `import { WebComponent } from '@webjsdev/core';
class B extends WebComponent {}
B.register('share-button');
`,
    );

    const violations = await checkConventions(appDir);
    assert.equal(
      violations.filter((v) => v.rule === 'no-duplicate-tag').length,
      0,
      'distinct tags must not be flagged',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('components-have-register: flags component with no register() call', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'no-reg.js'),
      `import { WebComponent } from '@webjsdev/core';
class NoReg extends WebComponent {}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'components-have-register');
    assert.ok(v, 'expected components-have-register violation');
    assert.ok(v.message.includes('register'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('components-have-register: passes with Class.register("tag")', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'good.js'),
      `import { WebComponent } from '@webjsdev/core';
class GoodComp extends WebComponent {}
GoodComp.register('good-comp');
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'components-have-register');
    assert.equal(v, undefined, 'should not flag component with Class.register()');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('components-have-register: passes with customElements.define fallback', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'native.js'),
      `import { WebComponent } from '@webjsdev/core';
class NativeComp extends WebComponent {}
customElements.define('native-comp', NativeComp);
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'components-have-register');
    assert.equal(v, undefined, 'should not flag native-API registration');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test("static properties: Lit's spelling with a declare is clean (#1686)", async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'lit-style.ts'),
      `import { WebComponent } from '@webjsdev/core';
class LitStyle extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;

  constructor() {
    super();
    this.count = 0;
  }
}
LitStyle.register('lit-style');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => /static-properties|class-field/.test(v.rule));
    assert.equal(v, undefined, 'static properties plus an erasable declare is a supported spelling');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

for (const [label, decl] of [
  ['a static properties field', 'static properties = { count: { type: Number } };'],
  ['static override properties', 'static override properties = { count: { type: Number } };'],
  ['a typed static properties field', 'static properties: Record<string, object> = { count: { type: Number } };'],
  ['a static get properties()', 'static get properties() { return { count: { type: Number } }; }'],
]) {
  test(`reactive-props-no-class-field: flags a class field beside ${label} (#1686)`, async () => {
    const appDir = await makeTempApp();
    try {
      await mkdir(join(appDir, 'components'), { recursive: true });
      await writeFile(
        join(appDir, 'components', 'field.ts'),
        `import { WebComponent } from '@webjsdev/core';
class FieldBad extends WebComponent {
  ${decl}
  count = 0;
}
FieldBad.register('field-bad');
`,
      );
      const violations = await checkConventions(appDir);
      const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
      assert.ok(v, 'a class field clobbers a static-properties accessor just as it does a factory one');
      assert.ok(v.message.includes('`count`'));
    } finally {
      await rm(appDir, { recursive: true, force: true });
    }
  });
}

test('no-signal-field-assignment: flags every write that replaces a signal field', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'writes.ts'),
      `import { WebComponent, html, signal, type Signal } from '@webjsdev/core';
class Writes extends WebComponent {
  readonly #open = signal(false);
  count = signal<number>(0);
  readonly box: Signal<{ open: boolean }> = signal({ open: false });
  cb: Signal<() => void> = signal(() => {});
  constructor() {
    super();
    this.made = signal('');
  }
  toggle() { this.#open = true; }
  bump() { this.count++; }
  rename() { this.made = 'x'; }
  reset() { this.box = { open: true }; this.cb = () => {}; }
  render() { return html\`<button @click=\${() => { this.count += 1; }}>x</button>\`; }
}
Writes.register('signal-writes');
`,
    );
    const violations = await checkConventions(appDir);
    const names = violations.filter((v) => v.rule === 'no-signal-field-assignment').map((v) => v.message.match(/\`this\.([#\w]+)\`/)[1]).sort();
    assert.deepEqual(names, ['#open', 'box', 'cb', 'count', 'made']);
    const v = violations.find((v) => v.rule === 'no-signal-field-assignment');
    assert.ok(v.fix.includes('.set('), 'the fix names .set()');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-signal-field-assignment: names the right field when members share a line or a type spans lines', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'packed.ts'),
      `import { WebComponent, html, signal, type Signal } from '@webjsdev/core';
class Packed extends WebComponent {
  plain = 1; readonly #open = signal(false);
  static shared = 1; flag = signal(false);
  wide: Signal<
    number
  > = signal(0);
  bump() { this.plain = 2; this.flag = true; this.wide = 1; }
  render() { return html\`<p>\${this.#open.get()}</p>\`; }
}
Packed.register('signal-packed');
`,
    );
    const violations = await checkConventions(appDir);
    const names = violations.filter((v) => v.rule === 'no-signal-field-assignment').map((v) => v.message.match(/\`this\.([#\w]+)\`/)[1]).sort();
    assert.deepEqual(names, ['flag', 'wide']);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-signal-field-assignment: passes reads, .set() writes, the constructor creation and plain fields', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'reads.ts'),
      `import { WebComponent, html, signal } from '@webjsdev/core';
class Reads extends WebComponent {
  readonly #open = signal(false);
  readonly shown = signal(true);
  label = '';
  constructor() {
    super();
    this.made = signal(0);
  }
  toggle() { this.#open.set(!this.#open.get()); this.label = 'x'; }
  render() { return html\`<p>\${this.shown.get() === true ? this.made.get() : ''}</p>\`; }
}
Reads.register('signal-reads');
`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.filter((v) => v.rule === 'no-signal-field-assignment').length, 0);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: passes for the factory form', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'good.ts'),
      `import { WebComponent, prop } from '@webjsdev/core';
class GoodProp extends WebComponent({ count: Number, open: prop(Boolean, { reflect: true }) }) {
  constructor() {
    super();
    this.count = 0;
  }
}
GoodProp.register('good-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'the factory form should be clean');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: flags class-field initializer on factory-declared reactive prop', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'factory.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Counter extends WebComponent({ count: Number }) {
  count = 0;
}
Counter.register('counter-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.ok(v, 'expected reactive-props-no-class-field violation for factory prop');
    assert.ok(v.message.includes('count'));
    assert.ok(v.fix.includes('default'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: passes with a constructor default', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'factory-ok.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Counter extends WebComponent({ count: Number }) {
  constructor() {
    super();
    this.count = 0;
  }
}
Counter.register('counter-prop-ok');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'expected no violation for a constructor default');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: passes with the default option', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'factory-default.ts'),
      `import { WebComponent, prop } from '@webjsdev/core';
class Counter extends WebComponent({ count: prop(Number, { default: 0 }) }) {
}
Counter.register('counter-default');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'the default option needs no class field');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: ignores non-reactive plain fields', async () => {
  // Fields whose names are NOT factory props are free-form: no reactive
  // accessor exists, so a class-field initializer is fine.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'mixed.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Mixed extends WebComponent({ count: Number }) {
  _conn: WebSocket | null = null;     // not reactive: fine
  _retries = 0;                       // not reactive: fine

  constructor() { super(); this.count = 0; }
}
Mixed.register('mixed-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'non-reactive class fields should not trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: does not trip on `this.x = …` inside methods', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'methods.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Methods extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }

  increment() {
    this.count = this.count + 1;
  }
}
Methods.register('methods-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'this.x = … inside methods is correct');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: does not trip on object-literal keys inside a method (#934)', async () => {
  // A multi-line object literal built inside a method body whose keys match a
  // factory prop name (`game:` / `scoreboard:`) is NOT a class-field
  // declaration. The brace-depth walker must count the method's and the
  // literal's opening braces so those keys are seen at depth > 0, never depth 0.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'board.ts'),
      `import { WebComponent, prop, html } from '@webjsdev/core';
class Board extends WebComponent({
  game: prop(Object),
  scoreboard: prop(Object),
}) {
  constructor() {
    super();
    this.game = null;
    this.scoreboard = null;
  }

  makeMove(op) {
    const next = {
      game: { ...this.game, board: op },
      scoreboard: { ...this.scoreboard, x: 1 },
    };
    return next;
  }

  render() { return html\`<div>\${this.game}</div>\`; }
}
Board.register('x-board');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.equal(v, undefined, 'object-literal keys inside a method are not class fields');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: flags a type-only declaration (`count!: number`)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'type-only.ts'),
      `import { WebComponent } from '@webjsdev/core';
class TypeOnly extends WebComponent({ count: Number }) {
  count!: number;
}
TypeOnly.register('type-only-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.ok(v, 'expected reactive-props-no-class-field violation for type-only declaration');
    assert.ok(v.message.includes('count'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: flags an optional type declaration (`count?: number`)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'optional-type.ts'),
      `import { WebComponent } from '@webjsdev/core';
class OptionalType extends WebComponent({ count: Number }) {
  count?: number;
}
OptionalType.register('optional-type-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.ok(v, 'expected reactive-props-no-class-field violation for optional type declaration');
    assert.ok(v.message.includes('count'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: flags a plain type declaration (`count: number`)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'plain-type.ts'),
      `import { WebComponent } from '@webjsdev/core';
class PlainType extends WebComponent({ count: Number }) {
  count: number;
}
PlainType.register('plain-type-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.ok(v, 'expected reactive-props-no-class-field violation for plain type declaration');
    assert.ok(v.message.includes('count'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no violations for empty app', async () => {
  const appDir = await makeTempApp();
  try {
    const violations = await checkConventions(appDir);
    assert.equal(violations.length, 0);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-server-env-in-components -------------------- */

test('no-server-env-in-components: flags non-public process.env reads in components', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'header.ts'),
      `import { WebComponent, html } from '@webjsdev/core';\n` +
      `class Header extends WebComponent {\n` +
      `  render() { return html\`<div data-key=\${process.env.STRIPE_SECRET}></div>\`; }\n` +
      `}\nHeader.register('app-header');\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'no-server-env-in-components');
    assert.ok(v, 'should flag process.env.STRIPE_SECRET');
    assert.ok(v.message.includes('STRIPE_SECRET'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-server-env-in-components: allows WEBJS_PUBLIC_* reads', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'api-link.ts'),
      `import { WebComponent, html } from '@webjsdev/core';\n` +
      `class ApiLink extends WebComponent {\n` +
      `  render() { return html\`<a href=\${process.env.WEBJS_PUBLIC_API_URL}>x</a>\`; }\n` +
      `}\nApiLink.register('api-link');\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'no-server-env-in-components'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-server-env-in-components: allows NODE_ENV reads', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'debug-banner.ts'),
      `import { WebComponent, html } from '@webjsdev/core';\n` +
      `class Debug extends WebComponent {\n` +
      `  render() { return process.env.NODE_ENV === 'development' ? html\`<p>dev</p>\` : html\`\`; }\n` +
      `}\nDebug.register('debug-banner');\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'no-server-env-in-components'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-server-env-in-components: skips .server.{js,ts} files (server actions may read any env)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'auth', 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'auth', 'components', 'helpers.server.ts'),
      `'use server';\nexport async function token() { return process.env.AUTH_SECRET; }\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'no-server-env-in-components'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-server-env-in-components: only flags each env var name once per file', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'multi.ts'),
      `import { WebComponent, html } from '@webjsdev/core';\n` +
      `class Multi extends WebComponent {\n` +
      `  render() {\n` +
      `    const a = process.env.SECRET_KEY;\n` +
      `    const b = process.env.SECRET_KEY;\n` +
      `    const c = process.env.OTHER_KEY;\n` +
      `    return html\`<div>\${a}\${b}\${c}</div>\`;\n` +
      `  }\n` +
      `}\nMulti.register('multi-comp');\n`,
    );
    const violations = await checkConventions(appDir);
    const flagged = violations.filter((v) => v.rule === 'no-server-env-in-components');
    assert.equal(flagged.length, 2, 'should flag SECRET_KEY once and OTHER_KEY once');
    const names = flagged.map((v) => v.message);
    assert.ok(names.some((m) => m.includes('SECRET_KEY')));
    assert.ok(names.some((m) => m.includes('OTHER_KEY')));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-server-env-in-components: does not fire outside components/', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'page.ts'),
      `export default function Page() { const db = process.env.DATABASE_URL; return db; }\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'no-server-env-in-components'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});


test('shell-in-non-root-layout: passes when root layout owns the shell', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'layout.ts'),
      `import { html } from '@webjsdev/core';
export default function RootLayout({ children }) {
  return html\`
    <!doctype html>
    <html lang="es" data-theme="dark">
      <head></head>
      <body class="bg-bg">\${children}</body>
    </html>
  \`;
}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'shell-in-non-root-layout');
    assert.equal(v, undefined, 'root layout writing the shell is allowed');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('shell-in-non-root-layout: flags nested layout with <html>', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app', 'admin'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'admin', 'layout.ts'),
      `import { html } from '@webjsdev/core';
export default function AdminLayout({ children }) {
  return html\`
    <!doctype html>
    <html lang="en"><head></head><body>\${children}</body></html>
  \`;
}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'shell-in-non-root-layout');
    assert.ok(v, 'nested layout writing a shell must be flagged');
    assert.match(v.file, /app\/admin\/layout\.ts$/);
    assert.match(v.message, /<!doctype|<html/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('shell-in-non-root-layout: flags page.ts that writes <body>', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app', 'blog'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'blog', 'page.ts'),
      `import { html } from '@webjsdev/core';
export default function BlogPage() {
  return html\`<body class="bg-white"><main>hello</main></body>\`;
}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'shell-in-non-root-layout');
    assert.ok(v, 'page.ts writing <body> must be flagged');
    assert.match(v.message, /<body/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('shell-in-non-root-layout: ignores shell tokens inside line/block comments', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app', 'foo'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'foo', 'layout.ts'),
      `import { html } from '@webjsdev/core';
// Note: do NOT write <!doctype> here: only the root layout owns the shell.
/* Reminder: the framework auto-emits <html>/<head>/<body>. */
export default function FooLayout({ children }) {
  return html\`<main>\${children}</main>\`;
}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'shell-in-non-root-layout');
    assert.equal(v, undefined, 'comments mentioning the shell shouldn\'t trigger');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('shell-in-non-root-layout: ignores non-layout files in app/', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app'), { recursive: true });
    // route.ts / middleware.ts / error.ts etc. can mention these tokens
    // (e.g. error pages constructing fallback HTML): only layout.* and
    // page.* are policed by this rule.
    await writeFile(
      join(appDir, 'app', 'route.ts'),
      `export async function GET() {
  return new Response('<!doctype html><html><body>hi</body></html>', {
    headers: { 'content-type': 'text/html' },
  });
}
`,
    );

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'shell-in-non-root-layout');
    assert.equal(v, undefined, 'route handlers must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('use-server-needs-extension: flags use server directive without .server.ts', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'auth', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'auth', 'actions', 'login.ts'),
      `'use server';
export async function login(email, password) {
  return { ok: true };
}
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'use-server-needs-extension');
    assert.ok(v, 'expected use-server-needs-extension violation');
    assert.match(v.file, /login\.ts$/);
    assert.match(v.fix, /login\.server\.ts/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('use-server-needs-extension: file with both markers is fine', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'auth', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'auth', 'actions', 'login.server.ts'),
      `'use server';
export async function login(email, password) {
  return { ok: true };
}
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'use-server-needs-extension');
    assert.equal(v, undefined, 'extension + directive should NOT trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('use-server-needs-extension: .server.ts WITHOUT directive does not trigger this rule', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'lib'), { recursive: true });
    await writeFile(
      join(appDir, 'lib', 'db.server.ts'),
      `export const db = { findMany: () => [] };
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'use-server-needs-extension');
    assert.equal(v, undefined, 'extension alone is server-only utility, not flagged here');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/**
 * Gitignore-pattern semantics regression (#365). The structural correctness of
 * the `.webjs/vendor/` exception is now verified by `webjs doctor`'s
 * `vendor-gitignore` check (moved out of `webjs check` in #461; see
 * `test/cli/doctor.test.mjs`). This hermetic test stays here because it probes
 * `git check-ignore` directly, asserting the depth-robust globstar `.webjs`
 * pattern itself, independent of any check/doctor surface. Uses a real `git
 * init` in a temp dir so `git check-ignore` behaves as it would in a real project.
 */

function initGit(appDir) {
  // Clear inherited git env so `git init` (and any later check-ignore) target
  // appDir, not an outer repo whose GIT_DIR / GIT_WORK_TREE leaked in via a
  // worktree pre-commit hook.
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...env } = process.env;
  const result = spawnSync('git', ['init', '-q'], { cwd: appDir, stdio: 'pipe', env });
  return result.status === 0;
}

test('`**/.webjs/*` ignores nested routes.d.ts while the anchored `.webjs/*` does not', async () => {
  // The actual #365 bug: a slash-bearing `.webjs/*` anchors to the
  // .gitignore's dir, so a nested app (a monorepo package) leaks its
  // generated `.webjs/routes.d.ts`. `**/.webjs/*` ignores it at any
  // depth while still re-including the committed vendor pin. Probed
  // directly with `git check-ignore`.
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...env } = process.env;
    const ignored = (rel) =>
      spawnSync('git', ['check-ignore', '-q', rel], { cwd: appDir, stdio: 'pipe', env })
        .status === 0;

    // Counterfactual: the old anchored pattern misses the nested file.
    await writeFile(
      join(appDir, '.gitignore'),
      '.webjs/*\n!.webjs/vendor/\n!.webjs/vendor/**\n',
    );
    assert.equal(
      ignored('website/.webjs/routes.d.ts'),
      false,
      'anchored `.webjs/*` leaks a nested routes.d.ts (the bug)',
    );

    // The fix: `**/.webjs/*` ignores routes.d.ts at every depth and
    // still tracks the vendor pin at root and nested depths.
    await writeFile(
      join(appDir, '.gitignore'),
      '**/.webjs/*\n!**/.webjs/vendor/\n!**/.webjs/vendor/**\n',
    );
    assert.equal(ignored('.webjs/routes.d.ts'), true, 'root routes.d.ts ignored');
    assert.equal(
      ignored('website/.webjs/routes.d.ts'),
      true,
      'nested routes.d.ts ignored',
    );
    assert.equal(
      ignored('.webjs/vendor/importmap.json'),
      false,
      'root vendor pin stays tracked',
    );
    assert.equal(
      ignored('website/.webjs/vendor/importmap.json'),
      false,
      'nested vendor pin stays tracked',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// --- Template-literal-aware scanner: docs-page false-positive regressions ---

test('tag-name-has-hyphen: ignores register(\'tag\') inside a template literal (docs example)', async () => {
  // A docs page renders example tag strings inside an `html\`...\``
  // template body. Pre-fix, the scanner read those as real
  // `register('tag')` calls and flagged unhyphenated names. Post-fix,
  // the redactor blanks template-literal bodies before the rule
  // scans, so example calls are invisible.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'docs-page.ts'),
      "import { html } from '@webjsdev/core';\n" +
      'export default function Docs() {\n' +
      '  return html`\n' +
      '    <p>Example: <code>MyTag.register("tag")</code></p>\n' +
      '  `;\n' +
      '}\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen');
    assert.equal(v, undefined,
      'register() call inside a template literal must not trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tag-name-has-hyphen: still flags real register(\'tag\') at top level', async () => {
  // Counterfactual: the redactor must NOT silence real violations.
  // A real top-level register() call without a hyphen still fires.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'real.js'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class BadTag extends WebComponent {}\n' +
      "BadTag.register('badtag');\n", // no hyphen, real call
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen');
    assert.ok(v, 'real top-level register() must still be checked');
    assert.ok(v.message.includes('badtag'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: ignores `enum`/`namespace` inside a template literal', async () => {
  // Docs page teaches users which TS constructs the runtime stripper
  // rejects. The example syntax lives inside an `html\`...\``
  // template body. Pre-fix, the rule read those as real declarations.
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'docs', 'page.ts'),
      "import { html } from '@webjsdev/core';\n" +
      'export default function TypeScript() {\n' +
      '  return html`\n' +
      '    <pre>enum Direction { Up, Down }</pre>\n' +
      '    <pre>namespace Util { export const VERSION = "1.0"; }</pre>\n' +
      '    <pre>class Foo { constructor(public x: number) {} }</pre>\n' +
      '  `;\n' +
      '}\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript');
    assert.equal(v, undefined,
      'non-erasable syntax inside a template literal must not trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-non-erasable-typescript: still flags real top-level enum', async () => {
  // Counterfactual: real top-level enum still fires.
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'real.ts'),
      'export enum Real { A, B }\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript');
    assert.ok(v, 'real top-level enum must still be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: ignores fixture strings in template literals', async () => {
  // Test files write fixture sources to disk as template-literal
  // strings. Pre-fix, the scanner read those fixture strings as real
  // class declarations in the test file itself, flagging the
  // test-file as the violator.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'test-runner.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      '// This file writes a fixture string. The fixture LOOKS like a\n' +
      '// reactive-props violation, but it is inside a template literal.\n' +
      'export const fixture = `\n' +
      '  class FixtureClass extends WebComponent {\n' +
      '    static properties = { x: { type: Number } };\n' +
      '    x = 0;\n' +
      '  }\n' +
      '`;\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find(
      (v) => v.rule === 'reactive-props-no-class-field',
    );
    assert.equal(v, undefined,
      'a class inside a template literal must not trigger the rules');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-no-class-field: still flags a real class-field initializer at top level', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'real.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class RealBad extends WebComponent({ x: Number }) {\n' +
      '  x = 0;\n' + // real top-level violation
      '}\n' +
      "RealBad.register('real-bad');\n",
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-no-class-field');
    assert.ok(v, 'real top-level violation must still be flagged');
    assert.equal(v.message.includes('x'), true);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('redactor: single- and double-quote strings are preserved verbatim', async () => {
  // The redactor keeps single/double-quote string contents because
  // rules like tag-name-has-hyphen need to read register('tag') to
  // assert the hyphen. Verified end-to-end via the rule.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'good.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class GoodTag extends WebComponent {}\n' +
      "GoodTag.register('good-tag');\n", // hyphenated, real call: must pass
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen' && v.file.includes('good.ts'));
    assert.equal(v, undefined,
      'redactor must NOT blank single-quote string contents (rule needs them)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('redactor: line and column positions are preserved across redaction', async () => {
  // Indirect test: the no-non-erasable-typescript rule reports a line
  // number. If the redactor shifted columns/lines, the reported line
  // would be wrong. Plant a real enum after several blank-able
  // constructs (string + template) and verify the line maps right.
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'lib', 'pos.ts'),
      'const a = "string with many chars including the word enum {";\n' + // 1
      'const b = `template with enum { Up }`;\n' +                          // 2
      'const c = /* block comment with enum { A, B } */ 42;\n' +            // 3
      'enum REAL { A, B }\n',                                               // 4 <- real
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('pos.ts'));
    assert.ok(v);
    assert.match(v.message, /line 4/,
      'reported line must point at the real enum, not the redacted positions');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// --- Backtick-quoted register() arguments ---

test('components-have-register: accepts backtick-quoted tag argument', async () => {
  // Documented equivalence: register(`tag`) is treated the same as
  // register('tag') / register("tag").
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'tick.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Tick extends WebComponent {}\n' +
      'Tick.register(`tick-tock`);\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'components-have-register' && v.file.includes('tick.ts'));
    assert.equal(v, undefined,
      'backtick-quoted register() call must satisfy components-have-register');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tag-name-has-hyphen: still validates the tag inside backticks', async () => {
  // Counterfactual: backticks must not let an unhyphenated tag slip
  // past tag-name-has-hyphen.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Bad extends WebComponent {}\n' +
      'Bad.register(`badtag`);\n', // backtick + no hyphen
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen' && v.file.includes('bad.ts'));
    assert.ok(v, 'unhyphenated backtick-quoted tag must still flag');
    assert.ok(v.message.includes('badtag'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tag-name-has-hyphen: accepts hyphenated backtick-quoted tag', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'ok.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Ok extends WebComponent {}\n' +
      'Ok.register(`ok-tag`);\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen' && v.file.includes('ok.ts'));
    assert.equal(v, undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('redactor: tagged template body is still blanked even when untagged backticks are preserved', async () => {
  // The tag-detection heuristic must distinguish html`...` (tagged,
  // body blanked) from `tag` (untagged, body preserved). Test by
  // mixing both in the same file.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'mixed.ts'),
      "import { WebComponent, html } from '@webjsdev/core';\n" +
      'class Mixed extends WebComponent {\n' +
      '  render() {\n' +
      // Tagged: must be blanked, so the fake register inside is invisible.
      '    return html`<p>Example: Fake.register("nohyphen")</p>`;\n' +
      '  }\n' +
      '}\n' +
      // Untagged: must be visible, with hyphenated tag.
      'Mixed.register(`mixed-tag`);\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen' && v.file.includes('mixed.ts'));
    assert.equal(v, undefined,
      'untagged backtick is preserved (hyphen check passes), tagged html template is blanked (no false positive)');
    const v2 = violations.find((v) => v.rule === 'components-have-register' && v.file.includes('mixed.ts'));
    assert.equal(v2, undefined, 'class is registered via backticks; rule must see it');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tag-name-has-hyphen: tagged template with ASI-style newline between tag and backtick is still blanked', async () => {
  // The walkback for tag detection must skip newlines so an
  // ASI-style break between the tag and the backtick still
  // classifies as tagged. Otherwise a `const x = html\n  \`...\``
  // body would be preserved verbatim and trip lint rules on
  // example code inside.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'asi.ts'),
      "import { html, WebComponent } from '@webjsdev/core';\n" +
      'class Foo extends WebComponent {\n' +
      '  render() {\n' +
      // Tag on previous line, backtick at start of next line.
      '    return html\n' +
      '      `<p>Example: Fake.register("nohyphen")</p>`;\n' +
      '  }\n' +
      '}\n' +
      "Foo.register('foo-bar');\n",
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen' && v.message.includes('nohyphen'));
    assert.equal(v, undefined,
      'tagged template with newline before backtick must be blanked');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// --- no-scaffold-placeholder is REMOVED (#969) ---
// The scaffold-distinctness machinery (a blocking marker gate plus a doctor
// design advisory) was retired: the scaffold is a learning reference the agent
// reads and then builds the real app from, so `webjs check` no longer enforces
// scaffold-content pruning. These are the counterfactuals: the rule must be
// gone from RULES, and a file that still carries the old marker token must NOT
// be flagged. The token is assembled so this test file does not carry the
// contiguous literal.
const SCAFFOLD_TOKEN = 'webjs-scaffold-' + 'placeholder';

test('no-scaffold-placeholder: the rule is no longer registered', () => {
  const rule = RULES.find((r) => r.name === 'no-scaffold-placeholder');
  assert.equal(rule, undefined, 'the scaffold-placeholder rule must be retired');
});

test('no-scaffold-placeholder: a file carrying the old marker token is not flagged', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(
      join(appDir, 'app', 'page.ts'),
      `// ${SCAFFOLD_TOKEN}. Example homepage, replace it then delete this line.\n` +
      "import { html } from '@webjsdev/core';\n" +
      'export default function Home() { return html`<h1>hi</h1>`; }\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-scaffold-placeholder');
    assert.equal(v, undefined, 'no rule should flag the retired marker token');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-page-route-conflict -------------------- */

test('no-page-route-conflict: flags a page and a route.ts at the same URL', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'x', 'page.ts'), `export default () => 'p';\n`);
    await writeFileEnsureDir(join(appDir, 'app', 'x', 'route.ts'), `export function GET() { return new Response('r'); }\n`);
    const v = (await checkConventions(appDir)).find((v) => v.rule === 'no-page-route-conflict');
    assert.ok(v, 'expected a no-page-route-conflict violation');
    assert.equal(v.file, 'app/x/route.ts');
    assert.match(v.message, /app\/x\/page\.ts/);
    assert.match(v.fix, /app\/api/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-page-route-conflict: a route group does not hide the conflict', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', '(site)', 'about', 'page.ts'), `export default () => 'p';\n`);
    await writeFileEnsureDir(join(appDir, 'app', 'about', 'route.ts'), `export function GET() { return new Response('r'); }\n`);
    const v = (await checkConventions(appDir)).find((v) => v.rule === 'no-page-route-conflict');
    assert.ok(v);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-page-route-conflict: a page and a route at different URLs are fine', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'x', 'page.ts'), `export default () => 'p';\n`);
    await writeFileEnsureDir(join(appDir, 'app', 'x', 'data', 'route.ts'), `export function GET() { return new Response('r'); }\n`);
    const v = (await checkConventions(appDir)).find((v) => v.rule === 'no-page-route-conflict');
    assert.equal(v, undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-jsx-attributes -------------------- */

test('no-jsx-attributes: flags className=, htmlFor= and a capitalised tag in an html template', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'page.ts'),
      "import { html } from '@webjsdev/core';\nexport default () => html`<div className=\"a\"><label htmlFor=${'x'}>x</label><Link href=\"/\">a</Link></div>`;\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-jsx-attributes');
    assert.equal(v.length, 1, 'one violation per template (the first React-ism)');
    assert.match(v[0].message, /className/);
    assert.match(v[0].fix, /class=/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-jsx-attributes: prose, strings, comments and escaped samples are not flagged', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'page.ts'),
      "import { html } from '@webjsdev/core';\n" +
      "const s = '<div className=\"x\">';\n" +
      "// html`<Link className=\"y\">`\n" +
      "export default () => html`<p>React writes &lt;div className=\"x\"&gt; and &lt;Link&gt;.</p><code-block>\\${'<'}Link></code-block>`;\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-jsx-attributes');
    assert.equal(v.length, 0, JSON.stringify(v));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-jsx-route-file -------------------- */

test('no-jsx-route-file: flags page.tsx / layout.jsx, not a .tsx component', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'blog', 'page.tsx'), 'export default function P() { return <h1>x</h1>; }\n');
    await writeFileEnsureDir(join(appDir, 'app', 'layout.jsx'), 'export default ({ children }) => children;\n');
    await writeFileEnsureDir(join(appDir, 'app', 'blog', 'card.tsx'), 'export {};\n');
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-jsx-route-file');
    assert.deepEqual(v.map((x) => x.file).sort(), ['app/blog/page.tsx', 'app/layout.jsx']);
    assert.match(v.find((x) => x.file === 'app/blog/page.tsx').fix, /app\/blog\/page\.ts/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-css-import -------------------- */

test('no-css-import: flags side-effect and default CSS imports with the <link> fix', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'layout.ts'), "import './globals.css';\nexport default ({ children }) => children;\n");
    await writeFileEnsureDir(join(appDir, 'components', 'card.ts'), "import styles from './card.module.css';\nexport { styles };\n");
    await writeFileEnsureDir(join(appDir, 'lib', 'doc.ts'), "export const s = \"import './x.css'\";\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-css-import');
    assert.deepEqual(v.map((x) => x.file).sort(), ['app/layout.ts', 'components/card.ts']);
    assert.match(v[0].fix, /<link rel="stylesheet"/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-inline-use-server -------------------- */

test("no-inline-use-server: flags a 'use server' directive inside a function body", async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'page.ts'),
      "import { html } from '@webjsdev/core';\n" +
      "async function create(fd) {\n  'use server';\n  return fd;\n}\n" +
      "export default () => html`<form action=${create}></form>`;\n");
    const v = (await checkConventions(appDir)).find((x) => x.rule === 'no-inline-use-server');
    assert.ok(v, 'expected no-inline-use-server');
    assert.match(v.message, /line 2/);
    assert.match(v.fix, /\.server\.ts/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test("no-inline-use-server: a module-top directive and a commented mention are fine", async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'modules', 'a.server.ts'), "'use server';\nexport async function a() { return 1; }\n");
    await writeFileEnsureDir(join(appDir, 'lib', 'b.ts'), "// function f() { 'use server'; }\nexport const b = 1;\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-inline-use-server');
    assert.equal(v.length, 0);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test("use-server-needs-extension: a routing file is told to move its actions, not rename", async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'app', 'page.ts'), "'use server';\nexport async function act() {}\nexport default () => '';\n");
    const v = (await checkConventions(appDir)).find((x) => x.rule === 'use-server-needs-extension');
    assert.ok(v);
    assert.doesNotMatch(v.fix, /page\.server\.ts/);
    assert.match(v.fix, /modules\/<feature>\/actions/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-server-env-in-components (browser-shipped) -------------------- */

test('no-server-env-in-components: NEXT_PUBLIC_ gets the WEBJS_PUBLIC_ fix; a shipped util is covered', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'lib', 'config.ts'), 'export const key = process.env.NEXT_PUBLIC_MAPS_KEY;\n');
    await writeFileEnsureDir(join(appDir, 'components', 'map-view.ts'),
      "import { WebComponent, html } from '@webjsdev/core';\nimport { key } from '../lib/config.ts';\n" +
      "class MapView extends WebComponent({}) { render() { return html`<button @click=${() => key}>m</button>`; } }\nMapView.register('map-view');\n");
    await writeFileEnsureDir(join(appDir, 'app', 'page.ts'),
      "import { html } from '@webjsdev/core';\nimport '../components/map-view.ts';\nexport default () => html`<map-view></map-view>${process.env.DATABASE_URL ? '' : ''}`;\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-server-env-in-components');
    assert.deepEqual(v.map((x) => x.file), ['lib/config.ts'], 'the shipped util is flagged; the page function is not');
    assert.match(v[0].fix, /WEBJS_PUBLIC_MAPS_KEY/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- no-next-runtime-guard -------------------- */

test('no-next-runtime-guard: flags process.env.NEXT_RUNTIME', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFileEnsureDir(join(appDir, 'instrumentation.ts'),
      "export async function register() {\n  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./otel.ts');\n}\n");
    await writeFileEnsureDir(join(appDir, 'lib', 'note.ts'), "// process.env.NEXT_RUNTIME is Next-only\nexport const n = 1;\n");
    const v = (await checkConventions(appDir)).filter((x) => x.rule === 'no-next-runtime-guard');
    assert.deepEqual(v.map((x) => x.file), ['instrumentation.ts']);
    assert.match(v[0].fix, /process\.versions\.bun/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});
