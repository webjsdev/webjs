/**
 * `webjs create <name>`: scaffold a new WebJs app with opinionated defaults.
 *
 * Creates a directory with:
 *   - app/ with a root layout + page
 *   - modules/ skeleton
 *   - components/ with a theme toggle
 *   - test/unit/ and test/e2e/ with example tests
 *   - AGENTS.md, CLAUDE.md
 *   - package.json with WebJs deps + test scripts
 *   - tsconfig.json for editor support
 */

import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { bunifyProse, bunifyDockerfile, bunifyCompose, bunifyCi, bunifyEnvExample } from './runtime-rewrite.js';
import { postgresCompose, postgresCi } from './db-rewrite.js';
import { assertValidAppName, toDatabaseName } from './app-name.js';
import { PLACEHOLDER_ICON_SVG, appManifest } from './app-icon.js';
import { detectPackageManager } from './package-manager.js';

/**
 * Run `<pm> install` inside the scaffolded app. Returns true on success.
 * Inherits stdio so the user sees the install progress live. Caller decides
 * whether to call this (skipped when --no-install).
 *
 * @param {string} appDir absolute path to the new app
 * @param {'npm'|'pnpm'|'yarn'|'bun'} pm
 * @returns {boolean}
 */
function runInstall(appDir, pm) {
  const r = spawnSync(pm, ['install'], { cwd: appDir, stdio: 'inherit' });
  return r.status === 0;
}

/**
 * Author the INITIAL Drizzle migration for the shipped schema, so the app boots
 * with its tables and the very first `run dev` works with no manual step. The
 * scaffold's schema is TypeScript (`db/schema.server.ts`); `db migrate` (run in
 * `webjs.dev.before` / `webjs.start.before`) only applies migration SQL FILES, so
 * with no file the shipped example hits "no such table". `db generate` turns the
 * schema into that first `db/migrations/*.sql`. It runs OFFLINE (a schema-to-SQL
 * diff, no database connection), so it is safe for sqlite AND postgres here, well
 * before any `DATABASE_URL` exists. Needs `drizzle-kit`, so it only runs after a
 * successful install; on `--no-install` the printed next-steps still show
 * `db:generate`. Returns whether a migration was authored.
 *
 * @param {string} appDir
 * @param {string} pm
 * @returns {boolean}
 */
function runDbGenerate(appDir, pm) {
  const r = spawnSync(pm, ['run', 'db:generate'], { cwd: appDir, stdio: 'inherit' });
  return r.status === 0;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, '..', 'templates');

// Root of the @webjsdev/ui registry workspace. We read component sources
// directly from disk at create time so the scaffolded app boots ready for
// `webjs ui add` without an HTTP round-trip during scaffolding.
//
//   <ui-pkg-root>/packages/registry/components/*.ts
//   <ui-pkg-root>/packages/registry/lib/utils.ts
//   <ui-pkg-root>/packages/registry/themes/index.css
//
// Locate <ui-pkg-root> via Node's module resolver rather than path
// arithmetic off __dirname. The old `__dirname/../../ui/packages/registry`
// form assumed @webjsdev/ui was a hoisted sibling of @webjsdev/cli under
// node_modules/@webjsdev/. That holds for npm/yarn's default hoisting, but
// breaks on nested layouts (pnpm's isolated linker, `npm install
// --install-strategy=nested`, some CI setups), where @webjsdev/ui lives at
// node_modules/@webjsdev/cli/node_modules/@webjsdev/ui and the arithmetic
// resolves to a path that doesn't exist, failing `webjs create`.
//
// @webjsdev/ui's package.json isn't reachable via require.resolve (its
// `exports` map doesn't expose `./package.json`), so resolve the package
// entry and walk up to the directory that owns its package.json.
function resolveUiRegistryRoot() {
  const require = createRequire(import.meta.url);
  let dir = dirname(require.resolve('@webjsdev/ui'));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root; give up
    dir = parent;
  }
  return resolve(dir, 'packages', 'registry');
}
const UI_REGISTRY_ROOT = resolveUiRegistryRoot();

/**
 * Add kit components to a freshly initialised app through the kit's own CLI
 * (`webjsui add`), so the files are byte for byte what an agent's
 * `npx webjs ui add <name>` writes: baked for the app's style, imports
 * rewritten to its cn() helper. Local-first, so it makes no network call.
 * @param {string} appDir
 * @param {string[]} names
 */
function addUiComponents(appDir, names) {
  const bin = resolve(UI_REGISTRY_ROOT, '..', '..', 'bin', 'webjsui.js');
  const r = spawnSync(process.execPath, [bin, 'add', ...names, '--cwd', appDir, '--yes', '--no-deps'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`[webjs create] could not add ${names.join(', ')} from the UI kit: ${(r.stderr || r.stdout || '').trim()}`);
  }
}

/**
 * Write `lib/utils/cn.ts` (the `cn()` helper) and `components.json` so the
 * scaffolded app is pre-initialised for `webjs ui add`. Reads the registry's
 * `lib/utils.ts` verbatim and writes it under `lib/utils/cn.ts` in the
 * scaffolded app so cn() sits in the same folder as the other browser-safe
 * helpers (ui.ts, format.ts).
 *
 * @param {string} appDir
 */
async function writeUiBootstrap(appDir) {
  // Caller (scaffoldApp) has already invoked assertUiRegistryAvailable(),
  // so the source files below are guaranteed to exist.

  // 1) lib/utils/cn.ts: the cn() helper (pure; safe to import into a page).
  const utilsContent = await readFile(
    join(UI_REGISTRY_ROOT, 'lib', 'utils.ts'), 'utf8',
  );
  await mkdir(join(appDir, 'lib', 'utils'), { recursive: true });
  await writeFile(join(appDir, 'lib', 'utils', 'cn.ts'), utilsContent);

  // 1b) lib/utils/dom.ts: the client-only DOM helper (onBeforeCache). Split out
  // of cn.ts so importing cn() does not pin a page to the browser (#819). Any
  // `webjs ui add` component that uses onBeforeCache imports it from here.
  const domContent = await readFile(
    join(UI_REGISTRY_ROOT, 'lib', 'dom.ts'), 'utf8',
  );
  await writeFile(join(appDir, 'lib', 'utils', 'dom.ts'), domContent);

  // 2) components.json: byte for byte what `webjsui init` writes (see the
  // DEFAULT_ALIASES / DEFAULT_TAILWIND_CSS constants in
  // packages/ui/src/commands/init.js, which #1129 made the single source of
  // these values). Keep the two in step: an app that scaffolds and one that
  // runs `webjs ui init` must end up with the same config. The utils alias
  // is lib/utils/cn so get-config.js's `+ '.ts'` resolves to lib/utils/cn.ts.
  // The theme CSS lives at styles/globals.css, NOT app/globals.css: app/ is
  // routing-only, so a non-routing stylesheet does not belong there.
  const componentsJson = {
    $schema: 'https://ui.webjs.dev/schema.json',
    style: 'default',
    tailwind: {
      css: 'styles/globals.css',
      baseColor: 'neutral',
      cssVariables: true,
    },
    aliases: {
      components: 'components',
      utils: 'lib/utils/cn',
      ui: 'components/ui',
      lib: 'lib',
    },
    iconLibrary: 'lucide',
  };
  await writeFile(
    join(appDir, 'components.json'),
    JSON.stringify(componentsJson, null, 2) + '\n',
  );

  // 3) styles/globals.css: copy the neutral theme verbatim. components.json
  // references this path, and future `webjs ui add` calls append to it. It
  // lives OUTSIDE app/ because app/ is routing-only. The same @theme maps are
  // written to public/input.css and compiled to the static public/tailwind.css
  // the layout links (so the app is styled with JavaScript off).
  const css = await readFile(
    join(UI_REGISTRY_ROOT, 'themes', 'index.css'), 'utf8',
  );
  await mkdir(join(appDir, 'styles'), { recursive: true });
  await writeFile(join(appDir, 'styles', 'globals.css'), scaffoldTheme(css));
}

/**
 * The scaffold's palette and type, written INTO the kit's theme block rather
 * than onto :root in app/layout.ts. The block is what `webjs ui init --preset`
 * replaces, so a preset repaints a fresh app, and a token defined in the
 * layout (later in the cascade) would silently override every preset. The
 * light values go on :root and the dark on .dark, the kit's shape, and the
 * fonts on @theme inline, where a preset writes its own. The app's extra
 * tokens (border-strong, primary-tint, the display face) follow the block's
 * end marker, so a preset leaves them alone.
 *
 * @param {string} css the kit's themes/index.css
 */
function scaffoldTheme(css) {
  // The webjs.dev/ui palette (shadcn's site tokens, the `.ui-site` block in
  // website/public/ui-input.css), light then dark, so a fresh app looks like
  // the kit's own site. test/scaffolds/scaffold-ui-theme.test.js holds the
  // two equal.
  const pairs = {
    background: ['oklch(1 0 0)', 'oklch(0.145 0 0)'],
    foreground: ['oklch(0% 0 0)', 'oklch(0.985 0 0)'],
    card: ['oklch(1 0 0)', 'oklch(0.205 0 0)'],
    'card-foreground': ['oklch(0% 0 0)', 'oklch(0.985 0 0)'],
    popover: ['oklch(1 0 0)', 'oklch(0.205 0 0)'],
    'popover-foreground': ['oklch(0% 0 0)', 'oklch(0.985 0 0)'],
    primary: ['oklch(0% 0 0)', 'oklch(0.922 0 0)'],
    'primary-foreground': ['oklch(0.985 0 0)', 'oklch(0.205 0 0)'],
    secondary: ['oklch(0.97 0 0)', 'oklch(0.269 0 0)'],
    'secondary-foreground': ['oklch(0.205 0 0)', 'oklch(0.985 0 0)'],
    muted: ['oklch(0.97 0 0)', 'oklch(0.269 0 0)'],
    'muted-foreground': ['oklch(0.556 0 0)', 'oklch(0.708 0 0)'],
    accent: ['oklch(0.97 0 0)', 'oklch(0.371 0 0)'],
    'accent-foreground': ['oklch(0.205 0 0)', 'oklch(0.985 0 0)'],
    destructive: ['oklch(0.577 0.245 27.325)', 'oklch(0.704 0.191 22.216)'],
    'destructive-foreground': ['oklch(0.97 0.01 17)', 'oklch(0.58 0.22 27)'],
    border: ['oklch(0.922 0 0)', 'oklch(1 0 0 / 10%)'],
    input: ['oklch(0.922 0 0)', 'oklch(1 0 0 / 15%)'],
    ring: ['oklch(0.708 0 0)', 'oklch(0.556 0 0)'],
    sidebar: ['oklch(0.985 0 0)', 'oklch(0.205 0 0)'],
    'sidebar-foreground': ['oklch(0% 0 0)', 'oklch(0.985 0 0)'],
    'sidebar-primary': ['oklch(0.205 0 0)', 'oklch(0.488 0.243 264.376)'],
    'sidebar-primary-foreground': ['oklch(0.985 0 0)', 'oklch(0.985 0 0)'],
    'sidebar-accent': ['oklch(0.97 0 0)', 'oklch(0.269 0 0)'],
    'sidebar-accent-foreground': ['oklch(0.205 0 0)', 'oklch(0.985 0 0)'],
    'sidebar-border': ['oklch(0.922 0 0)', 'oklch(1 0 0 / 10%)'],
    'sidebar-ring': ['oklch(0.708 0 0)', 'oklch(0.439 0 0)'],
  };
  // The site's type: Geist for text and headings, Geist Mono for code.
  const sans = "'Geist', ui-sans-serif, system-ui, sans-serif";
  const mono = "'Geist Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
  let out = setThemeVars(css, ':root', Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, v[0]])));
  out = setThemeVars(out, '.dark', Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, v[1]])));
  out = setThemeVars(out, ':root', { radius: '0.625rem' });
  out = setThemeVars(out, '@theme inline', { 'font-sans': sans, 'font-mono': mono });
  return out.replace(/\s*$/, '\n') + `
/* The app's own tokens, outside the theme block, so a preset leaves them in
   place. public/input.css maps them into utilities. */
:root {
  /* The navbar height. The header is sized BY this token and nothing
     measures it, so the offset in public/input.css cannot drift from it. */
  --header-h: 3.5rem;
  --border-strong: oklch(0.87 0 0);
  /* A translucent tint of the primary, so it follows every theme and preset. */
  --primary-tint: color-mix(in srgb, var(--primary) 22%, transparent);
  --font-display: 'Geist', ui-sans-serif, system-ui, sans-serif;
}
.dark {
  --border-strong: oklch(1 0 0 / 20%);
}
`;
}

