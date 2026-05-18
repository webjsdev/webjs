/**
 * `webjs create <name>`: scaffold a new webjs app with opinionated defaults.
 *
 * Creates a directory with:
 *   - app/ with a root layout + page
 *   - modules/ skeleton
 *   - components/ with a theme toggle
 *   - test/unit/ and test/e2e/ with example tests
 *   - CONVENTIONS.md, AGENTS.md, CLAUDE.md
 *   - package.json with webjs deps + test scripts
 *   - tsconfig.json for editor support
 */

import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, '..', 'templates');

// Root of the @webjskit/ui registry workspace. We read component sources
// directly from disk at create time so the scaffolded app boots ready for
// `webjs ui add` without an HTTP round-trip during scaffolding.
//
// Layout in the monorepo:
//   packages/cli/lib/create.js                       ← __dirname
//   packages/ui/packages/registry/components/*.ts
//   packages/ui/packages/registry/lib/utils.ts
//   packages/ui/packages/registry/themes/index.css
const UI_REGISTRY_ROOT = resolve(
  __dirname, '..', '..', 'ui', 'packages', 'registry',
);

/**
 * Read a single @webjskit/ui registry component, rewrite its relative import
 * of `../lib/utils.ts` so it resolves correctly when written to
 * `components/ui/<name>.ts` in the scaffolded app (which puts utils at
 * `lib/utils.ts`, i.e. two levels up), and return the rewritten source.
 *
 * @param {string} name  component name without `.ts` (e.g. 'button')
 * @returns {Promise<string|null>} source or null if not found
 */
async function readUiComponent(name) {
  const src = join(UI_REGISTRY_ROOT, 'components', `${name}.ts`);
  if (!existsSync(src)) return null;
  const raw = await readFile(src, 'utf8');
  // The registry source lives at <registry>/components/<x>.ts and imports
  // its sibling utils via '../lib/utils.ts'. Once copied to the user's
  // project at components/ui/<x>.ts, the equivalent path is two-up:
  // '../../lib/utils.ts'. Same rewrite for the unquoted form.
  return raw
    .replaceAll("'../lib/utils.ts'", "'../../lib/utils.ts'")
    .replaceAll('"../lib/utils.ts"', '"../../lib/utils.ts"');
}

/**
 * Copy a list of @webjskit/ui registry components into the scaffolded app
 * under `components/ui/`. Silently skips any name that isn't in the registry.
 *
 * @param {string} appDir  destination app root
 * @param {string[]} names list of component file basenames (without `.ts`)
 */
async function copyUiComponents(appDir, names) {
  const uiDir = join(appDir, 'components', 'ui');
  await mkdir(uiDir, { recursive: true });
  for (const n of names) {
    const content = await readUiComponent(n);
    if (content == null) continue;
    await writeFile(join(uiDir, `${n}.ts`), content);
  }
}

/**
 * Write `lib/utils.ts` (the `cn()` helper) and `components.json` so the
 * scaffolded app is pre-initialised for `webjs ui add`. Reads `lib/utils.ts`
 * verbatim from the registry source so we never drift.
 *
 * @param {string} appDir
 */
async function writeUiBootstrap(appDir) {
  // 1) lib/utils.ts: the cn() helper
  const utilsSrc = join(UI_REGISTRY_ROOT, 'lib', 'utils.ts');
  if (existsSync(utilsSrc)) {
    const content = await readFile(utilsSrc, 'utf8');
    await mkdir(join(appDir, 'lib'), { recursive: true });
    await writeFile(join(appDir, 'lib', 'utils.ts'), content);
  }

  // 2) components.json: the same shape `webjsui init` writes for webjs
  // projects (see packages/ui/src/utils/detect-project.js).
  const componentsJson = {
    $schema: 'https://ui.webjs.dev/schema.json',
    style: 'default',
    tailwind: {
      css: 'app/globals.css',
      baseColor: 'neutral',
      cssVariables: true,
    },
    aliases: {
      components: 'components',
      utils: 'lib/utils',
      ui: 'components/ui',
      lib: 'lib',
    },
    iconLibrary: 'lucide',
  };
  await writeFile(
    join(appDir, 'components.json'),
    JSON.stringify(componentsJson, null, 2) + '\n',
  );

  // 3) app/globals.css: copy the neutral theme verbatim. components.json
  // references this path, and future `webjs ui add` calls append to it.
  const themeSrc = join(UI_REGISTRY_ROOT, 'themes', 'index.css');
  if (existsSync(themeSrc)) {
    const css = await readFile(themeSrc, 'utf8');
    await mkdir(join(appDir, 'app'), { recursive: true });
    await writeFile(join(appDir, 'app', 'globals.css'), css);
  }
}

