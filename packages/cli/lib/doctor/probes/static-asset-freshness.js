/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 * @typedef {'fresh' | 'stale' | 'missing' | 'unrecorded'} RegenerateState
 * @typedef {(appDir: string) => Promise<Array<{ output: string, command: string, state: RegenerateState }>>} RegenerateStatusFn
 */

const NAME = 'Static build outputs (dev.regenerate freshness)';

const WHY = {
  stale: 'an input, its command, or the file changed since it was built',
  unrecorded: 'built outside `webjs regenerate`, so nothing records what from',
};

/**
 * ADVISORY: a declared `webjs.dev.regenerate` output does not match the build
 * record in `.webjs/regenerate.json` (#1672). In DEV the server rebuilds such an
 * output on request (#967), so this never bites locally; the check is the
 * dev/prod PARITY backstop for a `webjs start` (which does not rebuild on
 * request) or a committed file. WARN-level, and a missing output (a fresh clone
 * before its first build) is not this app's bug to report.
 *
 * Freshness is the server's own definition, read through `regenerateStatus`
 * from `@webjsdev/server`, so the doctor and the dev server cannot disagree.
 * The remedy is `webjs regenerate`, which works in a pipeline with no dev
 * server: it rebuilds what is not fresh and records each build.
 *
 * @param {string} appDir
 * @param {{ regenerateStatus?: RegenerateStatusFn, importServer?: () => Promise<{ regenerateStatus?: RegenerateStatusFn }> }} [opts]
 *   injectable for tests: the reader itself, or the import that supplies it
 * @returns {Promise<DoctorResult>}
 */
export async function checkStaticAssetFreshness(appDir, opts = {}) {
  let status = opts.regenerateStatus;
  if (!status) {
    try {
      const mod = await (opts.importServer || (() => import('@webjsdev/server')))();
      status = typeof mod.regenerateStatus === 'function' ? mod.regenerateStatus : undefined;
    } catch {
      status = undefined;
    }
  }
  if (!status) {
    return {
      name: NAME,
      status: 'warn',
      bestEffort: true,
      message: 'Could not load the installed @webjsdev/server build record reader, so declared build outputs were not checked.',
      fix: 'Install a @webjsdev/server that matches this CLI (`npm install`), then re-run `webjs doctor`.',
    };
  }
  const rows = await status(appDir);
  if (rows.length === 0) {
    return { name: NAME, status: 'pass', message: 'no webjs.dev.regenerate rules declared' };
  }
  const off = rows.filter((r) => r.state === 'stale' || r.state === 'unrecorded');
  if (off.length === 0) {
    return { name: NAME, status: 'pass', message: 'every declared build output matches its build record' };
  }
  return {
    name: NAME,
    status: 'warn',
    message:
      `${off.length} static build output(s) do not match the build record (.webjs/regenerate.json):\n` +
      off.map((r) => `    ${r.output} (${r.state}: ${WHY[/** @type {'stale' | 'unrecorded'} */ (r.state)]})`).join('\n') +
      '\n    In dev the server rebuilds these on request, so this only bites a `webjs start` (prod) or a committed file.',
    fix: 'Run `webjs regenerate`: it rebuilds every output that is not fresh and records each build, with no dev server. In CI run it before `webjs doctor`, and list it in `dev.before` / `start.before` in place of the raw compile command so every build is recorded.',
  };
}
