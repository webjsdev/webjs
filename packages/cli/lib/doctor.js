/**
 * `webjs doctor`: a project-health checklist runner (issue #266).
 *
 * webjs has unusually many fragile preconditions, each an independent failure
 * mode a contributor onboarding to an existing repo only hits at runtime: the
 * Node 24+ strip-types floor, the `erasableSyntaxOnly` TS flag, importmap pin
 * freshness, env drift vs `.env.example`, `@webjsdev/*` version coherence, and
 * the git pre-commit hook activation. `webjs doctor` verifies each one up front
 * and prints pass/warn/fail with an actionable fix line.
 *
 * This module is PURE: `runDoctorChecks(appDir, opts?)` reads files (and, for
 * the pin check, optionally the network), but NEVER calls `process.exit` and
 * NEVER prints. The CLI (`bin/webjs.js`, `case 'doctor'`) renders the results
 * and owns the exit code, which is what makes every check unit-testable in
 * isolation against a tmp fixture appDir.
 *
 * HARD-FAIL vs WARN split (the CLI exits non-zero on any 'fail'):
 *
 *   - 'fail' is reserved for a genuinely-broken TOOLCHAIN that would crash or
 *     500 at runtime, so CI can gate on it. Two checks can fail:
 *       * Node version below the required major (the strip-types floor).
 *       * `erasableSyntaxOnly` missing/false in an EXISTING tsconfig (non-erasable
 *         TS would fail at strip time with a 500).
 *   - 'warn' is for drift / preferences / best-effort signals that are the
 *     app's own runtime concern, never a doctor hard-fail: a missing tsconfig
 *     (a JS-only app legitimately has none), env drift, an outdated or
 *     unverifiable vendor pin, a `@webjsdev/*` version drift or missing install,
 *     and a missing/non-executable git hook.
 *   - 'pass' is the green path.
 *
 * Every NETWORK touch (only the vendor-pin freshness check) is BEST-EFFORT: a
 * fetch failure is a WARN ("could not check, network"), never a hard fail and
 * never a throw that crashes the command. Network is flaky, and a doctor that
 * fails CI because npm was briefly unreachable is worse than useless.
 */

import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkNodeInline } from './node-preflight.js';

/**
 * @typedef {'pass' | 'warn' | 'fail'} DoctorStatus
 * @typedef {{ name: string, status: DoctorStatus, message: string, fix?: string }} DoctorResult
 */

/**
 * Read the CLI package's own `engines.node` so the required Node major lives in
 * one place (mirrors how `bin/webjs.js` sources it). Falls back to `>=24.0.0`.
 * @param {string} cliDir  directory of THIS file's package (lib/ -> package root)
 * @returns {Promise<string>}
 */
async function readEngines(cliDir) {
  try {
    const pkg = JSON.parse(await readFile(join(cliDir, '..', 'package.json'), 'utf8'));
    return pkg?.engines?.node || '>=24.0.0';
  } catch {
    return '>=24.0.0';
  }
}

/**
 * Strip `//` line comments, block comments, and trailing commas from a JSONC
 * string so a tsconfig (which permits all three) parses with `JSON.parse`.
 * Deliberately simple: it does not honor comment-looking sequences inside
 * string values, which is acceptable for a tsconfig (paths rarely contain `//`
 * or block-comment markers, and the worst case is a parse failure the caller
 * already degrades to a WARN).
 * @param {string} text
 * @returns {string}
 */
function stripJsonc(text) {
  let out = '';
  let inString = false;
  let stringQuote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        // Copy the escaped char verbatim so an escaped quote does not end the string.
        out += text[i + 1] || '';
        i++;
      } else if (ch === stringQuote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++; // land on the '/'
      continue;
    }
    out += ch;
  }
  // Drop trailing commas before } or ].
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Parse a `.env`-style file into the SET of KEY names it declares. A simple
 * `KEY=value` line parse: comments (`#`) and blank lines are skipped, and only
 * the key before the first `=` is taken (the value is irrelevant for drift).
 * @param {string} text
 * @returns {Set<string>}
 */
