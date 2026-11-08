import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newestMtimeMs } from '../util.js';

/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/**
 * ADVISORY: a declared `webjs.dev.regenerate` output is STALE on disk (a source
 * is newer than the committed/built output). In DEV the framework recompiles it
 * on request (#967), so this never bites locally, but the check is the explicit
 * dev/prod PARITY backstop: it catches a stale `public/tailwind.css` that would
 * be served as-is by `webjs start` (prod does NOT recompile on request) or
 * committed into the repo. WARN-level: the fix is a one-line rebuild, and a
 * missing output (a fresh clone before the first `css:build`) is not this app's
 * bug to hard-fail on.
 *
 * The comparison is the server's own (`maybeRegenerate` in
 * `@webjsdev/server/src/dev-regenerate.js`), reimplemented rather than imported
 * so the CLI does not depend on a newer server. Since #1672 a clean dev
 * regenerate stamps the output at its newest input mtime, so this check agrees
 * with the dev server after any regenerate. A rebuild by hand (`npm run
 * css:build`) gets no stamp, and a compiler that skips an unchanged write (the
 * Tailwind CLI) then leaves the output's mtime old with current bytes, which is
 * why the message says requesting the output under `webjs dev` clears it.
 * @param {string} appDir
 * @returns {Promise<DoctorResult>}
 */
export async function checkStaticAssetFreshness(appDir) {
  const name = 'Static build outputs (dev.regenerate freshness)';
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
  } catch {
    return { name, status: 'pass', message: 'no package.json to analyse' };
  }
  const rules = pkg && pkg.webjs && pkg.webjs.dev ? pkg.webjs.dev.regenerate : null;
  if (!Array.isArray(rules) || rules.length === 0) {
    return { name, status: 'pass', message: 'no webjs.dev.regenerate rules declared' };
  }
  const stale = [];
  for (const rule of rules) {
    if (!rule || typeof rule.output !== 'string') continue;
    const output = rule.output.replace(/^\/+/, '');
    const outMtime = newestMtimeMs(join(appDir, output));
    if (outMtime === 0) continue; // missing output: not a staleness fail (built on first boot)
    let newestSrc = 0;
    for (const inp of Array.isArray(rule.inputs) ? rule.inputs : []) {
      const m = newestMtimeMs(join(appDir, inp));
      if (m > newestSrc) newestSrc = m;
    }
    if (newestSrc > outMtime) stale.push({ output, command: rule.command });
  }
  if (stale.length === 0) {
    return { name, status: 'pass', message: 'every declared build output is up to date with its sources' };
  }
  return {
    name,
    status: 'warn',
    message:
      `${stale.length} static build output(s) are older than a source file:\n` +
      stale.map((s) => `    ${s.output} (rebuild: ${s.command})`).join('\n') +
      '\n    In dev the framework recompiles these on request, so this only bites a `webjs start` (prod) or a committed stale file.' +
      '\n    A compiler that skips writing unchanged bytes (the Tailwind CLI does) leaves the mtime old after a rebuild by hand, so this can persist with current CSS.',
    fix: 'Request the output once under `webjs dev`: it rebuilds a stale output and stamps it fresh, even when the bytes did not change. Rebuilding with the command shown (e.g. `npm run css:build`) refreshes the bytes for a deploy, but clears this warning only when the output actually changed.',
  };
}
