#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

// Exactly three scaffolds exist. Keep this list as the single source of
// truth. AI-agent docs in README.md / AGENTS.md / .cursorrules /
// .windsurfrules / .github/copilot-instructions.md mirror it.
const TEMPLATES = ['full-stack', 'api', 'saas'];

const USAGE = `webjs commands:
  webjs dev   [--port 8080]                       Start dev server with live reload
  webjs start [--port 8080]                       Start production server (serves source directly, no build step)
  webjs test  [--server|--browser]                 Run server + browser tests
  webjs check                                     Validate app against conventions
  webjs create <name> [--template full-stack|api|saas] [--no-install]  Scaffold a new webjs app
                                                  (only 3 templates exist. default: full-stack with Prisma+SQLite)
                                                  Auto-runs the detected package manager's install in the new dir
                                                  unless --no-install is passed.
  webjs db generate                               Run \`prisma generate\`
  webjs db migrate [name]                         Run \`prisma migrate dev\`
  webjs db studio                                 Run \`prisma studio\`
  webjs ui <subcmd>                               AI-first component library CLI
                                                  (init / add / list / view / diff / info)
                                                  Requires @webjsdev/ui installed in the project
  webjs vendor pin [--download]                   Pin client-side npm packages to .webjs/vendor/importmap.json
                                                  Default: writes jspm.io URLs (browser fetches from CDN)
                                                  --download: also downloads bundles for offline production
  webjs vendor unpin <pkg>                        Remove a specific package from the pin file
  webjs vendor list                               Show pinned packages with versions and URLs
  webjs help                                      Show this help`;

/** @param {string[]} args */
function flag(args, name, def) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  return args[i + 1];
}

