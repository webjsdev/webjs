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
  webjs dev   [--port 3000]                       Start dev server with live reload
  webjs start [--port 3000]                       Start production server (serves source directly, no build step)
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
        const port = Number(flag(rest, '--port', process.env.PORT || 3000));
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
      const port = Number(flag(rest, '--port', process.env.PORT || 3000));
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
      // Pre-populate vendor/javascript/ with esm.sh bundles so the
      // server never has to call out to a CDN at runtime. Mirrors Rails 7's
      // `bin/importmap pin` UX. See agent-docs/vendor.md for the full guide.
      const sub = rest[0];
      const args = rest.slice(1);
      const { pinPackage, pinAll, removeFromCache, listCache, extractPackageName, extractSubpath, getPackageVersion } =
        await import('@webjsdev/server/src/vendor.js');
      const appDir = process.cwd();

      if (sub === 'pin') {
        if (args.length === 0) {
          // Pin every bare import currently used in the app
          console.log(`Pinning vendor packages from ${appDir}...`);
          const results = await pinAll(appDir);
          let totalBytes = 0;
          let okCount = 0;
          for (const r of results) {
            if (r.ok) {
              console.log(`  ${r.spec.padEnd(40)} ${(r.bytes / 1024).toFixed(1)} KB`);
              totalBytes += r.bytes;
              okCount++;
            } else {
              console.error(`  ${r.spec.padEnd(40)} FAILED: ${r.error}`);
            }
          }
          console.log(`Pinned ${okCount} package${okCount === 1 ? '' : 's'}, ${(totalBytes / 1024).toFixed(1)} KB total.`);
        } else {
          // Pin specific packages by name (and optional @version)
          for (const target of args) {
            const atIdx = target.lastIndexOf('@');
            const hasVersion = atIdx > 0; // > 0 to skip scoped @
            const spec = hasVersion ? target.slice(0, atIdx) : target;
            const pkgName = extractPackageName(spec);
            const subpath = extractSubpath(spec);
            if (!pkgName) { console.error(`  ${target}: invalid specifier`); continue; }
            const version = hasVersion ? target.slice(atIdx + 1) : getPackageVersion(pkgName, appDir);
            if (!version) {
              console.error(`  ${target}: cannot determine version (package not installed and no @version given)`);
              continue;
            }
            const r = await pinPackage(appDir, pkgName, version, subpath);
            if (r.ok) console.log(`  ${pkgName}@${version}${subpath} ${(r.bytes / 1024).toFixed(1)} KB`);
            else console.error(`  ${pkgName}@${version}${subpath} FAILED: ${r.error}`);
          }
        }
        break;
      }

      if (sub === 'unpin') {
        if (args.length === 0) { console.error('Usage: webjs vendor unpin <pkg>[@version]'); process.exit(1); }
        for (const target of args) {
          const atIdx = target.lastIndexOf('@');
          const hasVersion = atIdx > 0;
          const spec = hasVersion ? target.slice(0, atIdx) : target;
          const pkgName = extractPackageName(spec);
          const subpath = extractSubpath(spec);
          if (!pkgName) { console.error(`  ${target}: invalid specifier`); continue; }
          const version = hasVersion ? target.slice(atIdx + 1) : getPackageVersion(pkgName, appDir);
          if (!version) { console.error(`  ${target}: cannot determine version`); continue; }
          await removeFromCache(appDir, pkgName, version, subpath);
          console.log(`  unpinned ${pkgName}@${version}${subpath}`);
        }
        break;
      }

      if (sub === 'list') {
        const entries = await listCache(appDir);
        if (entries.length === 0) { console.log('Cache is empty. Run "webjs vendor pin" to populate.'); break; }
        console.log(`Cache: ${appDir}/vendor/javascript/`);
        let total = 0;
        for (const e of entries) {
          const name = `${e.pkg}@${e.version}${e.subpath}`;
          console.log(`  ${name.padEnd(40)} ${(e.bytes / 1024).toFixed(1)} KB`);
          total += e.bytes;
        }
        console.log(`${entries.length} package${entries.length === 1 ? '' : 's'} cached, ${(total / 1024).toFixed(1)} KB total.`);
        break;
      }

      console.error(`Unknown vendor subcommand: ${sub || '(none)'}\n` +
        `Usage:\n` +
        `  webjs vendor pin                       pin every bare import in this app\n` +
        `  webjs vendor pin <pkg>[@version]       pin a specific package\n` +
        `  webjs vendor unpin <pkg>[@version]     remove a package from cache\n` +
        `  webjs vendor list                      show cache contents`);
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
