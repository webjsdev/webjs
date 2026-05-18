/**
 * Integration tests for `scaffoldApp`: invokes the full-stack, api, and
 * saas scaffolds programmatically in a temp dir and asserts the expected
 * files / directory structure are produced. Runs entirely offline.
 *
 * This is a coverage anchor for `packages/cli/lib/create.js` and
 * `packages/cli/lib/saas-template.js`: both files are otherwise only
 * exercised by manual `webjs create` runs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../packages/cli/lib/create.js';

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-integ-'));
}

/**
 * Silence console.log during scaffold to keep test output clean.
 * Returns a restore function.
 */
function muteConsole() {
  const origLog = console.log;
  const origError = console.error;
  console.log = () => {};
  console.error = () => {};
  return () => {
    console.log = origLog;
    console.error = origError;
  };
}

test('scaffoldApp full-stack: writes the canonical full-stack app layout', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-app', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'my-app');
    assert.ok(existsSync(appDir), 'app directory created');

    // Core directories
    for (const d of ['app', 'components', 'modules', 'lib', 'public', 'prisma', 'test/unit', 'test/e2e']) {
      assert.ok(existsSync(join(appDir, d)), `${d}/ should exist`);
    }

    // Root files
    assert.ok(existsSync(join(appDir, 'package.json')));
    assert.ok(existsSync(join(appDir, 'tsconfig.json')));

    // Template files copied
    for (const f of ['AGENTS.md', 'CONVENTIONS.md', 'CLAUDE.md', '.editorconfig']) {
      assert.ok(existsSync(join(appDir, f)), `${f} should exist`);
    }

    // Full-stack template-specific
    assert.ok(existsSync(join(appDir, 'app', 'layout.ts')), 'layout.ts written');
    assert.ok(existsSync(join(appDir, 'app', 'page.ts')), 'page.ts written');
    assert.ok(existsSync(join(appDir, 'components', 'theme-toggle.ts')), 'theme-toggle written');

    // Prisma + lib singleton wired up
    assert.ok(existsSync(join(appDir, 'prisma', 'schema.prisma')), 'prisma schema written');
    assert.ok(existsSync(join(appDir, 'lib', 'prisma.ts')), 'lib/prisma.ts written');

    // package.json contents
    const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'my-app');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.scripts.dev, 'webjs dev');
    assert.equal(pkg.scripts.start, 'webjs start');
    assert.ok(pkg.dependencies['@webjskit/core']);
    assert.ok(pkg.dependencies['@webjskit/server']);
    assert.ok(pkg.dependencies['@prisma/client']);
    assert.ok(pkg.devDependencies['@webjskit/ts-plugin']);

    // tsconfig.json has the editor plugin
    const tsconfig = JSON.parse(readFileSync(join(appDir, 'tsconfig.json'), 'utf8'));
    const pluginNames = (tsconfig.compilerOptions.plugins || []).map((p) => p.name);
    assert.ok(pluginNames.includes('@webjskit/ts-plugin'), 'editor plugin listed');

    // {{APP_NAME}} placeholder substituted in template files
    const agents = readFileSync(join(appDir, 'AGENTS.md'), 'utf8');
    assert.ok(!agents.includes('{{APP_NAME}}'), 'placeholders substituted in AGENTS.md');

    // .gitignore mentions the SQLite dev DB
    const gitignore = readFileSync(join(appDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /prisma\/dev\.db/, '.gitignore covers SQLite');

    // .env.example mentions DATABASE_URL
    const envExample = readFileSync(join(appDir, '.env.example'), 'utf8');
    assert.match(envExample, /DATABASE_URL/, '.env.example carries DATABASE_URL');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp api: writes API-only template (no layout, no components)', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-api', cwd, { template: 'api' });
    const appDir = join(cwd, 'my-api');

    // Core skeleton still exists
    for (const d of ['app', 'modules', 'lib', 'prisma', 'test/unit']) {
      assert.ok(existsSync(join(appDir, d)), `${d}/ should exist`);
    }

    // API routes
    assert.ok(existsSync(join(appDir, 'app', 'api', 'health', 'route.ts')), 'health route');
    assert.ok(existsSync(join(appDir, 'app', 'api', 'users', 'route.ts')), 'users route');

    // Module skeleton
    assert.ok(existsSync(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts')));
    assert.ok(existsSync(join(appDir, 'modules', 'users', 'actions', 'create-user.server.ts')));
    assert.ok(existsSync(join(appDir, 'modules', 'users', 'types.ts')));

    // Unit tests included
    assert.ok(existsSync(join(appDir, 'test', 'unit', 'users.test.ts')));

    // No layout/page (API-only)
    assert.ok(!existsSync(join(appDir, 'app', 'layout.ts')), 'no layout for api');
    assert.ok(!existsSync(join(appDir, 'app', 'page.ts')), 'no page for api');
    assert.ok(!existsSync(join(appDir, 'components', 'theme-toggle.ts')),
      'no theme-toggle for api');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp saas: writes auth + dashboard + Prisma User model', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-saas', cwd, { template: 'saas' });
    const appDir = join(cwd, 'my-saas');

    // Core scaffold still in place
    assert.ok(existsSync(join(appDir, 'app', 'layout.ts')), 'layout.ts written');
    assert.ok(existsSync(join(appDir, 'app', 'page.ts')), 'page.ts written');

    // SaaS-specific lib files
    assert.ok(existsSync(join(appDir, 'lib', 'prisma.ts')), 'lib/prisma.ts present');
    assert.ok(existsSync(join(appDir, 'lib', 'password.ts')), 'lib/password.ts present');
    assert.ok(existsSync(join(appDir, 'lib', 'auth.ts')), 'lib/auth.ts present');

    // Prisma User model
    const schema = readFileSync(join(appDir, 'prisma', 'schema.prisma'), 'utf8');
    assert.match(schema, /model User/, 'User model present');
    assert.match(schema, /passwordHash/, 'User has passwordHash field');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp: exits / throws when the target dir already exists', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  // Stub process.exit so we can catch it.
  const origExit = process.exit;
  let exitCode = null;
  process.exit = (code) => {
    exitCode = code;
    // Throw to short-circuit: scaffoldApp would otherwise continue
    // executing after the existsSync branch.
    throw new Error('exit-stub');
  };
  try {
    await scaffoldApp('first', cwd, { template: 'full-stack' });
    // Second attempt at the same name → should exit(1).
    await assert.rejects(
      () => scaffoldApp('first', cwd, { template: 'full-stack' }),
      /exit-stub/,
    );
    assert.equal(exitCode, 1, 'process.exit(1) on duplicate dir');
  } finally {
    process.exit = origExit;
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp: template placeholder substitution in copied files', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('PlaceholderTest', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'PlaceholderTest');

    // Walk a few template-copied files and verify {{APP_NAME}} was replaced.
    const filesToCheck = ['AGENTS.md', 'CONVENTIONS.md', 'CLAUDE.md'];
    for (const f of filesToCheck) {
      const p = join(appDir, f);
      if (!existsSync(p)) continue;
      const content = readFileSync(p, 'utf8');
      assert.ok(!content.includes('{{APP_NAME}}'),
        `${f} should have {{APP_NAME}} substituted out`);
    }
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});