/**
 * Read the shadcn theme CSS so we can inline it into the layout's
 * `<style type="text/tailwindcss">` block. The Tailwind browser runtime
 * picks up inline `<style type="text/tailwindcss">` content, so the theme
 * tokens (`--color-primary`, `--color-card`, …) the registry components
 * consume are available at runtime without a build step.
 *
 * @returns {Promise<string>} theme CSS source, or '' if registry missing
 */
async function readThemeCss() {
  const src = join(UI_REGISTRY_ROOT, 'themes', 'index.css');
  if (!existsSync(src)) return '';
  return await readFile(src, 'utf8');
}

/**
 * @param {string} name  App directory name
 * @param {string} cwd   Current working directory
 */
export async function scaffoldApp(name, cwd, opts = {}) {
  const template = opts.template || 'full-stack';
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
    'prisma',
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
    scripts: {
      predev: 'prisma generate',
      prestart: 'prisma migrate deploy',
      dev: 'webjs dev',
      start: 'webjs start',
      test: 'webjs test',
      'test:server': 'webjs test --server',
      'test:browser': 'webjs test --browser',
      check: 'webjs check',
      'db:migrate': 'prisma migrate dev',
      'db:generate': 'prisma generate',
      'db:studio': 'prisma studio',
    },
    dependencies: {
      '@prisma/client': '^6.0.0',
      '@webjskit/cli': 'latest',
      '@webjskit/core': 'latest',
      '@webjskit/server': 'latest',
    },
    devDependencies: {
      prisma: '^6.0.0',
      '@web/test-runner': '^0.20.0',
      '@web/test-runner-playwright': '^0.11.0',
      'playwright': '^1.59.0',
      // tsserver plugin for editor intelligence inside html`` templates.
      // @webjskit/ts-plugin bundles ts-lit-plugin internally, so just one
      // plugin entry is needed in tsconfig (see below).
      '@webjskit/ts-plugin': 'latest',
      // AI-first component library CLI, preinstalled so `webjs ui add button`
      // works immediately after scaffold. Users can remove if they prefer
      // to add it later.
      '@webjskit/ui': 'latest',
    },
  }, null, 2) + '\n');

  await writeFile(join(appDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      // @webjskit/ts-plugin gives the editor:
      //   • type-check + diagnostics inside html`` templates (via the
      //     ts-lit-plugin it bundles internally)
      //   • webjs-aware go-to-definition on custom-element tags
      //   • "Unknown tag/attribute" suppression for elements registered
      //     via Class.register('tag-name')
      //   • attribute auto-complete sourced from `static properties`
      //   • attribute-value type-check against `declare` annotations
      // Editor-only. The framework runs without it.
      plugins: [
        { name: '@webjskit/ts-plugin' },
      ],
    },
  }, null, 2) + '\n');

  // --- Templates (AGENTS.md, CONVENTIONS.md, CLAUDE.md, test files, Claude hooks) ---

  const templateFiles = [
    'AGENTS.md',
    'CONVENTIONS.md',
    'CLAUDE.md',
    'test/unit/example.test.ts',
    'test/browser/example.test.js',
    'web-test-runner.config.js',
    // Environment variables
    '.env.example',
    // Git hooks (blocks commits on main)
    '.hooks/pre-commit',
    // Claude Code config + hooks
    '.claude.json',
    '.claude/settings.json',
    '.claude/hooks/guard-main-merge.sh',
    '.claude/hooks/guard-branch-context.sh',
    // Cross-agent config files
    '.cursorrules',
    '.windsurfrules',
    '.github/copilot-instructions.md',
    '.github/pull_request_template.md',
    '.editorconfig',
  ];
  for (const f of templateFiles) {
    const src = join(TEMPLATES, f);
    if (existsSync(src)) {
      await mkdir(dirname(join(appDir, f)), { recursive: true });
      let content = await readFile(src, 'utf8');
      content = content.replace(/\{\{APP_NAME\}\}/g, name);
      await writeFile(join(appDir, f), content);
    }
  }

  // Make hook scripts executable
  const { chmod } = await import('node:fs/promises');
  for (const hook of ['guard-main-merge.sh', 'guard-branch-context.sh']) {
    const hookPath = join(appDir, '.claude', 'hooks', hook);
    if (existsSync(hookPath)) await chmod(hookPath, 0o755);
  }
  // Make git pre-commit hook executable
  const preCommitPath = join(appDir, '.hooks', 'pre-commit');
  if (existsSync(preCommitPath)) await chmod(preCommitPath, 0o755);

  // --- Prisma schema + client singleton (all templates) ---

  await writeFile(join(appDir, 'prisma', 'schema.prisma'), `generator client {
  provider = "prisma-client-js"
}

datasource db {
  // Defaults to SQLite at ./prisma/dev.db. Switch to postgresql / mysql
  // by changing the provider + DATABASE_URL in .env.
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Example model. Feel free to delete or extend.
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
`);

  await writeFile(join(appDir, 'lib', 'prisma.ts'), `/**
 * Prisma client singleton. The \`globalThis\` trick keeps a single
 * instance across dev-server module reloads, so we don't open a new
 * DB connection on every file change.
 */
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__prisma = prisma;
`);

  // Env vars: append DATABASE_URL to the .env.example the template
  // already copied (if present). The scaffold's root .env.example
  // lists auth secrets etc.; we just add the DB line idempotently.
  const envExample = join(appDir, '.env.example');
  if (existsSync(envExample)) {
    const cur = await readFile(envExample, 'utf8');
    if (!cur.includes('DATABASE_URL')) {
      await writeFile(envExample, cur.replace(/\n?$/, '\n') + '\nDATABASE_URL=file:./prisma/dev.db\n');
    }
  } else {
    await writeFile(envExample, 'DATABASE_URL=file:./prisma/dev.db\n');
  }

  // .gitignore the generated SQLite file.
  const gitignore = join(appDir, '.gitignore');
  const gitignoreExtra = '\n# SQLite dev database\nprisma/dev.db\nprisma/dev.db-journal\n';
  if (existsSync(gitignore)) {
    const cur = await readFile(gitignore, 'utf8');
    if (!cur.includes('prisma/dev.db')) await writeFile(gitignore, cur + gitignoreExtra);
  } else {
    await writeFile(gitignore, 'node_modules\n.webjs\n' + gitignoreExtra);
  }

  // --- App files (template-specific) ---

  if (isApi) {
    // API-only template: no layout, no page, no components.
    // Just a health route and an example module with route wrapper.
    await mkdir(join(appDir, 'app', 'api', 'health'), { recursive: true });
    await mkdir(join(appDir, 'app', 'api', 'users'), { recursive: true });
    await writeFile(join(appDir, 'app', 'api', 'health', 'route.ts'), `export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
`);
    await mkdir(join(appDir, 'modules', 'users', 'actions'), { recursive: true });
    await mkdir(join(appDir, 'modules', 'users', 'queries'), { recursive: true });

    await writeFile(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts'), `'use server';

export async function listUsers() {
  // TODO: replace with real data source
  return [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];
}
`);
    await writeFile(join(appDir, 'modules', 'users', 'actions', 'create-user.server.ts'), `'use server';

export async function createUser(input: { name: string; email: string }) {
  // TODO: validate input, persist to database
  return { success: true, data: { id: Date.now().toString(), ...input } };
}
`);
    await writeFile(join(appDir, 'app', 'api', 'users', 'route.ts'), `/**
 * /api/users: thin route wrapper over typed server actions.
 * Business logic lives in modules/users/, not here.
 */
import { listUsers } from '../../../modules/users/queries/list-users.server.ts';
import { createUser } from '../../../modules/users/actions/create-user.server.ts';

export async function GET() {
  return Response.json(await listUsers());
}

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json(await createUser(body));
}
`);
    // Minimal test stub so the scaffold passes `webjs check` (tests-exist)
    // and `webjs test` runs cleanly. Replace these with real assertions
    // once you wire the action/query to a real data source.
    await writeFile(join(appDir, 'test', 'unit', 'users.test.ts'), `import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listUsers } from '../../modules/users/queries/list-users.server.ts';