async function main() {
  switch (cmd) {
    case 'dev': {
      // If we're already inside the --watch child, start the server directly.
      if (process.env.__WEBJS_DEV_CHILD === '1') {
        const { startServer } = await import('@webjsdev/server');
        const port = Number(flag(rest, '--port', process.env.PORT || 8080));
        await startServer({ appDir: process.cwd(), port, dev: true });
        break;
      }

      // Otherwise, spawn ourselves as a child with node --watch.
      // This restarts the process on file changes, guaranteeing a fresh
      // Node ESM module cache. Without this, edits to transitively-imported
      // modules (actions, queries, components, utils) don't take effect
      // because Node caches ESM by URL with no public invalidation API.
      // Build watch paths from directories that exist in the project.
      const { existsSync } = await import('node:fs');
      const watchPaths = [];
      for (const dir of ['app', 'components', 'modules', 'lib', 'actions']) {
        if (existsSync(dir)) watchPaths.push('--watch-path', dir);
      }
      // Watch root middleware/config if present
      for (const f of ['middleware.ts', 'middleware.js']) {
        if (existsSync(f)) watchPaths.push('--watch-path', f);
      }

      const child = spawn(
        process.execPath,
        [
          '--watch',
          '--watch-preserve-output',
          ...watchPaths,
          ...process.argv.slice(1),
        ],
        {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: { ...process.env, __WEBJS_DEV_CHILD: '1' },
        },
      );
      child.on('exit', (code) => process.exit(code ?? 0));
      break;
    }
    case 'start': {
      const { startServer } = await import('@webjsdev/server');
      const port = Number(flag(rest, '--port', process.env.PORT || 8080));
      await startServer({ appDir: process.cwd(), port, dev: false });
      break;
    }
    case 'db': {
      const sub = rest[0];
      const args = rest.slice(1);
      const map = { generate: ['generate'], migrate: ['migrate', 'dev', ...args], studio: ['studio'] };
      const prismaArgs = map[sub];
      if (!prismaArgs) { console.error('Unknown db subcommand.\n' + USAGE); process.exit(1); }
      const child = spawn('npx', ['prisma', ...prismaArgs], { stdio: 'inherit', cwd: process.cwd() });
      child.on('exit', (code) => process.exit(code ?? 0));
      break;
    }
    case 'ui': {
      // Delegate to @webjsdev/ui. Bundled as a hard dependency of
      // @webjsdev/cli, so `npm install -g @webjsdev/cli` pulls it in
      // automatically, and `webjs ui add button` works out of the box
      // without an extra install in user projects.
      const { createRequire } = await import('node:module');
      const req = createRequire(import.meta.url);
      let entry;
      try {
        entry = req.resolve('@webjsdev/ui/bin/webjsui.js');
      } catch {
        // Fallback: try resolving from the user's cwd in case of weird
        // workspace setups.
        try {
          const userReq = createRequire(join(process.cwd(), 'package.json'));
          entry = userReq.resolve('@webjsdev/ui/bin/webjsui.js');
        } catch {
          console.error('@webjsdev/ui could not be resolved.');
          console.error('Reinstall the CLI:  npm install -g @webjsdev/cli');
          process.exit(1);
        }
      }
      const child = spawn('node', [entry, ...rest], { stdio: 'inherit', cwd: process.cwd() });
      child.on('exit', (code) => process.exit(code ?? 0));
      break;
    }
    case 'test': {
      const cwd = process.cwd();
      const { existsSync } = await import('node:fs');

      // Two test runners:
      //   1. node:test for server-side tests (test/server/*.test.ts, test/unit/*.test.ts)
      //   2. WTR + Playwright for browser tests (test/browser/*.test.js)
      //
      // `webjs test`          → runs both
      // `webjs test --server` → server tests only (node:test)
      // `webjs test --browser` → browser tests only (WTR + Playwright)

      const serverOnly = rest.includes('--server');
      const browserOnly = rest.includes('--browser');
      const runServer = !browserOnly;
      const runBrowser = !serverOnly;

      // --- Server tests (node:test) ---
      if (runServer) {
        const { readdir } = await import('node:fs/promises');
        const testFiles = [];

        for (const dir of ['test/server', 'test/unit', 'test']) {
          const fullDir = join(cwd, dir);
          if (!existsSync(fullDir)) continue;
          const files = await readdir(fullDir);
          for (const f of files) {
            if (/\.test\.(js|ts|mjs|mts)$/.test(f)) {
              const full = join(fullDir, f);
              if (!testFiles.includes(full)) testFiles.push(full);
            }
          }
        }

        if (testFiles.length > 0) {
          console.log(`webjs test: running ${testFiles.length} server test file(s)…\n`);
          const child = spawn(process.execPath, ['--test', ...testFiles], {
            stdio: 'inherit', cwd, env: { ...process.env },
          });
          const code = await new Promise(r => child.on('exit', r));
          if (code !== 0) process.exit(code ?? 1);
        }
      }

      // --- Browser tests (WTR + Playwright) ---
      if (runBrowser) {
        const wtrConfig = join(cwd, 'web-test-runner.config.js');
        if (existsSync(wtrConfig) || existsSync(join(cwd, 'web-test-runner.config.mjs'))) {
          console.log(`\nwebjs test: running browser tests (WTR + Playwright)…\n`);
          const child = spawn('npx', ['wtr'], {
            stdio: 'inherit', cwd, env: { ...process.env },
          });
          const code = await new Promise(r => child.on('exit', r));
          if (code !== 0) process.exit(code ?? 1);
        } else if (!serverOnly) {
          // No WTR config, check for test/browser directory
          const browserDir = join(cwd, 'test', 'browser');
          if (existsSync(browserDir)) {
            console.log(`\nwebjs test: running browser tests (WTR + Playwright)…\n`);
            const child = spawn('npx', ['wtr', '--files', 'test/browser/**/*.test.js'], {
              stdio: 'inherit', cwd, env: { ...process.env },
            });
            const code = await new Promise(r => child.on('exit', r));
            if (code !== 0) process.exit(code ?? 1);
          }
        }
      }

      console.log('\nwebjs test: done ✓');
      break;
    }
    case 'check': {
      const { checkConventions, RULES, loadConventionOverrides } = await import('@webjsdev/server/check');

      if (rest.includes('--rules')) {
        const overrides = await loadConventionOverrides(process.cwd());
        const anyOverride = Object.keys(overrides).length > 0;
        console.log('webjs check, available rules:');
        console.log('  All rules are ENABLED by default. A rule is only off when');
        console.log('  package.json "webjs": { "conventions": { ... } } sets it');
        console.log('  to false.\n');
        for (const r of RULES) {
          const off = overrides[r.name] === false;
          const status = off ? '[disabled by override]' : '[enabled]';
          console.log(`  ${r.name.padEnd(30)} ${status.padEnd(24)} ${r.description}`);
        }
        if (!anyOverride) {
          console.log('\n  (no overrides found; every rule above is active in this project)');
        }
        break;
      }

      const violations = await checkConventions(process.cwd());

      if (violations.length === 0) {
        console.log('webjs check: all conventions pass ✓');
      } else {
        console.log(`webjs check: ${violations.length} violation(s) found\n`);
        for (const v of violations) {
          console.log(`  ✗ [${v.rule}] ${v.file}`);
          console.log(`    ${v.message}`);
          if (v.fix) console.log(`    Fix: ${v.fix}`);
          console.log();
        }
        process.exit(1);
      }
      break;
    }
    case 'create': {
      const name = rest[0];
      if (!name || name.startsWith('-')) {
        console.error('Usage: webjs create <app-name> [--template full-stack|api|saas]');
        process.exit(1);
      }
      const template = flag(rest, '--template', 'full-stack');
      if (!TEMPLATES.includes(template)) {
        // AI agents sometimes hallucinate template names ("blog", "todo",
        // "ecommerce"). Reject early with the canonical list + guidance
        // on which scaffold to pick for which kind of app.
        console.error(`Error: unknown template '${template}'.

Only three scaffolds exist:
  full-stack   (default): pages + components + API + Prisma/SQLite.
                Pick this for any app the user describes in product terms
                (todo app, blog, dashboard, marketplace, social feed, …).
  api          backend-only: route handlers + modules, no pages/SSR.
                Pick this only if the user explicitly asks for an HTTP/JSON
                API with no UI.
  saas         auth + login/signup + protected dashboard + Prisma User
                model. Pick this only if the user explicitly asks for auth
                or a SaaS-shaped product.

The scaffold is a starting point. Replace the example layout/page/
components/schema with the actual app the user requested. Use Prisma +
SQLite for persistence (already wired up). Never store app data in JSON
files.

Full docs: https://docs.webjs.com`);
        process.exit(1);
      }
      const noInstall = rest.includes('--no-install');
      const { scaffoldApp } = await import('../lib/create.js');
      await scaffoldApp(name, process.cwd(), { template, install: !noInstall });
      break;
    }
    case 'vendor': {
      const sub = rest[0];
      const args = rest.slice(1);
      const appDir = process.cwd();
      const { pinAll, unpinPackage, listPinned } = await import('@webjsdev/server');

      if (sub === 'pin') {
        const download = args.includes('--download');
        console.log(
          `Pinning vendor packages from ${appDir}` +
          (download ? ' (downloading bundles)' : '') + '...',
        );
        const result = await pinAll(appDir, { download });
        if (result.noBareImports) {
          // Scanner found zero bare-specifier imports in client-
          // reachable source. Without this branch pinAll would write
          // `{ imports: {} }`, which readPinFile then rejects as empty,
          // leaving a useless file behind in whatever cwd.
          console.error(
            `Pin: no bare-specifier npm imports found in client code under ${appDir}. ` +
            `Nothing to pin (no pin file written). Add a bare import like ` +
            `\`import x from 'pkg-name'\` to a page or component, then rerun.`,
          );
          process.exit(1);
        }
        if (result.failed) {
          // pinAll refused to write the pin file because every install
          // failed to resolve via jspm.io (e.g. brand-new published
          // version not yet on the CDN, network outage, jspm.io 5xx).
          // Surface the failure so the user fixes the cause before
          // shipping; the per-package failures already logged via
          // jspmResolveOne above tell the user which packages broke.
          console.error(
            `Pin FAILED: every package failed to resolve via jspm.io. No pin file written ` +
            `(would shadow the live-API fallback with an empty importmap and break the browser).`,
          );
          console.error(`Attempted installs:`);
          for (const i of result.attemptedInstalls) console.error(`  ${i}`);
          console.error(
            `Possible causes: the package version is too new for jspm.io's CDN to have indexed yet; ` +
            `network outage; jspm.io is down. Try again in a few minutes, or pin an older version.`,
          );
          process.exit(1);
        }
        const { pins, pruned, downloaded } = result;
        for (const p of pins) {
          const sizeStr = p.bytes != null ? ` ${(p.bytes / 1024).toFixed(1)} KB` : '';
          console.log(`  ${(p.pkg + '@' + p.version).padEnd(40)}${sizeStr}`);
        }
        for (const f of pruned) {
          console.log(`  ${f.padEnd(40)} REMOVED (orphan)`);
        }
        const pinMsg = `Pinned ${pins.length} package${pins.length === 1 ? '' : 's'}, wrote .webjs/vendor/importmap.json` +
          (downloaded ? ` + ${downloaded} bundle${downloaded === 1 ? '' : 's'}` : '') + '.';
        const pruneMsg = pruned.length ? ` Pruned ${pruned.length} orphan${pruned.length === 1 ? '' : 's'}.` : '';
        console.log(pinMsg + pruneMsg);
        break;
      }

      if (sub === 'unpin') {
        if (args.length === 0) {
          console.error('Usage: webjs vendor unpin <pkg>');
          process.exit(1);
        }
        let unpinFailed = false;
        for (const pkg of args) {
          const r = await unpinPackage(appDir, pkg);
          if (!r.removed) {
            console.error(`  ${pkg.padEnd(40)} not in pin file`);
            unpinFailed = true;
            continue;
          }
          const extra = r.deletedFile ? ` (also deleted ${r.deletedFile})` : '';
          console.log(`  ${pkg.padEnd(40)} unpinned${extra}`);
        }
        // Exit non-zero if ANY of the requested packages weren't in
        // the pin file. Scripts wrapping the CLI rely on the exit
        // code to detect "nothing was removed"; printing the message
        // alone wasn't enough.
        if (unpinFailed) process.exit(1);
        break;
      }

      if (sub === 'list') {
        const entries = await listPinned(appDir);
        if (entries.length === 0) {
          console.log('No pin file. Run "webjs vendor pin" to create .webjs/vendor/importmap.json.');
          break;
        }
        console.log(`Pinned packages from ${appDir}/.webjs/vendor/importmap.json:`);
        for (const e of entries) {
          const sizeStr = e.bytes != null ? ` ${(e.bytes / 1024).toFixed(1)} KB` : '';
          console.log(`  ${(e.pkg + '@' + e.version).padEnd(40)}${sizeStr}`);
          console.log(`    ${e.url}`);
        }
        console.log(`${entries.length} package${entries.length === 1 ? '' : 's'} pinned.`);
        break;
      }

      console.error(`Unknown vendor subcommand: ${sub || '(none)'}\n` +
        `Usage:\n` +
        `  webjs vendor pin [--download]    Pin packages to .webjs/vendor/importmap.json\n` +
        `  webjs vendor unpin <pkg>         Remove a package from the pin file\n` +
        `  webjs vendor list                Show pinned packages with versions and URLs`);
      process.exit(1);
    }
    case 'help':
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n` + USAGE);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
