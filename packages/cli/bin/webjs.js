#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

// Exactly three scaffolds exist. Keep this list as the single source of
// truth. AI-agent docs in README.md / AGENTS.md / .cursorrules /
// .agents/rules/workflow.md / .github/copilot-instructions.md mirror it.
const TEMPLATES = ['full-stack', 'api', 'saas'];

const USAGE = `webjs commands:
  webjs dev   [--port 8080]                       Start dev server with live reload
  webjs start [--port 8080]                       Start production server (serves source directly, no build step)
  webjs test  [--server|--browser]                 Run server + browser tests
  webjs check                                     Run correctness checks on the app
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
        console.log('  Every rule catches objectively broken code (a crash, a');
        console.log('  security leak, or a build/type-strip failure) and always');
        console.log('  runs. Project conventions (layout, style, process) are');
        console.log('  guidance in CONVENTIONS.md, not rules here.\n');
        for (const r of RULES) {
          console.log(`  ${r.name.padEnd(30)} ${r.description}`);
        }
        break;
      }

      const violations = await checkConventions(process.cwd());

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
      const { pinAll, unpinPackage, listPinned, auditPinned, findOutdated, updatePinned, readPinFile, SUPPORTED_PROVIDERS } = await import('@webjsdev/server');

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
