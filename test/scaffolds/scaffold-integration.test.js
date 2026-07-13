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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-integ-'));
}

// Root-cause guard for #845: the gitignore template MUST ship as `gitignore`
// (no dot). npm strips a `.gitignore` from a published tarball, so a dotfile
// name arrives missing in the installed CLI and the scaffold ships an app with
// no `.env` ignore. Renaming it back to `.gitignore` would silently reintroduce
// the bug (repo-local generation would still pass), so assert the file name.
test('gitignore template ships as a non-dotfile so npm cannot strip it', () => {
  const dir = join(import.meta.dirname, '..', '..', 'packages', 'cli', 'templates');
  assert.ok(existsSync(join(dir, 'gitignore')), 'templates/gitignore must exist');
  assert.ok(!existsSync(join(dir, '.gitignore')), 'templates/.gitignore must NOT exist (npm strips it)');
});

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
    for (const d of ['app', 'components', 'modules', 'lib', 'public', 'db', 'test/unit', 'test/e2e']) {
      assert.ok(existsSync(join(appDir, d)), `${d}/ should exist`);
    }

    // Root files
    assert.ok(existsSync(join(appDir, 'package.json')));
    assert.ok(existsSync(join(appDir, 'tsconfig.json')));

    // Template files copied
    for (const f of ['AGENTS.md', 'CONVENTIONS.md', 'CLAUDE.md', '.editorconfig']) {
      assert.ok(existsSync(join(appDir, f)), `${f} should exist`);
    }

    // #271: the opt-in progressive-enhancement service worker + its offline
    // fallback ship into the UI scaffolds (full-stack / saas; api has no UI),
    // dormant until the app registers it. This test covers full-stack.
    assert.ok(existsSync(join(appDir, 'public', 'sw.js')), 'public/sw.js should exist');
    assert.ok(existsSync(join(appDir, 'public', 'offline.html')), 'public/offline.html should exist');

    // #259: the VS Code settings that associate the webjs-config JSON Schema
    // with package.json's `webjs` block must reach the scaffolded app. This
    // file is under a `.vscode/` dir that .gitignore would normally exclude, so
    // it is a regression guard against the template silently not shipping.
    const vscodePath = join(appDir, '.vscode', 'settings.json');
    assert.ok(existsSync(vscodePath), '.vscode/settings.json should exist');
    const vscode = JSON.parse(readFileSync(vscodePath, 'utf8'));
    const webjsSchema = vscode['json.schemas']?.[0]?.schema?.properties?.webjs;
    assert.ok(
      webjsSchema && String(webjsSchema.$ref || '').includes('webjs-config.schema.json'),
      '.vscode/settings.json should $ref the webjs-config schema for the webjs block'
    );

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

    // Minimal-shell layout: the scaffold ships app/layout.ts as a MINIMAL shell
    // (theme + tokens + Tailwind infra, then {children} in a bare padded
    // container) so a delivered app designs its OWN chrome from scratch rather
    // than inheriting a header/nav/footer. The rich worked layout moved to
    // LAYOUT-REFERENCE.md, which the agent reads to learn the patterns.
    assert.match(layoutSrc, /<main class="min-h-dvh[^"]*">/,
      'layout renders a minimal full-height main, not a fixed-header reading-column shell');
    assert.doesNotMatch(layoutSrc, /<header\b/,
      'the minimal shell ships NO header (design your own; see LAYOUT-REFERENCE.md)');
    assert.doesNotMatch(layoutSrc, /Built with/,
      'the minimal shell ships NO scaffold "Built with webjs" footer');
    assert.ok(existsSync(join(appDir, 'LAYOUT-REFERENCE.md')),
      'the rich worked layout ships as LAYOUT-REFERENCE.md');

    // Scaffold-removal enforcement (#359): the example homepage and the minimal
    // layout shell carry a `webjs-scaffold-placeholder` marker, which the
    // no-scaffold-placeholder check fails on until the agent replaces the content
    // and deletes the marker. Token assembled so this test file does not carry
    // the contiguous literal the rule scans for.
    const marker = 'webjs-scaffold-' + 'placeholder';
    const pageSrc = readFileSync(join(appDir, 'app', 'page.ts'), 'utf8');
    assert.ok(layoutSrc.includes(marker), 'layout.ts must carry the scaffold-placeholder marker');
    assert.ok(pageSrc.includes(marker), 'page.ts must carry the scaffold-placeholder marker');
    // The minimal shell carries a "design your layout from scratch" marker, so
    // check stays red until the agent builds a real layout.
    assert.match(layoutSrc, new RegExp(marker + '[^\\n]*MINIMAL SHELL'),
      'layout.ts guards the minimal shell with a "design your layout" placeholder marker');
    // The design PALETTE ships guarded by its own placeholder marker, so a
    // delivered app cannot silently keep the scaffold's starter brand colors: the
    // agent must own the palette (or run --clear-placeholders) to clear the file.
    // The starter orange is kept (it looks finished); the marker forces a
    // conscious palette decision, and the marker is a single-line CSS comment so
    // --clear-placeholders strips it without breaking the <style> block.
    assert.match(layoutSrc, new RegExp(marker + '[^\\n]*STARTER brand colors'),
      'layout.ts guards the palette tokens with a scaffold-placeholder marker');
    // Two markers (minimal-shell, palette): removing one still fails the check
    // until both are addressed.
    assert.ok(layoutSrc.split(marker).length - 1 >= 2,
      'layout.ts carries the minimal-shell + palette placeholder markers');

    // GUARD (regression for a stripPlaceholderMarkers gap): `--clear-placeholders`
    // has no /* */ block-comment continuation (only // and <!-- --> runs). So any
    // marker emitted inside a CSS `/* */` comment MUST be single-line, or clearing
    // it would strip only the opening line and orphan a dangling `*/`, corrupting
    // every generated app's stylesheet. Assert every generated file keeps its
    // block-comment markers on one line.
    for (const rel of ['app/layout.ts', 'app/page.ts']) {
      const src = readFileSync(join(appDir, rel), 'utf8');
      for (const line of src.split('\n')) {
        if (!line.includes(marker)) continue;
        // A block-comment marker line opening `/*` must also close `*/` on the
        // same line (single-line). `//` and `<!-- -->` markers are handled by the
        // stripper's continuation logic and are exempt.
        if (line.includes('/*')) {
          assert.ok(line.includes('*/'),
            `${rel}: a /* */ scaffold marker must be single-line (else --clear-placeholders orphans a */)`);
        }
      }
    }

    // Drizzle db layer wired up
    assert.ok(existsSync(join(appDir, 'db', 'schema.server.ts')), 'db/schema.server.ts written');
    assert.ok(existsSync(join(appDir, 'db', 'columns.server.ts')), 'db/columns.server.ts written');
    assert.ok(existsSync(join(appDir, 'db', 'connection.server.ts')), 'db/connection.server.ts written');
    assert.ok(existsSync(join(appDir, 'drizzle.config.ts')), 'drizzle.config.ts written');
    // A JSON column helper ships so persisting structured data (a board, a tag
    // list, a settings blob) needs no outside Drizzle knowledge. SQLite path
    // uses text({ mode: 'json' }). The example schema demonstrates it once.
    const colsSrc = readFileSync(join(appDir, 'db', 'columns.server.ts'), 'utf8');
    assert.match(colsSrc, /export const json = <T>\(\) => text\(\{ mode: 'json' \}\)\.\$type<T>\(\)/,
      'sqlite columns.server.ts exports a generic json<T>() helper');
    const schemaSrc = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schemaSrc, /\bjson\b/, 'schema imports json');
    assert.match(schemaSrc, /json<\{[^}]*\}>\(\)/, 'schema demonstrates json<T>() on a column (counterfactual: fails if the demo column is dropped)');
    assert.ok(!existsSync(join(appDir, 'prisma')), 'no prisma/ dir (counterfactual: fails if db files not written)');
    // The INITIAL migration is authored by `webjs create` only AFTER a successful
    // install (drizzle-kit is needed). This test scaffolds with install:false, so
    // no migration is authored here; the printed next-steps still show db:generate
    // for that path. (The install:true path that authors it is verified manually /
    // via a docker build, per the CLI AGENTS.md e2e note.)
    const migDir = join(appDir, 'db', 'migrations');
    const migrationSql = existsSync(migDir)
      ? readdirSync(migDir).some((d) => existsSync(join(migDir, d, 'migration.sql')))
      : false;
    assert.equal(migrationSql, false, 'install:false authors no migration (db:generate needs drizzle-kit)');
    assert.ok(!existsSync(join(appDir, 'lib', 'prisma.server.ts')), 'no lib/prisma.server.ts');

    // # path-alias imports (#555/#556): the scaffold ships the single #* catch-all
    // imports key and uses # aliases for app-internal imports, no within-app deep relatives.
    const aliasPkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.deepEqual(aliasPkg.imports, { '#*': './*' }, 'package.json ships the per-dir # imports aliases');
    assert.match(pageSrc, /from '#[a-z]/, 'the example page imports via #');
    // No app-internal deep relative (../../) survives the codemod in any .ts.
    const tsFiles = [];
    (function walk(d) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|js)$/.test(e.name)) tsFiles.push(full);
      }
    })(appDir);
    for (const f of tsFiles) {
      const src = readFileSync(f, 'utf8');
      assert.ok(!/from '(\.\.\/){2,}/.test(src), `${f.slice(appDir.length)} must not keep a deep relative import`);
    }

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

    // Commit enforcement for Claude Code: CLAUDE.md overrides Claude Code's
    // never-commit default, a Stop hook backstops end-of-turn, and a
    // PostToolUse hook removes merged worktrees after `gh pr merge`.
    const claudeMd = readFileSync(join(appDir, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /OVERRIDES Claude Code/i,
      'CLAUDE.md overrides Claude Code\'s never-commit default');
    for (const h of ['commit-before-stop.sh', 'cleanup-merged-worktree.sh']) {
      assert.ok(existsSync(join(appDir, '.claude/hooks', h)), `${h} is scaffolded`);
    }
    const stopCommands = (claudeSettings.hooks?.Stop ?? [])
      .flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(stopCommands.includes('.claude/hooks/commit-before-stop.sh'),
      'settings.json wires commit-before-stop into Stop');
    const postCommands = (claudeSettings.hooks?.PostToolUse ?? [])
      .flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(postCommands.includes('.claude/hooks/cleanup-merged-worktree.sh'),
      'settings.json wires cleanup-merged-worktree into PostToolUse');

    // Render-and-look enforcement for UI work: a design/layout defect has no
    // failing test, so the scaffold ships a design-review skill, a
    // UserPromptSubmit router that points UI prompts at it, and a Stop-hook
    // backstop that nudges a render-and-look before finishing. All three must
    // be scaffolded and wired, and the skill the router names must exist (else
    // a fresh clone routes to a dangling skill).
    for (const h of ['route-skills.sh', 'design-review-before-stop.sh']) {
      assert.ok(existsSync(join(appDir, '.claude/hooks', h)), `${h} is scaffolded`);
    }
    assert.ok(
      existsSync(join(appDir, '.claude/skills/webjs-design-review/SKILL.md')),
      'the webjs-design-review skill is scaffolded',
    );
    const promptCommands = (claudeSettings.hooks?.UserPromptSubmit ?? [])
      .flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(promptCommands.includes('.claude/hooks/route-skills.sh'),
      'settings.json wires route-skills into UserPromptSubmit');
    assert.ok(stopCommands.includes('.claude/hooks/design-review-before-stop.sh'),
      'settings.json wires design-review-before-stop into Stop');

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
      'Dockerfile starts via npm start (a thin alias for webjs start; the ' +
      'migrate runs via webjs.start.before in-process, #550)');
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
    assert.match(dockerignore, /^!\*\*\/\.webjs\/vendor\/$/m,
      '.dockerignore keeps **/.webjs/vendor/ (committed importmap ships)');

    // package.json contents
    const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'my-app');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.scripts.dev, 'webjs dev');
    assert.equal(pkg.scripts.start, 'webjs start');
    // Both dev and start apply pending migrations before serving (#725), then
    // compile the static Tailwind stylesheet (#947), so a fresh clone boots
    // migrated AND fully styled with no manual step.
    // The before-step calls the Tailwind CLI DIRECTLY (not `npm run css:build`),
    // so it works on the node-less / npm-less Bun image too (#947); node_modules/.bin
    // is on PATH for before/parallel steps via envWithLocalBin.
    assert.deepEqual(pkg.webjs?.dev?.before, ['webjs db migrate', 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify'],
      'webjs.dev.before runs db migrate then the Tailwind compile (#725, #947)');
    assert.deepEqual(pkg.webjs?.start?.before, ['webjs db migrate', 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify'],
      'webjs.start.before runs db migrate then the Tailwind compile');
    assert.deepEqual(pkg.webjs?.dev?.parallel, ['tailwindcss -i ./public/input.css -o ./public/tailwind.css --watch'],
      'webjs.dev.parallel runs the Tailwind watcher (#947)');
    assert.equal(pkg.scripts['css:build'], 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify');
    assert.ok(pkg.devDependencies['@tailwindcss/cli'], 'the Tailwind CLI is a devDependency');
    assert.ok(pkg.dependencies['@webjsdev/core']);
    assert.ok(pkg.dependencies['@webjsdev/server']);
    assert.ok(pkg.dependencies['drizzle-orm'], 'drizzle-orm dep present');
    assert.ok(!pkg.dependencies['@prisma/client'], 'no prisma dep');
    // intellisense (@webjsdev/intellisense) stays: it gives editor INTELLIGENCE from node_modules via the
    // tsconfig plugin (any tsserver editor, no editor plugin needed).
    assert.ok(pkg.devDependencies['@webjsdev/intellisense']);
    assert.ok(pkg.devDependencies['@types/node'], 'scaffold installs Node builtin type declarations');
    // @webjsdev/ui is NOT pinned (#399): shadcn-style copy-in; `webjs ui add`
    // resolves the kit from the CLI, so the app needs no pin.
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(!allDeps['@webjsdev/ui'], 'no @webjsdev/ui in a scaffolded app');

    // tsconfig.json has the editor plugin, standalone (no ts-lit-plugin entry).
    const tsconfig = JSON.parse(readFileSync(join(appDir, 'tsconfig.json'), 'utf8'));
    const pluginNames = (tsconfig.compilerOptions.plugins || []).map((p) => p.name);
    assert.ok(pluginNames.includes('@webjsdev/intellisense'), 'editor plugin listed');
    assert.deepEqual(tsconfig.compilerOptions.types, ['node'], 'tsconfig enables node: builtin types for .server.ts files');
    assert.ok(!pluginNames.includes('ts-lit-plugin'), 'no separate ts-lit-plugin entry (standalone, #386)');
    assert.ok(!pkg.devDependencies['ts-lit-plugin'] && !pkg.dependencies['ts-lit-plugin'], 'scaffold pulls no ts-lit-plugin');

    // {{APP_NAME}} placeholder substituted in template files
    const agents = readFileSync(join(appDir, 'AGENTS.md'), 'utf8');
    assert.ok(!agents.includes('{{APP_NAME}}'), 'placeholders substituted in AGENTS.md');

    // .gitignore mentions the SQLite dev DB
    const gitignore = readFileSync(join(appDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /db\/dev\.db/, '.gitignore covers SQLite');

    // .gitignore ignores the real .env but keeps .env.example (#845). The
    // template ships as `gitignore` (no dot) and is renamed on copy, because
    // npm STRIPS a `.gitignore` from a published tarball; a regression to the
    // dotfile name makes the scaffold ship without a .env ignore, so a real
    // .env gets committed. Anchor to line starts so the active rules match,
    // not the comment prose.
    assert.match(gitignore, /^\.env$/m, '.gitignore ignores .env');
    assert.match(gitignore, /^!\.env\.example$/m, '.gitignore keeps .env.example tracked');

    // .gitignore ignores .webjs/ at ANY depth (#365): a scaffolded app
    // nested below its repo root must not leak its generated
    // .webjs/routes.d.ts. The depth-robust `**/.webjs/*` prefix is what
    // distinguishes the fix from the old root-anchored `.webjs/*`.
    // Anchor to a line start (multiline) so these match the ACTIVE rule
    // lines, not the surrounding comment prose that also names the
    // pattern. Without the anchor a revert of the real rule to `.webjs/*`
    // would still pass while a stale comment kept the `**/` text.
    assert.match(
      gitignore,
      /^\*\*\/\.webjs\/\*$/m,
      '.gitignore uses **/.webjs/* so a nested app does not leak routes.d.ts',
    );
    assert.match(
      gitignore,
      /^!\*\*\/\.webjs\/vendor\/$/m,
      '.gitignore keeps the **/ vendor negation so the committed pin ships',
    );

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
    for (const d of ['app', 'modules', 'lib', 'db', 'test/unit']) {
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

    // #271: the api template has no UI, so it must NOT ship the service worker
    // (this locks the corrected UI-only scoping; the copy lives in create.js's
    // !isApi block).
    assert.ok(!existsSync(join(appDir, 'public', 'sw.js')), 'api ships no sw.js');
    assert.ok(!existsSync(join(appDir, 'public', 'offline.html')), 'api ships no offline.html');

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

test('scaffoldApp saas: writes auth + dashboard + Drizzle User model', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-saas', cwd, { template: 'saas' });
    const appDir = join(cwd, 'my-saas');

    // Core scaffold still in place
    assert.ok(existsSync(join(appDir, 'app', 'layout.ts')), 'layout.ts written');
    assert.ok(existsSync(join(appDir, 'app', 'page.ts')), 'page.ts written');

    // saas shares the same minimal-shell root layout, so it too ships the bare
    // full-height main (no header/reading-column) plus LAYOUT-REFERENCE.md, and
    // designs its own chrome (the dashboard sub-nav lives in app/dashboard/layout.ts).
    const saasLayoutSrc = readFileSync(join(appDir, 'app', 'layout.ts'), 'utf8');
    assert.match(saasLayoutSrc, /<main class="min-h-dvh[^"]*">/,
      'saas root layout is the minimal full-height shell');
    assert.ok(existsSync(join(appDir, 'LAYOUT-REFERENCE.md')),
      'saas ships LAYOUT-REFERENCE.md');

    // #271: saas is a UI scaffold, so it ships the opt-in service worker.
    assert.ok(existsSync(join(appDir, 'public', 'sw.js')), 'saas ships public/sw.js');
    assert.ok(existsSync(join(appDir, 'public', 'offline.html')), 'saas ships public/offline.html');

    // SaaS-specific lib files
    assert.ok(existsSync(join(appDir, 'lib', 'password.server.ts')), 'lib/password.server.ts present');
    assert.ok(existsSync(join(appDir, 'lib', 'auth.server.ts')), 'lib/auth.server.ts present');
    assert.ok(!existsSync(join(appDir, 'lib', 'prisma.server.ts')), 'no lib/prisma.server.ts');

    // The copied ui-* components import cn() via the #lib/utils/cn.ts alias, not
    // a stale relative `../lib/utils.ts` that would ERR_MODULE_NOT_FOUND from
    // components/ui/ (saas-template's readUiComponent rewrite, #556). The cn
    // helper itself lives at lib/utils/cn.ts. Counterfactual: the no-op rewrite
    // bug left `'../lib/utils.ts'` and this fails.
    assert.ok(existsSync(join(appDir, 'lib', 'utils', 'cn.ts')), 'cn helper at lib/utils/cn.ts');
    for (const c of readdirSync(join(appDir, 'components', 'ui'))) {
      if (!c.endsWith('.ts')) continue;
      const src = readFileSync(join(appDir, 'components', 'ui', c), 'utf8');
      assert.doesNotMatch(src, /from ['"]\.\.\/lib\/utils\.ts['"]/, `${c} must not keep the stale ../lib/utils.ts cn import`);
      // #877: the onBeforeCache import must be rewritten the same way. The saas
      // generator previously rewrote only the cn() import, so dialog.ts kept the
      // registry-relative `../lib/dom.ts` (a nonexistent components/lib/dom.ts)
      // and failed `webjs typecheck` with TS2307. Counterfactual: the missing
      // rewrite leaves `'../lib/dom.ts'` and this fails.
      assert.doesNotMatch(src, /from ['"]\.\.\/lib\/dom\.ts['"]/, `${c} must not keep the stale ../lib/dom.ts import`);
      if (/onBeforeCache/.test(src)) {
        assert.match(src, /from ['"]#lib\/utils\/dom\.ts['"]/, `${c} imports onBeforeCache from #lib/utils/dom.ts`);
      }
    }

    // #877: lib/auth.server.ts must not assign `process.env.AUTH_SECRET`
    // (string | undefined) straight to the required `string` secret (TS2322).
    // It resolves through a typed const with a dev fallback + prod guard.
    const authSrc = readFileSync(join(appDir, 'lib', 'auth.server.ts'), 'utf8');
    assert.doesNotMatch(authSrc, /secret:\s*process\.env\.AUTH_SECRET\b/, 'secret must not be the raw string | undefined env read');
    assert.match(authSrc, /const authSecret =/, 'auth secret resolved through a typed const');
    assert.match(authSrc, /secret:\s*authSecret\b/, 'createAuth uses the typed authSecret');
    assert.match(authSrc, /NODE_ENV === 'production'[\s\S]*AUTH_SECRET must be set/, 'production fails fast when AUTH_SECRET is unset');

    // #878: every top-level page needs EXACTLY one <h1> (axe page-has-heading-one
    // wants one, and a second h1 is its own violation). The auth cards are the
    // sole heading so their title is the h1; the dashboard/settings pages already
    // carry a page <h1>, so their card title stays a subordinate <h2> (promoting
    // it to h1 was the regression this pins). Counterfactual: an <h3>-only page,
    // or a double-h1 dashboard, fails this.
    const h1Count = (src) => (src.match(/<h1\b/g) || []).length;
    for (const p of [['login'], ['signup'], ['dashboard'], ['dashboard', 'settings']]) {
      const pageSrc = readFileSync(join(appDir, 'app', ...p, 'page.ts'), 'utf8');
      assert.equal(h1Count(pageSrc), 1, `${p.join('/')} page has exactly one <h1>`);
    }

    // #878: no gallery surface may drop label text below AA contrast. The
    // `text-muted-foreground/70` opacity measured 3.83:1; full-opacity
    // `text-muted-foreground` passes. Scan the WHOLE generated gallery (every
    // component + feature page), not just one demo, so a stray low-contrast
    // token anywhere reds this. Counterfactual: any `/NN` opacity fails.
    const galleryDirs = [join(appDir, 'modules'), join(appDir, 'app', 'features')];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!e.name.endsWith('.ts')) continue;
        const src = readFileSync(full, 'utf8');
        assert.doesNotMatch(src, /text-muted-foreground\/\d/, `${full} keeps full-contrast text-muted-foreground (no /NN opacity)`);
      }
    };
    for (const d of galleryDirs) if (existsSync(d)) walk(d);

    // #878: gallery form controls need an accessible name (axe `label`). The
    // file-upload input and the directive-demo text input carried none, so a
    // full axe sweep flagged them critical. Pin their aria-labels.
    const fileStorage = readFileSync(join(appDir, 'app', 'features', 'file-storage', 'page.ts'), 'utf8');
    assert.match(fileStorage, /type="file"[^>]*aria-label=/, 'the file input has an aria-label');
    const directiveDemo = readFileSync(join(appDir, 'modules', 'directives', 'components', 'directive-demo.ts'), 'utf8');
    assert.match(directiveDemo, /aria-label="Editable text/, 'the ref-focus input has an aria-label');

    // Drizzle User model (saas overwrites db/schema.server.ts to add passwordHash)
    const schema = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /export const users = table\('users'/, 'users table present');
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

    // #904: a signed-in user must be able to log out. The dashboard subtree ships
    // a nested layout carrying a plain POST <form> to the createAuth signout route,
    // so logout works with JS off (progressive-enhancement default) and appears on
    // every /dashboard page.
    const dashLayout = readFileSync(join(appDir, 'app', 'dashboard', 'layout.ts'), 'utf8');
    assert.match(dashLayout, /<form method="POST" action="\/api\/auth\/signout"/, 'dashboard layout ships a POST signout form');
    assert.match(dashLayout, /Log out/, 'dashboard layout renders a Log out control');
    // signOut is server-only, so the logout control must reach it through the
    // route, never by importing lib/auth.server.ts into a browser-shipping page.
    assert.doesNotMatch(dashLayout, /import[^\n]*auth\.server/, 'logout control does not import the server-only auth module');

    // #904: a failed login must surface a message, not silently bounce to the home
    // page. createAuth is configured with pages.error: '/login' and the login page
    // reads searchParams.error to render it.
    const auth = readFileSync(join(appDir, 'lib', 'auth.server.ts'), 'utf8');
    assert.match(auth, /pages:\s*\{\s*error:\s*'\/login'\s*\}/, 'createAuth points its error page at /login');
    const login = readFileSync(join(appDir, 'app', 'login', 'page.ts'), 'utf8');
    assert.match(login, /searchParams\.error/, 'login page reads the error query param');
    assert.match(login, /Invalid email or password/, 'login page shows a message for a failed sign-in');

    // The auth test is a REAL handle()-driven flow at the convention-correct
    // path test/auth/auth.test.ts (#267), not the old type-shape stub at
    // test/unit/auth.test.ts.
    assert.ok(existsSync(join(appDir, 'test', 'auth', 'auth.test.ts')), 'test/auth/auth.test.ts present');
    assert.ok(!existsSync(join(appDir, 'test', 'unit', 'auth.test.ts')), 'old test/unit/auth.test.ts stub is gone');
    const authTest = readFileSync(join(appDir, 'test', 'auth', 'auth.test.ts'), 'utf8');
    assert.match(authTest, /@webjsdev\/server\/testing/, 'auth test uses the handle() test harness');
    assert.match(authTest, /redirects to \/login when unauthenticated/, 'auth test asserts the protected-route gate');
    assert.match(authTest, /loginAndGetCookies/, 'auth test drives the real login flow');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp: generated users module models HTTP-verb actions (#488)', async () => {
  // The api template emits the example users module: a GET read (cache + tags)
  // and a mutation that declares the tags it invalidates, so a new app sees the
  // HTTP-verb idiom out of the box. (create.js writes modules/users/ only inside
  // the `if (isApi)` branch.) Counterfactual: drop the verb config exports from
  // create.js's list-users / create-user strings and these assertions fail.
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('verb-app', cwd, { template: 'api' });
    const appDir = join(cwd, 'verb-app');

    const listUsers = readFileSync(
      join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts'), 'utf8');
    assert.match(listUsers, /export const method = 'GET'/, 'list-users declares method GET');
    assert.match(listUsers, /export const cache =/, 'list-users declares a cache window');
    assert.match(listUsers, /export const tags =/, 'list-users declares cache tags');

    const createUser = readFileSync(
      join(appDir, 'modules', 'users', 'actions', 'create-user.server.ts'), 'utf8');
    assert.match(createUser, /export const invalidates =/, 'create-user declares invalidates');
    // The mutation must NOT also declare method GET (a write is POST by default).
    assert.doesNotMatch(createUser, /export const method = 'GET'/, 'create-user is not a GET');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp saas: per-session current-user stays POST-default (#488)', async () => {
  // The saas auth read is per-user, so it deliberately is NOT a cacheable GET
  // server action: it ships as the documented counter-example. Counterfactual:
  // add `export const method = 'GET'` to saas-template's current-user and this
  // fails (which is exactly the data-leak the comment warns against).
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('verb-saas', cwd, { template: 'saas' });
    const appDir = join(cwd, 'verb-saas');
    const currentUser = readFileSync(
      join(appDir, 'modules', 'auth', 'queries', 'current-user.server.ts'), 'utf8');
    assert.doesNotMatch(currentUser, /export const method =/, 'current-user is not a verb-configured GET');
    assert.match(currentUser, /per-session read/, 'current-user explains why it stays POST-default');
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

test('scaffoldApp --db postgres: json<T>() helper maps to jsonb, one schema both dialects', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-pg', cwd, { template: 'full-stack', db: 'postgres' });
    const appDir = join(cwd, 'my-pg');
    const cols = readFileSync(join(appDir, 'db', 'columns.server.ts'), 'utf8');
    // The Postgres seam uses jsonb; the schema (shared across dialects) is
    // unchanged, so the same json<T>() call compiles on both.
    assert.match(cols, /jsonb/, 'postgres columns.server.ts imports jsonb');
    assert.match(cols, /export const json = <T>\(\) => jsonb\(\)\.\$type<T>\(\)/,
      'postgres json<T>() maps to jsonb().$type<T>() (counterfactual: fails if the helper is sqlite-only)');
    const schema = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /json<\{[^}]*\}>\(\)/, 'the one shared schema demonstrates json<T>() on postgres too');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});