function parseEnvKeys(text) {
  const keys = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    let key = line.slice(0, eq).trim();
    // Tolerate a leading `export ` (a common .env.example convention).
    if (key.startsWith('export ')) key = key.slice('export '.length).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) keys.add(key);
  }
  return keys;
}

/**
 * CHECK 1, Node version. HARD-FAIL when the running major is below the required
 * major (the strip-types + recursive fs.watch floor). `opts.nodeVersion` lets a
 * test inject the running version so the fail case is assertable without being
 * on old Node.
 * @param {string} cliDir
 * @param {{ nodeVersion?: string }} opts
 * @returns {Promise<DoctorResult>}
 */
async function checkNode(cliDir, opts) {
  const engines = await readEngines(cliDir);
  const current = opts.nodeVersion || process.versions.node;
  const r = checkNodeInline(current, engines);
  if (r.ok) {
    return {
      name: 'node-version',
      status: 'pass',
      message: `Node ${r.current} satisfies the required Node ${r.requiredMajor}+.`,
    };
  }
  return {
    name: 'node-version',
    status: 'fail',
    message:
      `Node ${r.current} is below the required Node ${r.requiredMajor}+. ` +
      `webjs is buildless and relies on Node ${r.requiredMajor}'s built-in TypeScript ` +
      `strip and recursive fs.watch.`,
    fix: `Upgrade to Node ${r.requiredMajor}+ (see https://nodejs.org).`,
  };
}

/**
 * CHECK 2, tsconfig erasableSyntaxOnly. PASS when `true`; WARN when no tsconfig
 * (a JS-only app legitimately has none) or the file is unparseable; HARD-FAIL
 * when the file EXISTS but the flag is missing/false (non-erasable TS 500s at
 * strip time).
 * @param {string} appDir
 * @returns {Promise<DoctorResult>}
 */
