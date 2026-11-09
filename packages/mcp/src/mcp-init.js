/**
 * The `init` tool of `webjs mcp`: the one thing an agent reads before it writes
 * WebJs code.
 *
 * It returns the WebJs brief (see `brief.js`) plus a map of the server's other
 * tools. There is no docs corpus behind it any more. Lit and Next.js habits are
 * meant to produce correct WebJs code, and where one cannot, `webjs check` and
 * the runtime refuse it with the fix in the message, so the brief is the whole
 * of the agent-facing documentation. For an exact contract the agent reads the
 * framework source, which is no-build and therefore the code that runs (the
 * `source` tool).
 *
 * Pure given its injected `{ appDir, serverVersion, readFile, exists }` deps, so
 * it is testable in-process without touching the real filesystem.
 *
 * @module mcp-init
 */

import { join } from 'node:path';

import { BRIEF, BRIEF_HEADING } from './brief.js';

/**
 * Compare two `major.minor.patch` versions, returning `-1` / `0` / `1`.
 *
 * Dependency-free by design (this package ships zero dependencies), and
 * deliberately coarse: any prerelease or build suffix is stripped before
 * comparing, a missing segment reads as `0`, and a non-numeric segment reads as
 * `0`. Its only consumer is the staleness warning, where the question is "is the
 * app's copy meaningfully newer", so ranking two prereleases of one patch is not
 * a case that needs an answer.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareVersions(a, b) {
  const parts = (v) => String(v == null ? '' : v).trim().split(/[-+]/)[0].split('.');
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < 3; i++) {
    const x = Number(pa[i]);
    const y = Number(pb[i]);
    const nx = Number.isFinite(x) ? x : 0;
    const ny = Number.isFinite(y) ? y : 0;
    if (nx !== ny) return nx < ny ? -1 : 1;
  }
  return 0;
}

/**
 * The `@webjsdev/mcp` version installed in `appDir`, or `null` when that cannot
 * be known (no app dir, no install, an unreadable or unparseable manifest, no
 * `version` field).
 *
 * @param {string} [appDir]
 * @param {{ exists?: (p: string) => boolean, readFile: (p: string, enc: string) => Promise<string> }} deps
 * @returns {Promise<string | null>}
 */
export async function readAppMcpVersion(appDir, deps) {
  if (typeof appDir !== 'string' || !appDir) return null;
  const manifest = join(appDir, 'node_modules', '@webjsdev', 'mcp', 'package.json');
  try {
    if (deps.exists && !deps.exists(manifest)) return null;
    const version = JSON.parse(await deps.readFile(manifest, 'utf8')).version;
    return typeof version === 'string' && version ? version : null;
  } catch {
    return null;
  }
}

/**
 * The staleness warning, or `null` when there is nothing to warn about.
 *
 * Fires only when the app's installed `@webjsdev/mcp` is strictly NEWER than the
 * running server's (a globally installed server lags the app it is asked
 * about, #1319). Equal or lower is silent. It warns rather than failing, since
 * a stale brief and stale tools still beat no answer.
 *
 * It names every way the server may have been started rather than guessing one,
 * because nothing here can observe it: a global install, the package cache
 * behind `npx @webjsdev/mcp`, `@webjsdev/cli` when started as `webjs mcp`, or a
 * checkout.
 *
 * @param {{ appDir?: string, serverVersion?: string, readFile: Function, exists?: Function }} deps
 * @returns {Promise<string | null>}
 */
export async function staleWarning(deps) {
  const server = deps.serverVersion;
  // '0.0.0' is the sentinel both entry points fall back to when they cannot read
  // their own manifest, so it means "unknown", not "older than everything".
  if (!server || server === '0.0.0') return null;
  const app = await readAppMcpVersion(deps.appDir, deps);
  if (!app || compareVersions(app, server) <= 0) return null;
  return (
    `Warning: this MCP server is @webjsdev/mcp@${server}, but this app has @webjsdev/mcp@${app}, ` +
    'so the brief and the tools below may be stale. ' +
    'Update whichever copy runs this server: a global install (npm i -g @webjsdev/mcp@latest, ' +
    'or bun add -g @webjsdev/mcp), the package cache behind npx @webjsdev/mcp, ' +
    '@webjsdev/cli when the server is started as webjs mcp, or the checkout it runs from.'
  );
}

/** What the server's other tools are for, so the agent reaches for the right one. */
const TOOL_MAP = [
  '## The tools on this server',
  '',
  '- For an exact contract, call `source` with `export` set to one export name',
  '  (its signature plus doc comment), `path` to read a framework file, or',
  '  `query` to grep the `@webjsdev/*` source.',
  '- To see the live app, call `list_routes`, `list_actions` and',
  '  `list_components`.',
  '- To validate an edit, call `check`. Every violation carries its fix.',
  '- Before hand-writing a page, a form, a dashboard or a chart, call `ui` to',
  '  find a ready-made block in the `@webjsdev/ui` kit.',
].join('\n');

/**
 * The `init` tool output: an optional staleness warning, the brief, and the
 * tool map.
 *
 * @param {{ appDir?: string, serverVersion?: string, readFile: Function, exists?: Function }} deps
 * @returns {Promise<string>}
 */
export async function initText(deps) {
  const warning = await staleWarning(deps);
  return [
    '# WebJs: read first',
    '',
    ...(warning ? [warning, ''] : []),
    BRIEF_HEADING,
    '',
    BRIEF,
    '',
    TOOL_MAP,
  ].join('\n');
}