import { createUser } from '../../modules/users/actions/create-user.server.ts';

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
    // Full-stack and SaaS templates: layout + page + theme toggle + Tailwind

    // Copy the Tailwind browser runtime + _utils/ui.ts helpers from the
    // scaffold templates directory so the app boots with the exact blog
    // example architecture: light DOM + Tailwind + JS helpers.
    const publicDir = join(appDir, 'public');
    await mkdir(publicDir, { recursive: true });
    const tailwindSrc = join(TEMPLATES, 'public', 'tailwind-browser.js');
    if (existsSync(tailwindSrc)) {
      await cp(tailwindSrc, join(publicDir, 'tailwind-browser.js'));
    }

    const utilsDir = join(appDir, 'app', '_utils');
    await mkdir(utilsDir, { recursive: true });
    const uiSrc = join(TEMPLATES, 'app', '_utils', 'ui.ts');
    if (existsSync(uiSrc)) {
      await cp(uiSrc, join(utilsDir, 'ui.ts'));
    }

    // Pre-initialise @webjskit/ui so the scaffold boots ready for
    // `webjs ui add <name>`: writes components.json + lib/utils.ts +
    // app/globals.css (the shadcn theme).
    await writeUiBootstrap(appDir);

    // Copy the standard ui-* component kit the scaffold's example pages
    // use. Sources are read from packages/ui/packages/registry/ in this
    // monorepo. Users can `webjs ui add <name>` for anything else.
    await copyUiComponents(appDir, [
      'button', 'card', 'alert', 'badge', 'separator', 'label', 'input',
    ]);

    // The shadcn theme tokens (`--color-primary`, `--color-card`, …) the
    // ui-* components consume. We read the registry's themes/index.css at
    // create time and inline it into the layout's
    // `<style type="text/tailwindcss">` block so the Tailwind browser
    // runtime picks it up. Same content also lives at app/globals.css for
    // `webjsui` tooling.
    const SHADCN_THEME = (await readThemeCss())
      // Escape backticks + ${} so the CSS survives interpolation into the
      // layout's template literal below.
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');

  await writeFile(join(appDir, 'app', 'layout.ts'), `import { html } from '@webjskit/core';
import '@webjskit/core/client-router';
import '../components/theme-toggle.ts';
// Webjs UI components are tiered:
//   - Tier 1 (button, card, input, label, alert, badge, separator, etc.) are
//     class-helper FUNCTIONS, with no custom element to register. Each page
//     imports the specific helpers it needs (e.g.
//     \`import { buttonClass } from '../components/ui/button.ts'\`).
//   - Tier 2 (dialog, popover, tooltip, tabs, accordion, etc.) ARE custom
//     elements. Register them by side-effect-importing here once so they
//     work transitively across every page:
//       import '../components/ui/dialog.ts';
// The example app/page.ts below uses only Tier-1 helpers, so nothing
// extra needs to be registered. Add Tier-2 imports as you 'webjs ui add'.

/**
 * Root layout: globals + chrome.
 *
 * Light DOM + Tailwind by default. Design tokens live in :root and are
 * mapped into the Tailwind palette via @theme, so classes like
 * text-fg, bg-bg-elev, font-serif, duration-fast, text-display all work.
 *
 * Nav + footer links repeat the same class bundle, so they're extracted
 * into small JS helpers below. Each helper runs at SSR time inside
 * html\\\`\\\`, producing static HTML in the response with no client runtime.
 */

const navLink = (href: string, label: string) => html\`
  <a href=\${href} class="text-fg-muted no-underline font-medium text-[13px] leading-none tracking-[0.005em] transition-colors duration-fast hover:text-fg">\${label}</a>
\`;

export default function RootLayout({ children }: { children: unknown }) {
  return html\`
    <script>
      (function(){
        try {
          var t = localStorage.getItem('webjs_theme');
          if (t === 'light' || t === 'dark') {
            document.documentElement.dataset.theme = t;
          }
        } catch (_) {}
      })();
    </script>
    <script src="/public/tailwind-browser.js"></script>
    <!--
      Webjs UI theme. Design tokens (--color-primary,
      --color-card, --radius, etc.) the ui-* components consume.
      The same content is also at app/globals.css; we inline it here so
      the Tailwind browser runtime resolves the tokens without a build step.
      Edit base palette via the :root / .dark blocks below.
    -->
    <style type="text/tailwindcss">
${SHADCN_THEME}
    </style>
    <style type="text/tailwindcss">
      @theme {
        --color-fg:            var(--fg);
        --color-fg-muted:      var(--fg-muted);
        --color-fg-subtle:     var(--fg-subtle);
        --color-bg:            var(--bg);
        --color-bg-elev:       var(--bg-elev);
        --color-bg-subtle:     var(--bg-subtle);
        --color-border:        var(--border);
        --color-border-strong: var(--border-strong);
        --color-accent:        var(--accent);
        --color-accent-hover:  var(--accent-hover);
        --color-accent-fg:     var(--accent-fg);
        --color-accent-tint:   var(--accent-tint);
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
    </style>
    <style>
      :root {
        color-scheme: light dark;
        /* ---------- dark (default) ---------- */
        --fg:            oklch(0.96 0.015 60);
        --fg-muted:      oklch(0.72 0.02 60);
        --fg-subtle:     oklch(0.55 0.02 60);
        --bg:            oklch(0.14 0.01 55);
        --bg-elev:       oklch(0.18 0.01 55);
        --bg-subtle:     oklch(0.16 0.01 55);
        --border:        oklch(0.26 0.012 55 / 0.9);
        --border-strong: oklch(0.38 0.012 55 / 0.9);
        --accent:        oklch(0.78 0.14 55);
        --accent-hover:  oklch(0.85 0.14 55);
        --accent-fg:     oklch(0.15 0.01 55);
        --accent-tint:   oklch(0.78 0.14 55 / 0.14);
        --font-sans:   -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --font-serif:  ui-serif, 'Iowan Old Style', Palatino, Georgia, serif;
        --font-mono:   ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      :root[data-theme='light'] {
        --fg:            oklch(0.18 0.015 60);
        --fg-muted:      oklch(0.42 0.02 65);
        --fg-subtle:     oklch(0.62 0.015 70);
        --bg:            oklch(0.985 0.008 80);
        --bg-elev:       oklch(1 0 0);
        --bg-subtle:     oklch(0.96 0.008 80);
        --border:        oklch(0.88 0.01 75 / 0.95);
        --border-strong: oklch(0.78 0.01 75 / 0.95);
        --accent:        oklch(0.58 0.15 55);
        --accent-hover:  oklch(0.5 0.15 55);
        --accent-fg:     oklch(1 0 0);
        --accent-tint:   oklch(0.58 0.15 55 / 0.1);
      }
      @media (prefers-color-scheme: light) {
        :root:not([data-theme='dark']) {
          --fg:            oklch(0.18 0.015 60);
          --fg-muted:      oklch(0.42 0.02 65);
          --fg-subtle:     oklch(0.62 0.015 70);
          --bg:            oklch(0.985 0.008 80);
          --bg-elev:       oklch(1 0 0);
          --bg-subtle:     oklch(0.96 0.008 80);
          --border:        oklch(0.88 0.01 75 / 0.95);
          --border-strong: oklch(0.78 0.01 75 / 0.95);
          --accent:        oklch(0.58 0.15 55);
          --accent-hover:  oklch(0.5 0.15 55);
          --accent-fg:     oklch(1 0 0);
          --accent-tint:   oklch(0.58 0.15 55 / 0.1);
        }
      }
      /* Body + pseudo-elements utility classes can't reach. */
      html, body { margin: 0; }
      body {
        background: var(--bg);
        color: var(--fg);
        font: 16px/1.65 var(--font-sans);
        -webkit-font-smoothing: antialiased;
      }
      ::selection { background: var(--accent-tint); color: var(--fg); }
    </style>

    <header class="sticky top-0 z-20 flex items-center gap-6 px-4 sm:px-6 py-3 border-b border-border bg-[color-mix(in_oklch,var(--bg)_75%,transparent)] backdrop-blur-[18px]">
      <a href="/" class="mr-auto inline-flex items-center gap-2 no-underline text-fg font-semibold text-[15px] leading-none tracking-tight">
        <span>${name}</span>
      </a>
      <nav class="flex gap-4 items-center">
        \${navLink('/', 'Home')}
        <theme-toggle></theme-toggle>
      </nav>
    </header>

    <main class="block max-w-[760px] mx-auto px-4 sm:px-6 pt-[72px] pb-12 min-h-screen">
      \${children}
    </main>
  \`;
}
`);

  await writeFile(join(appDir, 'app', 'page.ts'), `import { html } from '@webjskit/core';
import { rubric, displayH1, accentLink } from './_utils/ui.ts';
import { buttonClass } from '../components/ui/button.ts';
import { badgeClass } from '../components/ui/badge.ts';
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  cardDescriptionClass,
  cardContentClass,
} from '../components/ui/card.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '../components/ui/alert.ts';
import { separatorClass } from '../components/ui/separator.ts';

export const metadata = {
  title: '${name}: built with webjs',
};

export default function Home() {
  return html\`
    <section class="mb-18">
      \${rubric('welcome')}
      \${displayH1(html\`Hello from <span class="text-accent italic">${name}</span>.\`)}
      <p class="text-lede leading-[1.5] text-fg-muted max-w-[56ch] m-0 mb-6">
        Edit <code class="font-mono text-[0.9em]">app/page.ts</code> to get started.
        Run \${accentLink('#', 'webjs test')} to run tests and
        \${accentLink('#', 'webjs check')} to validate conventions.
      </p>
      <div class="flex gap-3 items-center">
        <button class=\${buttonClass()}>Get started</button>
        <button class=\${buttonClass({ variant: 'outline' })}>View docs</button>
        <span class=\${badgeClass({ variant: 'secondary' })}>v0.1</span>
      </div>
    </section>

    <div class=\${cardClass()} style="margin-bottom: 3rem">
      <div class=\${cardHeaderClass()}>
        <h3 class=\${cardTitleClass()}>Web Components + Server Actions</h3>
        <p class=\${cardDescriptionClass()}>
          Drop a custom element anywhere. Call a server action like a local
          function. webjs rewrites the import into a typed RPC stub.
        </p>
      </div>
      <div class=\${cardContentClass()}>
        <div class=\${alertClass()}>
          <h5 class=\${alertTitleClass()}>AI-first component kit included</h5>
          <div class=\${alertDescriptionClass()}>
            button, card, alert, badge, separator, label, input are already
            in <code class="font-mono text-[0.9em]">components/ui/</code> as
            class-helper functions you call from a native element. Add more
            with <code class="font-mono text-[0.9em]">webjs ui add &lt;name&gt;</code>.
          </div>
        </div>
      </div>
    </div>

    <div class=\${separatorClass()} style="margin: 2.5rem 0"></div>

    <section class="mt-10">
      <h2 class="font-serif text-[1.6rem] tracking-[-0.02em] font-bold m-0 mb-2">Light DOM + Tailwind</h2>
      <p class="text-fg-muted text-sm m-0 mb-4">
        Components render into light DOM by default. Tailwind utility classes
        apply directly. Set <code class="font-mono text-[0.9em]">static shadow = true</code>
        on a component when you need scoped styles, &lt;slot&gt; projection,
        or third-party-embed isolation.
      </p>
    </section>
  \`;
}
`);

  // AGENTS.md is copied via the `templateFiles` loop above, from
  // `packages/cli/templates/AGENTS.md` with `{{APP_NAME}}` substitution.

  // --- Theme toggle component ---

  await writeFile(join(appDir, 'components', 'theme-toggle.ts'), `import { WebComponent, html } from '@webjskit/core';

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
  declare state: { theme: Theme };

  constructor() {
    super();
    this.state = { theme: 'system' };
  }

  connectedCallback() {
    super.connectedCallback();
    let saved: string | null = null;
    try { saved = localStorage.getItem('webjs_theme'); } catch {}
    this.setState({ theme: saved === 'light' || saved === 'dark' ? saved : 'system' });
  }

  cycle() {
    const next: Theme = this.state.theme === 'system' ? 'light'
      : this.state.theme === 'light' ? 'dark' : 'system';
    this.setState({ theme: next });
    try {
      if (next === 'system') localStorage.removeItem('webjs_theme');
      else localStorage.setItem('webjs_theme', next);
    } catch {}
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }

  render() {
    const t = this.state.theme;
    const label = t === 'system' ? 'AUTO' : t === 'light' ? 'LIGHT' : 'DARK';
    const icon = t === 'light' ? ICONS.sun : t === 'dark' ? ICONS.moon : ICONS.system;
    return html\`
      <button
        class="inline-flex items-center justify-center w-9 h-9 p-0 border border-border rounded-full bg-bg-elev text-fg-muted cursor-pointer transition-all duration-150 hover:text-fg hover:border-border-strong active:scale-[0.94] focus-visible:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent-tint"
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

  // --- SaaS template extras: auth, dashboard, prisma ---
  if (isSaas) {
    const { writeSaasFiles } = await import('./saas-template.js');
    await writeSaasFiles(appDir);
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
    app/globals.css                      ← @webjskit/ui theme tokens
    components.json                      ← preconfigured for \`webjs ui add\`
    components/ui/{button,card,alert,badge,separator,label,input,
                    dialog,form,field,switch,checkbox}.ts
    components/theme-toggle.ts
    modules/auth/{actions,queries,types.ts}
    lib/{auth,prisma,password,utils}.ts  ← utils.ts is the cn() helper
    prisma/schema.prisma                 ← User model
    CONVENTIONS.md, AGENTS.md, CLAUDE.md
`);
  } else {
    console.log(`  ${name}/
    app/layout.ts, page.ts       ← light DOM + Tailwind + @theme tokens
    app/_utils/ui.ts             ← JS helpers for repeated class bundles
    app/globals.css              ← @webjskit/ui theme tokens
    components.json              ← preconfigured for \`webjs ui add\`
    components/ui/{button,card,alert,badge,separator,label,input}.ts
    components/theme-toggle.ts   ← light DOM web component
    lib/utils.ts                 ← cn() helper for ui-* components
    public/tailwind-browser.js   ← Tailwind runtime
    modules/
    CONVENTIONS.md, AGENTS.md, CLAUDE.md
`);
  }
  // Post-scaffold guidance. The full-stack and saas templates ship with
  // @webjskit/ui already initialised (components.json, lib/utils.ts, the
  // standard kit under components/ui/), so the user only runs `webjs dev`.
  // The api template has no UI; we only mention `webjs ui` in case the
  // user later adds one.
  const uiNote = isApi
    ? `# If you later add a UI to this API project:
  #   webjs ui init && webjs ui add button card dialog`
    : `webjs ui add <name>     # optional: add more ui-* components later`;
  console.log(`Next steps:
  cd ${name}
  npm install${isSaas ? '\n  npx prisma migrate dev --name init' : ''}
  ${uiNote}
  webjs dev

AI-driven development (enforced for all AI agents):
  ✓ Tests auto-generated with every feature
  ✓ Docs auto-updated with every change
  ✓ Git merges/pushes to main require approval
  ✓ Commits are automatic, small, and meaningful
  ✓ No AI attribution in commit messages
  ✓ Convention validation via \`webjs check\`

For AI agents, read this before editing scaffolded files:
  • The example layout / page / components / schema are REFERENCE ONLY.
    Replace them with the app the user actually asked for. Don't ship
    the scaffold's example User model or "Hello from …" page as the
    final product.
  • Use Prisma + SQLite for app data. It's already wired up. Define
    real models in prisma/schema.prisma and run \`webjs db migrate\`.
    NEVER store app data in JSON files, in-memory arrays, or
    localStorage as a substitute for the database.
  • Only three scaffolds exist: full-stack (default), api, saas. Don't
    invent template names. If you need a different kind of app, pick
    the closest scaffold and adapt it.
  • Read AGENTS.md + CONVENTIONS.md in the new project before writing
    any code. They are the contract.
  • Need more detail? Full hosted docs are at https://docs.webjs.com
    (every API, directive, recipe, and deployment guide).
`);
}
