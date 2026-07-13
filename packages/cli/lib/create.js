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
  return raw
    .replaceAll("'../lib/utils.ts'", "'#lib/utils/cn.ts'")
    .replaceAll('"../lib/utils.ts"', '"#lib/utils/cn.ts"')
    // onBeforeCache lives in its own client-only module so cn() stays pure (#819).
    .replaceAll("'../lib/dom.ts'", "'#lib/utils/dom.ts'")
    .replaceAll('"../lib/dom.ts"', '"#lib/utils/dom.ts"');
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
 * Read the @webjsdev/ui theme CSS so we can inline it into the layout's
 * `<style type="text/tailwindcss">` block. The Tailwind browser runtime
 * picks up inline `<style type="text/tailwindcss">` content, so the theme
 * tokens (`--color-primary`, `--color-card`, …) the registry components
 * consume are available at runtime without a build step.
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
      // dev and start tasks via the `before` hooks below. The compiler is Node
      // tooling, so it stays plain even for a Bun app (like test / db / check).
      ...(isApi ? {} : { 'css:build': 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify' }),
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
    // template it ALSO compiles Tailwind (`css:build`) in `before` so a freshly
    // cloned app is styled on the very first boot with no manual step, and runs
    // the Tailwind `--watch` under `parallel` for live recompiles in dev. The
    // api template has no CSS, so it gets neither.
    webjs: {
      dev: {
        before: isApi ? ['webjs db migrate'] : ['webjs db migrate', 'npm run css:build'],
        ...(isApi ? {} : { parallel: ['tailwindcss -i ./public/input.css -o ./public/tailwind.css --watch'] }),
      },
      start: { before: isApi ? ['webjs db migrate'] : ['webjs db migrate', 'npm run css:build'] },
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
    'AGENTS.md',
    'CONVENTIONS.md',
    'CLAUDE.md',
    // A worked layout (header/nav/theme-toggle/reading-column/footer) the agent
    // reads to learn the patterns, since app/layout.ts ships as a minimal shell
    // so the app designs its own chrome. Shipped for every template (harmless
    // for api, which has no app/layout.ts).
    'LAYOUT-REFERENCE.md',
    // Starter tests under the new feature-folder layout.
    'test/hello/hello.test.ts',
    'test/hello/browser/hello.test.js',
    'test/hello/e2e/hello.test.ts',
    'web-test-runner.config.js',
    // Optional boot-time APM hook (setOnError). Delete if unused.
    'instrumentation.ts',
    // Environment variables
    '.env.example',
    // Project-level gitignore (node_modules, .webjs, .env, OS junk).
    // Shipped as `gitignore` (no dot) and renamed to `.gitignore` on copy:
    // npm STRIPS a `.gitignore` from a published tarball, so a dotfile name
    // would arrive missing and the app would ship without a `.env` ignore
    // (dogfood #845). The SQLite dev.db rule is appended programmatically
    // below so it only appears for the sqlite dialect.
    'gitignore',
    // Git hooks (blocks commits on main)
    '.hooks/pre-commit',
    // Claude Code config + hooks
    '.claude.json',
    '.claude/settings.json',
    '.claude/hooks/block-prose-punctuation.sh',
    '.claude/hooks/guard-branch-context.sh',
    '.claude/hooks/nudge-uncommitted.sh',
    '.claude/hooks/commit-before-stop.sh',
    '.claude/hooks/cleanup-merged-worktree.sh',
    '.claude/hooks/require-tests-with-src.sh',
    '.claude/hooks/check-server-imports.sh',
    '.claude/hooks/check-server-imports.mjs',
    // Render-and-look enforcement for UI work: a UserPromptSubmit router that
    // points UI-building prompts at the webjs-design-review skill, a Stop-hook
    // backstop that nudges a render-and-look before finishing UI changes, and
    // the skill they route to. A design/layout defect has no failing test, so
    // this vision-in-the-loop is the only thing that catches it.
    '.claude/hooks/route-skills.sh',
    '.claude/hooks/design-review-before-stop.sh',
    '.claude/skills/webjs-design-review/SKILL.md',
    // Gemini CLI config + hooks
    '.gemini/settings.json',
    '.gemini/hooks/nudge-uncommitted.sh',
    // Cursor config + hooks
    '.cursor/hooks.json',
    '.cursor/hooks/nudge-uncommitted.sh',
    // OpenCode plugins (loaded as TS by Bun at runtime)
    '.opencode/plugins/nudge-uncommitted.ts',
    // Antigravity workspace rules (Google's documented convention is
    // `.agents/rules/*.md`, lowercase, per the Codelab
    // "Build Autonomous Developer Pipelines using agents.md and skills.md
    // in Antigravity"). Replaced the legacy `.windsurfrules` ship when
    // Windsurf was acquired by Google.
    '.agents/rules/workflow.md',
    // Cross-agent config files
    '.cursorrules',
    '.github/copilot-instructions.md',
    '.github/pull_request_template.md',
    // CI is the test gate (the pre-commit hook only blocks main). Runs
    // webjs check + the unit / browser / e2e layers on every PR and push
    // to main, mirroring the WebJs framework's own CI.
    '.github/workflows/ci.yml',
    '.editorconfig',
    // VS Code: associate the published webjs-config JSON Schema with the
    // package.json `webjs` block, so an unknown / typo'd key (#259) is
    // flagged natively in the editor instead of silently dropped.
    '.vscode/settings.json',
    // Production / deploy scaffolding. `docker compose up --build` runs
    // the app locally with the same Dockerfile production builds from.
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
    'AGENTS.md', 'CONVENTIONS.md', '.cursorrules',
    '.agents/rules/workflow.md', '.github/copilot-instructions.md',
    // The starter tests carry header comments with run commands (`npx wtr`,
    // `npm i -D puppeteer-core`); bun-ify those too so a bun app's test files
    // do not tell the user to run npm/npx (#541 review). The transform only
    // touches npm/npx command tokens, so the test code itself is unaffected.
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

  // Make hook scripts executable
  const { chmod } = await import('node:fs/promises');
  for (const hook of ['block-prose-punctuation.sh', 'guard-branch-context.sh', 'nudge-uncommitted.sh', 'commit-before-stop.sh', 'cleanup-merged-worktree.sh', 'require-tests-with-src.sh', 'route-skills.sh', 'design-review-before-stop.sh']) {
    const hookPath = join(appDir, '.claude', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  for (const hook of ['nudge-uncommitted.sh']) {
    const hookPath = join(appDir, '.gemini', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  for (const hook of ['nudge-uncommitted.sh']) {
    const hookPath = join(appDir, '.cursor', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  // Make git pre-commit hook executable
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
    // demonstrating the server-side surface (route() adapter + validation, rate
    // limiting, streaming, file storage, WebSockets + broadcast) plus env
    // validation. The api counterpart of the UI gallery. Prune what you skip.
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
    // Dormant until the app registers it (see agent-docs/service-worker.md);
    // it never changes the JS-disabled baseline.
    for (const swFile of ['sw.js', 'offline.html']) {
      const swSrc = join(TEMPLATES, 'public', swFile);
      if (existsSync(swSrc)) await cp(swSrc, join(publicDir, swFile));
    }

    const utilsDir = join(appDir, 'lib', 'utils');
    await mkdir(utilsDir, { recursive: true });
    const uiSrc = join(TEMPLATES, 'lib', 'utils', 'ui.ts');
    if (existsSync(uiSrc)) {
      await cp(uiSrc, join(utilsDir, 'ui.ts'));
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

    // Copy the standard ui-* component kit the scaffold's example pages
    // use. Sources are read from packages/ui/packages/registry/ in this
    // monorepo. Users can `webjs ui add <name>` for anything else.
    await copyUiComponents(appDir, [
      'button', 'card', 'alert', 'badge', 'separator', 'label', 'input',
    ]);

    // The gallery: idiomatic, densely-commented single-feature demos under
    // app/features/ plus one whole example app under app/examples/, with logic
    // in modules/, linked from the home page. Shipped in the default full-stack
    // scaffold so an agent gains context by browsing real code; prune
    // per-feature (delete the route + its module) for what the app does not
    // use. See CONVENTIONS.md "prune what the app does not use".
    if (!isApi) await copyGallery(appDir);

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

  await writeFile(join(appDir, 'app', 'layout.ts'), `import { html, cspNonce } from '@webjsdev/core';
import '#components/theme-toggle.ts';
// Webjs UI components are tiered:
//   - Tier 1 (button, card, input, label, alert, badge, separator, etc.) are
//     class-helper FUNCTIONS, with no custom element to register. Each page
//     imports the specific helpers it needs (e.g.
//     \`import { buttonClass } from '#components/ui/button.ts'\`).
//   - Tier 2 (dialog, popover, tooltip, tabs, accordion, etc.) ARE custom
//     elements. Register them by side-effect-importing here once so they
//     work transitively across every page:
//       import '#components/ui/dialog.ts';
// The example app/page.ts below uses only Tier-1 helpers, so nothing
// extra needs to be registered. Add Tier-2 imports as you 'webjs ui add'.

/**
 * Root layout: globals + a minimal shell.
 *
 * Light DOM + Tailwind by default. Design tokens live in :root and are
 * mapped into the Tailwind palette via @theme, so classes like
 * text-foreground, bg-card, font-serif, duration-fast, text-display all work.
 *
 * This shell is deliberately MINIMAL: it wires the theme, tokens, and Tailwind,
 * then renders \${children} in a bare container with no chrome, so you design the
 * app's own layout. LAYOUT-REFERENCE.md (project root) is a complete worked
 * layout (header, nav, theme toggle, reading column, footer) to learn from.
 */

export default function RootLayout({ children }: { children: unknown }) {
  // Read the in-flight request's CSP nonce so the theme-detection
  // inline script below passes strict CSP (script-src 'nonce-...').
  // Returns '' when no CSP nonce is set, in which case the attribute
  // is empty and the browser ignores it.
  const nonce = cspNonce();
  return html\`
    <script nonce="\${nonce}">
      // ===== OPTIONAL: light/dark theme apparatus (remove as one unit) =====
      // This IIFE reads the saved or OS theme and toggles the data-theme
      // attribute plus the dark class the ui kit reads, so the token VALUES in
      // the root, dark, and data-theme style blocks below switch. It is what
      // makes the app theme-aware. Building a SINGLE-theme app of your own?
      // Delete this IIFE, delete the dark and light style blocks below, and set
      // your palette once on the root selector. That removes the wiring so it
      // cannot fight your own colours (it will not override a plain root
      // palette). The header-measure IIFE that follows is unrelated, keep it
      // (it is dormant until you add a fixed header, per LAYOUT-REFERENCE.md).
      (function(){
        try {
          var mq = window.matchMedia('(prefers-color-scheme: light)');
          function apply(){
            var t = null;
            try { t = localStorage.getItem('webjs_theme'); } catch (_) {}
            var el = document.documentElement;
            if (t === 'light' || t === 'dark') el.dataset.theme = t;
            else delete el.dataset.theme;
            // Keep the .dark class the @webjsdev/ui kit uses in sync with the effective theme so the
            // copied ui-* components (button, card, etc.) follow light/dark too.
            // Dark is the default unless the OS prefers light or 'light' is set.
            var dark = t === 'dark' || (t !== 'light' && !mq.matches);
            el.classList.toggle('dark', dark);
          }
          apply();
          mq.addEventListener('change', apply);
        } catch (_) {}
      })();
      // ===== end optional theme apparatus =====
      // Header-measure script: DORMANT until you add a fixed header (the minimal
      // shell has none). When you add one (see LAYOUT-REFERENCE.md), make it
      // position:fixed (NOT sticky: a sticky header flickers on iOS WebKit during
      // a client-router nav). fixed leaves normal flow, so --header-h reserves its
      // height for the content below; this measures the real (responsive) height.
      // With no header it is a no-op (querySelector returns null) and --header-h
      // stays 0, so there is no phantom gap.
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
    <!-- Tailwind: a STATIC stylesheet compiled from public/input.css to
         public/tailwind.css by css:build / css:watch (run automatically by the
         dev and start tasks). A real stylesheet, so the app is fully styled with
         JavaScript DISABLED (no in-browser compile). -->
    <link rel="stylesheet" href="/public/tailwind.css">
    <style>
      /* ONE theme, canonical shadcn-style tokens. These are the token VALUES as
         plain CSS custom properties, so the palette resolves with JavaScript
         DISABLED and needs no build. public/input.css holds the token STRUCTURE
         and the @theme inline mappings that generate
         bg-background, text-foreground, bg-card, bg-primary, bg-accent,
         text-muted-foreground, border-border, ring-ring, and the rest. Here we
         set those tokens' VALUES to this app's brand palette, so the ui-*
         components AND your own chrome read ONE source of truth. Any component
         added later with webjs ui add <name> inherits it automatically. The
         stylesheet is linked before this block, so these VALUES win over the ui
         theme defaults. Dark-first, with light via the theme toggle (data-theme) or the
         OS. Follows the shadcn model: --primary is the BRAND color (orange, used
         for primary buttons, links, and emphasis), while --accent stays a NEUTRAL
         hover tint so the ui kit's outline/ghost/dropdown hover states keep proper
         contrast. Use bg-primary / text-primary for brand, bg-accent for hovers.
         Add a new design token the canonical way, a --x VALUE below plus a
         --color-x: var(--x) line in the @theme inline block in public/input.css,
         then use it as bg-x / text-x. Reach for opacity modifiers
         (bg-primary/10, hover:bg-primary/90, border-border/60) before inventing a
         new token, but keep body text at full opacity so it stays above the AA
         contrast floor (a faded text-muted-foreground/70 measured 3.83:1). */
      :root {
        --font-sans:  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --font-serif: ui-serif, 'Iowan Old Style', Palatino, Georgia, serif;
        --font-mono:  ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        /* 0 by default because the minimal shell has no fixed header. The
           header-measure script below overrides it to the real height the moment
           you add a fixed header element (see LAYOUT-REFERENCE.md), so body
           padding tracks it automatically. */
        --header-h: 0px;
        /* A translucent brand tint, derived from --primary so it tracks
           light/dark automatically. Used for the logo glow and focus ring. */
        --primary-tint: color-mix(in oklch, var(--primary) 20%, transparent);
      }
      /* webjs-scaffold-placeholder. These are the scaffold's STARTER brand colors (the shadcn-style orange); they look finished on purpose. Own the palette: set the token VALUES below (dark AND light blocks) to colors that fit what THIS app IS, keeping the token NAMES. A recolor chosen for the app beats keeping the starter orange. Then delete this marker line (or run webjs check --clear-placeholders to keep the starter palette deliberately). webjs check fails while the marker remains. */
      /* dark (the default, and the explicit .dark the toggle sets) */
      :root, .dark {
        color-scheme: dark;
        --background: oklch(0.14 0.01 55);
        --foreground: oklch(0.96 0.015 60);
        --card: oklch(0.18 0.01 55);
        --card-foreground: oklch(0.96 0.015 60);
        --popover: oklch(0.18 0.01 55);
        --popover-foreground: oklch(0.96 0.015 60);
        /* --primary is the orange BRAND color (shadcn model: primary = brand). */
        --primary: oklch(0.7 0.16 52);
        --primary-foreground: oklch(0.17 0.02 52);
        --secondary: oklch(0.22 0.01 55);
        --secondary-foreground: oklch(0.96 0.015 60);
        --muted: oklch(0.16 0.01 55);
        --muted-foreground: oklch(0.72 0.02 60);
        /* --accent stays a NEUTRAL hover tint (shadcn model), so the ui kit's
           outline/ghost/dropdown hover states keep proper contrast. */
        --accent: oklch(0.27 0.008 55);
        --accent-foreground: oklch(0.96 0.015 60);
        --border: oklch(0.26 0.012 55 / 0.9);
        --border-strong: oklch(0.38 0.012 55 / 0.9);
        --input: oklch(0.26 0.012 55 / 0.9);
        --ring: oklch(0.7 0.16 52);
        --logo-from: oklch(0.8 0.16 58);
        --logo-to: oklch(0.62 0.18 44);
      }
      /* light (explicit via the toggle) */
      :root[data-theme='light'] {
        color-scheme: light;
        --background: oklch(0.985 0.008 80);
        --foreground: oklch(0.18 0.015 60);
        --card: oklch(1 0 0);
        --card-foreground: oklch(0.18 0.015 60);
        --popover: oklch(1 0 0);
        --popover-foreground: oklch(0.18 0.015 60);
        --primary: oklch(0.54 0.16 52);
        --primary-foreground: oklch(1 0 0);
        --secondary: oklch(0.96 0.008 80);
        --secondary-foreground: oklch(0.18 0.015 60);
        --muted: oklch(0.96 0.008 80);
        --muted-foreground: oklch(0.42 0.02 65);
        --accent: oklch(0.955 0.006 80);
        --accent-foreground: oklch(0.18 0.015 60);
        --border: oklch(0.88 0.01 75 / 0.95);
        --border-strong: oklch(0.78 0.01 75 / 0.95);
        --input: oklch(0.88 0.01 75 / 0.95);
        --ring: oklch(0.54 0.16 52);
        --logo-from: oklch(0.63 0.17 50);
        --logo-to: oklch(0.44 0.11 52);
      }
      /* light (OS preference, when the user has made no explicit choice) */
      @media (prefers-color-scheme: light) {
        :root:not(.dark):not([data-theme='dark']) {
          color-scheme: light;
          --background: oklch(0.985 0.008 80);
          --foreground: oklch(0.18 0.015 60);
          --card: oklch(1 0 0);
          --card-foreground: oklch(0.18 0.015 60);
          --popover: oklch(1 0 0);
          --popover-foreground: oklch(0.18 0.015 60);
          --primary: oklch(0.54 0.16 52);
          --primary-foreground: oklch(1 0 0);
          --secondary: oklch(0.96 0.008 80);
          --secondary-foreground: oklch(0.18 0.015 60);
          --muted: oklch(0.96 0.008 80);
          --muted-foreground: oklch(0.42 0.02 65);
          --accent: oklch(0.955 0.006 80);
          --accent-foreground: oklch(0.18 0.015 60);
          --border: oklch(0.88 0.01 75 / 0.95);
          --border-strong: oklch(0.78 0.01 75 / 0.95);
          --input: oklch(0.88 0.01 75 / 0.95);
          --ring: oklch(0.54 0.16 52);
          --logo-from: oklch(0.63 0.17 50);
          --logo-to: oklch(0.44 0.11 52);
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
        font: 16px/1.65 var(--font-sans);
        -webkit-font-smoothing: antialiased;
      }
      ::selection { background: color-mix(in oklch, var(--primary) 22%, transparent); color: var(--foreground); }
    </style>

    <!-- webjs-scaffold-placeholder. MINIMAL SHELL, on purpose. Everything above (the theme apparatus, the design tokens, the linked Tailwind stylesheet) is infrastructure to keep. Below, \${children} drops into a bare full-height container with NO chrome: design THIS app's layout from scratch. Decide from what the app IS whether it needs a header, a nav, a footer, a sidebar, a centered reading column, or a full-bleed canvas, and build that here. A COMPLETE reference layout (fixed header, brand, nav, theme toggle, reading column, footer) ships at LAYOUT-REFERENCE.md in the project root: read it to learn the patterns, then write your own. Delete this line once your layout is designed. webjs check fails while the marker remains. -->
    <main class="min-h-dvh px-4 sm:px-6 py-8">
      \${children}
    </main>
  \`;
}
`);

  // The gallery-index home (links every feature demo + the example app) ships
  // only in the full-stack scaffold, which is the only one that ships the
  // gallery. saas gets its own landing below.
  if (isFullStack) {
  await writeFile(join(appDir, 'app', 'page.ts'), `// webjs-scaffold-placeholder. This is the example homepage. Replace it with your app's real page, then delete this line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import { rubric, displayH1, accentLink } from '#lib/utils/ui.ts';
import { buttonClass } from '#components/ui/button.ts';
import { badgeClass } from '#components/ui/badge.ts';
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  cardDescriptionClass,
} from '#components/ui/card.ts';

export const metadata = {
  title: '${displayName}: built with webjs',
};

// Two kinds of reference the scaffold ships. FEATURES are single-concept demos
// (one WebJs feature each, under app/features/, logic in modules/). EXAMPLES are
// whole apps that compose several features (under app/examples/). Prune what you
// do not use (delete the route AND its modules/<name>), then reshape this page.
const features = [
  { href: '/features/routing', title: 'Routing', blurb: 'A static route plus a dynamic [id] segment that reads params. The file-based router in miniature.' },
  { href: '/features/boundaries', title: 'Boundaries', blurb: 'The control-flow throws (forbidden / unauthorized / notFound) and the nearest boundary file that catches each.' },
  { href: '/features/components', title: 'Components', blurb: 'The WebComponent factory, reactive props, instance signals, and slot projection in light DOM.' },
  { href: '/features/server-actions', title: 'Server actions', blurb: 'A use-server RPC action next to a server-only .server.ts utility, and why the boundary matters.' },
  { href: '/features/optimistic-ui', title: 'Optimistic UI', blurb: 'The imperative optimistic(signal, value, action) flip: instant update, automatic rollback on failure.' },
  { href: '/features/async-render', title: 'Async render', blurb: 'A component that awaits server data in async render(), so the resolved value is in the first paint.' },
  { href: '/features/directives', title: 'Directives', blurb: 'The lit-html directive set: repeat for keyed lists, watch(signal) for a fine-grained node swap.' },
  { href: '/features/route-handler', title: 'Route handlers', blurb: 'A server-only route.ts HTTP endpoint returning JSON, the webjs equivalent of a Next route handler.' },
  { href: '/features/forms', title: 'Forms', blurb: 'A no-JS progressive-enhancement form posting to the page action, with server-side validation errors.' },
  { href: '/features/metadata', title: 'Metadata', blurb: 'Static metadata plus generateMetadata(ctx), which reads the request to compute the title and Open Graph tags.' },
  { href: '/features/caching', title: 'Caching', blurb: 'export const revalidate caches the page HTML per URL, with the safety rule for when a shared cache is allowed.' },
  { href: '/features/env', title: 'Env vars', blurb: 'The server-only vs WEBJS_PUBLIC_ boundary, read during SSR so secrets never reach the browser.' },
  { href: '/features/client-router', title: 'Client router', blurb: 'Automatic soft navigation: fragment-only fetches, hover prefetch, scroll restore, and graceful no-JS fallback.' },
  { href: '/features/service-worker', title: 'Service worker', blurb: 'The opt-in offline enhancement, registered from a browser-only lifecycle hook (never a page or layout).' },
  { href: '/features/websockets', title: 'WebSockets', blurb: 'A WS(ws, req) route endpoint plus the connectWS() client, echoing messages over a live socket.' },
  { href: '/features/broadcast', title: 'Broadcast', blurb: 'Fan a message out to every connected client on a WebSocket path, so all open tabs stay in sync.' },
  { href: '/features/rate-limit', title: 'Rate limiting', blurb: 'The rateLimit() middleware scoped to one endpoint, returning a 429 with Retry-After past the window.' },
  { href: '/features/file-storage', title: 'File storage', blurb: 'A no-JS multipart upload streamed into the FileStore, then served back through a streaming route.' },
  { href: '/features/sessions', title: 'Sessions', blurb: 'A signed-cookie session applied by a segment middleware, read and written per visitor with getSession() in a route.' },
];
const examples = [
  { href: '/examples/todo', title: 'Optimistic todo', blurb: 'A whole app composing several features: the declarative optimistic() list API, progressive-enhancement forms, accessible labels, the modules split, and SQLite.' },
];

const galleryCard = (item: { href: string; title: string; blurb: string }) => html\`
  <a href=\${item.href} class="block no-underline">
    <div class="\${cardClass()} h-full transition-colors hover:border-border-strong">
      <div class=\${cardHeaderClass()}>
        <h3 class=\${cardTitleClass()}>\${item.title}</h3>
        <p class=\${cardDescriptionClass()}>\${item.blurb}</p>
      </div>
    </div>
  </a>
\`;

export default function Home() {
  return html\`
    <section class="mb-14">
      \${rubric('welcome')}
      \${displayH1(html\`Hello from <span class="text-primary italic">${displayName}</span>.\`)}
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        This WebJs scaffold ships a gallery below: single-feature demos and one
        whole example app, all small, idiomatic, and heavily commented. Browse
        them for context, then replace this page with your own. See
        \${accentLink('https://docs.webjs.dev', 'the docs')} for the full reference.
      </p>
      <div class="flex gap-3 items-center">
        <a href="/examples/todo" class=\${buttonClass()}>Open the todo app</a>
        <span class=\${badgeClass({ variant: 'secondary' })}>v0.1</span>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="font-serif text-[1.6rem] tracking-[-0.02em] font-bold m-0 mb-1">Features</h2>
      <p class="text-muted-foreground text-sm m-0 mb-5">
        One webjs concept each, under <code class="font-mono text-[0.9em]">app/features/</code>
        with logic in <code class="font-mono text-[0.9em]">modules/</code>. Delete the ones you do not need.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        \${features.map(galleryCard)}
      </div>
    </section>

    <section>
      <h2 class="font-serif text-[1.6rem] tracking-[-0.02em] font-bold m-0 mb-1">Example apps</h2>
      <p class="text-muted-foreground text-sm m-0 mb-5">
        Whole apps that compose several features, under <code class="font-mono text-[0.9em]">app/examples/</code>.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        \${examples.map(galleryCard)}
      </div>
    </section>
  \`;
}
`);
  } else {
    // saas home: the auth landing (hero + login/signup/dashboard) stays the
    // headline, and the WebJs feature gallery sits BELOW it, so a saas app is
    // also a learning surface. Keep the `features` list in sync with the
    // full-stack home above (both ship the same gallery).
    await writeFile(join(appDir, 'app', 'page.ts'), `// webjs-scaffold-placeholder. This is the example homepage. Replace it with your app's real landing page, then delete this line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import { rubric, displayH1, accentLink } from '#lib/utils/ui.ts';
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  cardDescriptionClass,
} from '#components/ui/card.ts';

export const metadata = {
  title: '${displayName}: built with webjs',
};

// The WebJs feature gallery, shown below the auth landing. FEATURES are
// single-concept demos (under app/features/, logic in modules/); EXAMPLES are
// whole apps (under app/examples/). Prune what you do not use (delete the route
// AND its modules/<name>). Keep this list in sync with the full-stack home.
const features = [
  { href: '/features/routing', title: 'Routing', blurb: 'A static route plus a dynamic [id] segment that reads params. The file-based router in miniature.' },
  { href: '/features/boundaries', title: 'Boundaries', blurb: 'The control-flow throws (forbidden / unauthorized / notFound) and the nearest boundary file that catches each.' },
  { href: '/features/components', title: 'Components', blurb: 'The WebComponent factory, reactive props, instance signals, and slot projection in light DOM.' },
  { href: '/features/server-actions', title: 'Server actions', blurb: 'A use-server RPC action next to a server-only .server.ts utility, and why the boundary matters.' },
  { href: '/features/optimistic-ui', title: 'Optimistic UI', blurb: 'The imperative optimistic(signal, value, action) flip: instant update, automatic rollback on failure.' },
  { href: '/features/async-render', title: 'Async render', blurb: 'A component that awaits server data in async render(), so the resolved value is in the first paint.' },
  { href: '/features/directives', title: 'Directives', blurb: 'The lit-html directive set: repeat for keyed lists, watch(signal) for a fine-grained node swap.' },
  { href: '/features/route-handler', title: 'Route handlers', blurb: 'A server-only route.ts HTTP endpoint returning JSON, the webjs equivalent of a Next route handler.' },
  { href: '/features/forms', title: 'Forms', blurb: 'A no-JS progressive-enhancement form posting to the page action, with server-side validation errors.' },
  { href: '/features/metadata', title: 'Metadata', blurb: 'Static metadata plus generateMetadata(ctx), which reads the request to compute the title and Open Graph tags.' },
  { href: '/features/caching', title: 'Caching', blurb: 'export const revalidate caches the page HTML per URL, with the safety rule for when a shared cache is allowed.' },
  { href: '/features/env', title: 'Env vars', blurb: 'The server-only vs WEBJS_PUBLIC_ boundary, read during SSR so secrets never reach the browser.' },
  { href: '/features/client-router', title: 'Client router', blurb: 'Automatic soft navigation: fragment-only fetches, hover prefetch, scroll restore, and graceful no-JS fallback.' },
  { href: '/features/service-worker', title: 'Service worker', blurb: 'The opt-in offline enhancement, registered from a browser-only lifecycle hook (never a page or layout).' },
  { href: '/features/websockets', title: 'WebSockets', blurb: 'A WS(ws, req) route endpoint plus the connectWS() client, echoing messages over a live socket.' },
  { href: '/features/broadcast', title: 'Broadcast', blurb: 'Fan a message out to every connected client on a WebSocket path, so all open tabs stay in sync.' },
  { href: '/features/rate-limit', title: 'Rate limiting', blurb: 'The rateLimit() middleware scoped to one endpoint, returning a 429 with Retry-After past the window.' },
  { href: '/features/file-storage', title: 'File storage', blurb: 'A no-JS multipart upload streamed into the FileStore, then served back through a streaming route.' },
  { href: '/features/sessions', title: 'Sessions', blurb: 'A signed-cookie session applied by a segment middleware, read and written per visitor with getSession() in a route.' },
];
const examples = [
  { href: '/examples/todo', title: 'Optimistic todo', blurb: 'A whole app composing several features: the declarative optimistic() list API, progressive-enhancement forms, accessible labels, the modules split, and SQLite.' },
];

const galleryCard = (item: { href: string; title: string; blurb: string }) => html\`
  <a href=\${item.href} class="block no-underline">
    <div class="\${cardClass()} h-full transition-colors hover:border-border-strong">
      <div class=\${cardHeaderClass()}>
        <h3 class=\${cardTitleClass()}>\${item.title}</h3>
        <p class=\${cardDescriptionClass()}>\${item.blurb}</p>
      </div>
    </div>
  </a>
\`;

export default function Home() {
  return html\`
    <section class="mb-14">
      \${rubric('welcome')}
      \${displayH1(html\`Hello from <span class="text-primary italic">${displayName}</span>.\`)}
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0 mb-6">
        The saas starter: email and password auth, a protected dashboard, and a
        User model, all wired up. Replace this hero with your product's landing;
        the webjs feature gallery below is reference, prune what you do not need.
        See \${accentLink('https://docs.webjs.dev', 'the docs')} for the full reference.
      </p>
      <div class="flex gap-3 items-center">
        <a href="/login" class="inline-flex items-center px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm no-underline transition-all hover:bg-primary/90 active:scale-[0.97]">Log in</a>
        <a href="/signup" class="text-primary no-underline font-medium text-sm">Create an account</a>
        <a href="/dashboard" class="text-muted-foreground no-underline font-medium text-sm hover:text-foreground transition-colors">Dashboard</a>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="font-serif text-[1.6rem] tracking-[-0.02em] font-bold m-0 mb-1">Features</h2>
      <p class="text-muted-foreground text-sm m-0 mb-5">
        One webjs concept each, under <code class="font-mono text-[0.9em]">app/features/</code>
        with logic in <code class="font-mono text-[0.9em]">modules/</code>. Delete the ones you do not need.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        \${features.map(galleryCard)}
      </div>
    </section>

    <section>
      <h2 class="font-serif text-[1.6rem] tracking-[-0.02em] font-bold m-0 mb-1">Example apps</h2>
      <p class="text-muted-foreground text-sm m-0 mb-5">
        Whole apps that compose several features, under <code class="font-mono text-[0.9em]">app/examples/</code>.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        \${examples.map(galleryCard)}
      </div>
    </section>
  \`;
}
`);
  }

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
    // Tell git to use .hooks/ as the hooks directory (tracked in the repo)
    execSync('git config core.hooksPath .hooks', { cwd: appDir, stdio: 'pipe' });
  } catch { /* git not available: skip */ }

  // --- Print success ---

  if (isApi) {
    console.log(`  ${name}/
    app/api/health/route.ts
    app/api/users/route.ts               ← thin wrapper over server actions
    modules/users/{actions,queries,types.ts}
    CONVENTIONS.md, AGENTS.md, CLAUDE.md
`);
  } else if (isSaas) {
    console.log(`  ${name}/
    app/layout.ts, page.ts, login/, signup/
    app/dashboard/{page,settings,middleware}.ts  ← protected
    app/api/auth/[...path]/route.ts      ← auth API
    styles/globals.css                   ← @webjsdev/ui theme tokens
    components.json                      ← preconfigured for \`webjs ui add\`
    components/ui/{button,card,alert,badge,separator,label,input,
                    dialog,form,field,switch,checkbox}.ts
    components/theme-toggle.ts
    modules/auth/{actions,queries,types.ts}
    lib/{auth,password}.server.ts
    lib/utils/cn.ts                      ← cn() helper for ui-* components
    db/{schema,columns,connection}.server.ts  ← Drizzle (User model)
    CONVENTIONS.md, AGENTS.md, CLAUDE.md
`);
  } else {
    console.log(`  ${name}/
    app/layout.ts, page.ts       ← home links to the gallery
    app/features/{routing,components,server-actions,optimistic-ui,
                  async-render,directives,route-handler}/
                                 ← single-feature demos
    app/examples/todo/           ← one whole example app (composes features)
    styles/globals.css           ← @webjsdev/ui theme tokens
    components.json              ← preconfigured for \`webjs ui add\`
    components/ui/{button,card,alert,badge,separator,label,input}.ts
    components/theme-toggle.ts   ← light DOM web component
    lib/utils/cn.ts              ← cn() helper for ui-* components
    lib/utils/ui.ts              ← Tailwind class-bundle helpers
    public/input.css             ← Tailwind entry (compiled to public/tailwind.css)
    modules/{components,server-actions,optimistic-ui,async-render,
             directives,todo}/  ← feature + example logic (prune what you skip)
    db/{schema,columns,connection}.server.ts  ← Drizzle (User + Todo)
    CONVENTIONS.md, AGENTS.md, CLAUDE.md
`);
  }
  // AI-agent guidance comes first so it scrolls past in the terminal
  // (long reading material, not actionable). The actionable run
  // command lands LAST in the output so it is the final thing on
  // screen after the install completes.
  console.log(`AI-driven development (enforced for all AI agents):
  ✓ Tests auto-generated with every feature
  ✓ Docs auto-updated with every change
  ✓ Git merges/pushes to main require approval
  ✓ Commits are automatic, small, and meaningful
  ✓ No AI attribution in commit messages
  ✓ Convention validation via \`webjs check\`

For AI agents, read this before editing scaffolded files:
  • The example layout, home page, the gallery under app/features/ and
    app/examples/ (+ their modules) and schema are REFERENCE ONLY. Replace
    them with the app the user asked for, and prune the routes you do not
    use (delete the app/features/<name> or app/examples/<name> route AND
    its modules/<name>). Don't ship the scaffold's examples as the final
    product.
  • This fresh app intentionally FAILS \`webjs check\` with
    no-scaffold-placeholder violations on the example content (the home
    page, the layout, and each gallery route). That is the signal to
    replace or prune each. Delete the marker comment line as you do, and
    the check goes green.
  • Use Drizzle + SQLite for app data. It's already wired up. Define
    real models in db/schema.server.ts, then run \`webjs db generate\`
    and \`webjs db migrate\`. NEVER store app data in JSON files,
    in-memory arrays, or localStorage as a substitute for the database.
  • Only three scaffolds exist: full-stack (default), api, saas. Don't
    invent template names. If you need a different kind of app, pick
    the closest scaffold and adapt it.
  • Read AGENTS.md + CONVENTIONS.md in the new project before writing
    any code. They are the contract.
  • Need more detail? Full hosted docs are at https://docs.webjs.dev
    (every API, directive, recipe, and deployment guide).
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
