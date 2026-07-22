/**
 * `webjs create <name>`: scaffold a new WebJs app with opinionated defaults.
 *
 * Creates a directory with:
 *   - app/ with a root layout + page
 *   - modules/ skeleton
 *   - components/ with a theme toggle
 *   - test/unit/ and test/e2e/ with example tests
 *   - CONVENTIONS.md, AGENTS.md, CLAUDE.md
 *   - package.json with WebJs deps + test scripts
 *   - tsconfig.json for editor support
 */

import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { bunifyProse, bunifyDockerfile, bunifyCompose, bunifyCi } from './runtime-rewrite.js';
import { leanComponentSource } from './lean-copy.js';

/**
 * Detect which package manager invoked us. Reads `npm_config_user_agent`,
 * which npm / pnpm / yarn / bun all set when running scripts or `npx`.
 * Falls back to `npm` when nothing is detected (matches what most users
 * actually have installed).
 *
 * @returns {'npm'|'pnpm'|'yarn'|'bun'}
 */
function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm/')) return 'pnpm';
  if (ua.startsWith('yarn/')) return 'yarn';
  if (ua.startsWith('bun/')) return 'bun';
  return 'npm';
}

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
 * Read a single @webjsdev/ui registry component, rewrite its relative import
 * of `../lib/utils.ts` to the scaffolded app's aliased path so it resolves
 * when written to `components/ui/<name>.ts`. The scaffold puts cn() at
 * `lib/utils/cn.ts` (folder-grouped with other browser-safe helpers), so the
 * alias form is `#lib/utils/cn.ts` (#555/#556).
 *
 * @param {string} name  component name without `.ts` (e.g. 'button')
 * @returns {Promise<string>} source with import rewritten
 */
async function readUiComponent(name) {
  const src = join(UI_REGISTRY_ROOT, 'components', `${name}.ts`);
  const raw = await readFile(src, 'utf8');
  // The registry component imports cn() via a relative `../lib/utils.ts`; rewrite
  // it to the scaffolded app's aliased path (cn lives at lib/utils/cn.ts).
  const rewritten = raw
    .replaceAll("'../lib/utils.ts'", "'#lib/utils/cn.ts'")
    .replaceAll('"../lib/utils.ts"', '"#lib/utils/cn.ts"')
    // onBeforeCache lives in its own client-only module so cn() stays pure (#819).
    .replaceAll("'../lib/dom.ts'", "'#lib/utils/dom.ts'")
    .replaceAll('"../lib/dom.ts"', '"#lib/utils/dom.ts"');
  // Strip the worked @example from a Tier-1 helper (same as `webjs ui add`), so
  // the scaffolded component is lean and the example is served on demand. The
  // shared helper is used by the saas-template copier too, so they cannot drift.
  return leanComponentSource(rewritten, name);
}

/**
 * Copy a list of @webjsdev/ui registry components into the scaffolded app
 * under `components/ui/`. Throws if any name is missing from the registry,
 * since the scaffold's generated pages import these by name and a missing
 * file would produce ERR_MODULE_NOT_FOUND at first request. Caller must
 * have already invoked assertUiRegistryAvailable().
 *
 * @param {string} appDir  destination app root
 * @param {string[]} names list of component file basenames (without `.ts`)
 */
async function copyUiComponents(appDir, names) {
  const uiDir = join(appDir, 'components', 'ui');
  await mkdir(uiDir, { recursive: true });
  for (const n of names) {
    const src = join(UI_REGISTRY_ROOT, 'components', `${n}.ts`);
    if (!existsSync(src)) {
      throw new Error(
        `@webjsdev/ui registry is missing component '${n}.ts' at ${src}. ` +
        `The scaffold's example pages import this component by name. ` +
        `Either the registry was published incompletely or the scaffold's ` +
        `component list is out of sync with the registry.`,
      );
    }
    await writeFile(join(uiDir, `${n}.ts`), await readUiComponent(n));
  }
}

/**
 * Copy the example gallery (idiomatic, densely-commented working examples) into
 * the scaffolded app. Merges `templates/gallery/{app,modules}` over the app so
 * single-feature demos land under `app/features/<name>/`, whole example apps
 * under `app/examples/<name>/`, and their logic under `modules/<name>/`, the
 * app-thin + modules-logic split WebJs prescribes.
 *
 * Ships verbatim (no `{{APP_NAME}}` substitution): the examples are self-
 * contained and reference only `@webjsdev/*`, drizzle, `#db/*`, and each other.
 * The scaffold's own `app/page.ts` / `app/layout.ts` are written AFTER this and
 * the gallery ships neither, so there is no clobber. `cp` merges into existing
 * `app/` and `modules/` dirs rather than replacing them.
 *
 * @param {string} appDir
 */
async function copyGallery(appDir) {
  const galleryDir = join(TEMPLATES, 'gallery');
  for (const sub of ['app', 'modules']) {
    await cp(join(galleryDir, sub), join(appDir, sub), { recursive: true });
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

  // 2) components.json: the same shape `webjsui init` writes for webjs
  // projects (see packages/ui/src/utils/detect-project.js). The utils alias
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
  await writeFile(join(appDir, 'styles', 'globals.css'), css);
}

/**
 * Read the @webjsdev/ui theme CSS so we can write it into public/input.css,
 * which css:build compiles into the static public/tailwind.css the layout
 * links. The theme tokens (`--color-primary`, `--color-card`, …) the registry
 * components consume become real utility classes in the compiled stylesheet,
 * so the app is styled with JavaScript off.
 *
 * @returns {Promise<string>} theme CSS source
 */
async function readThemeCss() {
  const src = join(UI_REGISTRY_ROOT, 'themes', 'index.css');
  return await readFile(src, 'utf8');
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
  const template = opts.template || 'full-stack';
  // A human-friendly display title for the example home page. The npm `name`
  // stays the raw slug (lowercase, hyphenated), but showing a hyphenated slug as
  // a hero title looks unpolished, so title-case it for display ("my-app" ->
  // "My App"). Replace this with your real brand anyway.
  const displayName = name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // `install` is opt-in at the library level (so tests + programmatic
  // callers get a side-effect-free scaffold by default). The CLI entry
  // points (`webjs create` and `npx create-webjs-app`) explicitly set
  // `install: true` unless the user passes `--no-install`.
  const shouldInstall = opts.install === true;
  // Defence in depth. The CLI already validates this, but library
  // callers (tests, programmatic use) might pass anything.
  const VALID_TEMPLATES = ['full-stack', 'api', 'saas'];
  if (!VALID_TEMPLATES.includes(template)) {
    throw new Error(
      `Unknown template '${template}'. Only ${VALID_TEMPLATES.join(' / ')} exist.`,
    );
  }
  const isApi = template === 'api';
  const isSaas = template === 'saas';
  // The example gallery ships in every UI scaffold (full-stack AND saas). The
  // copyGallery gate below is !isApi, since only the api template has no UI. saas
  // overwrites db/schema.server.ts with its own schema (which includes the
  // gallery's todos table) and renders the gallery below its auth landing.
  // isFullStack distinguishes the plain full-stack app from saas for the parts
  // that differ (its own home page and the create.js-written schema).
  const isFullStack = !isApi && !isSaas;

  // Database dialect (#563): sqlite (default) or postgres. Drizzle is the ORM;
  // the schema/queries/actions are identical across dialects, only db/columns
  // + db/connection + the driver dep differ.
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
  const runtime = opts.runtime || (detectPackageManager() === 'bun' ? 'bun' : 'node');
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
      // The runtime-neutral tooling scripts below (test / db / check / typecheck
      // / doctor) stay plain `webjs ...`: they spawn node tooling (`node --test`,
      // drizzle-kit, tsc) and forcing `--bun` there buys nothing (and `webjs
      // test` shells `node --test`, which a `bun --test` would not be).
      // Compile Tailwind from public/input.css to a STATIC public/tailwind.css
      // that app/layout.ts links, so the app is fully styled with JavaScript
      // DISABLED (a real stylesheet, not an in-browser compile). Runs inside the
      // dev and start tasks via the `before` hooks below. Runtime-aware: a Bun
      // app runs the compiler under Bun (its image has no Node), a Node app runs
      // it directly.
      ...(isApi ? {} : { 'css:build': cssBuildCmd }),
      // Shed the demo gallery to a clean, buildable base (scripts/clear-gallery.mjs).
      ...(isApi ? {} : { 'gallery:clear': isBun ? 'bun scripts/clear-gallery.mjs' : 'node scripts/clear-gallery.mjs' }),
      dev: isBun ? 'bun --bun webjs dev' : 'webjs dev',
      start: isBun ? 'bun --bun webjs start' : 'webjs start',
      test: 'webjs test',
      'test:server': 'webjs test --server',
      'test:browser': 'webjs test --browser',
      check: 'webjs check',
      typecheck: 'webjs typecheck',
      // Onboarding/setup-verify: a contributor runs `npm run doctor` after
      // cloning to assert the toolchain (Node floor, tsconfig flag, env drift,
      // vendor pins, @webjsdev versions, git hook). Local tool, NOT a CI gate
      // (its env-drift + network pin-freshness checks would make CI flaky).
      doctor: 'webjs doctor',
      'db:generate': 'webjs db generate',
      'db:migrate': 'webjs db migrate',
      'db:push': 'webjs db push',
      'db:studio': 'webjs db studio',
      'db:seed': 'webjs db seed',
    },
    dependencies: {
      // Drizzle ORM (no codegen, no engine binary). Pinned to the 1.0 line
      // for relations v2. SQLite needs NO driver dependency: the connection
      // uses the built-in node:sqlite (Node) / bun:sqlite (Bun) via Drizzle's
      // node-sqlite / bun-sqlite adapters. Postgres still needs the pg driver.
      // Pinned EXACTLY (no caret): a caret on a prerelease still admits later
      // rc.N of 1.0.0, and the relations-v2 query API the scaffold is written and
      // tested against is rc.3 (#562). An exact pin keeps generated apps
      // deterministic instead of silently drifting to a newer rc.
      'drizzle-orm': '1.0.0-rc.3',
      ...(dialect === 'postgres' ? { pg: '^8.13.0' } : {}),
      '@webjsdev/cli': 'latest',
      '@webjsdev/core': 'latest',
      '@webjsdev/server': 'latest',
    },
    devDependencies: {
      'drizzle-kit': '1.0.0-rc.3',
      ...(dialect === 'postgres' ? { '@types/pg': '^8.11.0' } : {}),
      // The TypeScript compiler, for `npm run typecheck` (webjs typecheck runs
      // tsc --noEmit). Not needed at runtime (Node strips types in place), only
      // to type-check the app.
      typescript: '^5.6.0',
      '@types/node': '^24.0.0',
      '@web/test-runner': '^0.20.0',
      '@web/test-runner-playwright': '^0.11.0',
      'playwright': '^1.59.0',
      // The standard accessibility engine, used opt-in by the
      // assertNoA11yViolations() test helper from @webjsdev/core/testing.
      // Test-only: dynamically imported, never shipped to the app runtime.
      'axe-core': '^4.10.0',
      // The Tailwind v4 CLI that css:build runs to compile public/input.css into
      // the static public/tailwind.css the layout links. UI templates only (the
      // api template has no CSS). Build tooling, never shipped to the runtime.
      ...(isApi ? {} : { '@tailwindcss/cli': '^4.1.0' }),
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
    // Dev + start task orchestration (#550). `webjs dev` / `webjs start` read
    // `before` and run it in-process, so `npm run dev` / `start` (thin aliases
    // above) behave identically. Both apply pending migrations via `webjs db
    // migrate` (idempotent, a no-op when the db is current), so a freshly
    // generated migration is applied without a manual step (#725). For a UI
    // template it ALSO compiles Tailwind in `before` so a freshly cloned app is
    // styled on the very first boot with no manual step. The compile command is
    // the runtime-aware `cssBuildCmd` (a Bun app runs it under Bun, since its
    // image has no npm or Node), NOT `npm run css:build`. The api template has no
    // CSS, so it gets neither.
    //
    // In dev the static public/tailwind.css is kept fresh by `dev.regenerate`
    // (#967), NOT a background `tailwindcss --watch`. A watch that dies mid-
    // session or never starts serves stale/missing CSS with no error (a newly
    // added utility class has no backing rule, so the app renders unstyled
    // locally while prod is fine). `regenerate` instead recompiles ON REQUEST
    // when the output is older than a source (or missing): the framework rebuilds
    // it before serving `/public/tailwind.css`, so there is no watch process to
    // die and no staleness window. Same `cssBuildCmd` as prod, so dev and prod
    // resolve classes identically (nothing to diverge). `inputs` mirrors the
    // input.css @source globs (the dirs Tailwind scans for classes).
    webjs: {
      dev: {
        before: isApi ? ['webjs db migrate'] : ['webjs db migrate', cssBuildCmd],
        ...(isApi ? {} : {
          regenerate: [{
            output: 'public/tailwind.css',
            command: cssBuildCmd,
            inputs: ['app', 'components', 'modules', 'lib', 'public/input.css'],
          }],
        }),
      },
      start: { before: isApi ? ['webjs db migrate'] : ['webjs db migrate', cssBuildCmd] },
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
      'middleware.js',
      'middleware.ts',
      '.webjs/routes.d.ts',
    ],
    exclude: ['node_modules', '.webjs/vendor', 'db/migrations'],
  }, null, 2) + '\n');

  // --- Templates (AGENTS.md, CONVENTIONS.md, CLAUDE.md, test files, Claude hooks) ---

  const templateFiles = [
    // Single cross-agent source: a thin AGENTS.md points at the skill; the
    // .agents/rules workflow rules and the Claude enforcement hooks back it up.
    'AGENTS.md',
    'CONVENTIONS.md',
    '.agents/rules/workflow.md',
    // Per-agent files. Content is single-source (AGENTS.md + the skill); these
    // are thin bridges plus each tool's own config and commit-nudge hook. Claude
    // Code (CLAUDE.md @-imports AGENTS.md), Gemini CLI (GEMINI.md), Copilot in VS
    // Code (copilot-instructions.md). Cursor / opencode / Antigravity read
    // AGENTS.md natively; Cursor also gets a .cursorrules bridge, and each of
    // Cursor / Gemini / opencode ships a "commit often" nudge hook.
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursorrules',
    '.cursor/hooks.json',
    '.cursor/hooks/nudge-uncommitted.sh',
    '.gemini/settings.json',
    '.gemini/hooks/nudge-uncommitted.sh',
    '.opencode/plugins/nudge-uncommitted.ts',
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
    // CI runs webjs check + the test layers on every PR and push to main.
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
    'AGENTS.md', 'CLAUDE.md', 'CONVENTIONS.md', '.cursorrules',
    '.agents/rules/workflow.md',
    'test/hello/browser/hello.test.js', 'test/hello/e2e/hello.test.ts',
  ]);
  // compose.yaml builds from the (pure oven/bun) Dockerfile and inherits its
  // `bun --bun run start` CMD; only its healthcheck needs switching off node
  // (the pure Bun image has no node), which bunifyCompose does.
  const FILE_REWRITE = {
    'Dockerfile': bunifyDockerfile,
    'compose.yaml': bunifyCompose,
    '.github/workflows/ci.yml': bunifyCi,
  };
  for (const f of templateFiles) {
    const src = join(TEMPLATES, f);
    if (existsSync(src)) {
      // `gitignore` ships without a dot (npm strips a published `.gitignore`)
      // and is written to `.gitignore` in the generated app.
      const dest = f === 'gitignore' ? '.gitignore' : f;
      await mkdir(dirname(join(appDir, dest)), { recursive: true });
      let content = await readFile(src, 'utf8');
      content = content.replace(/\{\{APP_NAME\}\}/g, name);
      if (isBun) {
        if (PROSE_REWRITE.has(f)) content = bunifyProse(content);
        else if (FILE_REWRITE[f]) content = FILE_REWRITE[f](content);
      }
      await writeFile(join(appDir, dest), content);
    }
  }

  // The agent skill is the one cross-agent source (AGENTS.md points to it). It
  // lives ONCE, canonically, at the repo-root `.agents/skills/webjs/`. A
  // published CLI bundles it under `templates/` at prepack (see
  // scripts/sync-scaffold-skill.mjs, wired into this package's prepack), so copy
  // that bundle when present; in the monorepo the bundle is gitignored, so fall
  // back to the repo-root canonical.
  const bundledSkill = join(TEMPLATES, '.agents', 'skills', 'webjs');
  const repoRootSkill = resolve(__dirname, '..', '..', '..', '.agents', 'skills', 'webjs');
  const skillSrc = existsSync(bundledSkill) ? bundledSkill : repoRootSkill;
  if (existsSync(skillSrc)) {
    await cp(skillSrc, join(appDir, '.agents', 'skills', 'webjs'), { recursive: true });
  }

  // Make the Claude enforcement hooks + the git pre-commit executable.
  const { chmod } = await import('node:fs/promises');
  for (const hook of ['block-prose-punctuation.sh', 'block-raw-htmlelement.sh', 'guard-branch-context.sh', 'nudge-uncommitted.sh', 'commit-before-stop.sh', 'cleanup-merged-worktree.sh', 'require-tests-with-src.sh', 'check-server-imports.sh']) {
    const hookPath = join(appDir, '.claude', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  const preCommitPath = join(appDir, '.hooks', 'pre-commit');
  if (existsSync(preCommitPath)) await chmod(preCommitPath, 0o755);

  // --- Drizzle db layer (all templates), dialect-selected (#563) ---
  //
  // The schema, queries, and actions are identical across dialects; only
  // db/columns.server.ts + db/connection.server.ts + drizzle.config.ts + the
  // driver dep differ. Switching dialect (e.g. SQLite in dev, Postgres in
  // prod) is a config + module swap, not a code rewrite. Pinned to drizzle-orm
  // 1.0.0-rc.3 (relations v2). See research #562.

  const columnsSqlite = `import { sqliteTableCreator, integer, text, real, blob, index as _index } from 'drizzle-orm/sqlite-core';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { getTableName, type Table } from 'drizzle-orm';

// Raw drizzle builders, re-exported so the schema reads like drizzle.
export { text, integer, real, blob };

// Casing factory: column keys map to snake_case SQL names.
export const table = sqliteTableCreator((name) => name, 'snake_case');

export const pk = () => integer().primaryKey({ autoIncrement: true });
export const uuidPk = () => text().primaryKey().$defaultFn(() => crypto.randomUUID());
export const uuid = () => text();
// Structured value (array / object) stored as JSON. Type it with json<T>() so
// the column is narrowed on read/write instead of \`unknown\`.
export const json = <T>() => text({ mode: 'json' }).$type<T>();
export const bool = () => integer({ mode: 'boolean' });
export const timestamp = () => integer({ mode: 'timestamp_ms' });
export const createdAt = () => timestamp().notNull().defaultNow();
export const updatedAt = () => timestamp().notNull().defaultNow().$onUpdate(() => new Date());

// Anonymous-style index helper (rc.3 requires a name; this derives a
// table-qualified one, matching drizzle-kit's own convention).
export const index = (...cols: SQLiteColumn[]) =>
  _index(getTableName((cols[0] as unknown as { table: Table }).table) + '_' + cols.map((c) => c.name).join('_') + '_idx').on(...(cols as [SQLiteColumn, ...SQLiteColumn[]]));
`;

  const columnsPg = `import { pgTableCreator, serial, uuid as pgUuid, integer, text, real, boolean, jsonb, timestamp as pgTimestamp, index as _index } from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { getTableName, type Table } from 'drizzle-orm';

export { text, integer, real };

export const table = pgTableCreator((name) => name, 'snake_case');

export const pk = () => serial().primaryKey();
export const uuidPk = () => pgUuid().primaryKey().defaultRandom();
export const uuid = () => pgUuid();
// Structured value (array / object) stored as JSON. Type it with json<T>() so
// the column is narrowed on read/write instead of \`unknown\`.
export const json = <T>() => jsonb().$type<T>();
export const bool = () => boolean();
export const timestamp = () => pgTimestamp({ withTimezone: true });
export const createdAt = () => timestamp().notNull().defaultNow();
export const updatedAt = () => timestamp().notNull().defaultNow().$onUpdate(() => new Date());

export const index = (...cols: PgColumn[]) =>
  _index(getTableName((cols[0] as unknown as { table: Table }).table) + '_' + cols.map((c) => c.name).join('_') + '_idx').on(...(cols as [PgColumn, ...PgColumn[]]));
`;

  await writeFile(join(appDir, 'db', 'columns.server.ts'), dialect === 'postgres' ? columnsPg : columnsSqlite);

  // Example schema (dialect-agnostic). Replace the User model with your own.
  await writeFile(join(appDir, 'db', 'schema.server.ts'), `import { defineRelations } from 'drizzle-orm';
import { table, pk, ${isFullStack ? 'uuidPk, ' : ''}text, ${isFullStack ? 'bool, ' : ''}json, createdAt } from './columns.server.ts';

// Example model. Feel free to delete or extend.
export const users = table('users', {
  id: pk(),
  email: text().notNull().unique(),
  name: text(),
  // JSON column: a structured value persisted as JSON, typed via json<T>().
  // Same helper works on SQLite and Postgres. Delete if you do not need it.
  settings: json<{ theme?: string }>(),
  createdAt: createdAt(),
});
${isFullStack ? `
// Backs the example-gallery /examples/todo route (modules/todo). Delete it with
// the gallery when you prune the examples you do not use.
export const todos = table('todos', {
  id: uuidPk(),
  title: text().notNull(),
  completed: bool().notNull().default(false),
  createdAt: createdAt(),
});
` : ''}
// Relations live here (one defineRelations for the whole schema). Empty
// for now; add per-model relations as your schema grows.
export const relations = defineRelations({ users${isFullStack ? ', todos' : ''} }, () => ({}));

// Derived types, never hand-written.
export type User = typeof users.$inferSelect;
`);

  const connSqlite = `import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.server.ts';

// The only file that opens the driver. Runtime-neutral and ZERO native deps:
// built-in bun:sqlite on Bun, built-in node:sqlite on Node. Cached on
// globalThis across dev reloads.
// A relative SQLite path resolves against the app root (the parent of db/), not
// process.cwd(), so the connection works under \`webjs dev\` AND when the app is
// embedded via createRequestHandler from a different working directory.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';
const url = raw === ':memory:' || isAbsolute(raw) ? raw : resolve(appRoot, raw);
const g = globalThis as unknown as { __webjs_db?: unknown };

// Both node:sqlite and bun:sqlite default \`busy_timeout\` to 0, so a concurrent
// writer throws \`database is locked\` immediately. Restore a 5s wait (the old
// better-sqlite3 default) so contended access waits, and WAL so readers proceed
// alongside one writer.
function tune<T extends { exec(sql: string): unknown }>(client: T): T {
  client.exec('PRAGMA busy_timeout = 5000');
  client.exec('PRAGMA journal_mode = WAL');
  return client;
}

async function open() {
  if ((globalThis as { Bun?: unknown }).Bun) {
    // @ts-expect-error bun:sqlite is a Bun builtin with no Node typings
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: tune(new Database(url)), relations: schema.relations });
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  return drizzle({ client: tune(new DatabaseSync(url)), relations: schema.relations });
}

export const db = (g.__webjs_db ??= await open()) as Awaited<ReturnType<typeof open>>;
`;

  const connPg = `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.server.ts';

// The only file that opens the driver. Cached on globalThis across dev reloads.
const g = globalThis as unknown as { __webjs_db?: unknown };
function open() {
  return drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }), relations: schema.relations });
}
export const db = (g.__webjs_db ??= open()) as ReturnType<typeof open>;
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
  // copied (if present), idempotently.
  const dbUrlLine = dialect === 'postgres'
    ? 'DATABASE_URL=postgres://user:password@localhost:5432/' + name.replace(/[^a-z0-9_]/gi, '_')
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
    // The backend-features showcase (delete app/api/features + its modules to prune).
    features: {
      validate: \`\${base}/api/features/validate\`,
      'rate-limit': \`\${base}/api/features/rate-limit\`,
      stream: \`\${base}/api/features/stream\`,
      files: \`\${base}/api/features/files\`,
      ws: \`\${base.replace(/^http/, 'ws')}/api/features/ws\`,
    },
  });
}
`);
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await mkdir(join(appDir, 'modules', 'users', 'queries'), { recursive: true });

    await writeFile(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts'), `'use server';

// A GET server action (#488): a read declares its HTTP semantics via reserved
// sibling exports the framework reads statically. 'method' makes the call ride
// the URL (cacheable, ETag/304-aware, SSR-seeded on first paint); 'cache' is the
// max-age in seconds (private by default, do NOT add { public: true } unless the
// data is identical for EVERY visitor); 'tags' label the cached entry so a
// mutation can evict it. One function per file.
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
// evict on success, so the next listUsers() read refetches fresh instead of
// serving a stale browser-cached value. One function per file.
export const invalidates = () => ['users'];
export async function createUser(input: { name: string; email: string }) {
  // TODO: validate input, persist to database
  return { success: true, data: { id: Date.now().toString(), ...input } };
}
`);
    await writeFile(join(appDir, 'app', 'api', 'users', 'route.ts'), `/**
 * /api/users: thin route wrapper over typed server actions.
 * Business logic lives in modules/users/, not here.
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

    // The api backend-features showcase: endpoints under app/api/features/**
    // (the route() adapter + validation, rate limiting, streaming, file storage,
    // WebSockets + broadcast) that the root api index above links. The api
    // counterpart of the UI gallery. Prune what you skip.
    const { writeApiGallery } = await import('./api-gallery.js');
    await writeApiGallery(appDir);
  }

  if (!isApi) {
    // Full-stack and SaaS templates: layout + page + theme toggle + Tailwind

    // The Tailwind stylesheet is compiled from public/input.css (written below)
    // to a STATIC public/tailwind.css by css:build, and lib/utils/ui.ts helpers
    // are copied below, so the app boots with the exact blog example
    // architecture: light DOM + a real Tailwind stylesheet (styled with JS off)
    // + JS helpers.
    const publicDir = join(appDir, 'public');
    await mkdir(publicDir, { recursive: true });
    // Progressive-enhancement service worker (#271): ship the opt-in offline
    // primitive (the worker + its offline fallback) into the UI scaffolds
    // (full-stack / saas; this block is api-excluded since api has no UI).
    // Dormant until the app registers it (see the skill's references/service-worker.md);
    // it never changes the JS-disabled baseline.
    for (const swFile of ['sw.js', 'offline.html']) {
      const swSrc = join(TEMPLATES, 'public', swFile);
      if (existsSync(swSrc)) await cp(swSrc, join(publicDir, swFile));
    }
    // A base SVG favicon (the root layout links it). It ships with the app, not
    // the gallery, so it survives `npm run gallery:clear`.
    const faviconSrc = join(TEMPLATES, 'public', 'favicon.svg');
    if (existsSync(faviconSrc)) await cp(faviconSrc, join(publicDir, 'favicon.svg'));

    // The gallery-reset script (wired as `gallery:clear`). Only UI templates have
    // a gallery, so it ships here (NOT in the flat templateFiles list, which would
    // copy it into the api app where it has no gallery and would clobber app/).
    const clearScriptSrc = join(TEMPLATES, 'scripts', 'clear-gallery.mjs');
    if (existsSync(clearScriptSrc)) {
      await mkdir(join(appDir, 'scripts'), { recursive: true });
      await cp(clearScriptSrc, join(appDir, 'scripts', 'clear-gallery.mjs'));
    }

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

    // The saas auth pages import a few ui-* primitives. A full-stack app adds
    // any component on demand with `webjs ui add <name>`.
    if (isSaas) {
      await copyUiComponents(appDir, [
        'button', 'card', 'alert', 'badge', 'separator', 'label', 'input',
      ]);
    }

    // The @webjsdev/ui theme (`--color-primary`, `--color-card`, the @theme maps,
    // @custom-variant, @keyframes) plus the app @theme mappings are compiled from
    // public/input.css into the STATIC public/tailwind.css that app/layout.ts
    // links, so the app is fully styled with JavaScript disabled. Write input.css:
    // `@import "tailwindcss"`, source globs, the ui theme (read from the registry
    // themes/index.css), then the app @theme inline block. The token VALUES live
    // on :root in app/layout.ts (plain CSS, so they resolve with JS off) and the
    // @theme inline maps here reference them by var(), the same split the blog
    // uses. Same theme also lives at styles/globals.css for `webjsui` tooling.
    const uiThemeRaw = await readThemeCss();
    await writeFile(join(publicDir, 'input.css'), `@import "tailwindcss";

/* Scan app sources so their utility classes make it into the compiled bundle.
   Tailwind v4 auto-scans the project too; these @source lines are explicit. */
@source "../app/**/*.{ts,js}";
@source "../components/**/*.{ts,js}";
@source "../modules/**/*.{ts,js}";
@source "../lib/**/*.{ts,js}";

${uiThemeRaw}

/* App @theme mappings. The token VALUES live on :root in app/layout.ts (plain
   CSS custom properties, so they resolve with JavaScript disabled); these
   @theme inline maps turn them into utilities (bg-primary, text-display, ...). */
@theme inline {
  --color-border-strong: var(--border-strong);
  --color-primary-tint: var(--primary-tint);
  --font-sans:  var(--font-sans);
  --font-serif: var(--font-serif);
  --font-mono:  var(--font-mono);
  --text-display: clamp(2.6rem, 1.6rem + 3.2vw, 4.25rem);
  --text-h1:      clamp(2rem, 1.5rem + 1.6vw, 2.85rem);
  --text-h2:      clamp(1.35rem, 1.15rem + 0.7vw, 1.7rem);
  --text-lede:    clamp(1.05rem, 0.95rem + 0.3vw, 1.2rem);
  --duration-fast: 140ms;
  --duration-slow: 380ms;
}
`);

    // The gallery: idiomatic, densely-commented single-feature demos under
    // app/features/ plus one whole example app under app/examples/, with logic
    // in modules/, all linked from the home page below. Shipped in every UI
    // scaffold (full-stack AND saas) so an agent gains context by browsing real
    // working code; prune per-feature (delete the route + its module) for what
    // the app does not use.
    await copyGallery(appDir);

  await writeFile(join(appDir, 'app', 'layout.ts'), `import { html, cspNonce } from '@webjsdev/core';
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
export default function RootLayout({ children }: { children: unknown }) {
  // Read the in-flight request's CSP nonce so the theme-detection inline script
  // passes strict CSP. Returns '' when no CSP nonce is set.
  const nonce = cspNonce();
  return html\`
    <script nonce="\${nonce}">
      // Light/dark theme: read the saved or OS choice and set data-theme plus the
      // .dark class the tokens key off. Delete this block (and the light blocks
      // below) for a single-theme app.
      (function(){
        try {
          var mq = window.matchMedia('(prefers-color-scheme: light)');
          function apply(){
            var t = null;
            try { t = localStorage.getItem('webjs_theme'); } catch (_) {}
            var el = document.documentElement;
            if (t === 'light' || t === 'dark') el.dataset.theme = t;
            else delete el.dataset.theme;
            var dark = t === 'dark' || (t !== 'light' && !mq.matches);
            el.classList.toggle('dark', dark);
          }
          apply();
          mq.addEventListener('change', apply);
        } catch (_) {}
      })();
      // Header-measure: dormant until you add a fixed header. A fixed header
      // (use position:fixed, NOT sticky, which flickers on iOS WebKit during a
      // client-router nav) leaves normal flow, so --header-h reserves its height
      // for the content below. No header means a no-op and --header-h stays 0.
      (function(){
        function measure(){
          try {
            var hdr = document.querySelector('header');
            if (!hdr) return;
            var apply = function(){
              document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
            };
            apply();
            if (window.ResizeObserver) new ResizeObserver(apply).observe(hdr);
          } catch (_) {}
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', measure);
        else measure();
      })();
    </script>
    <meta name="color-scheme" content="light dark">
    <link rel="icon" href="/public/favicon.svg" type="image/svg+xml">
    <!-- JetBrains Mono for body/UI (its monospaced, developer-console feel) and
         Bricolage Grotesque for the display wordmark. Swap these for your own
         fonts (and update --font-sans / --font-display below). -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=JetBrains+Mono:wght@400;500;700&display=swap">
    <!-- Tailwind: a STATIC stylesheet compiled from public/input.css to
         public/tailwind.css by css:build (run automatically by the dev and start
         tasks; in dev it is also recompiled on request when a source changes, so
         it never goes stale). A real stylesheet, so the app is fully styled with
         JavaScript DISABLED (no in-browser compile). -->

    <link rel="stylesheet" href="/public/tailwind.css">
    <style>
      /* Design tokens. The token NAMES are infrastructure (public/input.css maps
         them into Tailwind via @theme). The VALUES are a cool neutral-grey palette
         with a monospaced type system: change them here to give the app its own
         look. bg-background / text-foreground / bg-card / bg-primary / border-border
         all resolve from these. */
      :root {
        --font-sans:  'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
        --font-serif: ui-serif, 'Iowan Old Style', Palatino, Georgia, serif;
        --font-mono:  'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
        --font-display: 'Bricolage Grotesque', 'JetBrains Mono', ui-sans-serif, system-ui, sans-serif;
        --header-h: 0px;
        /* A translucent tint of the primary, tracked automatically across
           light/dark. Used for focus rings (ring-primary-tint). */
        --primary-tint: color-mix(in srgb, var(--primary) 22%, transparent);
      }
      /* dark (the default, and the explicit .dark the toggle sets) */
      :root, .dark {
        color-scheme: dark;
        --background: #1e2226;
        --foreground: #dee2e6;
        --card: #313539;
        --card-foreground: #dee2e6;
        --popover: #313539;
        --popover-foreground: #dee2e6;
        --primary: #dee2e6;
        --primary-foreground: #1e2226;
        --secondary: #363a3e;
        --secondary-foreground: #dee2e6;
        --muted: #313539;
        --muted-foreground: #94989c;
        --accent: #363a3e;
        --accent-foreground: #f7fbff;
        --border: #34393e;
        --border-strong: #454b51;
        --input: #34393e;
        --ring: #6b7075;
      }
      /* light (explicit via the toggle) */
      :root[data-theme='light'] {
        color-scheme: light;
        --background: #dee2e6;
        --foreground: #313539;
        --card: #f0f4f7;
        --card-foreground: #313539;
        --popover: #f0f4f7;
        --popover-foreground: #313539;
        --primary: #313539;
        --primary-foreground: #f7fbff;
        --secondary: #f7fbff;
        --secondary-foreground: #313539;
        --muted: #eaeef1;
        --muted-foreground: #767b80;
        --accent: #f7fbff;
        --accent-foreground: #313539;
        --border: #c9d0d6;
        --border-strong: #b3bbc2;
        --input: #c9d0d6;
        --ring: #9aa0a5;
      }
      /* light (OS preference, when the user has made no explicit choice) */
      @media (prefers-color-scheme: light) {
        :root:not(.dark):not([data-theme='dark']) {
          color-scheme: light;
          --background: #dee2e6;
          --foreground: #313539;
          --card: #f0f4f7;
          --card-foreground: #313539;
          --popover: #f0f4f7;
          --popover-foreground: #313539;
          --primary: #313539;
          --primary-foreground: #f7fbff;
          --secondary: #f7fbff;
          --secondary-foreground: #313539;
          --muted: #eaeef1;
          --muted-foreground: #767b80;
          --accent: #f7fbff;
          --accent-foreground: #313539;
          --border: #c9d0d6;
          --border-strong: #b3bbc2;
          --input: #c9d0d6;
          --ring: #9aa0a5;
        }
      }
    </style>
    <style>
      /* Base styles utility classes can't reach. */
      html, body { margin: 0; }
      body {
        padding-top: var(--header-h);
        background: var(--background);
        color: var(--foreground);
        font: 15px/1.6 var(--font-sans);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    </style>
    <main class="min-h-dvh px-4 sm:px-6 py-8">
      \${children}
    </main>
  \`;
}
`);

  // Home page: a gallery index. A masthead, then a grid that links every feature
  // demo and the example app, and a footer with the docs + source links. Treat it
  // as a starting point: prune the demos you do not use (delete the
  // app/features/<x> route AND its modules/<x>), then reshape this page into the
  // app's real landing page. For the saas template a login/signup CTA row is
  // spliced under the tagline.
  const homeAuthLinks = isSaas
    ? '\n          <div class="flex flex-wrap gap-3 items-center justify-center mt-2"><a href="/login" class="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium no-underline hover:opacity-90">Log in</a><a href="/signup" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium no-underline hover:bg-accent">Create an account</a></div>'
    : '';
  await writeFile(join(appDir, 'app', 'page.ts'), `import { html } from '@webjsdev/core';

export const metadata = {
  title: '${displayName}',
};

// The gallery this page links. FEATURES are single-concept demos (one WebJs
// concept each, under app/features/, logic in modules/). EXAMPLES are whole apps
// composing several features (under app/examples/). Prune what you do not use
// (delete the route AND its modules/<name>), then reshape this page.
const FEATURES = [
  { href: '/features/routing', title: 'Routing', blurb: 'A static route plus a dynamic [id] segment that reads params. The file-based router in miniature.' },
  { href: '/features/boundaries', title: 'Boundaries', blurb: 'The control-flow throws (forbidden / unauthorized / notFound) and the nearest boundary file that catches each.' },
  { href: '/features/components', title: 'Components', blurb: 'The WebComponent factory, reactive props, instance signals, and slot projection in light DOM.' },
  { href: '/features/server-actions', title: 'Server actions', blurb: 'A use-server RPC action next to a server-only .server.ts utility, and why the boundary matters.' },
  { href: '/features/optimistic-ui', title: 'Optimistic UI', blurb: 'The imperative optimistic(signal, value, action) flip: instant update, automatic rollback on failure.' },
  { href: '/features/async-render', title: 'Async render', blurb: 'A component that awaits server data in async render(), so the resolved value is in the first paint.' },
  { href: '/features/streaming', title: 'Streaming actions', blurb: 'A use-server action that returns an async generator, streamed to the call site token by token with for await.' },
  { href: '/features/suspense', title: 'Suspense boundary', blurb: 'The <webjs-suspense> element: a first-paint fallback for a SLOW component, with the resolved content streamed in.' },
  { href: '/features/view-transitions', title: 'View transitions', blurb: 'The opt-in view-transition meta cross-fades a soft navigation, with a data-webjs-permanent element persisted across the swap.' },
  { href: '/features/directives', title: 'Directives', blurb: 'The lit-html directive set: repeat for keyed lists, watch(signal) for a fine-grained node swap.' },
  { href: '/features/route-handler', title: 'Route handlers', blurb: 'A server-only route.ts HTTP endpoint returning JSON, the WebJs equivalent of a Next route handler.' },
  { href: '/features/forms', title: 'Forms', blurb: 'A no-JS progressive-enhancement form posting to the page action, with server-side validation errors.' },
  { href: '/features/metadata', title: 'Metadata', blurb: 'Static metadata plus generateMetadata(ctx), which reads the request to compute the title and Open Graph tags.' },
  { href: '/features/caching', title: 'Caching', blurb: 'export const revalidate caches the page HTML per URL, with the safety rule for when a shared cache is allowed.' },
  { href: '/features/env', title: 'Env vars', blurb: 'The server-only vs WEBJS_PUBLIC_ boundary, read during SSR so secrets never reach the browser.' },
  { href: '/features/client-router', title: 'Client router', blurb: 'Automatic soft navigation: fragment-only fetches, hover prefetch, scroll restore, and graceful no-JS fallback.' },
  { href: '/features/frames', title: 'Frames', blurb: 'A webjs-frame region that swaps a filtered sub-list in place from a link, shipping zero component JS, with a no-JS full-nav fallback.' },
  { href: '/features/service-worker', title: 'Service worker', blurb: 'The opt-in offline enhancement, registered from a browser-only lifecycle hook (never a page or layout).' },
  { href: '/features/websockets', title: 'WebSockets', blurb: 'A WS(ws, req) route endpoint plus the connectWS() client, echoing messages over a live socket.' },
  { href: '/features/broadcast', title: 'Broadcast', blurb: 'Fan a message out to every connected client on a WebSocket path, so all open tabs stay in sync.' },
  { href: '/features/rate-limit', title: 'Rate limiting', blurb: 'The rateLimit() middleware scoped to one endpoint, returning a 429 with Retry-After past the window.' },
  { href: '/features/file-storage', title: 'File storage', blurb: 'A no-JS multipart upload streamed into the FileStore, then served back through a streaming route.' },
  { href: '/features/sessions', title: 'Sessions', blurb: 'A signed-cookie session applied by a segment middleware, read and written per visitor with getSession() in a route.' },
];
const EXAMPLES = [
  { href: '/examples/todo', title: 'Optimistic todo', blurb: 'A whole app composing several features: the declarative optimistic() list API, progressive-enhancement forms, accessible labels, the modules split, and SQLite.' },
];

export default function Home() {
  return html\`
    <div class="fixed top-4 right-4 z-10"><theme-toggle></theme-toggle></div>

    <div class="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center gap-16">
      <!-- Masthead -->
      <section class="flex flex-col items-center text-center gap-5">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground m-0">Welcome to</p>
        <h1 class="text-6xl sm:text-7xl font-bold uppercase tracking-tight leading-none m-0 break-words bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent" style="font-family: var(--font-display); word-spacing: 0.08em; letter-spacing: -0.02em;">
          WebJs Gallery
        </h1>
        <p class="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed m-0">
          AI-first and web-components-first. Server-rendered, progressively enhanced, and buildless.
        </p>${homeAuthLinks}
      </section>

      <!-- Gallery: every feature demo + the example app -->
      <section class="w-full flex flex-col gap-6">
        <div class="flex flex-col items-center gap-2 text-center">
          <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground m-0">Explore the gallery</h2>
          <p class="text-sm text-muted-foreground max-w-lg leading-relaxed m-0">
            One WebJs concept per demo under <code class="text-[0.9em] text-foreground">app/features/</code>, with logic
            in <code class="text-[0.9em] text-foreground">modules/</code>.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          \${FEATURES.map(f => html\`
            <a href="\${f.href}" class="group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 no-underline transition-colors hover:border-border-strong hover:bg-accent">
              <span class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-foreground">\${f.title}</span>
                <span class="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">&rarr;</span>
              </span>
              <span class="text-xs leading-relaxed text-muted-foreground">\${f.blurb}</span>
            </a>
          \`)}
        </div>
        \${EXAMPLES.map(e => html\`
          <a href="\${e.href}" class="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 no-underline transition-colors hover:border-border-strong hover:bg-accent">
            <span class="flex items-center gap-2.5">
              <span class="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground rounded border border-border px-1.5 py-0.5">Example app</span>
              <span class="text-sm font-medium text-foreground">\${e.title}</span>
              <span class="ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">&rarr;</span>
            </span>
            <span class="text-xs leading-relaxed text-muted-foreground">\${e.blurb}</span>
          </a>
        \`)}
      </section>

      <!-- Footer: docs + source -->
      <footer class="flex flex-col items-center gap-3">
        <nav class="flex items-center gap-6 text-sm text-muted-foreground" aria-label="WebJs links">
          <a href="https://docs.webjs.dev" class="inline-flex items-center gap-2 hover:text-foreground transition-colors no-underline">\${iconBook()}<span>Docs</span></a>
          <a href="https://github.com/webjsdev/webjs" class="inline-flex items-center gap-2 hover:text-foreground transition-colors no-underline">\${iconGithub()}<span>GitHub</span></a>
        </nav>
        <p class="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground m-0 text-center">
          Built with WebJs &middot; MIT License
        </p>
      </footer>
    </div>
  \`;
}

function iconBook() {
  return html\`<svg class="w-4 h-4 stroke-current fill-none" style="stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>\`;
}
function iconGithub() {
  return html\`<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>\`;
}
`);

  // AGENTS.md is copied via the `templateFiles` loop above, from
  // `packages/cli/templates/AGENTS.md` with `{{APP_NAME}}` substitution.

  // --- Theme toggle component ---

  await writeFile(join(appDir, 'components', 'theme-toggle.ts'), `import { WebComponent, html, signal } from '@webjsdev/core';

type Theme = 'system' | 'light' | 'dark';

/**
 * <theme-toggle> is a light-DOM component styled with Tailwind utilities.
 *
 * Light DOM is the default: no static shadow = true, no static styles.
 * Because this component has no custom CSS (only Tailwind classes,
 * which are already unique by construction), the class-prefix rule
 * doesn't apply here. If you ever add a <style> block, prefix every
 * selector with 'theme-toggle' (e.g. .theme-toggle__btn or
 * \`theme-toggle .btn\`).
 */
export class ThemeToggle extends WebComponent {
  theme = signal<Theme>('system');

  connectedCallback() {
    super.connectedCallback();
    let saved: string | null = null;
    try { saved = localStorage.getItem('webjs_theme'); } catch {}
    this.theme.set(saved === 'light' || saved === 'dark' ? saved : 'system');
  }

  cycle() {
    const t = this.theme.get();
    const next: Theme = t === 'system' ? 'light'
      : t === 'light' ? 'dark' : 'system';
    this.theme.set(next);
    try {
      if (next === 'system') localStorage.removeItem('webjs_theme');
      else localStorage.setItem('webjs_theme', next);
    } catch {}
    const el = document.documentElement;
    if (next === 'system') delete el.dataset.theme;
    else el.dataset.theme = next;
    // Keep the .dark class the @webjsdev/ui kit uses in sync so the ui-* components follow the theme.
    const dark = next === 'dark'
      || (next === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
    el.classList.toggle('dark', dark);
  }

  render() {
    const t = this.theme.get();
    const label = t === 'system' ? 'AUTO' : t === 'light' ? 'LIGHT' : 'DARK';
    const icon = t === 'light' ? ICONS.sun : t === 'dark' ? ICONS.moon : ICONS.system;
    return html\`
      <button
        class="inline-flex items-center justify-center w-9 h-9 p-0 border border-border rounded-full bg-card text-muted-foreground cursor-pointer transition-all duration-150 hover:text-foreground hover:border-border-strong active:scale-[0.94] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary-tint"
        @click=\${() => this.cycle()}
        aria-label="Cycle theme (currently \${label})"
        title="Theme: \${label.toLowerCase()}"
      >\${icon}</button>
    \`;
  }
}

const ICONS = {
  sun: html\`<svg class="w-4 h-4 stroke-current fill-none" style="stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>\`,
  moon: html\`<svg class="w-4 h-4 stroke-current fill-none" style="stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>\`,
  system: html\`<svg class="w-4 h-4 stroke-current fill-none" style="stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><path d="M3 5h18v11H3zM8 20h8M12 16v4"/></svg>\`,
};

ThemeToggle.register('theme-toggle');
`);
  } // end if (!isApi)

  // --- SaaS template extras: auth, dashboard, drizzle User model ---
  if (isSaas) {
    const { writeSaasFiles } = await import('./saas-template.js');
    await writeSaasFiles(appDir, { runtime });
  }

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

  const guide = 'AGENTS.md, .agents/skills/webjs/   ← the agent guide';
  if (isApi) {
    console.log(`  ${name}/
    app/api/{health,users}/route.ts
    modules/users/{actions,queries,types.ts}   ← routes over server actions
    db/{schema,columns,connection}.server.ts   ← Drizzle (User model)
    ${guide}
`);
  } else if (isSaas) {
    console.log(`  ${name}/
    app/{layout,page}.ts, login/, signup/
    app/dashboard/{page,settings,middleware}.ts  ← protected
    app/api/auth/[...path]/route.ts              ← auth API
    components/ui/*, components/theme-toggle.ts
    modules/auth/*, lib/{auth,password}.server.ts
    db/{schema,columns,connection}.server.ts     ← Drizzle (User model)
    ${guide}
`);
  } else {
    console.log(`  ${name}/
    app/{layout,page}.ts          ← a minimal home to grow in place
    components/theme-toggle.ts
    public/input.css              ← Tailwind entry (compiles to public/tailwind.css)
    db/{schema,columns,connection}.server.ts  ← Drizzle
    ${guide}
`);
  }
  console.log(`For AI agents, read this before editing:
  • Read AGENTS.md, then .agents/skills/webjs/SKILL.md. The skill is the guide
    to building a WebJs app and routes to focused references on demand.
  • This scaffold is a minimal starting point, not a demo to prune. Grow the app
    in place: add routes under app/, components under components/, and features
    under modules/<feature>/, and keep server-only code behind .server.ts.
  • Use the wired-up database (Drizzle): define real models in
    db/schema.server.ts, then run 'npm run db:generate' and 'npm run db:migrate'.
    Never store app data in JSON files, in-memory arrays, or localStorage.
  • Full hosted docs are at https://docs.webjs.dev.
`);

  // Auto-install (default). Detect the package manager from the env so
  // pnpm / yarn / bun users get their own. Pass `--no-install` (or
  // `{ install: false }` to scaffoldApp) to opt out, e.g. for CI tests
  // that exercise the scaffold without paying the install cost.
  // In bun mode, install with bun regardless of the invoking PM, so the app
  // commits `bun.lock` (text JSONC, git-diffable) instead of `package-lock.json`
  // (#541). Otherwise honour the invoking PM (npm / pnpm / yarn / bun).
  const pm = isBun ? 'bun' : detectPackageManager();
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
  // to "dev server up" in one command. The full-stack and saas
  // templates ship with @webjsdev/ui already initialised; the api
  // template has no UI but may add one later.
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
    ? `\nPostgres: copy .env.example to .env and set DATABASE_URL to a running database before \`${pm} run dev\`.\n`
    : '';
  // Use `npx webjsdev ui ...` here, not `npx webjs ui ...`. The bare
  // `webjs` npm name is owned by an unrelated package; `npx webjs
  // <cmd>` would fetch THAT package instead of ours when run outside
  // a project context. `webjsdev` is our unscoped CLI alias; npx's
  // single-bin fallback resolves it to the `webjs` binary, so behaviour
  // matches `@webjsdev/cli` exactly while keeping the command short
  // and unambiguous.
  const uiNote = isApi
    ? `# If you later add a UI to this API project:
  #   npx webjsdev ui init && npx webjsdev ui add button card dialog`
    : `npx webjsdev ui add <name>     # add more ui-* components later`;
  console.log(`
Next steps:
  ${runCommand}
  # → http://localhost:8080
${pgNote}
Optional:
  ${uiNote}
`);
}
