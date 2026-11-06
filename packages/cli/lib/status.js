/**
 * `webjs status [path...]` (#1664): wait for a running `webjs dev` server to
 * settle after an edit, then report what broke.
 *
 * An agent editing a running app used to `sleep 3`, fetch a page and grep the
 * HTML for "Server error". The reload frame does not settle it either: it is
 * sent before anything is re-imported, so a broken module only shows on the
 * next request. This command asks the dev server's own status endpoint
 * (`/__webjs/dev/status?wait=`), which holds until the change is rebuilt and
 * the app analysis has run again, then requests each given path so a render
 * error surfaces, and prints every error recorded since the last rebuild.
 *
 * Exit codes: 0 when settled with no errors and every path below 400, 1 when
 * anything is wrong (an error, a failing path, or no settle before the
 * timeout), 2 when no dev server answered at all.
 *
 * Pure of `process`: the port, fetch, clock and output are injected, so the
 * whole flow is unit-testable against a fake server.
 *
 * @module
 */

/** Exit code when no dev server answered on the port. */
export const NO_SERVER_EXIT_CODE = 2;

/**
 * @typedef {{
 *   status: string, settled: boolean, ready: string, boot: string | null,
 *   seq: number | null, rebuilds: number,
 *   errors: Array<{ kind: string, message: string, file?: string | null, line?: number | null,
 *     column?: number | null, codeFrame?: string | null, hint?: string | null, url?: string | null }>,
 * }} DevStatusBody
 */

/**
 * @param {{
 *   port: number,
 *   paths?: string[],
 *   basePath?: string,
 *   json?: boolean,
 *   timeoutMs?: number,
 *   graceMs?: number,
 *   host?: string,
 *   fetch?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   out?: (s: string) => void,
 *   err?: (s: string) => void,
 *   cwd?: string,
 * }} opts
 * @returns {Promise<number>} the exit code
 */
export async function runStatus(opts) {
  const {
    port, paths = [], basePath = '', json = false,
    timeoutMs = 30_000, graceMs = 300, host = 'localhost',
    fetch: doFetch = globalThis.fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    out = (s) => process.stdout.write(s + '\n'),
    err = (s) => process.stderr.write(s + '\n'),
    cwd = process.cwd(),
  } = opts;
  const origin = `http://${host}:${port}`;
  const base = origin + basePath;
  const deadline = now() + timeoutMs;

  // An edit saved a moment ago may not have reached the watcher yet, and on
  // Node the dev server restarts for most edits. Give the watcher a beat, then
  // keep asking through a refused connection until the deadline.
  if (graceMs > 0) await sleep(graceMs);

  /** @type {DevStatusBody | null} */
  let body = null;
  let reached = false;
  while (now() < deadline) {
    const waitSec = Math.max(1, Math.min(10, Math.ceil((deadline - now()) / 1000)));
    try {
      const res = await doFetch(`${base}/__webjs/dev/status?wait=${waitSec}`, { headers: { accept: 'application/json' } });
      reached = true;
      if (res.status === 404) {
        return finish({ ok: false, reason: 'not-dev', message: `${origin} answered, but it is not a webjs dev server (no /__webjs/dev/status). Is it running webjs start?` }, 1);
      }
      body = /** @type {DevStatusBody} */ (await res.json());
      if (body.settled) break;
    } catch {
      // Refused or reset: the server is (re)starting. Try again shortly.
      await sleep(250);
    }
  }

  if (!reached) {
    return finish({ ok: false, reason: 'no-server', message: `No dev server answered on ${origin}. Start it with npm run dev, or pass --port.` }, NO_SERVER_EXIT_CODE);
  }
  if (!body || !body.settled) {
    return finish({ ok: false, reason: 'not-settled', message: `The dev server did not settle within ${Math.round(timeoutMs / 1000)}s.`, status: body }, 1);
  }

  /** @type {Array<{ path: string, status: number | null, error?: string }>} */
  const results = [];
  for (const raw of paths) {
    const path = raw.startsWith('/') ? raw : '/' + raw;
    try {
      const res = await doFetch(base + path, { headers: { accept: 'text/html' }, redirect: 'manual' });
      results.push({ path, status: res.status });
      try { await res.arrayBuffer(); } catch { /* drain */ }
    } catch (e) {
      results.push({ path, status: null, error: String((e && /** @type {Error} */ (e).message) || e) });
    }
  }
  // Requesting the paths can record new render errors, so read them again.
  if (results.length) {
    try {
      const res = await doFetch(`${base}/__webjs/dev/status`, { headers: { accept: 'application/json' } });
      body = /** @type {DevStatusBody} */ (await res.json());
    } catch { /* keep the settled body */ }
  }

  const failingPaths = results.filter((r) => r.status === null || r.status >= 400);
  const ok = body.errors.length === 0 && failingPaths.length === 0 && body.ready === 'ok';
  return finish({ ok, url: base, settled: true, ready: body.ready, rebuilds: body.rebuilds, paths: results, errors: body.errors }, ok ? 0 : 1);

  /**
   * A file under the app directory, printed relative to it.
   * @param {string} file
   */
  function relative(file) {
    const root = cwd.replace(/[\\/]+$/, '');
    return file.startsWith(root + '/') || file.startsWith(root + '\\') ? file.slice(root.length + 1) : file;
  }

  /**
   * @param {Record<string, any>} report
   * @param {number} code
   */
  function finish(report, code) {
    if (json) {
      out(JSON.stringify(report, null, 2));
      return code;
    }
    if (report.reason) {
      err(`webjs status: ${report.message}`);
      return code;
    }
    out(`webjs status: ${report.ok ? 'ok' : 'problems found'} (settled, ready: ${report.ready}, ${report.rebuilds} rebuild${report.rebuilds === 1 ? '' : 's'}) at ${report.url}`);
    for (const r of report.paths) {
      out(`  GET ${r.path}  ${r.status === null ? 'failed: ' + r.error : r.status}`);
    }
    if (report.errors.length) {
      out(`${report.errors.length} error${report.errors.length === 1 ? '' : 's'} since the last rebuild:`);
      for (const e of report.errors) {
        const where = e.file ? `${relative(e.file)}${e.line ? ':' + e.line + (e.column ? ':' + e.column : '') : ''}` : '';
        out(`  [${e.kind}] ${e.message}${where ? '  at ' + where : ''}${e.url ? '  (' + e.url + ')' : ''}`);
        if (e.hint) out(`    hint: ${e.hint}`);
        if (e.codeFrame) out(String(e.codeFrame).split('\n').map((l) => '    ' + l).join('\n'));
      }
    }
    return code;
  }
}
