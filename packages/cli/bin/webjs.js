#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkNodeInline, nodeInlineMessage } from '../lib/node-preflight.js';
import { loadAppEnv, resolvePort } from '../lib/port.js';
import { planDevSupervisor } from '../lib/dev-supervisor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

// Node-version preflight (issue #238), INLINE and dependency-free.
// This MUST run before any `import @webjsdev/server`: importing the server
// package links `src/dev.js`, which references Node 24+ builtins, so on an old
// Node that import would LINK-fail before any preflight inside the server
// package could run. The primary guard is therefore `checkNodeInline` (from
// `../lib/node-preflight.js`, which imports nothing), depending only on
// `process.versions.node`. The richer `assertNodeVersion` import inside main()
// stays as belt-and-suspenders for the link-ok (>= 22.13) cases.
// `help` / no-arg is exempt so a user on an old Node can still read usage.
if (cmd !== 'help' && cmd !== undefined) {
  let engines = '>=24.0.0';
  try {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    );
    engines = pkg?.engines?.node || engines;
  } catch {}
  const r = checkNodeInline(process.versions.node, engines);
  if (!r.ok) {
    console.error(nodeInlineMessage(r));
    process.exit(1);
  }
}

// Exactly three scaffolds exist. Keep this list as the single source of
// truth. AI-agent docs in README.md / AGENTS.md / .cursorrules /
// .agents/rules/workflow.md / .github/copilot-instructions.md mirror it.
const TEMPLATES = ['full-stack', 'api', 'saas'];

const USAGE = `webjs commands:
  webjs dev   [--port 8080] [--no-hot]            Start dev server with live reload
                                                  (--no-hot: run in-process, no hot-reload supervisor)
  webjs start [--port 8080]                       Start production server (serves source directly, no build step)
  webjs test  [--server|--browser]                 Run server + browser tests
  webjs check [--json]                            Run correctness checks on the app (--json emits structured violations)
  webjs mcp                                       Start the read-only MCP server (routes / actions / components / check)
  webjs doctor                                    Verify project health (Node, tsconfig, env, vendor pins, importmap coherence, @webjsdev versions, git hook)
  webjs types                                     Generate .webjs/routes.d.ts (typed Route union + per-route params)
  webjs typecheck [tsc args...]                   Type-check the app with the project's tsc --noEmit (non-zero on errors)
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

/**
 * Run the configured `before` steps (#550) sequentially to completion before the
 * server boots: `dev.before` (e.g. `prisma generate`) for `webjs dev`,
 * `start.before` (e.g. `prisma migrate deploy`) for `webjs start`. These replace
 * the old `predev` / `prestart` npm hooks, so a bare `webjs dev`/`start` is not a
 * degraded run. A non-zero exit aborts the boot with a clear message (a failed
 * generate/migrate must not serve stale code/schema). No-op when there are no
 * steps. Runs through a shell so a step can be a normal command line.
 *
 * @param {string} phase 'dev' | 'start' (for the log line)
 * @param {string[]} steps
 * @param {string} cwd
 */
async function runBeforeSteps(phase, steps, cwd) {
  for (const step of steps) {
    console.log(`webjs ${phase}: running before-step \`${step}\`…`);
    const code = await new Promise((res) => {
      const c = spawn(step, { shell: true, stdio: 'inherit', cwd });
      c.on('exit', (code) => res(code ?? 0));
      c.on('error', () => res(1));
    });
    if (code !== 0) {
      console.error(`webjs ${phase}: before-step failed (exit ${code}): ${step}`);
      process.exit(code);
    }
  }
}

/**
 * Spawn the configured dev `parallel` tasks (#550) as long-lived children
 * ALONGSIDE the server, so a bare `webjs dev` runs the same watchers (Tailwind,
 * etc.) that `npm run dev` ran via `concurrently` + `pre*` hooks. Returns a
 * killer that tears them all down, so a leaked watcher cannot outlive the dev
 * server. A no-op when there are no parallel tasks, so a plain app is unchanged.
 *
 * @param {string[]} commands
 * @param {string} cwd
 * @returns {() => void}
 */