/**
 * Set CSS variables in the first `<selector> {` block of `css`, replacing a
 * declared one where it stands and appending the rest at the block's end. The
 * same rule as @webjsdev/ui's setBlockVars (packages/ui/src/utils/theme.js),
 * which `init --preset` uses on this block.
 *
 * @param {string} css
 * @param {string} selector
 * @param {Record<string, string>} vars bare names (`primary`, not `--primary`)
 */
function setThemeVars(css, selector, vars) {
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${esc(selector)}\\s*\\{)([\\s\\S]*?)(\\n\\})`);
  return css.replace(re, (_m, open, body, close) => {
    let next = body;
    const missing = [];
    for (const [key, value] of Object.entries(vars)) {
      const varRe = new RegExp(`(\\n\\s*--${esc(key)}\\s*:\\s*)[^;\\n]+`);
      if (varRe.test(next)) next = next.replace(varRe, (_v, lead) => lead + value);
      else missing.push(`  --${key}: ${value};`);
    }
    return open + next + (missing.length ? '\n' + missing.join('\n') : '') + close;
  });
}

/**
 * Fail loudly when the @webjsdev/ui registry is not on disk. The scaffold
 * reads component sources, the cn() helper, and the @webjsdev/ui theme from
 * UI_REGISTRY_ROOT and weaves them into a generated app/page.ts that
 * imports `components/ui/button.ts`. If the registry is missing, the
 * generated app boots to ERR_MODULE_NOT_FOUND on first request, which is
 * a confusing failure for end-users to debug.
 *
 * The check guards against an @webjsdev/ui published tarball that forgets
 * to ship `packages/registry/` in its `files` array (the bug fixed in
 * the same commit), and against a corrupted node_modules install.
 */
function assertUiRegistryAvailable() {
  const required = [
    join(UI_REGISTRY_ROOT, 'components'),
    join(UI_REGISTRY_ROOT, 'lib', 'utils.ts'),
    join(UI_REGISTRY_ROOT, 'themes', 'index.css'),
  ];
  const missing = required.filter((p) => !existsSync(p));
  if (missing.length === 0) return;
  throw new Error(
    `@webjsdev/ui registry sources not found at ${UI_REGISTRY_ROOT}.\n` +
    `Missing:\n${missing.map((p) => `  - ${p}`).join('\n')}\n\n` +
    `The scaffold reads component sources from the installed @webjsdev/ui ` +
    `package. If you see this from a fresh \`npm create webjs\`, the ` +
    `published @webjsdev/ui tarball is missing \`packages/registry/\` ` +
    `(check its package.json \`files\` array). Please file an issue at ` +
    `https://github.com/webjsdev/webjs/issues with your @webjsdev/ui ` +
    `version (\`npm ls @webjsdev/ui\`).`,
  );
}

/**
 * @param {string} name  App directory name
 * @param {string} cwd   Current working directory
 */
