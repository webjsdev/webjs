// webjs-disable-file reactive-props-use-declare
// This test file contains class-field initializer fixtures used to
// assert that the `reactive-props-use-declare` rule catches them.
// The fixture strings are inside template literals or contained
// classes that the file-walking source scanner reads as real source.
// Disable the rule for this file so `webjs check` on the framework
// repo itself stays clean.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { checkConventions } from '../../src/check.js';

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

test('reactive-props-use-declare: flags class-field initializer on reactive prop', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.ts'),
      `import { WebComponent } from '@webjsdev/core';
class BadProp extends WebComponent {
  static properties = { count: { type: Number } };
  count: number = 0;
}
BadProp.register('bad-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.ok(v, 'expected reactive-props-use-declare violation');
    assert.ok(v.message.includes('count'));
    assert.ok(v.fix.includes('declare'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-use-declare: also flags untyped initializer', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.ts'),
      `import { WebComponent } from '@webjsdev/core';
class BadProp extends WebComponent {
  static properties = { name: { type: String } };
  name = 'Anonymous';
}
BadProp.register('bad-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.ok(v, 'expected violation for `name = "Anonymous"`');
    assert.ok(v.message.includes('name'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-use-declare: passes when declare + constructor are used', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'good.ts'),
      `import { WebComponent } from '@webjsdev/core';
class GoodProp extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;

  constructor() {
    super();
    this.count = 0;
  }
}
GoodProp.register('good-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.equal(v, undefined, 'declare + constructor should be clean');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-use-declare: ignores non-reactive plain fields', async () => {
  // Fields whose names are NOT in `static properties` are free-form -
  // no reactive accessor exists, so a class-field initializer is fine.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'mixed.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Mixed extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;
  _conn: WebSocket | null = null;     // not reactive: fine
  _retries = 0;                       // not reactive: fine

  constructor() { super(); this.count = 0; }
}
Mixed.register('mixed-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.equal(v, undefined, 'non-reactive class fields should not trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-use-declare: does not trip on `this.x = …` inside methods', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'methods.ts'),
      `import { WebComponent } from '@webjsdev/core';
class Methods extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;

  constructor() { super(); this.count = 0; }

  increment() {
    this.count = this.count + 1;
  }
}
Methods.register('methods-prop');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.equal(v, undefined, 'this.x = … inside methods is correct');
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

test('rule override disables a rule', async () => {
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

    const violations = await checkConventions(appDir, {
      rules: { 'tag-name-has-hyphen': false },
    });
    const v = violations.find((v) => v.rule === 'tag-name-has-hyphen');
    assert.equal(v, undefined, 'disabled rule should not fire');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- actions-in-modules -------------------- */

test('actions-in-modules: flags .server.ts file outside modules/*/actions or queries', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules'), { recursive: true });
    await mkdir(join(appDir, 'app', 'api'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'api', 'create.server.ts'),
      `'use server';\nexport async function create() {}`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'actions-in-modules');
    assert.ok(v, 'expected actions-in-modules violation');
    assert.ok(v.message.includes('actions/'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: ignores files already inside modules/*/actions', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'users', 'actions', 'create.server.ts'),
      `export async function create() {}`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'actions-in-modules'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: ignores files inside modules/*/queries', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'users', 'queries'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'users', 'queries', 'list.server.ts'),
      `export async function list() {}`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'actions-in-modules'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: ignores files inside modules/*/components or utils', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'users', 'components'), { recursive: true });
    await mkdir(join(appDir, 'modules', 'users', 'utils'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'users', 'components', 'form.server.ts'),
      `'use server';\nexport async function submit() {}`,
    );
    await writeFile(
      join(appDir, 'modules', 'users', 'utils', 'helper.server.ts'),
      `'use server';\nexport async function helper() {}`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'actions-in-modules'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: not enforced when modules/ does not exist', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'app', 'api'), { recursive: true });
    await writeFile(
      join(appDir, 'app', 'api', 'rogue.server.ts'),
      `export async function rogue() {}`,
    );
    const violations = await checkConventions(appDir);
    // With no modules/ dir, the rule is skipped.
    assert.equal(violations.find((v) => v.rule === 'actions-in-modules'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- one-function-per-action -------------------- */

test('one-function-per-action: flags file exporting > 1 async function', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'users', 'actions', 'multi.server.ts'),
      `'use server';\nexport async function create() {}\nexport async function remove() {}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'one-function-per-action');
    assert.ok(v, 'expected one-function-per-action violation');
    assert.ok(v.message.includes('2 functions'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('one-function-per-action: passes for single-function file', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'users', 'actions', 'single.server.ts'),
      `export async function create() {}\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'one-function-per-action'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('one-function-per-action: detects `export const foo = async ...` pattern', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'u', 'actions'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'u', 'actions', 'arrow.server.ts'),
      `'use server';\nexport const a = async () => {};\nexport const b = async () => {};\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'one-function-per-action');
    assert.ok(v);
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

/* -------------------- tests-exist -------------------- */

test('tests-exist: flags modules/feature with no matching test file', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'orphan'), { recursive: true });
    const violations = await checkConventions(appDir);
    const v = violations.find(
      (x) => x.rule === 'tests-exist' && x.file.includes('orphan'),
    );
    assert.ok(v);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('tests-exist: passes when a test file mentions the module name', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'posts'), { recursive: true });
    await mkdir(join(appDir, 'test', 'unit'), { recursive: true });
    await writeFile(
      join(appDir, 'test', 'unit', 'posts.test.ts'),
      `import { test } from 'node:test';\n`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(
      violations.find((v) => v.rule === 'tests-exist' && v.file.includes('posts')),
      undefined,
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/* -------------------- package.json webjs.conventions overrides -------------------- */

test('override via package.json "webjs.conventions" disables a rule', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.js'),
      `import { WebComponent } from '@webjsdev/core';\n` +
      `class BadComp extends WebComponent {}\nBadComp.register('badcomp');\n`,
    );
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'x',
        webjs: { conventions: { 'tag-name-has-hyphen': false } },
      }),
    );
    const violations = await checkConventions(appDir);
    assert.equal(violations.find((v) => v.rule === 'tag-name-has-hyphen'), undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('top-level "conventions" key in package.json is ignored (no legacy fallback)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.js'),
      `import { WebComponent } from '@webjsdev/core';\n` +
      `class BadComp extends WebComponent {}\nBadComp.register('badcomp');\n`,
    );
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'x',
        conventions: { 'tag-name-has-hyphen': false },
      }),
    );
    const violations = await checkConventions(appDir);
    assert.ok(
      violations.find((v) => v.rule === 'tag-name-has-hyphen'),
      'top-level "conventions" must not disable the rule',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('a webjs.conventions.js file is ignored (no legacy fallback)', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'bad.js'),
      `import { WebComponent } from '@webjsdev/core';\n` +
      `class BadComp extends WebComponent {}\nBadComp.register('badcomp');\n`,
    );
    await writeFile(
      join(appDir, 'webjs.conventions.js'),
      `export default { 'tag-name-has-hyphen': false };\n`,
    );
    const violations = await checkConventions(appDir);
    assert.ok(
      violations.find((v) => v.rule === 'tag-name-has-hyphen'),
      'webjs.conventions.js must not disable the rule',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('unknown rule name in override is ignored (no crash)', async () => {
  const appDir = await makeTempApp();
  try {
    const violations = await checkConventions(appDir, {
      rules: { 'nonexistent-rule': false },
    });
    assert.ok(Array.isArray(violations));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: exempts files under lib/ (cross-cutting infra)', async () => {
  const appDir = await makeTempApp();
  try {
    // Required: modules/ must exist for actions-in-modules to run at all.
    await mkdir(join(appDir, 'modules', 'auth'), { recursive: true });
    await mkdir(join(appDir, 'lib'), { recursive: true });
    await writeFile(
      join(appDir, 'lib', 'prisma.ts'),
      `'use server';\nexport const prisma = {};\n`,
    );
    await writeFile(
      join(appDir, 'lib', 'session.ts'),
      `'use server';\nexport function getSession() {}\nexport function setSession() {}\n`,
    );

    const violations = await checkConventions(appDir);
    const flagged = violations.filter((v) => v.rule === 'actions-in-modules');
    assert.deepEqual(flagged, [], 'lib/*.ts files must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('actions-in-modules: still flags loose .server.ts at the root', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'posts'), { recursive: true });
    await writeFile(
      join(appDir, 'create-post.server.ts'),
      `'use server';\nexport async function createPost() {}\n`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'actions-in-modules');
    assert.ok(v, 'expected actions-in-modules violation for loose .server.ts');
    assert.equal(v.file, 'create-post.server.ts');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('one-function-per-action: only applies inside modules/*/actions/ or queries/', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'modules', 'auth', 'actions'), { recursive: true });
    await mkdir(join(appDir, 'lib'), { recursive: true });
    // lib/session.ts has 5 exports: was previously flagged. Must NOT be flagged now.
    await writeFile(
      join(appDir, 'lib', 'session.ts'),
      `'use server';
export function getSession() {}
export function setSession() {}
export function clearSession() {}
export function rotateSession() {}
export function verifySession() {}
`,
    );
    // modules/auth/actions/login.server.ts with 2 exports: MUST be flagged.
    await writeFile(
      join(appDir, 'modules', 'auth', 'actions', 'login.server.ts'),
      `'use server';\nexport async function login() {}\nexport async function loginAlt() {}\n`,
    );
    const violations = await checkConventions(appDir);
    const flagged = violations
      .filter((v) => v.rule === 'one-function-per-action')
      .map((v) => v.file);
    assert.deepEqual(flagged, ['modules/auth/actions/login.server.ts']);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-json-data-files: flags JSON files under data/', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'data'), { recursive: true });
    await writeFile(join(appDir, 'data', 'todos.json'), '[]');

    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'no-json-data-files');
    assert.ok(v, 'expected no-json-data-files violation');
    assert.equal(v.file, 'data/todos.json');
    assert.ok(v.message.includes('Prisma'));
    assert.ok(v.fix.includes('schema.prisma'));
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-json-data-files: flags db.json / database.json / *-db.json anywhere', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFile(join(appDir, 'db.json'), '{}');
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(join(appDir, 'app', 'posts-db.json'), '{}');
    await writeFile(join(appDir, 'database.json'), '{}');

    const violations = await checkConventions(appDir);
    const flagged = violations
      .filter((v) => v.rule === 'no-json-data-files')
      .map((v) => v.file)
      .sort();
    assert.deepEqual(flagged, ['app/posts-db.json', 'database.json', 'db.json']);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-json-data-files: does not flag package.json / tsconfig.json / other config', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFile(join(appDir, 'package.json'), '{"name":"x"}');
    await writeFile(join(appDir, 'tsconfig.json'), '{}');
    await writeFile(join(appDir, 'manifest.json'), '{}');
    // A random JSON file with a normal name elsewhere: also fine.
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(join(appDir, 'app', 'metadata.json'), '{}');

    const violations = await checkConventions(appDir);
    assert.equal(
      violations.find((v) => v.rule === 'no-json-data-files'),
      undefined,
      'should not flag config / metadata JSON',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-json-data-files: skips node_modules / prisma / dist / build / public', async () => {
  const appDir = await makeTempApp();
  try {
    // db.json inside ignored dirs must NOT be flagged.
    for (const d of ['node_modules', 'prisma', 'dist', 'build', 'public', '.next']) {
      await mkdir(join(appDir, d), { recursive: true });
      await writeFile(join(appDir, d, 'db.json'), '{}');
    }
    const violations = await checkConventions(appDir);
    assert.equal(
      violations.find((v) => v.rule === 'no-json-data-files'),
      undefined,
      'should not descend into ignored dirs',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('no-json-data-files: can be disabled via overrides', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'data'), { recursive: true });
    await writeFile(join(appDir, 'data', 'todos.json'), '[]');

    const violations = await checkConventions(appDir, {
      rules: { 'no-json-data-files': false },
    });
    assert.equal(
      violations.find((v) => v.rule === 'no-json-data-files'),
      undefined,
    );
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
      join(appDir, 'lib', 'prisma.server.ts'),
      `export const prisma = { findMany: () => [] };
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'use-server-needs-extension');
    assert.equal(v, undefined, 'extension alone is server-only utility, not flagged here');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('use-server-needs-extension: can be disabled via overrides', async () => {
  const appDir = await makeTempApp();
  try {
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'tmp',
        webjs: { conventions: { 'use-server-needs-extension': false } },
      }),
    );
    await mkdir(join(appDir, 'modules', 'auth'), { recursive: true });
    await writeFile(
      join(appDir, 'modules', 'auth', 'login.ts'),
      `'use server';
export async function login() { return 1; }
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((x) => x.rule === 'use-server-needs-extension');
    assert.equal(v, undefined, 'override should disable the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

/**
 * Tests for the gitignore-vendor-not-ignored rule. Uses a real
 * `git init` in a temp directory so `git check-ignore` behaves
 * exactly as it would in a real project.
 */

function initGit(appDir) {
  const result = spawnSync('git', ['init', '-q'], { cwd: appDir, stdio: 'pipe' });
  return result.status === 0;
}

test('gitignore-vendor-not-ignored: flags the broken `.webjs/` pattern', async () => {
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    // The structurally-broken pattern: parent excluded, child negations
    // can never re-include anything because git stops at the parent.
    await writeFile(join(appDir, '.gitignore'), '.webjs/\n!.webjs/vendor/\n');
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.ok(v, 'expected gitignore-vendor-not-ignored violation');
    assert.match(v.fix, /\.webjs\/\*/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('gitignore-vendor-not-ignored: passes for the correct pattern', async () => {
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    await writeFile(
      join(appDir, '.gitignore'),
      '.webjs/*\n!.webjs/vendor/\n!.webjs/vendor/**\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.equal(v, undefined, 'correct pattern should not violate');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('gitignore-vendor-not-ignored: flags broader `*.js` rule that hides bundle files', async () => {
  // The pin manifest gets through because it ends in .json, but
  // `webjs vendor pin --download` writes <pkg>@<version>.js files
  // and those get blocked. Two-probe check catches this.
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    await writeFile(
      join(appDir, '.gitignore'),
      '.webjs/*\n!.webjs/vendor/\n!.webjs/vendor/**\n*.js\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.ok(v, 'broader *.js rule should be flagged');
    assert.match(v.message, /sample-pkg|\.js/, 'message should reference the bundle file probe');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('gitignore-vendor-not-ignored: skipped when not a git repo', async () => {
  const appDir = await makeTempApp();
  try {
    // No `git init`. A .gitignore exists but there is no .git/ dir,
    // so the rule must skip rather than emit a false positive.
    await writeFile(join(appDir, '.gitignore'), '.webjs/\n');
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.equal(v, undefined, 'rule must skip when .git is absent');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('gitignore-vendor-not-ignored: skipped when no .gitignore exists', async () => {
  const appDir = await makeTempApp();
  try {
    if (!initGit(appDir)) return;
    // git repo exists but no .gitignore at all (user has not opted
    // into ignore rules yet). Rule must skip.
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.equal(v, undefined, 'rule must skip when .gitignore is absent');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('webjs-disable-file: suppresses a single rule for the whole file', async () => {
  // The directive: `// webjs-disable-file <rule>` at the top of a
  // file tells `webjs check` to ignore the named rule's violations
  // in that file. Use case: a docs page rendering example code
  // strings that the scanner reads as real source. Verify with the
  // `reactive-props-use-declare` rule + a real violation that
  // would normally fire.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'fixture.ts'),
      '// webjs-disable-file reactive-props-use-declare\n' +
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Bad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' +  // class-field initializer: would normally violate
      '}\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.equal(v, undefined,
      'directive must suppress the named rule for this file');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('webjs-disable-file: bare directive (no rule) suppresses all rules', async () => {
  // `// webjs-disable-file` with no rule list disables every rule
  // for the file. Useful for test fixtures or docs pages that
  // violate many rules at once.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'fixture.ts'),
      '// webjs-disable-file\n' +
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Bad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' +
      '}\n' +
      // also triggers no-non-erasable-typescript:
      'enum E { A, B }\n',
    );
    const violations = await checkConventions(appDir);
    // Filter to violations in our fixture file; other rules on
    // other files are out of scope for this assertion.
    const ours = violations.filter((v) => v.file.endsWith('fixture.ts'));
    assert.deepEqual(ours, [],
      'bare webjs-disable-file must suppress every rule for the file');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('webjs-disable-file: comma-separated rule list suppresses each named rule', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'fixture.ts'),
      '// webjs-disable-file reactive-props-use-declare, no-non-erasable-typescript\n' +
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Bad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' +
      '}\n' +
      "Bad.register('bad-tag');\n" + // keep components-have-register happy
      'enum E { A, B }\n',
    );
    const violations = await checkConventions(appDir);
    const ours = violations.filter((v) => v.file.endsWith('fixture.ts'));
    // Both named rules suppressed. Any OTHER rules that fire on this
    // fixture are fine to assert against here (none expected with
    // the register() call in place).
    const named = ours.filter((v) => v.rule === 'reactive-props-use-declare' || v.rule === 'no-non-erasable-typescript');
    assert.deepEqual(named, [], 'both named rules must be suppressed');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('webjs-disable-file: only the named rule is suppressed (other rules still fire)', async () => {
  // Defensive: a single-rule directive must NOT silence unrelated
  // rules. If it did, users would lose lint coverage by mistake.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'fixture.ts'),
      '// webjs-disable-file reactive-props-use-declare\n' +
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class Bad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' +
      '}\n' +
      // Also triggers no-non-erasable-typescript, but that rule is
      // NOT in the disable list, so it must still fire.
      'enum E { A, B }\n',
    );
    const violations = await checkConventions(appDir);
    const reactive = violations.find((v) => v.rule === 'reactive-props-use-declare' && v.file.endsWith('fixture.ts'));
    const tsRule = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('fixture.ts'));
    assert.equal(reactive, undefined, 'named rule must be suppressed');
    assert.ok(tsRule, 'unrelated rule must still fire');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('webjs-disable-file: directive inside a template-literal string does NOT disable the rule', async () => {
  // Anti-bypass: the directive must be a real top-of-file comment.
  // If a string value inside source code happens to contain
  // "// webjs-disable-file ...", that should not silently disable
  // lint coverage. Implementation anchors the regex with `^\s*//`
  // (multi-line mode), which still matches if the directive begins
  // a line, but does not match characters strictly embedded inside
  // an expression. The realistic threat is documentation prose
  // containing the literal directive; we accept that as a "looks
  // like a real comment" indistinguishable case and rely on
  // authoring discipline (the directive is opt-in, anyone reading
  // the file sees it).
  //
  // What we DO guard against: a directive that's clearly inside a
  // string concatenation expression (no `//` line-start). Verified
  // by ensuring the rule still fires when the directive is part of
  // a string literal returned by a function rather than a real
  // line comment.
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'fixture.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'const fake = `// webjs-disable-file reactive-props-use-declare`;\n' +
      'class Bad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' +
      '}\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare' && v.file.endsWith('fixture.ts'));
    assert.ok(v, 'directive in a string literal must NOT disable the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});