function startParallelTasks(commands, cwd) {
  const children = commands.map((cmd) => {
    console.log(`webjs dev: starting parallel task \`${cmd}\`…`);
    return spawn(cmd, { shell: true, stdio: 'inherit', cwd });
  });
  let killed = false;
  return () => {
    if (killed) return;
    killed = true;
    for (const c of children) {
      try { c.kill(); } catch {}
    }
  };
}

async function main() {
  // Preflight: webjs needs Node 24+ (built-in TS strip + recursive fs.watch).
  // Run before any subcommand so an older Node fails fast with a clear,
  // actionable message naming the found + required version, exiting non-zero
  // instead of crashing cryptically later. `help` is exempt so a user on an
  // old Node can still read usage.
  if (cmd !== 'help' && cmd !== undefined) {
    const { assertNodeVersion } = await import('@webjsdev/server');
    assertNodeVersion({ onFail: 'exit' });
  }
  switch (cmd) {
    case 'dev': {
      // If we're already inside the reload child (node --watch or bun --hot),
      // start the server directly.
      if (process.env.__WEBJS_DEV_CHILD === '1') {
        const { startServer } = await import('@webjsdev/server');
        // Load `.env` BEFORE resolving the port so a `PORT` set there is in
        // process.env at resolution time (#447). The server loads `.env`
        // too, but that runs too late to affect the port the CLI computes.
        loadAppEnv(process.cwd());
        const port = resolvePort(flag(rest, '--port'));
        await startServer({ appDir: process.cwd(), port, dev: true });
        break;
      }

      // A bare `webjs dev` (not `npm run dev`) skips the `predev` hook, so a
      // Prisma app boots against an ungenerated client and crashes with no
      // hint (#452). Detect that here, in the PARENT only, so the message
      // prints once rather than on every watch restart. Scoped to Prisma apps;
      // a non-Prisma app sees nothing. A hint, not an auto-run.
      const { prismaDevHint } = await import('../lib/prisma-preflight.js');
      const hint = prismaDevHint(process.cwd());
      if (hint) console.error(hint);

      // Run the configured dev orchestration in the PARENT only (#550), so a
      // bare `webjs dev` matches `npm run dev`. `dev.before` (one-shot, e.g.
      // `prisma generate`) runs to completion first; `dev.parallel` (Tailwind's
      // watcher, etc.) then runs as children alongside the server. Spawned once
      // here, NOT in the watch child (which re-execs on every restart). Torn
      // down on exit so a watcher cannot outlive the server.
      const { readAppTasks } = await import('../lib/app-tasks.js');
      const devTasks = readAppTasks(process.cwd());
      await runBeforeSteps('dev', devTasks.dev.before, process.cwd());
      const killTasks = startParallelTasks(devTasks.dev.parallel, process.cwd());
      process.on('SIGINT', () => { killTasks(); process.exit(0); });
      process.on('SIGTERM', () => { killTasks(); process.exit(0); });

      // Decide how to run: in-process (`--no-hot`), or re-exec'd under the host
      // runtime's hot-reload supervisor (`node --watch` on Node, `bun --hot` on
      // Bun, #514). The branch logic lives in the pure `planDevSupervisor` so it
      // is unit-testable without spawning a process.
      const { existsSync } = await import('node:fs');
      const plan = planDevSupervisor({
        isBun: !!process.versions.bun,
        argv: process.argv.slice(1),
        noHot: rest.includes('--no-hot'),
        exists: (p) => existsSync(p),
      });

      if (plan.mode === 'inline') {
        const { startServer } = await import('@webjsdev/server');
        loadAppEnv(process.cwd());
        const port = resolvePort(flag(rest, '--port'));
        await startServer({ appDir: process.cwd(), port, dev: true });
        killTasks();
        break;
      }

      const child = spawn(process.execPath, plan.args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, __WEBJS_DEV_CHILD: '1' },
      });
      child.on('exit', (code) => { killTasks(); process.exit(code ?? 0); });
      break;
    }
    case 'start': {
      const { startServer } = await import('@webjsdev/server');
      // Load `.env` BEFORE resolving the port so a `PORT` set there wins over
      // the 8080 default (#447), same as for `dev`.
      loadAppEnv(process.cwd());
      // Run the configured `start.before` steps (e.g. `webjs db migrate`)
      // before serving (#550), so a bare `webjs start` is not a degraded run
      // that skips the `prestart` hook. Aborts the boot on a failed step.
      const { readAppTasks } = await import('../lib/app-tasks.js');
      await runBeforeSteps('start', readAppTasks(process.cwd()).start.before, process.cwd());
      const port = resolvePort(flag(rest, '--port'));
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
      // @webjsdev/cli, so `npm install -g webjsdev` pulls it in
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
          console.error('Reinstall the CLI:  npm install -g webjsdev');
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

        // Walk test/ recursively so the documented feature-folder layout
        // (test/<feature>/<name>.test.ts) is discovered, not just files
        // sitting directly in test/. Two kinds are NOT run here:
        //   - **/browser/**  → real-browser tests, owned by WTR below.
        //   - **/e2e/**      → full-app boot, opt-in via WEBJS_E2E=1 (the
        //                      documented "WEBJS_E2E=1 webjs test adds the
        //                      e2e tests" semantics).
        const runE2E = !!process.env.WEBJS_E2E;
        const walk = async (dir, segments) => {
          let entries;
          try { entries = await readdir(dir, { withFileTypes: true }); }
          catch { return; }
          for (const ent of entries) {
            if (ent.name === 'node_modules') continue;
            const full = join(dir, ent.name);
            if (ent.isDirectory()) {
              if (ent.name === 'browser') continue;
              if (ent.name === 'e2e' && !runE2E) continue;
              await walk(full, [...segments, ent.name]);
            } else if (/\.test\.(js|ts|mjs|mts)$/.test(ent.name)) {
              if (!testFiles.includes(full)) testFiles.push(full);
            }
          }
        };
        await walk(join(cwd, 'test'), []);

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
      const { checkConventions, RULES } = await import('@webjsdev/server/check');

      if (rest.includes('--rules')) {
        console.log('webjs check, correctness rules:');
        console.log('  Every rule catches code that is wrong to ship: a crash, a');
        console.log('  security leak, a build/type-strip failure, or (the one');
        console.log('  sentinel-based rule, no-scaffold-placeholder) unreplaced');
        console.log('  scaffold example content. They always run. Project');
        console.log('  conventions (layout, style, process) are guidance in');
        console.log('  CONVENTIONS.md, not rules here.\n');
        for (const r of RULES) {
          console.log(`  ${r.name.padEnd(30)} ${r.description}`);
        }
        break;
      }

      const violations = await checkConventions(process.cwd());

      // --json emits the raw structured violations + a summary count as JSON,
      // so an agent running `webjs check` in a loop consumes structured data
      // instead of regex-scraping stdout. The shared projector keeps this byte-
      // identical to the MCP `check` tool. The non-zero exit on violations is
      // preserved (an agent gates on the exit code AND parses the report).
      if (rest.includes('--json')) {
        // The projector lives in @webjsdev/mcp (the MCP `check` tool's home),
        // so `check --json` and the MCP tool stay byte-identical (#415).
        const { projectCheck } = await import('@webjsdev/mcp/check-report');
        console.log(JSON.stringify(projectCheck(violations)));
        if (violations.length > 0) process.exit(1);
        break;
      }

      if (violations.length === 0) {
        console.log('webjs check: all checks pass ✓');
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
    case 'doctor': {
      // Project-health checklist (#266). The checks are PURE (in lib/doctor.js);
      // this branch only renders them and owns the exit code: non-zero iff any
      // HARD check FAILS, so CI can gate on it. Warns are informational and do
      // NOT fail the exit (env drift / pin staleness / version drift are the
      // app's concern, not a broken toolchain).
      const { runDoctorChecks } = await import('../lib/doctor.js');
      const results = await runDoctorChecks(process.cwd());
      const marker = { pass: '[pass]', warn: '[warn]', fail: '[fail]' };
      console.log('webjs doctor: project-health checklist\n');
      for (const r of results) {
        console.log(`  ${marker[r.status]} ${r.name}`);
        console.log(`    ${r.message}`);
        if (r.fix && r.status !== 'pass') console.log(`    Fix: ${r.fix}`);
        console.log();
      }
      const counts = results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, /** @type {Record<string, number>} */ ({}));
      const pass = counts.pass || 0;
      const warn = counts.warn || 0;
      const fail = counts.fail || 0;
      console.log(`  ${pass} passed, ${warn} warning(s), ${fail} failed.`);
      if (fail > 0) {
        console.error(
          `\nwebjs doctor: ${fail} hard check(s) failed. Fix the toolchain issue(s) above.`,
        );
        process.exit(1);
      }
      break;
    }
    case 'types': {
      // Generate `.webjs/routes.d.ts` from the app's `app/` routes (#258),
      // narrowing the @webjsdev/core `Route` href union + per-route `params`.
      // Opt-in codegen: the static types in @webjsdev/core work without it
      // (un-generated apps see `Route = string`).
      const { generateRouteTypes } = await import('@webjsdev/server');
      const { mkdir, writeFile } = await import('node:fs/promises');
      const appDir = process.cwd();
      const text = await generateRouteTypes(appDir);
      const outDir = join(appDir, '.webjs');
      await mkdir(outDir, { recursive: true });
      const outFile = join(outDir, 'routes.d.ts');
      await writeFile(outFile, text);
      // Count the typed routes (each `WebjsRoutes` key is one route literal).
      const count = (text.match(/^\s+".*": true;$/gm) || []).length;
      console.log(
        `webjs types: wrote .webjs/routes.d.ts (${count} route${count === 1 ? '' : 's'} typed). ` +
        `Ensure tsconfig "include" lists ".webjs/routes.d.ts" so tsserver picks it up.`,
      );
      break;
    }
    case 'typecheck': {
      // Type-check the app with the project's OWN tsc (it reads the app's
      // tsconfig: strict + noEmit + erasableSyntaxOnly). The framework runs the
      // standard compiler, it does not embed one. Extra args after `typecheck`
      // pass through (e.g. `webjs typecheck --watch`). Exits non-zero on a type
      // error, so it works as a CI gate and the scaffolded `typecheck` script.
      const cwd = process.cwd();
      const { createRequire } = await import('node:module');
      let tscPath;
      try {
        const req = createRequire(join(cwd, 'package.json'));
        tscPath = req.resolve('typescript/bin/tsc');
      } catch {
        console.error(
          'webjs typecheck: TypeScript is not installed in this project.\n' +
          'Install it with `npm install -D typescript`, then re-run `webjs typecheck`.',
        );
        process.exit(1);
      }
      const child = spawn(process.execPath, [tscPath, '--noEmit', ...rest], {
        stdio: 'inherit',
        cwd,
      });
      child.on('exit', (code) => process.exit(code ?? 1));
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
      const { pinAll, unpinPackage, listPinned, auditPinned, findOutdated, updatePinned, readPinFile, ensureVendorCommittable, SUPPORTED_PROVIDERS } = await import('@webjsdev/server');

      // Parse `--from <provider>` once at the top so subcommands share it.
      // Mirrors importmap-rails's `bin/importmap pin foo --from jsdelivr`.
      let from = 'jspm';
      const fromIdx = args.indexOf('--from');
      if (fromIdx !== -1) {
        from = args[fromIdx + 1];
        if (!from || !SUPPORTED_PROVIDERS.has(from)) {
          console.error(
            `Unknown --from provider '${from || ''}'. Supported: ${[...SUPPORTED_PROVIDERS].join(', ')}.`,
          );
          process.exit(1);
        }
        // Strip --from + its argument so downstream flag checks like
        // `args.includes('--download')` aren't confused.
        args.splice(fromIdx, 2);
      }

      if (sub === 'pin') {
        const download = args.includes('--download');
        // Same precedence rule as `vendor update`: explicit --from
        // wins; otherwise pinAll reads the pin file's persisted
        // provider so a user who pinned via jsdelivr stays on it.
        // Pass undefined (not the parsed 'jspm' default) when no
        // --from to engage the pin-file fallback. Peek at the pin
        // file here to compute the log line before pinAll runs.
        const explicitFrom = fromIdx !== -1 ? from : undefined;
        const existing = await readPinFile(appDir);
        const usedFrom = explicitFrom || existing?.provider || 'jspm';
        console.log(
          `Pinning vendor packages from ${appDir}` +
          (usedFrom !== 'jspm' ? ` via ${usedFrom}` : '') +
          (download ? ' (downloading bundles)' : '') + '...',
        );
        const result = await pinAll(appDir, { download, from: explicitFrom });
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
          // failed to resolve via the chosen resolver (jspm.io's
          // Generator API powers all providers; the failure mode is
          // typically a brand-new published version not yet on the
          // CDN, a network outage, or a provider-side 5xx). Surface
          // the failure with the actual provider in the message so
          // the user can fix the cause before shipping.
          const provider = result.provider || 'jspm.io';
          console.error(
            `Pin FAILED: every package failed to resolve via ${provider}. No pin file written ` +
            `(would shadow the live-API fallback with an empty importmap and break the browser).`,
          );
          console.error(`Attempted installs:`);
          for (const i of result.attemptedInstalls) console.error(`  ${i}`);
          console.error(
            `Possible causes: the package version is too new for ${provider}'s CDN to have indexed yet; ` +
            `network outage; ${provider} is down. Try again in a few minutes, or pin an older version.`,
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

        // Make the pins committable. Vendoring is opt-in, so the pins the
        // user just wrote are meant for source control; a `.gitignore`
        // that excludes `.webjs/` would silently swallow them. Fresh
        // scaffolds already carry the `!.webjs/vendor/` exception, so for
        // them this is a no-op. If the output IS ignored, self-heal the
        // app's own `.gitignore`; if there is no `.gitignore` to patch (the
        // ignore comes from a parent repo or `.git/info/exclude`), print a
        // notice so the pins do not vanish from `git status` unexplained.
        const committable = await ensureVendorCommittable(appDir);
        if (committable.patched) {
          console.log(
            `Added the \`.webjs/vendor/\` exception to .gitignore so these pins commit. ` +
            `Run \`git add .gitignore .webjs/vendor\`.`,
          );
        } else if (committable.ignored) {
          console.warn(
            `[webjs] .webjs/vendor/importmap.json is gitignored, so these pins will NOT ` +
            `commit. The ignore is not in this app's .gitignore (a parent repo's .gitignore ` +
            `or .git/info/exclude). Un-ignore it by adding \`!**/.webjs/vendor/\` and ` +
            `\`!**/.webjs/vendor/**\` where the \`.webjs\` exclusion lives, then ` +
            `\`git add .webjs/vendor\`. Verify with \`git check-ignore -q .webjs/vendor/importmap.json\`.`,
          );
        }
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

      if (sub === 'audit') {
        // npm bulk-advisories check against pinned versions. Mirrors
        // bin/importmap audit. Exits non-zero when any vulnerability
        // is found so CI can gate on it.
        const { vulnerable, totalChecked, errored } = await auditPinned(appDir);
        if (totalChecked === 0) {
          console.log('No pinned packages to audit. Run "webjs vendor pin" first.');
          break;
        }
        if (errored) {
          console.error(
            `Could not reach registry.npmjs.org for security advisories ` +
            `(network failure, timeout, or 5xx). Retry when connectivity is back.`,
          );
          process.exit(1);
        }
        if (vulnerable.length === 0) {
          console.log(`No vulnerable packages found (${totalChecked} checked).`);
          break;
        }
        console.log(`Package                                  Severity   Vulnerable versions       Title`);
        for (const v of vulnerable) {
          console.log(
            `  ${v.name.padEnd(38)} ${v.severity.padEnd(10)} ${v.vulnerableVersions.padEnd(25)} ${v.title}`,
          );
        }
        const bySeverity = vulnerable.reduce((acc, v) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1;
          return acc;
        }, /** @type {Record<string,number>} */ ({}));
        const summary = Object.entries(bySeverity)
          .sort((a, b) => b[1] - a[1])
          .map(([sev, n]) => `${n} ${sev}`).join(', ');
        console.error(
          `  ${vulnerable.length} vulnerabilit${vulnerable.length === 1 ? 'y' : 'ies'} found: ${summary}`,
        );
        process.exit(1);
      }

      if (sub === 'outdated') {
        // npm registry latest-version check against pinned versions.
        // Mirrors bin/importmap outdated. Exits non-zero when any
        // package is outdated so CI / Renovate-style automation can
        // detect it.
        const outdated = await findOutdated(appDir);
        if (outdated.length === 0) {
          console.log('No outdated packages found.');
          break;
        }
        console.log(`Package                                  Current               Latest`);
        for (const o of outdated) {
          console.log(`  ${o.pkg.padEnd(38)} ${o.current.padEnd(21)} ${o.latest}`);
        }
        console.error(
          `  ${outdated.length} outdated package${outdated.length === 1 ? '' : 's'} found.`,
        );
        process.exit(1);
      }

      if (sub === 'update') {
        // Re-pin outdated packages to latest. Mirrors bin/importmap
        // update. Does NOT modify package.json or node_modules; the
        // user should run `npm install <pkg>@<latest>` afterward to
        // keep the local install in sync.
        //
        // Provider precedence: explicit --from CLI flag wins. Without
        // it, updatePinned reads the pin file's persisted provider so
        // a user who pinned via jsdelivr stays on jsdelivr after
        // update. Pass `undefined` (not the parsed `from = 'jspm'`
        // default) when no --from was given so updatePinned's
        // pin-file fallback engages.
        const explicitFrom = fromIdx !== -1 ? from : undefined;
        const existing = await readPinFile(appDir);
        const usedFrom = explicitFrom || existing?.provider || 'jspm';
        console.log(`Updating outdated vendor pins in ${appDir}${usedFrom !== 'jspm' ? ` via ${usedFrom}` : ''}...`);
        const result = await updatePinned(appDir, { from: explicitFrom });
        if (result.noOutdated) {
          console.log('No outdated packages found.');
          break;
        }
        if (result.updated.length === 0) {
          console.error('No packages were updated (jspm.io may have failed to resolve any of the new versions).');
          process.exit(1);
        }
        for (const u of result.updated) {
          console.log(`  ${u.pkg.padEnd(38)} ${u.from} → ${u.to}`);
        }
        console.log(
          `Updated ${result.updated.length} package${result.updated.length === 1 ? '' : 's'}. ` +
          `Run \`npm install ${result.updated.map(u => `${u.pkg}@${u.to}`).join(' ')}\` to ` +
          `sync your node_modules.`,
        );
        break;
      }

      console.error(`Unknown vendor subcommand: ${sub || '(none)'}\n` +
        `Usage:\n` +
        `  webjs vendor pin [--from PROVIDER] [--download]   Pin packages to .webjs/vendor/importmap.json\n` +
        `  webjs vendor unpin <pkg>                          Remove a package from the pin file\n` +
        `  webjs vendor list                                 Show pinned packages with versions and URLs\n` +
        `  webjs vendor audit                                Run a security audit against pinned versions\n` +
        `  webjs vendor outdated                             Check pinned packages for newer versions\n` +
        `  webjs vendor update [--from PROVIDER]             Re-pin outdated packages to latest\n` +
        `\n` +
        `  --from PROVIDER     CDN to resolve through. One of: ${[...SUPPORTED_PROVIDERS].join(', ')}. Default: jspm.`);
      process.exit(1);
    }
    case 'mcp': {
      // Read-only MCP server (#262, #415) over stdio. STDOUT is the JSON-RPC
      // channel, so nothing here may write to stdout: the data functions are
      // read-only and `runMcpServer` routes all diagnostics to stderr. The
      // implementation lives in the standalone `@webjsdev/mcp` package (also
      // runnable directly as `npx @webjsdev/mcp`); `webjs mcp` delegates to it
      // for back-compat. The version advertised in the initialize handshake is
      // @webjsdev/mcp's own, resolved by its bin, so this passes none.
      const { runMcpServer } = await import('@webjsdev/mcp');
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      let version = '0.0.0';
      try {
        const { readFileSync } = await import('node:fs');
        version = JSON.parse(
          readFileSync(require.resolve('@webjsdev/mcp/package.json'), 'utf8'),
        ).version || version;
      } catch {}
      await runMcpServer({
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: process.cwd(),
        version,
      });
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
