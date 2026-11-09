/**
 * `webjs status [path...]` (#1664): wait for a running `webjs dev` server to
 * settle after an edit, then report what broke.
 *
 * An agent editing a running app used to `sleep 3`, fetch a page and grep the
 * HTML for "Server error". The reload frame does not settle it either: it is
 * sent before anything is re-imported, so a broken module only shows on the
 * next request. This command asks the dev server's own status endpoint
 * (`/__webjs/dev/status?wait=`), which holds until the change is rebuilt and
 * the app analysis has run again, then requests each given path (the app's
 * root when none is given) plus every page with a recorded render error, so a
 * page an edit broke, or fixed, is re-rendered before anything is reported. A
 * render
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
 * The paths `webjs status --boot` requests when none are given: every page
 * and every GET route handler whose path needs no parameter. A dynamic route
 * cannot be requested without a real value, so it is listed as skipped.
 * @param {{ pages: Array<{ path: string }>, apis: Array<{ path: string, methods?: string[] }> }} report
 * @returns {{ paths: string[], skipped: string[] }}
 */
export function bootProbePaths(report) {
  const paths = [];
  const skipped = [];
  const add = (/** @type {string} */ p) => {
    // An optional catch-all also answers with no segments, at its parent path.
    const bare = p.replace(/\/\[\[\.\.\.[^\]]+\]\]$/, '') || '/';
    if (bare.includes('[')) skipped.push(p);
    else if (!paths.includes(bare)) paths.push(bare);
  };
  for (const page of report.pages || []) add(page.path);
  for (const api of report.apis || []) {
    if (!api.methods || api.methods.includes('GET')) add(api.path);
  }
  return { paths, skipped };
}

/**
 * `webjs status --boot`: boot the app in-process with the dev handler and
 * report every route's status and every error it records, with no dev server
 * to start, wait for, or stop. With no paths it probes every route that needs
 * no parameter, failing only on a server error there (a 401 or a redirect is
 * an answer, not a fault); a path the caller names still fails at 400.
 * @param {{
 *   appDir: string,
 *   paths?: string[],
 *   basePath?: string,
 *   json?: boolean,
 *   timeoutMs?: number,
 *   createHandler: (appDir: string) => Promise<{ handle: (req: Request) => Promise<Response>, warmup?: () => Promise<unknown> }>,
 *   listRoutes: (appDir: string) => Promise<{ pages: Array<{ path: string }>, apis: Array<{ path: string, methods?: string[] }> }>,
 *   out?: (s: string) => void,
 *   err?: (s: string) => void,
 * }} opts
 * @returns {Promise<number>} the exit code
 */
export async function runStatusBoot(opts) {
  const {
    appDir, paths = [], basePath = '', json = false, timeoutMs = 30_000,
    createHandler, listRoutes,
    out = (s) => process.stdout.write(s + '\n'),
    err = (s) => process.stderr.write(s + '\n'),
  } = opts;
  const app = await createHandler(appDir);
  if (app.warmup) await app.warmup();
  let toProbe = paths;
  if (!paths.length) {
    const { paths: derived, skipped } = bootProbePaths(await listRoutes(appDir));
    toProbe = derived.length ? derived : ['/'];
    if (skipped.length && !json) out(`webjs status: skipped ${skipped.length} route${skipped.length === 1 ? '' : 's'} that need${skipped.length === 1 ? 's' : ''} a parameter (pass a real path to probe it): ${skipped.join(', ')}`);
  }
  return runStatus({
    port: 0,
    host: 'boot',
    paths: toProbe,
    basePath,
    json,
    timeoutMs,
    graceMs: 0,
    namedFailStatus: paths.length ? 400 : 500,
    fetch: (url, init) => app.handle(new Request(url, init)),
    out,
    err,
    cwd: appDir,
  });
}

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
 *   namedFailStatus?: number,
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
    timeoutMs = 30_000, graceMs = 300, host = 'localhost', namedFailStatus = 400,
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
  // The app root when no path is given, so a bare run still renders something:
  // on Node most edits restart the server, which starts with no errors at all.
  // Then every page with a recorded render error, so an error the edit fixed is
  // cleared and one it did not fix is confirmed, rather than reported stale.
  const toRequest = paths.length ? [...paths] : ['/'];
  // Paths the caller named, or the default root: any status at 400 or above
  // fails the run. A page re-requested only because it had a render error may
  // since have been deleted or renamed, so for those only a server error fails.
  const named = new Set(toRequest.map((r) => (r.startsWith('/') ? r : '/' + r)));
  for (const e of body.errors) {
    if (e.kind !== 'render' || !e.url) continue;
    let p = String(e.url);
    if (basePath && (p === basePath || p.startsWith(basePath + '/'))) p = p.slice(basePath.length) || '/';
    if (!toRequest.includes(p)) toRequest.push(p);
  }
  for (const raw of toRequest) {
    const path = raw.startsWith('/') ? raw : '/' + raw;
    try {
      const res = await doFetch(base + path, { headers: { accept: 'text/html' }, redirect: 'manual' });
      results.push({ path, status: res.status });
      try { await res.arrayBuffer(); } catch { /* drain */ }
    } catch (e) {
      results.push({ path, status: null, error: String((e && /** @type {Error} */ (e).message) || e) });
    }
  }
  // Requesting the pages records new render errors and clears fixed ones, so
  // read the list again.
  if (results.length) {
    try {
      const res = await doFetch(`${base}/__webjs/dev/status`, { headers: { accept: 'application/json' } });
      body = /** @type {DevStatusBody} */ (await res.json());
    } catch { /* keep the settled body */ }
  }

  const failingPaths = results.filter((r) => r.status === null || r.status >= (named.has(r.path) ? namedFailStatus : 500));
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