async function checkTsconfig(appDir) {
  const path = join(appDir, 'tsconfig.json');
  if (!existsSync(path)) {
    return {
      name: 'tsconfig-erasable',
      status: 'warn',
      message: 'No tsconfig.json found. A JS-only app needs none; a TypeScript app requires one.',
      fix: 'If this app uses TypeScript, add a tsconfig.json with "erasableSyntaxOnly": true.',
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(stripJsonc(await readFile(path, 'utf8')));
  } catch {
    return {
      name: 'tsconfig-erasable',
      status: 'warn',
      message: 'tsconfig.json could not be parsed (even after stripping comments + trailing commas).',
      fix: 'Fix the tsconfig.json syntax, then ensure "compilerOptions.erasableSyntaxOnly": true.',
    };
  }
  const flag = parsed?.compilerOptions?.erasableSyntaxOnly;
  if (flag === true) {
    return {
      name: 'tsconfig-erasable',
      status: 'pass',
      message: 'tsconfig.json sets "erasableSyntaxOnly": true.',
    };
  }
  return {
    name: 'tsconfig-erasable',
    status: 'fail',
    message:
      'tsconfig.json is missing "compilerOptions.erasableSyntaxOnly": true. ' +
      'Non-erasable TypeScript (enum, namespace, parameter properties, ...) 500s at strip time.',
    fix: 'Set "compilerOptions": { "erasableSyntaxOnly": true } in tsconfig.json.',
  };
}

/**
 * CHECK 3, .env presence + drift vs .env.example. WARN-level only (a missing
 * env var is the app's runtime problem, not a toolchain crash). When no
 * `.env.example`, PASS (nothing to compare). When `.env.example` exists but
 * `.env` is absent, WARN to copy it. Otherwise WARN listing any example key
 * missing from `.env`, else PASS.
 * @param {string} appDir
 * @returns {Promise<DoctorResult>}
 */
async function checkEnv(appDir) {
  const examplePath = join(appDir, '.env.example');
  if (!existsSync(examplePath)) {
    return {
      name: 'env-drift',
      status: 'pass',
      message: 'No .env.example to compare against.',
    };
  }
  const exampleKeys = parseEnvKeys(await readFile(examplePath, 'utf8'));
  const envPath = join(appDir, '.env');
  if (!existsSync(envPath)) {
    return {
      name: 'env-drift',
      status: 'warn',
      message: '.env.example exists but .env does not.',
      fix: 'Copy it: cp .env.example .env  (then fill in the values).',
    };
  }
  const envKeys = parseEnvKeys(await readFile(envPath, 'utf8'));
  const missing = [...exampleKeys].filter((k) => !envKeys.has(k));
  if (missing.length === 0) {
    return {
      name: 'env-drift',
      status: 'pass',
      message: `.env has all ${exampleKeys.size} key(s) declared in .env.example.`,
    };
  }
  return {
    name: 'env-drift',
    status: 'warn',
    message: `.env is missing ${missing.length} key(s) from .env.example: ${missing.join(', ')}.`,
    fix: 'Add the missing key(s) to .env (see .env.example for the expected names).',
  };
}

/**
 * CHECK 4, vendor pin freshness. Applies ONLY when a pin file exists. PASS/skip
 * for an unpinned app (it resolves live, which is fine in dev). BEST-EFFORT +
 * NETWORK-TOLERANT: any error (network, timeout) is a WARN "could not check",
 * never a hard fail and never a throw. PASS when all pins current, WARN listing
 * outdated packages otherwise.
 *
 * The vendor functions are injected via `opts.vendor` so a test can supply a
 * stub without a real network call; absent the override, they are dynamically
 * imported from `@webjsdev/server`.
 * @param {string} appDir
 * @param {{ vendor?: { hasVendorPin: (d: string) => boolean, findOutdated: (d: string) => Promise<Array<{ pkg: string, current: string, latest: string }>> } }} opts
 * @returns {Promise<DoctorResult>}
 */
async function checkVendorPin(appDir, opts) {
  let vendor = opts.vendor;
  if (!vendor) {
    try {
      const mod = await import('@webjsdev/server');
      vendor = { hasVendorPin: mod.hasVendorPin, findOutdated: mod.findOutdated };
    } catch {
      return {
        name: 'vendor-pin',
        status: 'warn',
        message: 'Could not load the vendor toolchain to check pin freshness.',
        fix: 'Run `npm install` so @webjsdev/server is available, then re-run `webjs doctor`.',
      };
    }
  }
  let pinned = false;
  try {
    pinned = vendor.hasVendorPin(appDir);
  } catch {
    pinned = false;
  }
  if (!pinned) {
    return {
      name: 'vendor-pin',
      status: 'pass',
      message: 'No vendor pin file; the app resolves vendor imports live (fine in dev).',
    };
  }
  let outdated;
  try {
    outdated = await vendor.findOutdated(appDir);
  } catch {
    // findOutdated is built to swallow fetch errors and return [], but guard
    // anyway: a network check must NEVER throw out of doctor.
    return {
      name: 'vendor-pin',
      status: 'warn',
      message: 'Could not check pin freshness (network unreachable or registry error).',
      fix: 'Re-run `webjs doctor` when connectivity is back, or run `webjs vendor outdated`.',
    };
  }
  if (!Array.isArray(outdated) || outdated.length === 0) {
    return {
      name: 'vendor-pin',
      status: 'pass',
      message: 'All vendor pins are current.',
    };
  }
  const list = outdated.map((o) => `${o.pkg} (${o.current} -> ${o.latest})`).join(', ');
  return {
    name: 'vendor-pin',
    status: 'warn',
    message: `${outdated.length} pinned package(s) are outdated: ${list}.`,
    fix: 'Run `webjs vendor update` to re-pin to the latest versions.',
  };
}

/**
 * Compare an installed version against a semver range PRAGMATICALLY (no semver
 * dependency). Supports the common scaffold shapes: `latest` / `*` / `workspace:*`
 * (any installed version satisfies), an exact `1.2.3`, and a caret `^1.2.3`
 * (installed must be >= the floor AND share the same major, with major 0 also
 * pinning the minor, matching npm caret semantics). An unrecognized range is
 * treated as "cannot statically verify" (returns null), so the caller does not
 * warn on a shape it does not understand.
 * @param {string} installed
 * @param {string} range
 * @returns {boolean | null}
 */
function satisfiesRange(installed, range) {
  if (!installed) return null;
  const r = String(range).trim();
  if (r === 'latest' || r === '*' || r === '' || r.startsWith('workspace:')) return true;
  const parse = (v) => {
    const m = String(v).match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const inst = parse(installed);
  if (!inst) return null;
  if (/^\d+\.\d+\.\d+$/.test(r)) {
    const exact = parse(r);
    return exact ? inst[0] === exact[0] && inst[1] === exact[1] && inst[2] === exact[2] : null;
  }
  if (r.startsWith('^')) {
    const floor = parse(r);
    if (!floor) return null;
    if (inst[0] !== floor[0]) return false;
    // For 0.x, caret pins the minor too (^0.7.0 allows 0.7.x, not 0.8.0).
    if (floor[0] === 0 && inst[1] !== floor[1]) return false;
    const cmp =
      inst[0] !== floor[0] ? inst[0] - floor[0] :
      inst[1] !== floor[1] ? inst[1] - floor[1] :
      inst[2] - floor[2];
    return cmp >= 0;
  }
  return null;
}

/**
 * CHECK 5, @webjsdev/* version coherence. WARN-level only (a version drift is
 * not a crash). Reads the app package.json `@webjsdev/*` ranges across
 * dependencies + devDependencies, then for each reads the INSTALLED version from
 * `node_modules/@webjsdev/<pkg>/package.json` and checks it satisfies the
 * declared range. PASS when every @webjsdev dep is present + satisfied; WARN on
 * a missing install or a range drift.
 * @param {string} appDir
 * @returns {Promise<DoctorResult>}
 */
async function checkWebjsVersions(appDir) {
  const pkgPath = join(appDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return {
      name: 'webjs-versions',
      status: 'warn',
      message: 'No package.json found in this directory.',
      fix: 'Run `webjs doctor` from the app root (where package.json lives).',
    };
  }
  let pkg;
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  } catch {
    return {
      name: 'webjs-versions',
      status: 'warn',
      message: 'package.json could not be parsed.',
      fix: 'Fix the package.json syntax.',
    };
  }
  const ranges = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const webjsDeps = Object.keys(ranges).filter((n) => n.startsWith('@webjsdev/'));
  if (webjsDeps.length === 0) {
    return {
      name: 'webjs-versions',
      status: 'warn',
      message: 'No @webjsdev/* dependencies declared in package.json.',
      fix: 'A webjs app depends on @webjsdev/core + @webjsdev/server (+ @webjsdev/cli).',
    };
  }
  const missing = [];
  const drift = [];
  for (const dep of webjsDeps) {
    const installedPkg = join(appDir, 'node_modules', dep, 'package.json');
    if (!existsSync(installedPkg)) {
      missing.push(dep);
      continue;
    }
    let installedVersion = '';
    try {
      installedVersion = JSON.parse(await readFile(installedPkg, 'utf8')).version || '';
    } catch {
      missing.push(dep);
      continue;
    }
    const ok = satisfiesRange(installedVersion, ranges[dep]);
    // null = a range shape we cannot statically verify; do not warn on it.
    if (ok === false) drift.push(`${dep}@${installedVersion} does not satisfy "${ranges[dep]}"`);
  }
  if (missing.length > 0) {
    return {
      name: 'webjs-versions',
      status: 'warn',
      message: `${missing.length} @webjsdev/* dependency not installed: ${missing.join(', ')}.`,
      fix: 'Run `npm install` to install the declared dependencies.',
    };
  }
  if (drift.length > 0) {
    return {
      name: 'webjs-versions',
      status: 'warn',
      message: `@webjsdev version drift: ${drift.join('; ')}.`,
      fix: 'Run `npm install` to reconcile node_modules with the declared ranges.',
    };
  }
  return {
    name: 'webjs-versions',
    status: 'pass',
    message: `All ${webjsDeps.length} @webjsdev/* dependency satisfy their declared ranges.`,
  };
}

/**
 * CHECK 6 (optional), git pre-commit hook installed + executable. WARN when the
 * repo is a git checkout but `.git/hooks/pre-commit` is absent or
 * non-executable, since the test-gate / changelog hook would not fire. PASS when
 * present + executable, or skip (PASS) when this is not a git checkout at all
 * (an exported tarball, a non-repo dir). Respects a configured `core.hooksPath`
 * is OUT of scope here: the common scaffold installs into `.git/hooks`, so this
 * checks the default location and a configured path is the user's own concern.
 * @param {string} appDir
 * @returns {DoctorResult}
 */
function checkGitHook(appDir) {
  const gitDir = join(appDir, '.git');
  if (!existsSync(gitDir)) {
    return {
      name: 'git-hook',
      status: 'pass',
      message: 'Not a git checkout; no pre-commit hook expected.',
    };
  }
  const hook = join(gitDir, 'hooks', 'pre-commit');
  if (!existsSync(hook)) {
    return {
      name: 'git-hook',
      status: 'warn',
      message: 'No .git/hooks/pre-commit hook installed.',
      fix: 'Install the project hooks (e.g. `npm install` runs the prepare step that wires them).',
    };
  }
  let executable = false;
  try {
    // Owner-execute bit. On a checkout without exec bits (some Windows / CI
    // setups) the hook will not run, so flag it.
    executable = (statSync(hook).mode & 0o100) !== 0;
  } catch {
    executable = false;
  }
  if (!executable) {
    return {
      name: 'git-hook',
      status: 'warn',
      message: '.git/hooks/pre-commit exists but is not executable.',
      fix: 'chmod +x .git/hooks/pre-commit',
    };
  }
  return {
    name: 'git-hook',
    status: 'pass',
    message: '.git/hooks/pre-commit is installed and executable.',
  };
}

/**
 * Run every doctor check against `appDir` and return the results. PURE: no
 * printing, no `process.exit`; the CLI renders + decides the exit code.
 *
 * @param {string} appDir  the app directory to check (usually `process.cwd()`)
 * @param {{
 *   nodeVersion?: string,
 *   cliDir?: string,
 *   vendor?: { hasVendorPin: (d: string) => boolean, findOutdated: (d: string) => Promise<Array<{ pkg: string, current: string, latest: string }>> },
 * }} [opts]  test-injection seams:
 *   - `nodeVersion`: override the running Node version (asserts the fail case
 *     without being on old Node);
 *   - `cliDir`: directory of the CLI package whose `engines.node` sources the
 *     required major (defaults to THIS module's package);
 *   - `vendor`: inject the `{ hasVendorPin, findOutdated }` pair so the pin check
 *     runs against a stub instead of a real network call.
 * @returns {Promise<DoctorResult[]>}
 */
export async function runDoctorChecks(appDir, opts = {}) {
  const cliDir = opts.cliDir || new URL('.', import.meta.url).pathname;
  const results = await Promise.all([
    checkNode(cliDir, opts),
    checkTsconfig(appDir),
    checkEnv(appDir),
    checkVendorPin(appDir, opts),
    checkWebjsVersions(appDir),
    Promise.resolve(checkGitHook(appDir)),
  ]);
  return results;
}
