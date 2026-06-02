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

/**
 * Tests for the gitignore-vendor-not-ignored rule. Uses a real
 * `git init` in a temp directory so `git check-ignore` behaves
 * exactly as it would in a real project.
 */

function initGit(appDir) {
  // Clear inherited git env so `git init` (and the rule's later
  // check-ignore) target appDir, not an outer repo whose GIT_DIR /
  // GIT_WORK_TREE leaked in via a worktree pre-commit hook.
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...env } = process.env;
  const result = spawnSync('git', ['init', '-q'], { cwd: appDir, stdio: 'pipe', env });
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

test('gitignore-vendor-not-ignored: ignores leaked GIT_WORK_TREE/GIT_DIR (worktree pre-commit)', async () => {
  // Regression for the env-leak fix in check.js. The rule shells out to
  // `git check-ignore` with cwd set to appDir. When `webjs check` (or
  // `npm test`) runs inside a git hook from a linked worktree, git
  // exports GIT_WORK_TREE / GIT_DIR / GIT_INDEX_FILE into the env, and
  // those OVERRIDE cwd-based repo discovery, so the probe would consult
  // the outer repo instead of appDir. We simulate that by pointing those
  // vars at THIS monorepo (process.cwd()), then assert the rule still
  // reads appDir's .gitignore (flags the broken `*.js` rule). Without the
  // `env` strip in check.js this fails: the probe resolves against the
  // outer repo where `.webjs/vendor/*.js` is not ignored.
  const appDir = await makeTempApp();
  const saved = {
    GIT_DIR: process.env.GIT_DIR,
    GIT_WORK_TREE: process.env.GIT_WORK_TREE,
    GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
  };
  try {
    if (!initGit(appDir)) return;
    await writeFile(
      join(appDir, '.gitignore'),
      '.webjs/*\n!.webjs/vendor/\n!.webjs/vendor/**\n*.js\n',
    );
    // Leak outer-repo git context, the way a worktree pre-commit hook does.
    process.env.GIT_DIR = join(process.cwd(), '.git');
    process.env.GIT_WORK_TREE = process.cwd();
    delete process.env.GIT_INDEX_FILE;
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'gitignore-vendor-not-ignored');
    assert.ok(v, 'rule must read appDir gitignore despite leaked GIT_* env');
  } finally {
    for (const [k, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    }
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

test('reactive-props-use-declare: ignores fixture-style class strings inside template literals', async () => {
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
      '// reactive-props violation, but inside a template literal.\n' +
      'export const fixture = `\n' +
      '  class FixtureClass extends WebComponent {\n' +
      '    static properties = { x: { type: Number } };\n' +
      '    x = 0;\n' +
      '  }\n' +
      '`;\n',
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
    assert.equal(v, undefined,
      'class-field initializer inside a template literal must not trigger the rule');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('reactive-props-use-declare: still flags a real class-field initializer at top level', async () => {
  const appDir = await makeTempApp();
  try {
    await mkdir(join(appDir, 'components'), { recursive: true });
    await writeFile(
      join(appDir, 'components', 'real.ts'),
      "import { WebComponent } from '@webjsdev/core';\n" +
      'class RealBad extends WebComponent {\n' +
      '  static properties = { x: { type: Number } };\n' +
      '  x = 0;\n' + // real top-level violation
      '}\n' +
      "RealBad.register('real-bad');\n",
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === 'reactive-props-use-declare');
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

// --- package.json overrides still apply to rules touched by PR #109 ---
