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

import { scaffoldApp } from '../../packages/cli/lib/create.js';

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

    // Dark-mode wiring: the head init script (in layout) AND the theme-toggle
    // must toggle the shadcn `.dark` class, not only the `data-theme`
    // attribute. Without `.dark`, the copied components/ui/* render light
    // tokens on the dark chrome (white buttons/cards, invisible text). Light
    // mode hides this, so guard it here. See agent-docs/styling.md "Dark mode".
    const layoutSrc = readFileSync(join(appDir, 'app', 'layout.ts'), 'utf8');
    const toggleSrc = readFileSync(join(appDir, 'components', 'theme-toggle.ts'), 'utf8');
    assert.match(layoutSrc, /classList\.toggle\(['"]dark['"]/,
      'layout head script must toggle the .dark class (shadcn dark-mode signal)');
    assert.match(toggleSrc, /classList\.toggle\(['"]dark['"]/,
      'theme-toggle must toggle the .dark class (shadcn dark-mode signal)');

    // Prisma + lib singleton wired up
    assert.ok(existsSync(join(appDir, 'prisma', 'schema.prisma')), 'prisma schema written');
    assert.ok(existsSync(join(appDir, 'lib', 'prisma.server.ts')), 'lib/prisma.server.ts written');

    // The require-tests hook still reaches the scaffolded app for Claude
    // Code: the hook file is copied and the Claude settings wire it into
    // PreToolUse. (The tool-agnostic test gate has moved to CI, see below.)
    assert.ok(existsSync(join(appDir, '.claude/hooks/require-tests-with-src.sh')),
      'require-tests hook is scaffolded');
    const claudeSettings = JSON.parse(
      readFileSync(join(appDir, '.claude/settings.json'), 'utf8'),
    );
    const preCommands = (claudeSettings.hooks?.PreToolUse ?? [])
      .flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(
      preCommands.includes('.claude/hooks/require-tests-with-src.sh'),
      'settings.json wires the require-tests hook into PreToolUse',
    );

    // The local pre-commit hook is lightweight: it blocks commits to main
    // and nothing else. The test/convention gate runs in CI, not locally,
    // so `git commit` stays fast and the gate cannot be skipped with a
    // local --no-verify. Mirrors the webjs framework's own pre-commit.
    const preCommit = readFileSync(join(appDir, '.hooks/pre-commit'), 'utf8');
    assert.match(preCommit, /Cannot commit directly to/,
      'pre-commit blocks commits to main');
    assert.doesNotMatch(preCommit, /npx --no-install webjs/,
      'pre-commit no longer runs the test suite (moved to CI)');
    assert.doesNotMatch(preCommit, /no test is staged/,
      'pre-commit no longer carries the require-tests floor (moved to CI)');

    // CI carries the test gate: webjs check + the unit / browser / e2e
    // layers on every PR and push to main.
    const ciWorkflow = readFileSync(
      join(appDir, '.github/workflows/ci.yml'), 'utf8');
    assert.match(ciWorkflow, /npm run check/,
      'CI runs webjs check');
    assert.match(ciWorkflow, /npm run test:server/,
      'CI runs the unit + integration suite (server layer)');
    assert.match(ciWorkflow, /npm run test:browser/,
      'CI runs the browser suite');
    assert.match(ciWorkflow, /WEBJS_E2E/,
      'CI runs the e2e layer');

    // Production / deploy scaffolding ships with every app.
    assert.ok(existsSync(join(appDir, 'Dockerfile')), 'Dockerfile scaffolded');
    assert.ok(existsSync(join(appDir, 'compose.yaml')), 'compose.yaml scaffolded');
    assert.ok(existsSync(join(appDir, '.dockerignore')), '.dockerignore scaffolded');
    const dockerfile = readFileSync(join(appDir, 'Dockerfile'), 'utf8');
    assert.match(dockerfile, /FROM node:24-alpine/,
      'Dockerfile pins the same Node major as CI (24)');
    assert.match(dockerfile, /CMD \["npm", "start"\]/,
      'Dockerfile starts via npm so prestart hooks fire');
    // Platform-neutral readiness gate: a HEALTHCHECK probing /__webjs/ready, so
    // the gate works on any Docker-based deploy without a per-platform file.
    assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/__webjs\/ready/,
      'Dockerfile HEALTHCHECK probes /__webjs/ready');
    const compose = readFileSync(join(appDir, 'compose.yaml'), 'utf8');
    assert.match(compose, /healthcheck:[\s\S]*\/__webjs\/ready/,
      'compose.yaml healthcheck probes /__webjs/ready');
    // .dockerignore must preserve the .webjs/vendor negation (parent
    // exclusion would silently drop the committed importmap).
    const dockerignore = readFileSync(join(appDir, '.dockerignore'), 'utf8');
    assert.match(dockerignore, /!\.webjs\/vendor\//,
      '.dockerignore keeps .webjs/vendor/ (committed importmap ships)');

    // package.json contents
    const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'my-app');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.scripts.dev, 'webjs dev');
    assert.equal(pkg.scripts.start, 'webjs start');
    assert.ok(pkg.dependencies['@webjsdev/core']);
    assert.ok(pkg.dependencies['@webjsdev/server']);
    assert.ok(pkg.dependencies['@prisma/client']);
    assert.ok(pkg.devDependencies['@webjsdev/ts-plugin']);

    // tsconfig.json has the editor plugin
    const tsconfig = JSON.parse(readFileSync(join(appDir, 'tsconfig.json'), 'utf8'));
    const pluginNames = (tsconfig.compilerOptions.plugins || []).map((p) => p.name);
    assert.ok(pluginNames.includes('@webjsdev/ts-plugin'), 'editor plugin listed');

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

    // Root CORS middleware demonstrating the cors() primitive
    const mwPath = join(appDir, 'middleware.ts');
    assert.ok(existsSync(mwPath), 'api template ships a root middleware.ts');
    const mw = readFileSync(mwPath, 'utf8');
    assert.match(mw, /import \{ cors \} from '@webjsdev\/server'/, 'imports cors()');
    assert.match(mw, /export default cors\(/, 'default-exports the cors() middleware');
    // Never demonstrate the invalid wildcard + credentials combination.
    assert.doesNotMatch(mw, /origin:\s*'\*'/, 'no wildcard origin with credentials');

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
    assert.ok(existsSync(join(appDir, 'lib', 'prisma.server.ts')), 'lib/prisma.server.ts present');
    assert.ok(existsSync(join(appDir, 'lib', 'password.server.ts')), 'lib/password.server.ts present');
    assert.ok(existsSync(join(appDir, 'lib', 'auth.server.ts')), 'lib/auth.server.ts present');

    // Prisma User model
    const schema = readFileSync(join(appDir, 'prisma', 'schema.prisma'), 'utf8');
    assert.match(schema, /model User/, 'User model present');
    assert.match(schema, /passwordHash/, 'User has passwordHash field');

    // Signup page is the canonical no-JS form write-path (#244): it exports a
    // page `action`, posts via `<form method="POST">`, and returns fieldErrors
    // + values on failure so the re-render keeps the user's input.
    const signup = readFileSync(join(appDir, 'app', 'signup', 'page.ts'), 'utf8');
    assert.match(signup, /export async function action/, 'signup page exports an action');
    assert.match(signup, /<form method="POST"/, 'signup form posts to the page action');
    assert.match(signup, /fieldErrors/, 'signup action returns field errors');
    assert.match(signup, /actionData/, 'signup page reads actionData for re-render');
    assert.doesNotMatch(signup, /id="signup-form"/, 'old inert JS-only form id is gone');
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
