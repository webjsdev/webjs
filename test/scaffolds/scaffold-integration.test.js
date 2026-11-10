/**
 * Integration tests for `scaffoldApp`: invokes the full-stack and api scaffolds
 * programmatically in a temp dir and asserts the expected files / directory
 * structure are produced. Runs entirely offline.
 *
 * This is a coverage anchor for `packages/cli/lib/create.js` (including the auth
 * gallery card it wires into the UI template), otherwise only exercised by manual
 * `webjs create` runs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

const GALLERY = join(import.meta.dirname, '..', '..', 'gallery');

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

/**
 * Like `muteConsole`, but keeps what was printed so a test can assert on the
 * post-scaffold guidance. A sibling rather than a flag on `muteConsole` so
 * every existing caller stays untouched.
 * @returns {{ restore: () => void, output: () => string }}
 */
function captureConsole() {
  const origLog = console.log;
  const origError = console.error;
  /** @type {string[]} */
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  console.error = (...args) => { lines.push(args.join(' ')); };
  return {
    restore: () => {
      console.log = origLog;
      console.error = origError;
    },
    output: () => lines.join('\n'),
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
    for (const d of ['app', 'components', 'lib', 'public', 'db', 'test']) {
      assert.ok(existsSync(join(appDir, d)), `${d}/ should exist`);
    }

    // Root files
    assert.ok(existsSync(join(appDir, 'package.json')));
    assert.ok(existsSync(join(appDir, 'tsconfig.json')));

    // Single cross-agent source (AGENTS.md carrying the brief), the CLAUDE.md
    // bridge, and Claude protective hooks.
    for (const f of ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.editorconfig']) {
      assert.ok(existsSync(join(appDir, f)), `${f} should exist`);
    }
    // Per-agent files and design-distinctness ceremony removed.
    // The agent skill, the workflow rules, CONVENTIONS.md and the gallery were
    // dropped: the brief in AGENTS.md plus Lit and Next.js muscle memory is the
    // whole agent doc set.
    for (const f of ['GEMINI.md', '.github/copilot-instructions.md', '.cursorrules', 'LAYOUT-REFERENCE.md', '.claude/hooks/design-review-before-stop.sh', '.claude/skills/webjs-design-review', '.agents', 'CONVENTIONS.md', 'scripts/clear-gallery.mjs', 'app/features', 'app/examples', 'modules/gallery']) {
      assert.ok(!existsSync(join(appDir, f)), `${f} should NOT exist in the scaffold`);
    }
    // Thin bridge (a pointer to AGENTS.md).
    for (const f of ['CLAUDE.md']) {
      const src = readFileSync(join(appDir, f), 'utf8');
      assert.ok(src.length < 2200, `${f} is a thin bridge, not a full rule duplicate`);
      assert.match(src, /AGENTS\.md/, `${f} points at AGENTS.md`);
    }

    // #271: the opt-in progressive-enhancement service worker + its offline
    // fallback ship into the UI scaffold (full-stack; api has no UI),
    // dormant until the app registers it.
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
    // attribute. Without `.dark`, the theme (and the copied components/ui/*)
    // render light tokens on the dark chrome (white buttons/cards, invisible text). Light
    // mode hides this, so guard it here. See https://webjs.dev/docs/styling.
    const layoutSrc = readFileSync(join(appDir, 'app', 'layout.ts'), 'utf8');
    const toggleSrc = readFileSync(join(appDir, 'components', 'theme-toggle.ts'), 'utf8');
    assert.match(layoutSrc, /classList\.toggle\(['"]dark['"]/,
      'layout head script must toggle the .dark class (shadcn dark-mode signal)');
    assert.match(toggleSrc, /classList\.toggle\(['"]dark['"]/,
      'theme-toggle must toggle the .dark class (shadcn dark-mode signal)');
    assert.doesNotMatch(toggleSrc, /\sstyle="/, 'the toggle carries no inline style (its icons use SVG attributes)');
    assert.doesNotMatch(toggleSrc, /document\.(getElementById|querySelector)/, 'and no document query');
    // The head script only applies the theme before paint; following the OS is
    // the toggle's job, on Lit's lifecycle (#1686).
    assert.doesNotMatch(layoutSrc, /addEventListener/, 'the pre-paint script attaches no listener');
    assert.match(toggleSrc, /connectedCallback\(\) \{[\s\S]*?matchMedia\('\(prefers-color-scheme: dark\)'\)[\s\S]*?addEventListener\('change'/, 'the toggle follows the OS from connectedCallback');
    assert.match(toggleSrc, /disconnectedCallback\(\) \{[\s\S]*?removeEventListener\('change'/, 'and stops in disconnectedCallback');
    // The toggle is the UI kit's own Button (the AGENTS.md rule), which also
    // gives it the pointer cursor Tailwind v4's reset takes from a button.
    assert.match(toggleSrc, /import \{ buttonClass \} from '#components\/ui\/button\.ts'/, 'the toggle uses the kit Button');
    assert.match(toggleSrc, /class=\$\{buttonClass\(\{ variant: 'ghost', size: 'icon' \}\)\}/, 'as a ghost icon button');
    assert.match(readFileSync(join(appDir, 'components', 'ui', 'button.ts'), 'utf8'), /\bcursor-pointer\b/, 'whose classes carry the pointer cursor');
    assert.match(toggleSrc, /static properties = \{ theme: \{ state: true \} \};/, 'its theme is Lit reactive state');

    // The shell wears the webjs.dev/ui theme (shadcn's neutral palette and
    // Geist), with a floating top navbar and a main that fills the viewport
    // minus the navbar.
    assert.match(layoutSrc, /<main class="min-h-\[calc\(100dvh-var\(--header-h\)\)\][^"]*">/,
      'layout main fills the viewport minus the navbar');
    assert.match(layoutSrc, /<header\b/, 'the shell ships a floating top navbar');
    // #1660: the navbar is sized by --header-h and nothing measures it, so a
    // client-router swap that replaces the header cannot zero the offset.
    assert.match(layoutSrc, /<header class="[^"]*h-\(--header-h\)/, 'the navbar is sized by the token');
    const inputCssEarly = readFileSync(join(appDir, 'public', 'input.css'), 'utf8');
    assert.match(inputCssEarly, /body:has\(> header\.fixed\) \{ padding-top: var\(--header-h\); \}/,
      'pinning the navbar is a one-class edit');
    // The scaffold follows its own AGENTS.md: no hand-written CSS in the layout,
    // only Tailwind on the kit's tokens (#1686).
    assert.doesNotMatch(layoutSrc, /<style\b/, 'the layout carries no <style> block');
    assert.doesNotMatch(layoutSrc, /\sstyle="/, 'and no inline style attribute');
    // Pinning from a breakpoint up is resolved by Tailwind from the app's own
    // theme (@variant), never from hard-coded widths in the layout.
    assert.doesNotMatch(layoutSrc, /min-width: \d/, 'the layout hard-codes no breakpoint width');
    assert.match(inputCssEarly, /html:has\(> body > header\.fixed\) \{ scroll-padding-top: var\(--header-h\); \}/,
      'a pinned navbar also offsets in-page anchor jumps');
    const inputCss = readFileSync(join(appDir, 'public', 'input.css'), 'utf8');
    assert.match(inputCss, /body:has\(> header\[class~="md:fixed"\]\) \{ @variant md \{ padding-top: var\(--header-h\); \} \}/,
      'and pinning it from a breakpoint up reserves the space through the app\'s own md breakpoint');
    assert.doesNotMatch(layoutSrc, /ResizeObserver/, 'the layout does not measure the header');
    // The dark tokens are on .dark, which only the head script sets, so native
    // controls switch on the same class. With JavaScript off the page is light
    // throughout, never light tokens over OS-dark controls and scrollbars.
    assert.match(layoutSrc, /<meta name="color-scheme" content="light">/, 'the meta names light only');
    assert.match(inputCss, /:root \{ color-scheme: light; \}/, 'color-scheme defaults to light');
    assert.match(inputCss, /:root\.dark \{ color-scheme: dark; \}/, 'and turns dark with the tokens');
    assert.match(inputCss, /body \{ @apply bg-background text-foreground font-sans antialiased; \}/, 'the body takes the kit tokens');
    assert.doesNotMatch(layoutSrc, /color-scheme: light dark|content="light dark"/, 'never following the OS on its own');
    assert.match(layoutSrc, /family=Geist:/, 'layout loads Geist');
    assert.match(layoutSrc, /family=Geist\+Mono/, 'and Geist Mono');
    // The palette lives in the theme block of styles/globals.css (light on
    // :root, dark on .dark), where a preset replaces it, never in the layout.
    const themeSrc = readFileSync(join(appDir, 'styles', 'globals.css'), 'utf8');
    assert.match(themeSrc, /:root \{[\s\S]*?--primary: oklch\(0% 0 0\);/, 'the theme ships the webjs.dev/ui palette');
    assert.match(themeSrc, /\.dark \{[\s\S]*?--primary: oklch\(0\.922 0 0\);/, 'with its dark half on .dark');
    assert.doesNotMatch(layoutSrc, /--primary\s*:/, 'and the layout overrides none of it');
    assert.doesNotMatch(layoutSrc, /oklch\(0\.7 0\.16 52\)/,
      'no orange brand color survives in the neutral scaffold');

    // App icon: the scaffold ships app/icon.svg (a neutral PLACEHOLDER, marked
    // so webjs doctor can flag it) and app/manifest.webmanifest, both linked by
    // the framework, so the layout declares no icons. A hand-written
    // <link rel="icon"> in the layout body lands in <body>, where browsers
    // ignore it; and a declared metadata.icons would suppress the auto-link.
    assert.doesNotMatch(layoutSrc, /icons:/, 'layout declares no metadata.icons');
    assert.doesNotMatch(layoutSrc, /<link rel="icon"/,
      'layout must NOT hand-write a <link rel=icon> (it lands in <body>, ignored)');
    assert.match(readFileSync(join(appDir, 'app', 'icon.svg'), 'utf8'), /data-webjs-placeholder="icon"/,
      'ships the marked placeholder app/icon.svg');
    assert.ok(!existsSync(join(appDir, 'public', 'favicon.svg')), 'no WebJs-branded public/favicon.svg');
    const manifest = JSON.parse(readFileSync(join(appDir, 'app', 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.icons[0].src, '/icon.svg', 'the manifest names the app icon');
    assert.ok(manifest.name, 'the manifest carries the app name');

    // The home page is a minimal starting point that imports nothing from a
    // gallery, and the navbar links the docs and the source.
    const pageSrc = readFileSync(join(appDir, 'app', 'page.ts'), 'utf8');
    // The home is a thin route over the example module (modules/users/).
    assert.match(pageSrc, /from '#modules\/users\/actions\/add-user\.server\.ts'/, 'the home binds the example module\'s action');
    assert.match(pageSrc, /from '#modules\/users\/queries\/list-users\.server\.ts'/, 'and reads its query');
    assert.match(pageSrc, /<form action=\$\{addUser\}/, 'as a bound form');
    assert.match(pageSrc, /<user-list \.users=\$\{latest\}><\/user-list>/, 'and renders the users with the module\'s component');
    const listSrc = readFileSync(join(appDir, 'modules', 'users', 'components', 'user-list.ts'), 'utf8');
    assert.match(listSrc, /static properties = \{ users: \{ type: Array \} \};/, 'a Lit-style reactive property');
    assert.match(listSrc, /UserList\.register\('user-list'\)/, 'registered under its tag');
    assert.match(pageSrc, /<form action=\$\{clearUsers\}>/, 'and a Clear list button bound to its clear action');
    assert.match(readFileSync(join(appDir, 'modules', 'users', 'actions', 'clear-users.server.ts'), 'utf8'), /^'use server';/, 'which is a server action');
    assert.ok(existsSync(join(appDir, 'test', 'users', 'users.test.ts')), 'the module ships its own test');
    assert.match(pageSrc, /Edit app\/page\.ts/, 'the home points at the file to edit');
    assert.match(layoutSrc, /webjs\.dev\/docs/, 'the navbar links the docs');
    assert.match(layoutSrc, /github\.com\/webjsdev\/webjs/, 'the navbar links the source');
    assert.doesNotMatch(layoutSrc + toggleSrc, /#modules\//, 'the shell imports no demo module');

    // Drizzle db layer wired up
    assert.ok(existsSync(join(appDir, 'db', 'schema.server.ts')), 'db/schema.server.ts written');
    assert.ok(existsSync(join(appDir, 'db', 'connection.server.ts')), 'db/connection.server.ts written');
    assert.ok(existsSync(join(appDir, 'drizzle.config.ts')), 'drizzle.config.ts written');
    // The schema is plain Drizzle, as in Drizzle's own docs (#1686): no
    // helper module an agent must first read, and a column's type is visible
    // where it is declared (integer({ mode: 'timestamp_ms' }) is a Date).
    assert.ok(!existsSync(join(appDir, 'db', 'columns.server.ts')), 'no db/columns.server.ts helper module');
    const schemaSrc = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schemaSrc, /from 'drizzle-orm\/sqlite-core'/, 'the schema imports Drizzle directly');
    assert.match(schemaSrc, /sqliteTable\('users'/, 'a plain sqliteTable');
    assert.match(schemaSrc, /text\(\{ mode: 'json' \}\)\.\$type<\{[^}]*\}>\(\)/, 'a JSON column the Drizzle way (counterfactual: fails if the demo column is dropped)');
    assert.match(schemaSrc, /integer\(\{ mode: 'timestamp_ms' \}\)/, 'a Date column says so where it is declared');
    assert.doesNotMatch(schemaSrc, /columns\.server/, 'no import of a helper module');
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
    // components/ui/ is the kit's own add output (relative imports to cn(),
    // which `webjs ui diff` compares against), so it is not the scaffold's code.
    for (const f of tsFiles.filter((f) => !f.includes(`${join('components', 'ui')}`))) {
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
    // The check-on-edit feedback loop: `webjs check` runs after each edit and
    // the edited file's violations go back to the agent.
    assert.ok(postCommands.includes('.claude/hooks/check-on-edit.sh'),
      'settings.json wires check-on-edit into PostToolUse');
    for (const h of ['check-on-edit.sh', 'check-on-edit.mjs']) {
      assert.ok(existsSync(join(appDir, '.claude/hooks', h)), `${h} is scaffolded`);
    }
    assert.ok(statSync(join(appDir, '.claude/hooks/check-on-edit.sh')).mode & 0o111,
      'check-on-edit.sh is executable');

    // The design-review ceremony (a skill + a UserPromptSubmit router + a Stop
    // hook) was retired in #969; only the protective hooks above ship now.

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

    // The test gate is the `webjs.ci` step list in package.json (#1471):
    // `npm run ci` runs it locally, and the ONE-job workflow runs the same
    // list on every PR and push to main, so the two cannot drift.
    const ciWorkflow = readFileSync(
      join(appDir, '.github/workflows/ci.yml'), 'utf8');
    assert.match(ciWorkflow, /^\s+- run: npm run ci$/m,
      'the workflow runs the declared step list through npm run ci');
    assert.doesNotMatch(ciWorkflow, /npm run check|npm run test:server/,
      'counterfactual: the workflow no longer restates the steps by hand');
    assert.match(ciWorkflow, /^permissions:\n  contents: read$/m,
      'the workflow token is read-only');
    assert.match(ciWorkflow, /timeout-minutes: \d+/, 'the job is bounded');
    const ciPkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.equal(ciPkg.scripts.ci, 'webjs ci', 'the ci script is the runtime-neutral webjs command');
    const flatten = (steps) => steps.flatMap((s) =>
      typeof s === 'string' ? [{ run: s }] : s.steps ? flatten(s.steps) : [s]);
    const ciSteps = flatten(ciPkg.webjs.ci.steps);
    const runs = ciSteps.map((s) => s.run);
    for (const expected of ['webjs check', 'webjs doctor', 'webjs typecheck', 'webjs test --server', 'webjs test --browser']) {
      assert.ok(runs.includes(expected), `the ci list runs ${expected}`);
    }
    assert.ok(ciSteps.some((s) => s.env?.WEBJS_E2E === '1'), 'the ci list runs the e2e layer via its env');
    const checks = ciPkg.webjs.ci.steps.find((s) => s.title === 'Checks');
    assert.equal(checks.parallel, 2, 'the Checks group runs two steps at a time');
    const tests = checks.steps.find((s) => s.title === 'Tests');
    assert.equal(tests.parallel, undefined, 'the Tests sub-group is sequential (one SQLite file)');

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
    // The compile runs through `webjs regenerate` (#1672), which builds the
    // regenerate rule's command (the Tailwind CLI called DIRECTLY, so it works on
    // the npm-less Bun image, #947) and records the build, so the dev server and
    // the doctor see it as fresh. A raw compile here would record nothing.
    assert.deepEqual(pkg.webjs?.dev?.before, ['webjs db migrate', 'webjs regenerate'],
      'webjs.dev.before runs db migrate then builds and records the stylesheet (#725, #1672)');
    assert.deepEqual(pkg.webjs?.start?.before, ['webjs db migrate', 'webjs regenerate'],
      'webjs.start.before runs db migrate then builds and records the stylesheet');
    // Dev keeps the static CSS fresh via on-request regenerate (#967), NOT a
    // background `tailwindcss --watch` (which could die mid-session and serve
    // stale CSS). So there is no dev.parallel watcher, and a regenerate rule
    // rebuilds public/tailwind.css on request when a source is newer.
    assert.equal(pkg.webjs?.dev?.parallel, undefined, 'no --watch parallel task (#967)');
    assert.deepEqual(pkg.webjs?.dev?.regenerate, [{
      output: 'public/tailwind.css',
      command: 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify',
      inputs: ['app', 'components', 'modules', 'lib', 'styles', 'public/input.css'],
    }], 'webjs.dev.regenerate recompiles the static CSS on request (#967)');
    assert.equal(pkg.scripts['css:build'], 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify');
    // A production DEPENDENCY (#1606): `webjs start` compiles the CSS at every
    // boot, and the Dockerfile installs production dependencies only.
    assert.ok(pkg.dependencies['@tailwindcss/cli'], 'the Tailwind CLI is a production dependency');
    assert.equal(pkg.devDependencies['@tailwindcss/cli'], undefined, 'and not also a devDependency');
    assert.ok(pkg.dependencies['drizzle-kit'], 'drizzle-kit (webjs db migrate at boot) is a production dependency');
    assert.equal(pkg.devDependencies['drizzle-kit'], undefined, 'and not also a devDependency');
    assert.match(readFileSync(join(appDir, 'Dockerfile'), 'utf8'), /RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force/,
      'the image installs production dependencies only');
    // public/input.css does `@import "tailwindcss"`, so the package is a DIRECT
    // dependency (#1493): bun's isolated linker and pnpm link only declared
    // packages, so a transitive-only tailwindcss fails the compile there.
    assert.ok(pkg.dependencies.tailwindcss, 'tailwindcss is declared directly (input.css imports it)');
    assert.equal(pkg.dependencies.tailwindcss.split('.')[0], pkg.dependencies['@tailwindcss/cli'].split('.')[0],
      'tailwindcss is on the same major as @tailwindcss/cli');
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
    assert.ok(tsconfig.include.includes('test/**/*'),
      'generated tsconfig type-checks the app test directory (#1299)');
    assert.ok(tsconfig.include.includes('db/**/*'),
      'generated tsconfig type-checks the schema and connection on their own (#1686)');

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
    // No CSS, so no Tailwind packages at all (#1493 is UI-templates only).
    const apiPkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
    assert.ok(!apiPkg.devDependencies.tailwindcss && !apiPkg.devDependencies['@tailwindcss/cli'],
      'the api template declares no Tailwind packages');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

// #1418: a fresh scaffold used to report 5 high-severity npm audit advisories,
// all of them GHSA-jmr9-qjv8-65gv in extract-zip, reached only through
// @web/test-runner -> @web/test-runner-chrome -> puppeteer-core@24 ->
// @puppeteer/browsers@2.13.2. extract-zip has no patched version, so the floor
// has to sit at puppeteer-core, whose 25 line moved to @puppeteer/browsers@3
// (no extract-zip at all). Both templates declare @web/test-runner, so both
// need the override; the assertion runs over both because the manifest is
// shared and an isApi branch added later could silently drop it from one.
//
// This proves the override is EMITTED, not that the audit is clean: a unit
// test cannot install from the network. The clean-audit half is verified by
// hand against a real scaffold and recorded on the PR.
test('scaffoldApp: both templates pin a puppeteer-core floor clearing the extract-zip advisory (#1418)', async () => {
  for (const template of ['full-stack', 'api']) {
    const cwd = await tempCwd();
    const restore = muteConsole();
    try {
      await scaffoldApp('audit-app', cwd, { template });
      const pkg = JSON.parse(readFileSync(join(cwd, 'audit-app', 'package.json'), 'utf8'));
      assert.equal(pkg.overrides?.['puppeteer-core'], '^25.7.0',
        `${template} overrides puppeteer-core past the @puppeteer/browsers@2 line`);
      assert.ok(pkg.devDependencies['@web/test-runner'],
        `${template} still declares the runner the override exists for`);
    } finally {
      restore();
      await rm(cwd, { recursive: true, force: true });
    }
  }
});

test('gallery app: the auth card wires createAuth + dashboard + User model', () => {
  // The auth card lives in the repo gallery app (gallery.webjs.dev); the
  // scaffold no longer ships it.
  const appDir = GALLERY;
  {
    // Auth server modules. createAuth config + hashing live under modules/auth/;
    // the handler route stays at the app root (createAuth hardcodes /api/auth).
    assert.ok(existsSync(join(appDir, 'modules', 'auth', 'password.server.ts')), 'modules/auth/password.server.ts present');
    assert.ok(existsSync(join(appDir, 'modules', 'auth', 'auth.server.ts')), 'modules/auth/auth.server.ts present');
    assert.ok(existsSync(join(appDir, 'app', 'api', 'auth', '[...path]', 'route.ts')), 'auth api handler at the app root');

    // #877/#556: auth.server.ts must not assign `process.env.AUTH_SECRET`
    // (string | undefined) straight to the required `string` secret (TS2322).
    // It resolves through a typed const with a dev fallback + prod guard.
    const authSrc = readFileSync(join(appDir, 'modules', 'auth', 'auth.server.ts'), 'utf8');
    assert.doesNotMatch(authSrc, /secret:\s*process\.env\.AUTH_SECRET\b/, 'secret must not be the raw string | undefined env read');
    assert.match(authSrc, /const authSecret =/, 'auth secret resolved through a typed const');
    assert.match(authSrc, /secret:\s*authSecret\b/, 'createAuth uses the typed authSecret');
    assert.match(authSrc, /NODE_ENV === 'production'[\s\S]*AUTH_SECRET must be set/, 'production fails fast when AUTH_SECRET is unset');
    assert.match(authSrc, /createAuth, Credentials, GitHub, Google/, 'demonstrates the createAuth provider surface');

    // #878: each auth page carries EXACTLY one <h1> (axe page-has-heading-one
    // wants one, and a second h1 is its own violation). Counterfactual: an
    // <h3>-only page, or a double-h1 dashboard, fails this.
    const h1Count = (src) => (src.match(/<h1\b/g) || []).length;
    for (const p of [['login'], ['signup'], ['dashboard'], ['dashboard', 'settings']]) {
      const pageSrc = readFileSync(join(appDir, 'app', 'features', 'auth', ...p, 'page.ts'), 'utf8');
      assert.equal(h1Count(pageSrc), 1, `auth/${p.join('/')} page has exactly one <h1>`);
    }

    // The users table carries the auth passwordHash column.
    const schema = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /export const users = table\('users'/, 'users table present');
    assert.match(schema, /passwordHash/, 'users table carries the auth passwordHash column');

    // Signup is the canonical no-JS form write-path (#1155): the page BINDS the
    // imported module action with `<form action=${signup}>` (no per-page
    // adapter), and the action returns fieldErrors + values on failure so the
    // re-render keeps the user's input.
    const signup = readFileSync(join(appDir, 'app', 'features', 'auth', 'signup', 'page.ts'), 'utf8');
    assert.match(signup, /<form action=\$\{signup\}/, 'signup form binds the imported action');
    assert.doesNotMatch(signup, /export async function action/,
      'and does NOT reintroduce a per-page action adapter');
    assert.match(signup, /actionData/, 'signup page reads actionData for re-render');
    const signupAction = readFileSync(
      join(appDir, 'modules', 'auth', 'actions', 'signup.server.ts'), 'utf8');
    // #1664: a form-bound action reads its fields as properties, the same shape
    // it would get over RPC, so a scaffolded app teaches that shape.
    assert.match(signupAction, /input: SignupInput/, 'the action takes the readable form input');
    assert.match(signupAction, /input\.email/, 'and reads a field as a property');
    assert.match(signupAction, /fieldErrors/, 'and returns field errors');

    // #904: a signed-in user must be able to log out. The dashboard subtree ships
    // a nested layout carrying a plain POST <form> to the createAuth signout route,
    // so logout works with JS off (progressive-enhancement default).
    const dashLayout = readFileSync(join(appDir, 'app', 'features', 'auth', 'dashboard', 'layout.ts'), 'utf8');
    assert.match(dashLayout, /<form method="POST" action="\/api\/auth\/signout"/, 'dashboard layout ships a POST signout form');
    assert.match(dashLayout, /Log out/, 'dashboard layout renders a Log out control');
    // signOut is server-only, so the logout control must reach it through the
    // route, never by importing the server-only auth module into a shipping page.
    assert.doesNotMatch(dashLayout, /import[^\n]*auth\.server/, 'logout control does not import the server-only auth module');

    // The protected route is gated by a per-segment middleware that bounces an
    // anonymous visitor to login.
    const gate = readFileSync(join(appDir, 'app', 'features', 'auth', 'dashboard', 'middleware.ts'), 'utf8');
    assert.match(gate, /auth\(req\)/, 'the gate reads the session off the request');
    assert.match(gate, /location: '\/features\/auth\/login'/, 'the gate redirects anonymous visitors to login');

    // #904: a failed login must surface a message, not silently bounce to the home
    // page. createAuth is configured with pages.error at the login route and the
    // login page reads searchParams.error to render it.
    assert.match(authSrc, /pages:\s*\{\s*error:\s*'\/features\/auth\/login'\s*\}/, 'createAuth points its error page at the login route');
    const login = readFileSync(join(appDir, 'app', 'features', 'auth', 'login', 'page.ts'), 'utf8');
    assert.match(login, /searchParams\.error/, 'login page reads the error query param');
    assert.match(login, /Invalid email or password/, 'login page shows a message for a failed sign-in');

    // The auth test is a REAL handle()-driven flow shipped with the card.
    assert.ok(existsSync(join(appDir, 'test', 'auth', 'auth.test.ts')), 'test/auth/auth.test.ts present');
    const authTest = readFileSync(join(appDir, 'test', 'auth', 'auth.test.ts'), 'utf8');
    assert.match(authTest, /@webjsdev\/server\/testing/, 'auth test uses the handle() test harness');
    assert.match(authTest, /redirects to login when unauthenticated/, 'auth test asserts the protected-route gate');
    assert.match(authTest, /loginAndGetCookies/, 'auth test drives the real login flow');
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

test('gallery app: per-session current-user stays POST-default (#488)', () => {
  // The auth-card current-user read is per-user, so it deliberately is NOT a
  // cacheable GET server action: it ships as the documented counter-example.
  // Counterfactual: add `export const method = 'GET'` to the auth card's
  // current-user and this fails (the exact data-leak the comment warns against).
  const currentUser = readFileSync(
    join(GALLERY, 'modules', 'auth', 'queries', 'current-user.server.ts'), 'utf8');
  assert.doesNotMatch(currentUser, /export const method =/, 'current-user is not a verb-configured GET');
  assert.match(currentUser, /per-session/, 'current-user explains why it stays POST-default');
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
    // Deliberately mixed-case: this is the repo's only uppercase exercise of the
    // {{APP_NAME}} substitution path in create.js, and #1066 allows uppercase.
    await scaffoldApp('PlaceholderTest', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'PlaceholderTest');

    // Walk a few template-copied files and verify {{APP_NAME}} was replaced.
    const filesToCheck = ['AGENTS.md', 'CLAUDE.md'];
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

test('scaffoldApp --db postgres: the schema is plain Drizzle pg-core, a jsonb JSON column', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-pg', cwd, { template: 'full-stack', db: 'postgres' });
    const appDir = join(cwd, 'my-pg');
    assert.ok(!existsSync(join(appDir, 'db', 'columns.server.ts')), 'no helper module on postgres either');
    const schema = readFileSync(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /from 'drizzle-orm\/pg-core'/, 'the postgres schema imports pg-core directly');
    assert.match(schema, /pgTable\('users'/, 'a plain pgTable');
    assert.match(schema, /jsonb\(\)\.\$type<\{[^}]*\}>\(\)/, 'a jsonb JSON column (counterfactual: fails if the dialect is ignored)');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp --db postgres: the pool fails fast and survives a dropped connection', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('my-pg', cwd, { template: 'full-stack', db: 'postgres' });
    const conn = readFileSync(join(cwd, 'my-pg', 'db', 'connection.server.ts'), 'utf8');
    // Without a connect timeout a request hangs forever while the database is
    // down, and without an 'error' listener an idle connection the server
    // drops crashes the process.
    assert.match(conn, /connectionTimeoutMillis: 5_000/, 'a database that is down fails a request in seconds');
    assert.match(conn, /idleTimeoutMillis: 10_000/, 'idle connections are closed');
    assert.match(conn, /max: Number\(process\.env\.DATABASE_POOL_MAX\) \|\| 10/, 'the pool size is capped and configurable');
    assert.match(conn, /pool\.on\('error'/, 'an idle connection error is handled');
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp --db postgres: the DATABASE_URL names a fold-stable database', async () => {
  const cwd = await tempCwd();
  const cap = captureConsole();
  try {
    // A mixed-case name used to keep its capitals in the emitted URL, while
    // `CREATE DATABASE MyPgApp;` folds to `mypgapp`, so the URL named a
    // database that did not exist. Anchored and exact: a loose /mypgapp/ would
    // still pass on a URL that carried the capitals somewhere else.
    await scaffoldApp('MyPgApp', cwd, { template: 'full-stack', db: 'postgres' });
    const envExample = readFileSync(join(cwd, 'MyPgApp', '.env.example'), 'utf8');
    assert.match(
      envExample,
      /^DATABASE_URL=postgres:\/\/user:password@localhost:5432\/mypgapp$/m,
      'the postgres DATABASE_URL names the lowercased database',
    );
    // The user has to create that database, so the guidance has to name it.
    assert.match(cap.output(), /mypgapp/, 'the post-scaffold guidance names the derived database');
  } finally {
    cap.restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp --db postgres: an already-lowercase name is unchanged', async () => {
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    // Byte-identical to the output before the fold landed: the no-regression
    // half of the counterfactual.
    await scaffoldApp('my-pg', cwd, { template: 'full-stack', db: 'postgres' });
    const envExample = readFileSync(join(cwd, 'my-pg', '.env.example'), 'utf8');
    assert.match(
      envExample,
      /^DATABASE_URL=postgres:\/\/user:password@localhost:5432\/my_pg$/m,
      'a lowercase name still emits the same URL it always did',
    );
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});

// AGENTS.md carries a template-SPECIFIC build playbook (#1076): the full-stack
// scaffold teaches the UI playbook (design tokens, the UI kit, an MPA), the api
// scaffold teaches the backend playbook (route handlers, endpoint security), and
// neither ships guidance that does not match what it generated. Both open with
// the same brief and drop the opt-out phrasing that let smaller models
// under-gather context.
test('scaffoldApp: AGENTS.md is the brief alone, the same for both templates', async () => {
  // The agent doc set is the brief plus Lit and Next.js muscle memory, so both
  // templates ship one short AGENTS.md with no template-specific playbook.
  const cwd = await tempCwd();
  const restore = muteConsole();
  try {
    await scaffoldApp('fs-app', cwd, { template: 'full-stack' });
    await scaffoldApp('api-app', cwd, { template: 'api' });
    const fs = readFileSync(join(cwd, 'fs-app', 'AGENTS.md'), 'utf8');
    const api = readFileSync(join(cwd, 'api-app', 'AGENTS.md'), 'utf8');
    assert.equal(fs.replace('fs-app', 'X'), api.replace('api-app', 'X'), 'one AGENTS.md for both templates');
    assert.doesNotMatch(fs, /\{\{[A-Z_]+\}\}/, 'no leftover placeholder');
    assert.match(fs, /## The WebJs brief/, 'opens with the brief');
    assert.match(fs, /node_modules\/@webjsdev\/\*/, 'points at the framework source');
    assert.match(fs, /npx w[e]bjs check/, 'names the check loop');
    assert.match(fs, /use Lit's APIs over raw DOM calls/, 'steers components to Lit APIs over raw DOM');
    assert.match(fs, /document\.getElementById/, 'naming the raw DOM calls to avoid');
    assert.match(fs, /Style with Tailwind utilities on the kit's design tokens/, 'steers styling to Tailwind on the kit tokens');
    assert.match(fs, /npx webjs ui init --preset/, 'and theming to a kit preset');
    assert.match(fs, /`modules\/users\/` is an example of that shape: read it, then\ndelete it, its test and whatever uses it before you build the app\./, 'tells the agent to delete the example module before building');
    assert.match(fs, /\n## This app\n\nReplace this paragraph with what /, 'ends with a This app section the agent fills in');
    assert.match(fs, /`CLAUDE\.md` imports this file, so notes go here\./, 'which says app notes live in AGENTS.md, not CLAUDE.md');
    // The brief plus the scaffold's rules plus the This app stub: still short,
    // since every line is read on every turn.
    assert.ok(fs.split('\n').length < 66, `AGENTS.md stays short (${fs.split('\n').length} lines)`);
    for (const dir of ['fs-app', 'api-app']) {
      assert.ok(!existsSync(join(cwd, dir, '.agents')), `${dir}: no .agents rules or skills`);
    }
  } finally {
    restore();
    await rm(cwd, { recursive: true, force: true });
  }
});