export async function scaffoldApp(name, cwd, opts = {}) {
  // Defence in depth, same as the template check below. `webjs create` already
  // validates the name, but a programmatic caller can pass anything, and the
  // name is interpolated into generated source as a template-literal value
  // (#1066), so an unvalidated quote / backtick / `${` would emit a file that
  // fails to parse. Throwing here happens before any directory is created.
  assertValidAppName(name);
  const template = opts.template || 'full-stack';
  // A human-friendly display title for the example home page. The package
  // `name` stays the raw slug as typed, but showing a hyphenated slug as
  // a hero title looks unpolished, so title-case it for display ("my-app" ->
  // "My App"). Replace this with your real brand anyway.
  const displayName = name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // `install` is opt-in at the library level (so tests + programmatic
  // callers get a side-effect-free scaffold by default). The CLI entry
  // points (`webjs create` and `npx create-webjs-app`) explicitly set
  // `install: true` unless the user passes `--no-install`.
  const shouldInstall = opts.install === true;
  // `--skip-ci` (#1471, `rails new --skip-ci` parity): omit the GitHub
  // workflow. The local `webjs ci` list in package.json is always emitted, so
  // the app still has its gate; only the cloud half is optional.
  const skipCi = opts.skipCi === true;
  // Defence in depth. The CLI already validates this, but library
  // callers (tests, programmatic use) might pass anything.
  const VALID_TEMPLATES = ['full-stack', 'api'];
  if (!VALID_TEMPLATES.includes(template)) {
    throw new Error(
      `Unknown template '${template}'. Only ${VALID_TEMPLATES.join(' / ')} exist.`,
    );
  }
  const isApi = template === 'api';
  // The UI-only steps below are gated on !isApi (the api template has no UI).

  // Database dialect (#563): sqlite (default) or postgres. Drizzle is the ORM;
  // queries and actions are identical across dialects; the schema's column
  // builders, db/connection and the driver dep differ.
  const dialect = opts.db || 'sqlite';
  const VALID_DIALECTS = ['sqlite', 'postgres'];
  if (!VALID_DIALECTS.includes(dialect)) {
    throw new Error(`Unknown --db '${dialect}'. Only ${VALID_DIALECTS.join(' / ')} are supported.`);
  }

  // Runtime axis (#541), ORTHOGONAL to --template (the exactly-3-templates
  // invariant is untouched). Default node; bun opt-in via `--runtime bun` OR
  // auto-detected when the scaffold is invoked through bun (`bun create webjs`),
  // with the explicit flag winning over detection. A bun-flavored app SERVES on
  // Bun (its dev/start scripts force `--bun`), commits `bun.lock`, sets
  // `trustedDependencies`, and ships a bun Dockerfile / CI / agent docs.
  // Runtime detection reads ONLY the invoking tool (no lockfile walk): a
  // global `webjs create` run inside someone else's Bun workspace should not
  // silently flip the new app to serving on Bun.
  const runtime = opts.runtime || (detectPackageManager({ cwd: null, prefer: 'agent' }) === 'bun' ? 'bun' : 'node');
  const VALID_RUNTIMES = ['node', 'bun'];
  if (!VALID_RUNTIMES.includes(runtime)) {
    throw new Error(`Unknown --runtime '${runtime}'. Only ${VALID_RUNTIMES.join(' / ')} are supported.`);
  }
  const isBun = runtime === 'bun';
  // Tailwind compile commands (#947). A UI scaffold compiles a STATIC stylesheet
  // (not the browser runtime), so it renders styled with JavaScript off. The
  // compiler is a node-shebang CLI, so a Bun app (whose Dockerfile is a node-less
  // `oven/bun:1` image, #595) must run it under Bun via `bun --bun`; a Node app
  // runs it directly (the before / regenerate steps get node_modules/.bin on PATH
  // via envWithLocalBin). Deliberately NOT `npm run css:build` in the hooks: the
  // Bun image has no npm, so that step would exit 127 and abort the boot.
  const twBin = isBun ? 'bun --bun tailwindcss' : 'tailwindcss';
  const cssBuildCmd = `${twBin} -i ./public/input.css -o ./public/tailwind.css --minify`;
  const appDir = join(cwd, name);
  if (existsSync(appDir)) {
    console.error(`Error: directory '${name}' already exists.`);
    process.exit(1);
  }

  console.log(`\nwebjs create: scaffolding '${name}' (${template})...\n`);

  // Create directory structure
  const dirs = [
    'app',
    'components',
    'modules',
    'lib',
    'public',
    'db',
    'test/unit',
    'test/e2e',
  ];
  for (const d of dirs) await mkdir(join(appDir, d), { recursive: true });

  // --- Root files ---

  await writeFile(join(appDir, 'package.json'), JSON.stringify({
    name,
    version: '0.1.0',
    type: 'module',
    private: true,
    // Native package.json subpath aliases (#555): write app-internal imports as
    // `#lib/...`, `#components/...`, `#db/...`, `#<any-dir>/...` instead of deep
    // `../../../` relatives. ONE catch-all key, so a new top-level folder is
    // aliased with no config change. Node 24+ and Bun both resolve `#*` natively
    // (a `#/`-prefixed key is rejected by Bun, so this slash-free form is the
    // cross-runtime-safe shape; no build step, no tsconfig paths). The webjs
    // server expands the same map for the import graph + browser importmap. Opt
    // out by using a plain relative import.
    imports: {
      '#*': './*',
    },
    scripts: {
      // No `predev` / `prestart` hooks (#550): the `webjs` block below holds
      // the dev + start orchestration (`webjs db migrate`), run INSIDE `webjs
      // dev` / `webjs start`, so `npm run dev` / `start` (thin aliases) behave
      // identically. Both apply pending migrations before serving (#725).
      //
      // Bun runtime (#541): the long-running server scripts (`dev` / `start`)
      // are prefixed `bun --bun` so the app SERVES on Bun. The `--bun` overrides
      // the `webjs` bin's `#!/usr/bin/env node` shebang (without it `bun run dev`
      // would exec WebJs under Node, silently running the "bun" app on Node).
      // Baking it into the script body means a plain `bun run dev` (or even
      // `npm run dev`) starts on Bun, so a user never has to remember the flag.
      // The db scripts force it too (#1598): `webjs db` runs drizzle-kit and the
      // seed with the CLI's own runtime, and through the node shebang that was
      // Node, at 2.5 to 4 times the CPU of the same command on Bun (generate
      // about 3 CPU-s against 1, migrate 1.2 against 0.5, seed 1 against 0.2,
      // measured on the Postgres scaffold); on Bun the seed also sees `.env`.
      // It is the path a Node-less oven/bun image already takes (#570). The
      // other tooling scripts (test / check / typecheck / doctor / ci) stay
      // plain `webjs ...`: `webjs test` shells `node --test`, which a
      // `bun --test` would not be, and `check` costs the same on both.
      // Compile Tailwind from public/input.css to a STATIC public/tailwind.css
      // that app/layout.ts links, so the app is fully styled with JavaScript
      // DISABLED (a real stylesheet, not an in-browser compile). Runs inside the
      // dev and start tasks via the `before` hooks below. Runtime-aware: a Bun
      // app runs the compiler under Bun (its image has no Node), a Node app runs
      // it directly.
      ...(isApi ? {} : { 'css:build': cssBuildCmd }),
      dev: isBun ? 'bun --bun --no-env-file webjs dev' : 'webjs dev',
      start: isBun ? 'bun --bun --no-env-file webjs start' : 'webjs start',
      test: 'webjs test',
      'test:server': 'webjs test --server',
      'test:browser': 'webjs test --browser',
      check: 'webjs check',
      typecheck: 'webjs typecheck',
      // Project health: a contributor runs `npm run doctor` after cloning to
      // assert the toolchain (Node floor, tsconfig flag, env drift, vendor
      // pins, @webjsdev versions, git hook), and CI runs the same script. Which
      // findings are FATAL comes from the `webjs.doctor.gate` block below, so
      // the environment-shaped checks (env drift, pin freshness over the
      // network, the git hook) stay warns and cannot make CI flaky.
      doctor: 'webjs doctor',
      // Local CI (#1471): every check above plus the test layers, one command,
      // from the step list in the `webjs.ci` block below. Runtime-neutral like
      // the other tooling scripts (it spawns `webjs ...` children).
      ci: 'webjs ci',
      'db:generate': isBun ? 'bun --bun webjs db generate' : 'webjs db generate',
      'db:migrate': isBun ? 'bun --bun webjs db migrate' : 'webjs db migrate',
      'db:push': isBun ? 'bun --bun webjs db push' : 'webjs db push',
      'db:studio': isBun ? 'bun --bun webjs db studio' : 'webjs db studio',
      'db:seed': isBun ? 'bun --bun webjs db seed' : 'webjs db seed',
    },
    dependencies: {
      // Drizzle ORM (no codegen, no engine binary). Pinned to the 1.0 line
      // for relations v2. SQLite needs NO driver dependency: the connection
      // uses the built-in node:sqlite (Node) / bun:sqlite (Bun) via Drizzle's
      // node-sqlite / bun-sqlite adapters. Postgres still needs the pg driver.
      // Pinned EXACTLY (no caret): a caret on a prerelease still admits later
      // rc.N of 1.0.0, and the relations-v2 query API the scaffold is written and
      // tested against is rc.5 (#562). An exact pin keeps generated apps
      // deterministic instead of silently drifting to a newer rc.
      'drizzle-orm': '1.0.0-rc.5',
      ...(dialect === 'postgres' ? { pg: '^8.13.0' } : {}),
      '@webjsdev/cli': 'latest',
      '@webjsdev/core': 'latest',
      '@webjsdev/server': 'latest',
      // What the production BOOT runs, so production dependencies (#1606):
      // `webjs start` runs the `webjs.start.before` steps at every boot,
      // `webjs db migrate` (drizzle-kit) and, on a UI app, the Tailwind
      // compile. The Dockerfile installs production dependencies only, so as
      // devDependencies these would be missing from the image and the boot
      // would fail. `tailwindcss` itself is declared too (#1493):
      // public/input.css starts with `@import "tailwindcss"`, and bun's
      // isolated linker and pnpm link only declared packages, so leaving it
      // transitive (via @tailwindcss/cli) fails the compile with
      // `Can't resolve 'tailwindcss'`. The api template has no CSS.
      'drizzle-kit': '1.0.0-rc.5',
      ...(isApi ? {} : { '@tailwindcss/cli': '^4.1.0', tailwindcss: '^4.1.0' }),
    },
    devDependencies: {
      ...(dialect === 'postgres' ? { '@types/pg': '^8.11.0' } : {}),
      // The TypeScript compiler, for `npm run typecheck` (webjs typecheck runs
      // tsc --noEmit). Not needed at runtime (Node strips types in place), only
      // to type-check the app.
      // Must not resolve below the floor the tsconfig this same generator
      // writes requires: `erasableSyntaxOnly` landed in TypeScript 5.8, and a
      // 5.6 or 5.7 resolution refuses the whole config with
      // `TS5023: Unknown compiler option`. Kept on the major the repo's own
      // apps use, so an app and the framework that generated it type-check
      // under the same compiler. Guarded by
      // test/scaffolds/scaffold-typescript-floor.test.js.
      typescript: '^6.0.3',
      '@types/node': '^24.0.0',
      '@web/test-runner': '^0.20.0',
      '@web/test-runner-playwright': '^0.11.0',
      'playwright': '^1.59.0',
      // The standard accessibility engine, used opt-in by the
      // assertNoA11yViolations() test helper from @webjsdev/core/testing.
      // Test-only: dynamically imported, never shipped to the app runtime.
      'axe-core': '^4.10.0',
      // tsserver plugin, wired into tsconfig below. Gives the language
      // INTELLIGENCE (go-to-def, completions, diagnostics, hover inside html``
      // templates) in any tsserver editor with NO editor plugin installed,
      // because editors load tsconfig plugins from node_modules. The `webjs`
      // VS Code extension and webjs.nvim ALSO bundle this plugin (so it works
      // before `npm install` too, and adds template HIGHLIGHTING, which a
      // tsserver plugin can't provide); tsserver dedupes by name, so loading
      // it both ways is a no-op. Standalone, no Lit dependency. Editor-only.
      '@webjsdev/intellisense': 'latest',
      // NOTE: @webjsdev/ui is intentionally NOT pinned. The UI kit uses a
      // copy-in model (shadcn-compatible conventions): `webjs ui add <name>`
      // copies component source into components/ui/ (they import
      // @webjsdev/core, not the kit), and the
      // CLI resolves @webjsdev/ui from its own install.
    },
    // Transitive-version floor for the browser test runner (#1418). Without
    // this, `npm audit` in a freshly created app reports 5 high-severity
    // advisories the moment scaffolding finishes, all of them one advisory
    // (GHSA-jmr9-qjv8-65gv, an unvalidated symlink path traversal in
    // extract-zip) reached through one chain:
    //
    //   @web/test-runner -> @web/test-runner-chrome -> puppeteer-core@24
    //     -> @puppeteer/browsers@2.13.2 -> extract-zip@2.0.1
    //
    // extract-zip has NO patched version (the advisory covers `*`, and 2.0.1
    // is the newest release), so an override on extract-zip itself cannot fix
    // anything. The fix sits one level up: @puppeteer/browsers@3 dropped
    // extract-zip entirely (it unpacks with modern-tar), and puppeteer-core@25
    // depends on that 3 line. puppeteer-core@24.43.1 pins @puppeteer/browsers
    // EXACTLY ("2.13.2", no caret), so npm cannot dedupe its way out and an
    // explicit override is the only lever.
    //
    // Nothing in a scaffolded app executes this code. The runner is a
    // devDependency, and web-test-runner.config.js launches browsers through
    // playwrightLauncher, so the puppeteer chrome launcher is dead weight that
    // @web/test-runner pulls in unconditionally via its own hard dependency on
    // @web/test-runner-chrome (there is no supported install without it).
    //
    // Caret, not an exact pin: this is a security FLOOR, so a generated app
    // should pick up later 25.x patches. That is the opposite of the
    // drizzle-orm reasoning above, where the exact pin is deliberate because
    // the scaffold source is written against one rc API.
    //
    // Do NOT "fix" this by taking @web/test-runner@1, which is what
    // `npm audit fix --force` proposes: its @web/test-runner-chrome@1 still
    // declares puppeteer-core ^24, so the same vulnerable chain resolves and
    // the audit stays red after a breaking major.
    //
    // basic-ftp (#1492) is the same kind of floor for the same runner: it is
    // reached through puppeteer-core's proxy-agent chain and 6.2.2 is its fixed
    // release (GHSA-c475-qrg2-pj4r), so an install that still resolves an older
    // chain cannot land below it.
    //
    // Overrides are honoured ONLY at a workspace root. When this app is a
    // member of an npm or bun workspace, move this block into the root
    // package.json (`webjs doctor` warns with WORKSPACE_OVERRIDES until then).
    overrides: {
      'puppeteer-core': '^25.7.0',
      'basic-ftp': '^6.2.2',
    },
    // Dev + start task orchestration (#550). `webjs dev` / `webjs start` read
    // `before` and run it in-process, so `npm run dev` / `start` (thin aliases
    // above) behave identically. Both apply pending migrations via `webjs db
    // migrate` (idempotent, a no-op when the db is current), so a freshly
    // generated migration is applied without a manual step (#725). For a UI
    // template it ALSO runs `webjs regenerate` in `before`, so a freshly cloned app is
    // styled on the very first boot with no manual step. That builds every
    // `regenerate` output that is not fresh and RECORDS each build in
    // .webjs/regenerate.json (#1672), which is how the dev server and
    // `webjs doctor` know the output is current. A raw compile in `before`
    // writes no record, so the first request after every boot would compile
    // again. The rule's command is the runtime-aware `cssBuildCmd` (a Bun app
    // runs it under Bun, since its image has no npm or Node), NOT `npm run
    // css:build`. The api template has no CSS, so it gets neither.
    //
    // In dev the static public/tailwind.css is kept fresh by `dev.regenerate`
    // (#967), NOT a background `tailwindcss --watch`. A watch that dies mid-
    // session or never starts serves stale/missing CSS with no error (a newly
    // added utility class has no backing rule, so the app renders unstyled
    // locally while prod is fine). `regenerate` instead recompiles ON REQUEST
    // when the output does not match its build record (or is missing): the
    // framework rebuilds it before serving `/tailwind.css`, so there is
    // no watch process to die and no staleness window. Same `cssBuildCmd` as
    // prod, so dev and prod resolve classes identically (nothing to diverge).
    // `inputs` mirrors the
    // input.css @source globs (the dirs Tailwind scans for classes).
    webjs: {
      dev: {
        before: isApi ? ['webjs db migrate'] : ['webjs db migrate', 'webjs regenerate'],
        ...(isApi ? {} : {
          regenerate: [{
            output: 'public/tailwind.css',
            command: cssBuildCmd,
            inputs: ['app', 'components', 'modules', 'lib', 'styles', 'public/input.css'],
          }],
        }),
      },
      start: { before: isApi ? ['webjs db migrate'] : ['webjs db migrate', 'webjs regenerate'] },
      // No `db` block on purpose (#1468). `webjs db` defaults to drizzle-kit,
      // and Drizzle is the scaffold default by OMISSION: an app that swaps the
      // ORM adds `"db": { "migrate": "prisma migrate deploy", ... }` here and
      // the `webjs db migrate` spelling in `before` (and the Dockerfile, and
      // CI) keeps working. Emitting the Drizzle mapping would only duplicate
      // the default into every app.
      // Which doctor findings are FATAL is the app's own call (#1257), declared
      // here rather than in the CI workflow so `npm run doctor` locally and the
      // workflow step agree about what fails. UNMARKED_ASSET_LINKS starts at
      // error because an un-versioned public url is a real deploy-staleness
      // bug (it shipped a visible regression on webjs.dev) and the generated
      // layout already writes asset(), so a fresh app is green on day one.
      // Two checks are fatal with no entry here at all, NODE_VERSION and
      // TSCONFIG_ERASABLE, because either would 500 the app at runtime;
      // everything else keeps its default warn. Add a code with "off" to
      // silence it, or "error" to make it fatal too.
      doctor: { gate: { UNMARKED_ASSET_LINKS: 'error' } },
      // The dependency audit's allowlist (#1492), the ONE place an accepted
      // advisory is listed, each with the reason it is safe. `webjs audit`
      // (the CI step below) fails on every other advisory at `level` or above,
      // and prints an entry as stale once the audit stops reporting it, so
      // remove it then. Only accept an advisory with NO patched release that
      // the app's users cannot reach; anything with a fix gets upgraded.
      audit: {
        level: 'high',
        ignore: [
          {
            id: 'GHSA-vfj7-8cjw-p6xm',
            reason: 'braces <=3.0.3 (no patched release) is reached only through dev tooling: the Tailwind '
              + 'CLI file watcher and the test runner globber, on glob patterns this repo writes. Nothing '
              + 'in the served app expands a pattern from request input.',
          },
        ],
      },
      // Local CI (#1471), the Rails `bin/ci` posture. `npm run ci` runs this
      // list on a developer machine and the generated GitHub workflow runs the
      // SAME list through the same command, so the two cannot drift. Bare
      // `webjs ...` commands, like the before-steps above (a Bun app's image
      // has no npm). The `Checks` group runs two steps at a time with each
      // step's output replayed whole; `Tests` inside it stays SEQUENTIAL, one
      // slot, because the server and e2e layers share one SQLite file.
      ci: {
        steps: [
          { title: 'Setup', run: 'webjs db migrate' },
          {
            title: 'Checks',
            parallel: 2,
            steps: [
              { title: 'Conventions', run: 'webjs check' },
              { title: 'Health', run: 'webjs doctor' },
              { title: 'Types', run: 'webjs typecheck' },
              // `webjs audit` (#1492) runs `npm audit` or `bun audit` (by the
              // nearest lockfile) and fails at webjs.audit.level, minus the
              // advisories webjs.audit.ignore accepts below.
              { title: 'Security: dependency audit', run: 'webjs audit' },
              {
                title: 'Tests',
                steps: [
                  { title: 'Tests: server', run: 'webjs test --server' },
                  { title: 'Tests: browser', run: 'webjs test --browser' },
                  { title: 'Tests: e2e', run: 'webjs test --server', env: { WEBJS_E2E: '1' } },
                ],
              },
            ],
          },
        ],
      },
    },
  }, null, 2) + '\n');

  await writeFile(join(appDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: ['node'],
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      // WebJs uses Node's built-in type-stripping (`process.features.
      // typescript === 'strip'`) which preserves source positions
      // byte-exactly. The constraint is that TypeScript must be
      // "erasable": no `enum`, no `namespace` with values, no
      // constructor parameter properties, no legacy decorators with
      // `emitDecoratorMetadata`. erasableSyntaxOnly makes the
      // compiler reject those at edit time so violations surface as
      // red squiggles instead of runtime ERR_UNSUPPORTED_TYPESCRIPT_
      // SYNTAX errors. Use a `const` object + union for enum-shaped
      // values; write fields + constructor assignments explicitly.
      erasableSyntaxOnly: true,
      // Type-only imports must say `import type` (Lit's `PropertyValues`,
      // a Drizzle row type). The type stripper erases only what is marked, so
      // an unmarked type import survives into the served module and fails at
      // load with "does not provide an export named"; this flag makes tsc
      // report it at edit time instead.
      verbatimModuleSyntax: true,
      // @webjsdev/intellisense (standalone, no Lit dependency) gives the editor,
      // inside html`` templates:
      //   • go-to-definition on custom-element tags, attributes, and CSS classes
      //   • binding-aware completions (tag names, .prop / ?bool / plain attrs)
      //   • diagnostics (value type-checks, unquoted-binding, expressionless .prop)
      //   • hover showing the component class / declared member type
      // Editor-only. The framework runs without it. For VS Code / Cursor /
      // Windsurf, the `webjs` extension bundles this automatically.
      plugins: [
        { name: '@webjsdev/intellisense' },
      ],
    },
    // `db/**/*` is in so the schema and the connection are checked on their
    // own, not only through a file that imports them (#1686: a driver type
    // change in the connection passed typecheck because nothing included it).
    //
    // `test/**/*` is in so `webjs typecheck` reads the tests you write, the
    // same way Next / Remix / Astro's generated configs do (#1299). A type
    // error in a test is then a gate failure rather than something a reviewer
    // has to catch by eye, and it needs no second config to remember to run.
    //
    // `.webjs/routes.d.ts` is the OPT-IN generated route-types overlay (#258):
    // run `webjs types` (or `webjs dev`, which emits it) to narrow the
    // @webjsdev/core `Route` href union + per-route `params`. Listed in
    // `include` so tsserver picks it up; it is gitignored (regenerated per
    // machine), so a fresh clone runs `webjs dev` / `webjs types` to recreate
    // it, and the static @webjsdev/core types work even when it is absent.
    include: [
      'app/**/*',
      'components/**/*',
      'modules/**/*',
      'lib/**/*',
      'db/**/*',
      'test/**/*',
      'middleware.js',
      'middleware.ts',
      'proxy.ts',
      'instrumentation.ts',
      'instrumentation-client.ts',
      'env.ts',
      '.webjs/routes.d.ts',
    ],
    exclude: ['node_modules', '.webjs/vendor', 'db/migrations'],
  }, null, 2) + '\n');

  // --- Templates (AGENTS.md, CLAUDE.md, test files, Claude hooks) ---

  const templateFiles = [
    // Single cross-agent source: AGENTS.md carries the brief; the .agents/rules
    // workflow rules and the Claude enforcement hooks back it up.
    'AGENTS.md',
    'CLAUDE.md',
    // Claude Code config + the protective enforcement hooks (no design ceremony).
    '.claude.json',
    '.claude/settings.json',
    '.claude/hooks/block-prose-punctuation.sh',
    '.claude/hooks/block-raw-htmlelement.sh',
    '.claude/hooks/guard-branch-context.sh',
    '.claude/hooks/nudge-uncommitted.sh',
    '.claude/hooks/commit-before-stop.sh',
    '.claude/hooks/cleanup-merged-worktree.sh',
    '.claude/hooks/require-tests-with-src.sh',
    '.claude/hooks/check-server-imports.sh',
    '.claude/hooks/check-server-imports.mjs',
    '.claude/hooks/check-on-edit.sh',
    '.claude/hooks/check-on-edit.mjs',
    // Git pre-commit hook (blocks commits directly to main).
    '.hooks/pre-commit',
    // Starter tests under the feature-folder layout.
    'test/hello/hello.test.ts',
    'test/hello/browser/hello.test.js',
    'test/hello/e2e/hello.test.ts',
    'web-test-runner.config.js',
    // Optional boot-time APM hook (setOnError). Delete if unused.
    'instrumentation.ts',
    '.env.example',
    // Shipped without a dot (npm strips a published .gitignore) and renamed on copy.
    'gitignore',
    '.github/pull_request_template.md',
    // The cloud half of CI: one job that runs `npm run ci`, the same step list
    // the app declares under `webjs.ci` (#1471). Omitted by `--skip-ci`.
    '.github/workflows/ci.yml',
    '.editorconfig',
    '.vscode/settings.json',
    // Production / deploy scaffolding.
    'Dockerfile',
    'compose.yaml',
    '.dockerignore',
  ];
  // Bun runtime (#541): the agent-config markdown shows bun commands, and the
  // deploy files (Dockerfile / compose / CI) run on Bun. Each is DERIVED from
  // the canonical node template by a pure transform (see runtime-rewrite.js), so
  // there is no parallel bun template to drift. Prose files get the command
  // rewrites; the three infra files get their file-specific transform. On Node,
  // every file is copied byte-identical (the map is empty).
  const PROSE_REWRITE = new Set([
    'AGENTS.md', 'CLAUDE.md',
    'test/hello/browser/hello.test.js', 'test/hello/e2e/hello.test.ts',
    // Comments that name a command (#1527): `npm run ci` in the hook, the
    // Tailwind build note in the ignore file.
    '.hooks/pre-commit', 'gitignore',
  ]);
  // compose.yaml builds from the (pure oven/bun) Dockerfile and inherits its
  // `bun --bun run start` CMD; only its healthcheck needs switching off node
  // (the pure Bun image has no node), which bunifyCompose does.
  const FILE_REWRITE = {
    'Dockerfile': bunifyDockerfile,
    'compose.yaml': bunifyCompose,
    '.github/workflows/ci.yml': bunifyCi,
    '.env.example': bunifyEnvExample,
  };
  // Database axis (#1490): the compose + CI templates are the SQLite shape, so
  // a --db postgres app derives its variant (a Postgres service, DATABASE_URL
  // pointed at it) by a pure transform, like the Bun rewrite above. Applied
  // FIRST; the two touch disjoint lines, so they compose. SQLite copies as is.
  const DB_REWRITE = dialect === 'postgres' ? {
    'compose.yaml': (c) => postgresCompose(c, toDatabaseName(name)),
    '.github/workflows/ci.yml': (c) => postgresCi(c, toDatabaseName(name)),
  } : {};
  for (const f of templateFiles) {
    // `--skip-ci` drops only the workflow; the PR template still ships.
    if (skipCi && f === '.github/workflows/ci.yml') continue;
    const src = join(TEMPLATES, f);
    if (existsSync(src)) {
      // `gitignore` ships without a dot (npm strips a published `.gitignore`)
      // and is written to `.gitignore` in the generated app.
      const dest = f === 'gitignore' ? '.gitignore' : f;
      await mkdir(dirname(join(appDir, dest)), { recursive: true });
      let content = await readFile(src, 'utf8');
      content = content.replace(/\{\{APP_NAME\}\}/g, name);
      if (DB_REWRITE[f]) content = DB_REWRITE[f](content);
      if (isBun) {
        if (PROSE_REWRITE.has(f)) content = bunifyProse(content);
        else if (FILE_REWRITE[f]) content = FILE_REWRITE[f](content);
      }
      await writeFile(join(appDir, dest), content);
    }
  }

  // Make the Claude enforcement hooks + the git pre-commit executable.
  const { chmod } = await import('node:fs/promises');
  for (const hook of ['block-prose-punctuation.sh', 'block-raw-htmlelement.sh', 'guard-branch-context.sh', 'nudge-uncommitted.sh', 'commit-before-stop.sh', 'cleanup-merged-worktree.sh', 'require-tests-with-src.sh', 'check-server-imports.sh', 'check-on-edit.sh']) {
    const hookPath = join(appDir, '.claude', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  const preCommitPath = join(appDir, '.hooks', 'pre-commit');
  if (existsSync(preCommitPath)) await chmod(preCommitPath, 0o755);

  // --- Drizzle db layer (all templates), dialect-selected (#563) ---
  //
  // Plain Drizzle, as in Drizzle's own docs, so an agent writes the schema
  // from what it already knows (#1686: a helper module every agent first had
  // to read cost lookups and hid types, e.g. a timestamp() that was a Date).
  // A column's SQL name is its key, Drizzle's default; name one explicitly
  // (\`integer('created_at')\`) when a different SQL name is wanted. Only the
  // schema's builders, the connection and the driver differ between SQLite and
  // Postgres. Pinned to drizzle-orm 1.0.0-rc.5 (relations v2). See research #562.

  const schemaShared = `// A foreign key belongs on the COLUMN, as in any Drizzle schema, and an index
// in the table's third argument:
//   export const posts = TABLE('posts', {
//     id: ID,
//     userId: integer().notNull().references(() => users.id),
//     title: text().notNull(),
//   }, (t) => [index('posts_user_id_idx').on(t.userId)]);
// A relation (what db.query's \`with\` follows) belongs HERE, in the one
// defineRelations for the whole schema (Drizzle 1.0), never on a column:
//   export const relations = defineRelations({ users, posts }, (r) => ({
//     posts: { author: r.one.users({ from: r.posts.userId, to: r.users.id }) },
//     users: { posts: r.many.posts() },
//   }));
export const relations = defineRelations({ users }, () => ({}));

// Derived types, never hand-written.
export type User = typeof users.$inferSelect;
`;

  const schemaSqlite = `import { defineRelations } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Example model. Feel free to delete or extend.
export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text(),
  // A JSON column: a structured value, typed with $type<T>().
  settings: text({ mode: 'json' }).$type<{ theme?: string }>(),
  // A JavaScript Date, stored as milliseconds. For a plain number use integer().
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().defaultNow(),
});
` + schemaShared.replace('TABLE', 'sqliteTable').replace('ID', 'integer().primaryKey({ autoIncrement: true })');

  const schemaPg = `import { defineRelations } from 'drizzle-orm';
import { pgTable, serial, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Example model. Feel free to delete or extend.
export const users = pgTable('users', {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  name: text(),
  // A JSON column: a structured value, typed with $type<T>().
  settings: jsonb().$type<{ theme?: string }>(),
  // A JavaScript Date.
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
` + schemaShared.replace('TABLE', 'pgTable').replace('ID', 'serial().primaryKey()');

  await writeFile(join(appDir, 'db', 'schema.server.ts'), dialect === 'postgres' ? schemaPg : schemaSqlite);

  const connSqlite = `import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import * as schema from './schema.server.ts';

// The only file that opens the driver. Runtime-neutral and ZERO native deps:
// built-in bun:sqlite on Bun, built-in node:sqlite on Node.
// A relative SQLite path resolves against the app root (the parent of db/), not
// process.cwd(), so the connection works under \`webjs dev\` AND when the app is
// embedded via createRequestHandler from a different working directory.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';
const url = raw === ':memory:' || isAbsolute(raw) ? raw : resolve(appRoot, raw);

// Only the DRIVER handle is cached on globalThis (per database url), so a dev
// reload reuses one open connection. The Drizzle wrapper below is rebuilt each
// time this module is evaluated, because it captures schema.relations: caching
// the wrapper kept the first load's relations, so a table added while
// \`webjs dev\` ran stayed undefined on db.query until a restart.
const g = globalThis as unknown as { __webjs_db_clients?: Map<string, unknown> };
const clients = (g.__webjs_db_clients ??= new Map());
function cached<T>(open: () => T): T {
  if (!clients.has(url)) clients.set(url, open());
  return clients.get(url) as T;
}

// Both node:sqlite and bun:sqlite default \`busy_timeout\` to 0, so a concurrent
// writer throws \`database is locked\` immediately. Restore a 5s wait (the old
// better-sqlite3 default) so contended access waits, and WAL so readers proceed
// alongside one writer.
function tune<T extends { exec(sql: string): unknown }>(client: T): T {
  client.exec('PRAGMA busy_timeout = 5000');
  client.exec('PRAGMA journal_mode = WAL');
  return client;
}

// One concrete type for db. Both drivers share the same synchronous SQLite
// query builder, but typed as a union of the two, TypeScript cannot resolve an
// overloaded method across it and db.select({ id: users.id }) fails to compile.
type Db = NodeSQLiteDatabase<typeof schema.relations>;

async function connect(): Promise<Db> {
  if ((globalThis as { Bun?: unknown }).Bun) {
    // @ts-expect-error bun:sqlite is a Bun builtin with no Node typings
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: cached(() => tune(new Database(url))), relations: schema.relations }) as unknown as Db;
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  return drizzle({ client: cached(() => tune(new DatabaseSync(url))), relations: schema.relations });
}

export const db = await connect();
`;

  const connPg = `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.server.ts';

// The only file that opens the driver. The pool relies on no session state (no
// SET, no LISTEN, no advisory locks held across queries), so it also works
// behind a transaction pooler. Idle connections close after 10 s; a database
// that is down fails a request in 5 s instead of hanging it; DATABASE_POOL_MAX
// caps the pool (default 10).
//
// Only the POOL is cached on globalThis (per connection string), so a dev
// reload reuses it. The Drizzle wrapper is rebuilt each time this module is
// evaluated, because it captures schema.relations: caching the wrapper kept the
// first load's relations, so a table added while \`webjs dev\` ran stayed
// undefined on db.query until a restart.
const url = process.env.DATABASE_URL ?? '';
const g = globalThis as unknown as { __webjs_db_pools?: Map<string, Pool> };
const pools = (g.__webjs_db_pools ??= new Map());

function openPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle connection the server drops (a restart, a failover) emits
  // 'error' on the pool, and an unhandled one would crash the process.
  pool.on('error', (err) => console.error('[db] idle connection lost:', err.message));
  return pool;
}

if (!pools.has(url)) pools.set(url, openPool());
export const db = drizzle({ client: pools.get(url) as Pool, relations: schema.relations });
`;

  await writeFile(join(appDir, 'db', 'connection.server.ts'), dialect === 'postgres' ? connPg : connSqlite);

  // drizzle-kit config (root, must be this exact filename). DB url from env.
  await writeFile(join(appDir, 'drizzle.config.ts'), dialect === 'postgres'
    ? `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.server.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`
    : `import { defineConfig } from 'drizzle-kit';

// No 'driver' is set: drizzle-kit auto-selects the SQLite driver for
// migrate/push/studio from the runtime, picking the built-in node:sqlite on
// Node and bun:sqlite on Bun (it only reaches for better-sqlite3 when that
// package is present, which this app does not install). That auto-selection is
// what keeps \`webjs db migrate\` free of a native driver, matching the runtime
// connection in db/connection.server.ts.
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.server.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db' },
});
`);

  // Env vars: append DATABASE_URL to the .env.example the template already
  // copied (if present), idempotently. The database segment is the app name
  // normalized to a fold-stable PostgreSQL identifier, so the emitted URL
  // names the same database whether the user runs `createdb` or types
  // `CREATE DATABASE`. Hoisted because the post-scaffold guidance below names
  // the same value, and the two must not be able to drift.
  const dbName = toDatabaseName(name);
  const dbUrlLine = dialect === 'postgres'
    ? 'DATABASE_URL=postgres://user:password@localhost:5432/' + dbName
    : 'DATABASE_URL=file:./db/dev.db';
  const envExample = join(appDir, '.env.example');
  if (existsSync(envExample)) {
    let cur = await readFile(envExample, 'utf8');
    // Replace any existing DATABASE_URL line so it is dialect-correct; else append.
    if (/^DATABASE_URL=.*$/m.test(cur)) {
      cur = cur.replace(/^DATABASE_URL=.*$/m, dbUrlLine);
    } else {
      cur = cur.replace(/\n?$/, '\n') + '\n' + dbUrlLine + '\n';
    }
    await writeFile(envExample, cur);
  } else {
    await writeFile(envExample, dbUrlLine + '\n');
  }

  // A real .env with fresh secrets, the way `rails new` writes its secret key:
  // createAuth() and session() both refuse to run without theirs, and an app
  // that works on the first `npm run dev` should not need a manual step first.
  // The file is gitignored, so each clone generates its own; never overwrite one.
  const envFile = join(appDir, '.env');
  if (!existsSync(envFile)) {
    const example = await readFile(envExample, 'utf8');
    const secret = () => randomBytes(32).toString('hex');
    await writeFile(envFile, example.replace(/^(AUTH_SECRET|SESSION_SECRET)=$/gm, (_, key) => `${key}=${secret()}`));
  }

  // .gitignore the generated SQLite file (sqlite only; postgres has no local file).
  if (dialect !== 'postgres') {
    const gitignore = join(appDir, '.gitignore');
    const gitignoreExtra = '\n# SQLite dev database\ndb/dev.db\ndb/dev.db-journal\ndb/dev.db-*\n';
    if (existsSync(gitignore)) {
      const cur = await readFile(gitignore, 'utf8');
      if (!cur.includes('db/dev.db')) await writeFile(gitignore, cur + gitignoreExtra);
    } else {
      // Defense in depth: if the template gitignore is ever absent, still
      // never leave a real `.env` trackable (dogfood #845).
      await writeFile(gitignore, 'node_modules\n.webjs\n.env\n.env.*\n!.env.example\n' + gitignoreExtra);
    }
  }

  // --- App files (template-specific) ---

  if (isApi) {
    // API-only template: no layout, no page, no components.
    // Just a health route and an example module with route wrapper.

    // Root middleware applying CORS to every route. An API consumed by a
    // browser from another origin needs this; the `cors()` primitive
    // handles origin reflection, the OPTIONS preflight, Vary: Origin, and
    // the credentials rule, so route handlers stay focused on data.
    await writeFile(join(appDir, 'middleware.ts'), `import { cors } from '@webjsdev/server';

/**
 * App-wide CORS policy. Replace the allow-list with your real frontend
 * origins. With \`credentials: true\` a wildcard origin is invalid per the
 * CORS spec, so list explicit origins (never \`'*'\` + credentials).
 */
export default cors({
  origin: ['http://localhost:3000', 'https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['content-type', 'authorization'],
  maxAge: 86400,
});
`);

    await mkdir(join(appDir, 'app', 'api', 'health'), { recursive: true });
    await mkdir(join(appDir, 'app', 'api', 'users'), { recursive: true });
    await writeFile(join(appDir, 'app', 'api', 'health', 'route.ts'), `export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
`);
    // Root API index. The api template has no UI, so \`/\` is a route handler,
    // not a page: it lists the available endpoints instead of returning a bare
    // 404 (friendlier than an empty root for an API-only app).
    await writeFile(join(appDir, 'app', 'route.ts'), `export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  return Response.json({
    name: '${name}',
    endpoints: {
      health: \`\${base}/api/health\`,
      users: \`\${base}/api/users\`,
    },
  });
}
`);
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await mkdir(join(appDir, 'modules', 'users', 'queries'), { recursive: true });

    await writeFile(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts'), `'use server';

// A GET server action (#488): a read declares its HTTP semantics via reserved
// sibling exports the framework reads statically. 'method' makes the call ride
// the URL and be ETag/304-aware; 'cache' is what makes the response cacheable at
// all (the max-age in seconds, private by default, do NOT add { public: true }
// unless the data is identical for EVERY visitor); 'tags' label the cached entry so a
// mutation can evict it. All three shape the RPC endpoint a browser import hits,
// so they do nothing for the in-process call in app/api/users/route.ts; they are
// here as the idiom to carry into a client that imports the action. One function
// per file.
export const method = 'GET';
export const cache = 30;
export const tags = () => ['users'];
export async function listUsers() {
  // TODO: replace with real data source
  return [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];
}
`);
    await writeFile(join(appDir, 'modules', 'users', 'actions', 'create-user.server.ts'), `'use server';

// A mutation server action (#488). With no 'method' export it defaults to POST
// (CSRF-protected, rich request body). 'invalidates' lists the cache tags to
// evict once the action completes without throwing, so a client that read
// listUsers() refetches fresh instead of serving a stale browser-cached value.
// (A returned { success: false } envelope still evicts, since the action ran.)
// It applies on the RPC endpoint a browser import hits. The route.ts in this
// template calls the function directly, which is in-process, so the config
// exports do not fire there. One function per file.
export const invalidates = () => ['users'];
export async function createUser(input: { name: string; email: string }) {
  // TODO: validate input, persist to database
  return { success: true, data: { id: Date.now().toString(), ...input } };
}
`);
    await writeFile(join(appDir, 'app', 'api', 'users', 'route.ts'), `/**
 * /api/users: thin route wrapper over typed server actions.
 * Business logic lives in modules/users/, not here.
 *
 * These calls are in-process, so the actions' config exports do NOT apply here.
 * method / cache / tags / invalidates shape the RPC endpoint a browser import
 * hits, and nothing else applies them, so this endpoint sets its own headers if
 * it wants caching. The namespace form of the route() adapter from
 * \@webjsdev/server (import * as q; export const GET = route(q)) picks up the
 * declared validate and middleware, which are the two an endpoint can reuse.
 */
import { listUsers } from '#modules/users/queries/list-users.server.ts';
import { createUser } from '#modules/users/actions/create-user.server.ts';

export async function GET() {
  return Response.json(await listUsers());
}

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json(await createUser(body));
}
`);
    // Minimal starter test so a freshly scaffolded app ships with a test
    // and `webjs test` runs cleanly. Replace these with real assertions
    // once you wire the action/query to a real data source.
    await writeFile(join(appDir, 'test', 'unit', 'users.test.ts'), `import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listUsers } from '#modules/users/queries/list-users.server.ts';
import { createUser } from '#modules/users/actions/create-user.server.ts';

test('listUsers returns an array', async () => {
  const users = await listUsers();
  assert.ok(Array.isArray(users));
});

test('createUser returns a success envelope with the input echoed back', async () => {
  const result = await createUser({ name: 'Test', email: 'test@example.com' });
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Test');
  assert.equal(result.data.email, 'test@example.com');
});
`);
    await writeFile(join(appDir, 'modules', 'users', 'types.ts'), `export interface User {
  id: string;
  name: string;
  email: string;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };
`);

  }

  if (!isApi) {
    // The UI template: layout + page + theme toggle + Tailwind

    // The Tailwind stylesheet is compiled from public/input.css (written below)
    // to a STATIC public/tailwind.css by css:build, and lib/utils/ui.ts helpers
    // are copied below, so the app boots with the exact blog example
    // architecture: light DOM + a real Tailwind stylesheet (styled with JS off)
    // + JS helpers.
    const publicDir = join(appDir, 'public');
    await mkdir(publicDir, { recursive: true });
    // Progressive-enhancement service worker (#271): ship the opt-in offline
    // primitive (the worker + its offline fallback) into the UI scaffold
    // (this block is api-excluded since api has no UI).
    // Dormant until the app registers it (the opt-in snippet is in sw.js's own
    // header); it never changes the JS-disabled baseline.
    for (const swFile of ['sw.js', 'offline.html']) {
      const swSrc = join(TEMPLATES, 'public', swFile);
      if (existsSync(swSrc)) await cp(swSrc, join(publicDir, swFile));
    }
    // The WebJs logo the header shows, one file per theme (the webjs.dev
    // lockup: an inverted file would flip the paper along with the ink).
    await mkdir(join(publicDir, 'brand'), { recursive: true });
    for (const logo of ['webjs-lockup-on-light.svg', 'webjs-lockup-on-dark.svg']) {
      await cp(join(TEMPLATES, 'public', 'brand', logo), join(publicDir, 'brand', logo));
    }
    // The app icon and web app manifest: `app/icon.svg` (a neutral PLACEHOLDER
    // the agent replaces with the app's own icon; `webjs doctor` warns while it
    // is still there) and `app/manifest.webmanifest` (the app's name). The
    // framework links both into <head> and answers /favicon.ico with the icon,
    // so the layout declares nothing.
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(join(appDir, 'app', 'icon.svg'), PLACEHOLDER_ICON_SVG);
    await writeFile(join(appDir, 'app', 'manifest.webmanifest'), appManifest(displayName));


    // Fail loudly if the @webjsdev/ui registry sources aren't on disk.
    // Without this, downstream copy helpers would silently skip and the
    // generated app would boot to ERR_MODULE_NOT_FOUND on the first page
    // render (the import in app/page.ts below points at a file we didn't
    // write).
    assertUiRegistryAvailable();

    // Pre-initialise @webjsdev/ui so the scaffold boots ready for
    // `webjs ui add <name>`: writes components.json + lib/utils/cn.ts +
    // styles/globals.css (the @webjsdev/ui theme).
    await writeUiBootstrap(appDir);
    // The kit components the shell uses (the theme toggle's Button, the home
    // page form's Input and Label), installed by the kit's own `add`
    // (local-first, no network), exactly as `npx webjs ui add <name>` would.
    addUiComponents(appDir, ['button', 'input', 'label']);

    // Pages style with Tailwind on the kit's tokens. The app is pre-initialised
    // for `webjs ui add <name>` via writeUiBootstrap above and ships one kit
    // component, the Button its theme toggle uses; the rest are added on demand.

    // The @webjsdev/ui theme (`--color-primary`, `--color-card`, the @theme maps,
    // @custom-variant, @keyframes) plus the app @theme mappings are compiled from
    // public/input.css into the STATIC public/tailwind.css that app/layout.ts
    // links, so the app is fully styled with JavaScript disabled. Write input.css:
    // `@import "tailwindcss"`, source globs, an import of the ui theme at
    // styles/globals.css, then the app @theme inline block. The theme is
    // IMPORTED, not copied: styles/globals.css is the stylesheet components.json
    // names, so the tokens `webjs ui add` merges into it for a block (sidebar's
    // --sidebar-*, chart's --chart-*) reach the compiled CSS. The token VALUES
    // live there too, inside the theme block `init` owns, so
    // `webjs ui init --preset <code>` repaints a fresh app: nothing in
    // app/layout.ts overrides them.
    await writeFile(join(publicDir, 'input.css'), `@import "tailwindcss";
@import "../styles/globals.css";

/* Scan app sources so their utility classes make it into the compiled bundle.
   Tailwind v4 auto-scans the project too; these @source lines are explicit. */
@source "../app/**/*.{ts,js}";
@source "../components/**/*.{ts,js}";
@source "../modules/**/*.{ts,js}";
@source "../lib/**/*.{ts,js}";

/* Base styles, on the kit's tokens. The light tokens are on :root and the
   dark ones on .dark, which the head script keeps in step with the saved
   choice or the OS. color-scheme switches on the same class, so native
   controls and scrollbars always match the tokens: with JavaScript off the
   page is light throughout rather than light tokens over dark controls. */
@layer base {
  :root { color-scheme: light; }
  :root.dark { color-scheme: dark; }
  body { @apply bg-background text-foreground font-sans antialiased; }
}

/* A fixed header leaves normal flow, so reserve its height (--header-h, in
   styles/globals.css) and stop an in-page #anchor jump (native, or the client
   router's scrollIntoView) below it. Keyed on the class, so pinning the navbar
   is a one-class edit. */
body:has(> header.fixed) { padding-top: var(--header-h); }
html:has(> body > header.fixed) { scroll-padding-top: var(--header-h); }

/* A navbar pinned from a breakpoint up (md:fixed md:inset-x-0 md:top-0)
   reserves its height from that breakpoint. @variant resolves each breakpoint
   from this app's theme, so a customized --breakpoint-* stays in step; a
   breakpoint you add under a new name needs its own line. */
body:has(> header[class~="sm:fixed"]) { @variant sm { padding-top: var(--header-h); } }
body:has(> header[class~="md:fixed"]) { @variant md { padding-top: var(--header-h); } }
body:has(> header[class~="lg:fixed"]) { @variant lg { padding-top: var(--header-h); } }
body:has(> header[class~="xl:fixed"]) { @variant xl { padding-top: var(--header-h); } }
body:has(> header[class~="2xl:fixed"]) { @variant 2xl { padding-top: var(--header-h); } }
html:has(> body > header[class~="sm:fixed"]) { @variant sm { scroll-padding-top: var(--header-h); } }
html:has(> body > header[class~="md:fixed"]) { @variant md { scroll-padding-top: var(--header-h); } }
html:has(> body > header[class~="lg:fixed"]) { @variant lg { scroll-padding-top: var(--header-h); } }
html:has(> body > header[class~="xl:fixed"]) { @variant xl { scroll-padding-top: var(--header-h); } }
html:has(> body > header[class~="2xl:fixed"]) { @variant 2xl { scroll-padding-top: var(--header-h); } }

/* App @theme mappings. The token VALUES live in styles/globals.css: the
   colours and fonts in its theme block (which webjs ui init --preset
   replaces), the app's own extras after it. These @theme inline maps turn the
   extras and the type scale into utilities (border-border-strong, text-display). */
@theme inline {
  --font-display: var(--font-display);
  --color-border-strong: var(--border-strong);
  --color-primary-tint: var(--primary-tint);
  --text-display: clamp(2.6rem, 1.6rem + 3.2vw, 4.25rem);
  --text-h1:      clamp(2rem, 1.5rem + 1.6vw, 2.85rem);
  --text-h2:      clamp(1.35rem, 1.15rem + 0.7vw, 1.7rem);
  --text-lede:    clamp(1.05rem, 0.95rem + 0.3vw, 1.2rem);
  /* Each size carries its line height (and, for the large steps, its
     tracking). Tailwind v4's text-* utility sets
     line-height: var(--tw-leading, var(--text-<name>--line-height)), so a
     size with no companion leaves an invalid value and the heading falls
     back to the body's 1.6, opening huge gaps between wrapped lines.
     A leading-* / tracking-* class on the element still wins. */
  --text-display--line-height: 1.04;
  --text-display--letter-spacing: -0.025em;
  --text-h1--line-height: 1.1;
  --text-h1--letter-spacing: -0.02em;
  --text-h2--line-height: 1.2;
  --text-lede--line-height: 1.55;
  --duration-fast: 140ms;
  --duration-slow: 380ms;
}
`);


  await writeFile(join(appDir, 'app', 'layout.ts'), `import { html, cspNonce, asset } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/theme-toggle.ts';

/**
 * Root layout: the ONLY file that writes the document shell. It wires a neutral
 * design-token palette, the light/dark theme, and the Tailwind stylesheet, then
 * renders \${children} in a bare container. Grow it in place: add a header, nav,
 * footer, or reading column here as your app needs them. Design tokens live as
 * plain CSS custom properties (they resolve with JavaScript disabled) and are
 * mapped into Tailwind via @theme in public/input.css, so bg-background,
 * text-foreground, bg-card, bg-primary, and border-border all work.
 */

// The favicon and manifest are app/icon.svg and app/manifest.webmanifest: the
// framework links them into <head> itself, so nothing is declared here. Replace
// the placeholder icon with this app's own.

// LayoutProps types every layout argument (children, params, searchParams,
// url) from the framework, so children is a TemplateResult rather than an
// untyped value. Derive types like this everywhere instead of widening to
// unknown.
export default function RootLayout({ children }: LayoutProps) {
  // Read the in-flight request's CSP nonce so the theme-detection inline script
  // passes strict CSP. Returns '' when no CSP nonce is set.
  const nonce = cspNonce();
  return html\`
    <script nonce="\${nonce}">
      // Light/dark theme, applied BEFORE first paint so a saved dark choice
      // never flashes light. This is the one thing that cannot be a component:
      // a component (the theme toggle included) upgrades only once its module
      // has loaded, after the first paint. <theme-toggle> takes over from there
      // (Lit's lifecycle), following the OS while the choice is "system". The
      // dark tokens and color-scheme both switch on the .dark class; data-theme
      // records a saved choice. With JavaScript off nothing sets .dark and the
      // page is light throughout. Delete this block for a single-theme app.
      (function(){
        try {
          var t = null;
          try { t = localStorage.getItem('webjs_theme'); } catch (_) {}
          var el = document.documentElement;
          if (t === 'light' || t === 'dark') el.dataset.theme = t;
          el.classList.toggle('dark', t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches));
        } catch (_) {}
      })();
    </script>
    <meta name="color-scheme" content="light">
    <!-- Geist for text and headings and Geist Mono for code, the webjs.dev/ui
         type. Swap these for your own fonts (and update --font-sans in
         styles/globals.css, or apply a preset with webjs ui init --preset,
         which prints the faces to load). -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@400;500;700&display=swap">
    <!-- Tailwind: a STATIC stylesheet compiled from public/input.css to
         public/tailwind.css by css:build (run automatically by the dev and start
         tasks; in dev it is also recompiled on request when a source changes, so
         it never goes stale). A real stylesheet, so the app is fully styled with
         JavaScript DISABLED (no in-browser compile).

         asset() adds a content hash in production (/tailwind.css?v=...)
         and the framework then serves it immutable for a year, so a deploy that
         changes the CSS changes the url and no browser or CDN can serve the old
         bytes. Mark the thing that FETCHES: do not wrap a <link rel="preload">
         whose asset is really fetched by an @font-face url() in the CSS, or the
         preload can never match the request and the file downloads twice. -->

    <link rel="stylesheet" href=\${asset('/tailwind.css')}>
    <!-- No style block here: the base styles, color-scheme and the pinned-header
         offset are in public/input.css, on the kit's tokens, and every token
         (the --header-h navbar height included) is in styles/globals.css. -->
    <!-- Top navbar, on every page: brand on the left, links + theme toggle on
         the right. It floats (no separator) and is in normal flow, so it just
         scrolls with the page. To pin it, add fixed inset-x-0 top-0 z-20 to its
         class (position: fixed, never sticky, which flickers on iOS during a nav).
         Its height is the --header-h token, so keep it one row: nothing measures
         it, which is what keeps the offset right after a client-router swap. -->
    <header class="max-w-5xl mx-auto px-4 sm:px-6 h-(--header-h) flex items-center justify-between gap-4">
      <a href="/" class="inline-flex items-center gap-2 no-underline text-foreground font-display font-bold tracking-tight">
        <span class="size-5.5 rounded-md bg-linear-to-br from-foreground to-muted-foreground" aria-hidden="true"></span>
        ${displayName}
      </a>
      <nav class="flex items-center gap-4 text-sm" aria-label="Primary">
        <a href="https://webjs.dev/docs" target="_blank" rel="noopener" class="hidden sm:inline text-muted-foreground hover:text-foreground no-underline transition-colors">Docs</a>
        <a href="https://github.com/webjsdev/webjs" target="_blank" rel="noopener" class="hidden sm:inline text-muted-foreground hover:text-foreground no-underline transition-colors">GitHub</a>
        <theme-toggle></theme-toggle>
      </nav>
    </header>
    <!-- Fill the viewport minus the navbar, so a short page has no spurious
         scrollbar (min-h-dvh alone would overflow by the navbar height). -->
    <main class="min-h-[calc(100dvh-var(--header-h))] max-w-5xl mx-auto px-4 sm:px-6 py-8">
      \${children}
    </main>
  \`;
}
`);

  // The example module: modules/<feature>/ holds a feature's server actions,
  // queries, components, utils and types, and the routes in app/ stay thin.
  // One tiny feature over the schema's users table: an action the home page
  // binds as a form, a server-only query it reads, a component that renders
  // the result, the types, and a test.
  await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
  await mkdir(join(appDir, 'modules', 'users', 'queries'), { recursive: true });
  await mkdir(join(appDir, 'modules', 'users', 'components'), { recursive: true });
  await writeFile(join(appDir, 'modules', 'users', 'components', 'user-list.ts'), `import { WebComponent, html } from '@webjsdev/core';
import type { User } from '../types.ts';

/**
 * The users feature's component, written as in Lit. The page passes the users
 * in as a property (.users=\${users}); a component never queries the database
 * itself, since it also runs in the browser.
 */
export class UserList extends WebComponent {
  static properties = { users: { type: Array } };
  declare users: User[];

  constructor() {
    super();
    this.users = [];
  }

  render() {
    if (this.users.length === 0) {
      return html\`<p class="text-sm text-muted-foreground m-0">No users yet. Add the first one above.</p>\`;
    }
    return html\`
      <ul class="grid gap-1 m-0 p-0 list-none text-sm text-muted-foreground">
        \${this.users.map((user) => html\`<li>\${user.email}</li>\`)}
      </ul>
    \`;
  }
}
UserList.register('user-list');
`);
  await writeFile(join(appDir, 'modules', 'users', 'types.ts'), `// The users feature's types, derived from the schema rather than written by hand.
export type { User } from '#db/schema.server.ts';
`);
  await writeFile(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts'), `import { desc } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import type { User } from '../types.ts';

// A query: server-only code (a .server.ts file with no 'use server'), called
// from a page, which runs on the server. Without 'use server' it is never
// callable from the browser. One function per file.
export async function listUsers(limit = 5): Promise<User[]> {
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}
`);
  await writeFile(join(appDir, 'modules', 'users', 'actions', 'add-user.server.ts'), `'use server';

import { revalidatePath } from '@webjsdev/server';
import type { ActionResult } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import type { User } from '../types.ts';

// A server action, bound by the home page as <form action=\${addUser}>, so it
// works with JavaScript off. A failure re-renders the page with this result on
// actionData; a success redirects back and revalidatePath('/') refreshes it.
// One function per file.
export async function addUser(formData: FormData): Promise<ActionResult<User>> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return { success: false, fieldErrors: { email: 'Enter a valid email address.' }, status: 422 };
  }
  try {
    const [user] = await db.insert(users).values({ email }).returning();
    revalidatePath('/');
    return { success: true, data: user };
  } catch {
    return { success: false, fieldErrors: { email: 'That email is already added.' }, status: 422 };
  }
}
`);
  await mkdir(join(appDir, 'test', 'users'), { recursive: true });
  await writeFile(join(appDir, 'test', 'users', 'add-user.test.ts'), `// The example module's test: the action against the test database, which
// \`webjs test\` prepares from db/schema.server.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUser } from '#modules/users/actions/add-user.server.ts';
import { listUsers } from '#modules/users/queries/list-users.server.ts';

const form = (email: string) => {
  const fd = new FormData();
  fd.set('email', email);
  return fd;
};

test('addUser refuses an invalid email', async () => {
  const result = await addUser(form('not-an-email'));
  assert.equal(result.success, false);
  assert.ok(result.fieldErrors?.email);
});

test('addUser adds a user, which listUsers then returns', async () => {
  const email = \`ada-\${Date.now()}@example.com\`;
  const result = await addUser(form(email));
  assert.equal(result.success, true);
  assert.ok((await listUsers()).some((u) => u.email === email));
});
`);

  // Home page: the logo, then the example module at work (a form bound to its
  // action, its component rendering what its query returns). Reshape it into the app's real landing page.
  await writeFile(join(appDir, 'app', 'page.ts'), `import { html, nothing } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { inputClass } from '#components/ui/input.ts';
import { labelClass } from '#components/ui/label.ts';
import { addUser } from '#modules/users/actions/add-user.server.ts';
import { listUsers } from '#modules/users/queries/list-users.server.ts';
import '#modules/users/components/user-list.ts';

export const metadata = {
  title: '${displayName}',
};

// A thin route: the data and the mutation live in modules/users/.
export default async function Home({ actionData }: PageProps) {
  const latest = await listUsers();
  const error = actionData?.fieldErrors?.email;
  return html\`
    <section class="py-16 flex flex-col items-center text-center gap-4">
      <!-- The WebJs logo, one file per theme (public/brand/), as the heading. -->
      <h1 class="m-0">
        <img src="/brand/webjs-lockup-on-light.svg" alt="WebJs" width="228" height="60" class="block h-15 w-auto dark:hidden">
        <img src="/brand/webjs-lockup-on-dark.svg" alt="WebJs" width="228" height="60" class="hidden h-15 w-auto dark:block">
      </h1>
      <p class="text-muted-foreground max-w-lg m-0">Your WebJs app starts here. Edit app/page.ts.</p>
    </section>
    <!-- The example module (modules/users/): replace it with your own features. -->
    <section class="mx-auto max-w-sm grid gap-4">
      <form action=\${addUser} class="grid gap-3">
        <div class="grid gap-2">
          <label class=\${labelClass()} for="email">Email</label>
          <input class=\${inputClass()} id="email" name="email" type="email" required
            aria-invalid=\${error ? 'true' : nothing} aria-describedby=\${error ? 'email-error' : nothing}>
          \${error ? html\`<p id="email-error" role="alert" class="text-sm text-destructive m-0">\${error}</p>\` : nothing}
        </div>
        <button class=\${buttonClass()} type="submit">Add user</button>
      </form>
      <user-list .users=\${latest}></user-list>
    </section>
  \`;
}
`);

  // AGENTS.md is copied via the `templateFiles` loop above, from
  // `packages/cli/templates/AGENTS.md` with `{{APP_NAME}}` substitution.

  // --- Theme toggle component ---

  await writeFile(join(appDir, 'components', 'theme-toggle.ts'), `import { WebComponent, html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';

type Theme = 'system' | 'light' | 'dark';

/**
 * <theme-toggle> is a light-DOM component styled with Tailwind utilities.
 *
 * Light DOM is the default: no static shadow = true, no static styles. It
 * is the UI kit's ghost icon Button (components/ui/button.ts), and it reacts
 * through Lit's APIs (reactive state, an @click binding, the connected /
 * disconnected lifecycle), never a <style> block or a document query. The
 * one DOM write is the .dark class on <html>, which is the theme switch
 * itself and no component renders.
 */
export class ThemeToggle extends WebComponent {
  // Lit's internal reactive state (its @state()): no attribute, re-renders on change.
  static properties = { theme: { state: true } };
  declare theme: Theme;
  #os: MediaQueryList | null = null;
  readonly #onOsChange = () => this.#apply();

  constructor() {
    super();
    this.theme = 'system';
  }

  connectedCallback() {
    super.connectedCallback();
    let saved: string | null = null;
    try { saved = localStorage.getItem('webjs_theme'); } catch {}
    this.theme = saved === 'light' || saved === 'dark' ? saved : 'system';
    // The head script in app/layout.ts applied the theme before paint; from
    // here the toggle keeps it current, following the OS while on "system".
    this.#os = window.matchMedia('(prefers-color-scheme: dark)');
    this.#os.addEventListener('change', this.#onOsChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#os?.removeEventListener('change', this.#onOsChange);
  }

  cycle() {
    const next: Theme = this.theme === 'system' ? 'light'
      : this.theme === 'light' ? 'dark' : 'system';
    this.theme = next;
    try {
      if (next === 'system') localStorage.removeItem('webjs_theme');
      else localStorage.setItem('webjs_theme', next);
    } catch {}
    this.#apply();
  }

  /** The tokens in styles/globals.css and color-scheme both switch on .dark; data-theme records a saved choice. */
  #apply() {
    const t = this.theme;
    const el = document.documentElement;
    if (t === 'system') delete el.dataset.theme;
    else el.dataset.theme = t;
    el.classList.toggle('dark', t === 'dark' || (t === 'system' && !!this.#os?.matches));
  }

  render() {
    const t = this.theme;
    const label = t === 'system' ? 'AUTO' : t === 'light' ? 'LIGHT' : 'DARK';
    const icon = t === 'light' ? ICONS.sun : t === 'dark' ? ICONS.moon : ICONS.system;
    return html\`
      <button
        type="button"
        class=\${buttonClass({ variant: 'ghost', size: 'icon' })}
        @click=\${() => this.cycle()}
        aria-label="Cycle theme (currently \${label})"
        title="Theme: \${label.toLowerCase()}"
      >\${icon}</button>
    \`;
  }
}

const ICONS = {
  sun: html\`<svg class="w-4 h-4 stroke-current fill-none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>\`,
  moon: html\`<svg class="w-4 h-4 stroke-current fill-none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>\`,
  system: html\`<svg class="w-4 h-4 stroke-current fill-none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 5h18v11H3zM8 20h8M12 16v4"/></svg>\`,
};

ThemeToggle.register('theme-toggle');
`);
  } // end if (!isApi)

  // AGENTS.md is already in place via the shared `templateFiles` loop
  // earlier in this function, so no framework-root fallback needed.

  // --- Git init + configure hooks directory ---
  const { execSync } = await import('node:child_process');
  try {
    execSync('git init', { cwd: appDir, stdio: 'pipe' });
    // Use the tracked .hooks/ dir (the pre-commit blocks commits to main).
    execSync('git config core.hooksPath .hooks', { cwd: appDir, stdio: 'pipe' });
  } catch { /* git not available: skip */ }

  // --- Print success ---

  const guide = 'AGENTS.md                     ← the agent brief';
  if (isApi) {
    console.log(`  ${name}/
    app/api/{health,users}/route.ts
    modules/users/{actions,queries,types.ts}   ← routes over server actions
    db/{schema,connection}.server.ts   ← Drizzle (User model)
    ${guide}
`);
  } else {
    console.log(`  ${name}/
    app/{layout,page}.ts          ← the starting page, grow it in place
    components/theme-toggle.ts
    public/input.css              ← Tailwind entry (compiles to public/tailwind.css)
    db/{schema,connection}.server.ts  ← Drizzle
    ${guide}
`);
  }
  console.log(`For AI agents, read this before editing:
  • Read AGENTS.md. Its brief is the whole difference from Next.js routing
    and Lit components; run 'npx webjs check' after each edit.
  • This scaffold is a minimal starting point, not a demo to prune. Grow the app
    in place: add routes under app/, components under components/, and features
    under modules/<feature>/, and keep server-only code behind .server.ts.
  • Use the wired-up database (Drizzle): define real models in
    db/schema.server.ts, then run 'npm run db:generate' and 'npm run db:migrate'.
    Never store app data in JSON files, in-memory arrays, or localStorage.
  • Full hosted docs are at https://webjs.dev/docs.
`);

  // Auto-install (default). Detect the package manager from the env so
  // pnpm / yarn / bun users get their own. Pass `--no-install` (or
  // `{ install: false }` to scaffoldApp) to opt out, e.g. for CI tests
  // that exercise the scaffold without paying the install cost.
  // In bun mode, install with bun regardless of the invoking PM, so the app
  // commits `bun.lock` (text JSONC, git-diffable) instead of `package-lock.json`
  // (#541). Otherwise honour the invoking PM (npm / pnpm / yarn / bun), and when
  // nothing invoked us through a package manager (a global `webjs` bin), the
  // lockfile of the enclosing project or workspace (#1494), so an app created
  // inside a bun workspace does not get a stray package-lock.json.
  const pm = isBun ? 'bun' : detectPackageManager({ cwd: dirname(appDir), prefer: 'agent' });
  let installed = false;
  let generatedMigration = false;
  if (shouldInstall) {
    console.log(`Running '${pm} install' in ${name}/ ...\n`);
    installed = runInstall(appDir, pm);
    if (!installed) {
      console.log(`\n[warn] ${pm} install failed. Run '${pm} install' manually in ${name}/ to finish setup.\n`);
    } else {
      // Author the initial migration NOW (drizzle-kit is installed), so the
      // shipped schema's tables exist and the very first `run dev` works with no
      // manual step (webjs.*.before applies the migration on boot). See runDbGenerate.
      console.log(`Authoring the initial database migration ('${pm} run db:generate') ...\n`);
      generatedMigration = runDbGenerate(appDir, pm);
      if (!generatedMigration) {
        console.log(`\n[warn] '${pm} run db:generate' failed. Run it manually in ${name}/ before '${pm} run dev'.\n`);
      }
    }
  }

  // Next-steps banner prints LAST so the actionable command is the
  // final thing on screen, never buried above the AI-agent guidance.
  // Single copy-paste line so the user can move from "scaffold done"
  // to "dev server up" in one command. The full-stack template ships
  // with @webjsdev/ui already initialised; the api template has no UI
  // but may add one later.
  const installSegment = installed ? '' : `${pm} install && `;
  // The shipped schema is applied on the first `run dev` (webjs.*.before runs
  // `db migrate`), but only if a migration FILE exists. When we installed, we
  // already authored it above (runDbGenerate), so the run command is just
  // `run dev`. Otherwise (--no-install, or generate failed) the user authors it
  // first: `db:generate` writes the migration from db/schema.server.ts, then
  // `run dev` applies it (Drizzle splits Prisma's `migrate dev` into
  // generate-then-migrate).
  const dbSegment = generatedMigration ? '' : `${pm} run db:generate && `;
  const runCommand = `cd ${name} && ${installSegment}${dbSegment}${pm} run dev`;
  // Postgres needs a reachable DATABASE_URL before any migrate (sqlite uses a
  // local file with no .env). Point it at a running database; `dev` / `start`
  // then apply pending migrations via webjs.*.before.
  const pgNote = dialect === 'postgres'
    ? `\nPostgres: set DATABASE_URL in .env to a running database before \`${pm} run dev\`.\nThe example URL names the database \`${dbName}\`. Create that database or edit the URL.\n`
    : '';
  // Use `npx webjsdev ui ...` here, not `npx webjs ui ...`. The bare
  // `webjs` npm name is owned by an unrelated package; `npx webjs
  // <cmd>` would fetch THAT package instead of ours when run outside
  // a project context. `webjsdev` is our unscoped CLI alias; npx's
  // single-bin fallback resolves it to the `webjs` binary, so behaviour
  // matches `@webjsdev/cli` exactly while keeping the command short
  // and unambiguous.
  // A Bun app runs one-off binaries with `bunx` (#1527).
  const x = isBun ? 'bunx' : 'npx';
  const uiNote = isApi
    ? `# If you later add a UI to this API project:
  #   ${x} webjsdev ui init && ${x} webjsdev ui add button card dialog`
    : `${x} webjsdev ui add <name>     # add more ui-* components later`;
  console.log(`
Next steps:
  ${runCommand}
  # → http://localhost:8080
${pgNote}
Optional:
  ${uiNote}
`);
}
