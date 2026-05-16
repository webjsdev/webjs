#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

// Exactly three scaffolds exist — keep this list as the single source of
// truth. AI-agent docs in README.md / AGENTS.md / .cursorrules /
// .windsurfrules / .github/copilot-instructions.md mirror it.
const TEMPLATES = ['full-stack', 'api', 'saas'];

const USAGE = `webjs — commands:
  webjs dev   [--port 3000]                       Start dev server with live reload
  webjs start [--port 3000]                       Start production server (serves source directly; no build step)
  webjs test  [--server|--browser]                 Run server + browser tests
  webjs check                                     Validate app against conventions
  webjs create <name> [--template full-stack|api|saas]  Scaffold a new webjs app
                                                  (only 3 templates exist; default: full-stack with Prisma+SQLite)
  webjs db generate                               Run \`prisma generate\`
  webjs db migrate [name]                         Run \`prisma migrate dev\`
  webjs db studio                                 Run \`prisma studio\`
  webjs ui <subcmd>                               AI-first component library CLI
                                                  (init / add / list / view / diff / info)
                                                  Requires @webjskit/ui installed in the project
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
        const { startServer } = await import('@webjskit/server');
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
      const { startServer } = await import('@webjskit/server');
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
      // Delegate to @webjskit/ui. Bundled as a hard dependency of
      // @webjskit/cli — `npm install -g @webjskit/cli` pulls it in
      // automatically, so `webjs ui add button` works out of the box
      // without an extra install in user projects.
      const { createRequire } = await import('node:module');
      const req = createRequire(import.meta.url);
      let entry;
      try {
        entry = req.resolve('@webjskit/ui/bin/webjsui.js');
      } catch {
        // Fallback: try resolving from the user's cwd in case of weird
        // workspace setups.
        try {
          const userReq = createRequire(join(process.cwd(), 'package.json'));
          entry = userReq.resolve('@webjskit/ui/bin/webjsui.js');
        } catch {
          console.error('@webjskit/ui could not be resolved.');
          console.error('Reinstall the CLI:  npm install -g @webjskit/cli');
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
          // No WTR config — check for test/browser directory
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
      const { checkConventions, RULES } = await import('@webjskit/server/check');
      const violations = await checkConventions(process.cwd());

      if (rest.includes('--rules')) {
        console.log('webjs check — available rules:\n');
        for (const r of RULES) {
          console.log(`  ${r.name.padEnd(30)} ${r.description}`);
        }
        break;
      }

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
  full-stack   (default) — pages + components + API + Prisma/SQLite.
                Pick this for any app the user describes in product terms
                (todo app, blog, dashboard, marketplace, social feed, …).
  api          — backend-only: route handlers + modules, no pages/SSR.
                Pick this only if the user explicitly asks for an HTTP/JSON
                API with no UI.
  saas         — auth + login/signup + protected dashboard + Prisma User
                model. Pick this only if the user explicitly asks for auth
                or a SaaS-shaped product.

The scaffold is a starting point — replace the example layout/page/
components/schema with the actual app the user requested. Use Prisma +
SQLite for persistence (already wired up); never store app data in JSON
files.

Full docs: https://docs.webjs.com`);
        process.exit(1);
      }
      const { scaffoldApp } = await import('../lib/create.js');
      await scaffoldApp(name, process.cwd(), { template });
      break;
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
