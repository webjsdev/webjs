/**
 * Node-version preflight guard (issue #238).
 *
 * webjs depends on Node 24+ built-ins: `module.stripTypeScriptTypes` (the
 * no-build TypeScript strip) and recursive `fs.watch` (dev live-reload). On an
 * older Node the failure surfaces late and cryptically (a strip error or a
 * missing API deep inside a request), not as a clear "you need Node 24+". This
 * module is the single early preflight that fails fast with an actionable
 * message naming the exact version found and the version required.
 *
 * The check is a PURE function (`checkNodeVersion`) so it unit-tests with
 * injected version strings, no spawning an old Node. `assertNodeVersion` is the
 * thin side-effecting wrapper the CLI and the server entry both call: it prints
 * to stderr + exits non-zero (CLI), or throws a clear Error (embedded server),
 * depending on the `onFail` mode.
 *
 * The minimum is sourced from ONE place, this package's own `engines.node`
 * field, so it never drifts from what npm enforces on install.
 */
import { createRequire } from 'node:module';

/**
 * Parse the leading major-version integer out of a Node version string.
 * Handles `'24.1.0'`, `'v24.1.0'`, and prerelease tags like
 * `'24.0.0-nightly20240101'`. Returns `NaN` when no leading integer is found.
 * @param {string} version
 * @returns {number}
 */
export function parseMajor(version) {
  const m = String(version).trim().match(/^v?(\d+)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * Parse the minimum major version out of an `engines.node` range like
 * `'>=24.0.0'`, `'>= 24'`, or `'24.x'`. Returns `NaN` when no integer is found.
 * @param {string} engines
 * @returns {number}
 */
export function parseRequiredMajor(engines) {
  const m = String(engines).match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * Pure version check. Compares the running Node major against the required
 * minimum and returns a structured result (no side effects).
 * @param {string} current the running Node version (e.g. `process.versions.node`)
 * @param {number} requiredMajor the minimum acceptable major version
 * @returns {{ ok: boolean, current: string, currentMajor: number, requiredMajor: number, message: string }}
 */
export function checkNodeVersion(current, requiredMajor) {
  const currentMajor = parseMajor(current);
  // If we cannot parse the running version, fail open: do not block a runtime
  // that reports an unusual version string. The deep APIs guard themselves.
  const ok = Number.isNaN(currentMajor) || currentMajor >= requiredMajor;
  const message = ok
    ? ''
    : `webjs requires Node ${requiredMajor}+ but found Node ${current}. ` +
      `webjs is buildless and relies on Node ${requiredMajor}'s built-in ` +
      `TypeScript strip (module.stripTypeScriptTypes) and recursive fs.watch, ` +
      `neither of which exists on Node ${currentMajor}. ` +
      `Upgrade to Node ${requiredMajor} or newer (see https://nodejs.org).`;
  return { ok, current, currentMajor, requiredMajor, message };
}

/**
 * Read the minimum required Node major from this package's own
 * `engines.node` field, so the minimum lives in exactly one place. Falls back
 * to 24 if the field is missing or unparseable (defensive only).
 * @returns {number}
 */
export function requiredNodeMajor() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    const major = parseRequiredMajor(pkg?.engines?.node || '');
    if (!Number.isNaN(major)) return major;
  } catch {}
  return 24;
}

/**
 * Side-effecting preflight: assert the running Node satisfies the minimum.
 * On an unsupported Node, either exits the process non-zero (CLI, `onFail:
 * 'exit'`) or throws a clear Error (embedded server, `onFail: 'throw'`).
 * A no-op on a supported Node.
 * @param {{ current?: string, requiredMajor?: number, onFail?: 'exit'|'throw' }} [opts]
 * @returns {void}
 */
export function assertNodeVersion(opts = {}) {
  // Bun (#508) satisfies webjs's requirements through a different mechanism: the
  // TS strip comes from `amaro` (resolved by ts-strip.js), and `fs.watch` /
  // `node:crypto` are provided by its node-compat layer, even though Bun reports
  // a Node version string. The Node-major gate is a proxy for "the Node built-ins
  // exist", which does not hold on Bun, so skip it there. Only when no explicit
  // `current` is passed (real runtime detection, not a unit test override).
  if (opts.current === undefined && typeof process !== 'undefined' && process.versions && process.versions.bun) {
    return;
  }
  const current = opts.current ?? process.versions.node;
  const requiredMajor = opts.requiredMajor ?? requiredNodeMajor();
  const onFail = opts.onFail ?? 'throw';
  const result = checkNodeVersion(current, requiredMajor);
  if (result.ok) return;
  if (onFail === 'exit') {
    console.error(result.message);
    process.exit(1);
  }
  throw new Error(result.message);
}
