/**
 * `webjs mcp`: a minimal, READ-ONLY Model Context Protocol server (#262).
 *
 * Exposes the live introspection surface an AI agent needs while editing a
 * webjs app (the route table, registered server actions with their RPC
 * endpoints, registered custom-element tags, and the structured `webjs check`
 * violations) over MCP's stdio transport. Every tool REUSES an existing
 * `@webjsdev/server` data function and MUTATES NOTHING. The prior art is
 * Next.js's `next-devtools-mcp` (get_routes / get_server_action_by_id /
 * get_errors); this is deliberately tiny.
 *
 * Transport: MCP stdio is newline-delimited JSON-RPC 2.0. One JSON object per
 * line arrives on stdin; exactly one JSON response line per request is written
 * to stdout. STDOUT IS THE PROTOCOL CHANNEL, so this module writes ONLY
 * JSON-RPC frames there and routes every diagnostic to stderr. A malformed
 * input line is answered with a JSON-RPC parse error and never crashes the
 * loop. Hand-rolled with zero new dependency (webjs is buildless +
 * minimal-deps).
 *
 * @module mcp
 */

import { createInterface } from 'node:readline';
import { relative } from 'node:path';

const PROTOCOL_VERSION = '2024-11-05';

/**
 * The four read-only tools. Each takes an optional `{ appDir }` (default the
 * server's cwd) and projects an EXISTING `@webjsdev/server` function's output
 * into an agent-friendly shape. Descriptions are crisp so a model picks the
 * right tool without reading source.
 */
const TOOL_DEFS = [
  {
    name: 'list_routes',
    description:
      'List the app route table: SSR pages (path, file, dynamic flag, param names) and route.{js,ts} API handlers (path, file, HTTP methods). Read-only.',
  },
  {
    name: 'list_actions',
    description:
      'List registered server actions (the .server.{js,ts} files with "use server"): file, exported function name, and the /__webjs/action/<hash>/<fn> RPC endpoint. Read-only.',
  },
  {
    name: 'list_components',
    description:
      'List registered custom-element tags: tag name, defining file, and class name. Read-only.',
  },
  {
    name: 'check',
    description:
      'Run webjs check (correctness rules) and return the structured violations { rule, file, message, fix } plus a summary count and per-rule breakdown. Read-only.',
  },
];

/** The shared input schema: every tool takes an optional appDir override. */
const TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    appDir: {
      type: 'string',
      description: 'App directory to introspect. Defaults to the server cwd.',
    },
  },
  required: [],
};

/**
 * Lexically extract the names exported from a module source. Recognises the
 * common forms a server-action / route file uses without LOADING the module
 * (loading would run its top-level side effects: Prisma init, DB connects).
 *
 *   export async function foo() {}   export function foo() {}
 *   export const foo = ...           export let/var foo = ...
 *   export default ...               (recorded as 'default')
 *   export { a, b as c }             (the EXPORTED name, so `c`)
 *
 * @param {string} src
 * @returns {string[]} unique export names, in source order
 */
export function extractExportNames(src) {
  /** @type {string[]} */
  const names = [];
  const add = (n) => { if (n && !names.includes(n)) names.push(n); };

  // export [async] function NAME / export const|let|var NAME / export class NAME
  const declRe =
    /\bexport\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(src)) !== null) add(m[1]);

  // export default ...
  if (/\bexport\s+default\b/.test(src)) add('default');

  // export { a, b as c, default as d }
  const namedRe = /\bexport\s*\{([^}]*)\}/g;
  while ((m = namedRe.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      // `local as exported` -> the exported name is what callers import.
      const asMatch = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(seg);
      if (asMatch) add(asMatch[1]);
      else {
        const idMatch = /^([A-Za-z_$][\w$]*)$/.exec(seg);
        if (idMatch) add(idMatch[1]);
      }
    }
  }
  return names;
}

/**
 * Lexically extract the HTTP method exports of a route.{js,ts} file. The webjs
 * router dispatches on named `GET` / `POST` / `PUT` / `PATCH` / `DELETE` /
 * `HEAD` / `OPTIONS` / `WS` exports, so we report exactly those that are
 * exported. Read-only: no module load.
 *
 * @param {string} src
 * @returns {string[]}
 */
export function extractRouteMethods(src) {
  const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'WS'];
  const exported = new Set(extractExportNames(src));
  return METHODS.filter((m) => exported.has(m));
}

/**
 * The literal URL path for a page/api directory: `blog/[slug]` -> `/blog/[slug]`,
 * the root `.` -> `/`. Route groups `(group)` and `_private` segments drop, the
 * same normalization `buildRouteTable` uses for matching.
 *
 * @param {string} routeDir  POSIX-style, `.` for the app root.
 * @returns {string}
 */
function routePathFromDir(routeDir) {
  if (!routeDir || routeDir === '.') return '/';
  const segs = routeDir
    .split('/')
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('_'));
  return segs.length ? '/' + segs.join('/') : '/';
}

/**
 * The tool runners. Each is async, takes `(appDir)`, and returns a plain
 * JSON-serialisable projection of an existing server data function. All are
 * read-only.
 *
 * @param {{ buildRouteTable: Function, buildActionIndex: Function, hashFile: Function, scanComponents: Function, checkConventions: Function, projectCheck: Function, readFile: Function }} deps
 */
export function makeToolRunners(deps) {
  const {
    buildRouteTable,
    buildActionIndex,
    hashFile,
    scanComponents,
    checkConventions,
    projectCheck,
    readFile,
  } = deps;

  return {
    async list_routes(appDir) {
      const table = await buildRouteTable(appDir);
      const pages = await Promise.all(
        table.pages.map(async (r) => {
          /** @type {{ path: string, file: string, dynamic?: boolean, params?: string[] }} */
          const out = {
            path: routePathFromDir(r.routeDir),
            file: relative(appDir, r.file),
          };
          if (r.paramNames && r.paramNames.length) {
            out.dynamic = true;
            out.params = r.paramNames;
          }
          return out;
        }),
      );
      const apis = await Promise.all(
        table.apis.map(async (r) => {
          let methods = [];
          try {
            methods = extractRouteMethods(await readFile(r.file, 'utf8'));
          } catch {}
          return {
            path: routePathFromDir(r.routeDir),
            file: relative(appDir, r.file),
            methods,
          };
        }),
      );
      return { pages, apis };
    },

    async list_actions(appDir) {
      const idx = await buildActionIndex(appDir, true);
      /** @type {Array<{ file: string, fn: string, endpoint: string }>} */
      const actions = [];
      for (const [file, hash] of idx.fileToHash) {
        let names = [];
        try {
          names = extractExportNames(await readFile(file, 'utf8'));
        } catch {}
        for (const fn of names) {
          actions.push({
            file: relative(appDir, file),
            fn,
            endpoint: `/__webjs/action/${hash}/${fn}`,
          });
        }
      }
      // Stable order for deterministic output.
      actions.sort((a, b) =>
        a.file === b.file ? a.fn.localeCompare(b.fn) : a.file.localeCompare(b.file),
      );
      return actions;
    },

    async list_components(appDir) {
      const comps = await scanComponents(appDir);
      return comps
        .map((c) => ({
          tag: c.tag,
          file: relative(appDir, c.file),
          className: c.className,
        }))
        .sort((a, b) => a.tag.localeCompare(b.tag));
    },

    async check(appDir) {
      const violations = await checkConventions(appDir);
      return projectCheck(violations);
    },
  };
}

/**
 * A JSON-RPC 2.0 result frame.
 * @param {string|number|null} id
 * @param {any} result
 */
function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

/**
 * A JSON-RPC 2.0 error frame.
 * @param {string|number|null} id
 * @param {number} code
 * @param {string} message
 */
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Run the read-only webjs MCP server over the given streams. Reads
 * newline-delimited JSON-RPC from `stdin`, writes one response line per request
 * to `stdout`, and logs diagnostics to `stderr` ONLY (stdout is the protocol
 * channel). Resolves when stdin ends (clean shutdown).
 *
 * Injectable streams + `cwd` keep it testable in-process with PassThrough
 * streams; the bin passes the real `process.std*` + `process.cwd()`.
 *
 * @param {{
 *   stdin: NodeJS.ReadableStream,
 *   stdout: NodeJS.WritableStream,
 *   stderr: NodeJS.WritableStream,
 *   cwd: string,
 *   version?: string,
 *   deps?: object,
 * }} opts
 * @returns {Promise<void>}
 */
export async function runMcpServer(opts) {
  const { stdin, stdout, stderr, cwd } = opts;
  const version = opts.version || '0.0.0';

  // Resolve the data functions from @webjsdev/server (reading them is
  // read-only). Injectable for tests so they need not boot the real server.
  let deps = opts.deps;
  if (!deps) {
    const server = await import('@webjsdev/server');
    const check = await import('@webjsdev/server/check');
    const { readFile } = await import('node:fs/promises');
    const { projectCheck } = await import('./check-json.js');
    deps = {
      buildRouteTable: server.buildRouteTable,
      buildActionIndex: server.buildActionIndex,
      hashFile: server.hashFile,
      scanComponents: server.scanComponents,
      checkConventions: check.checkConventions,
      projectCheck,
      readFile,
    };
  }
  const runners = makeToolRunners(deps);

  /** Write one JSON-RPC frame as a single line to stdout. */
  const send = (frame) => {
    stdout.write(JSON.stringify(frame) + '\n');
  };
  /** Diagnostics go to stderr only, never stdout. */
  const logErr = (msg) => {
    try { stderr.write(`[webjs mcp] ${msg}\n`); } catch {}
  };

  /**
   * Dispatch one parsed JSON-RPC message. Returns a frame to send, or null
   * for a notification (no `id`) which gets no response.
   */
  const dispatch = async (msg) => {
    const id = msg && Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;
    const isNotification = id === null || id === undefined;
    const method = msg && msg.method;

    if (method === 'initialize') {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'webjs', version },
      });
    }

    // `notifications/initialized` (and any other notification) gets no reply.
    if (isNotification) return null;

    if (method === 'tools/list') {
      return rpcResult(id, {
        tools: TOOL_DEFS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: TOOL_INPUT_SCHEMA,
        })),
      });
    }

    if (method === 'tools/call') {
      const params = (msg && msg.params) || {};
      const name = params.name;
      const args = params.arguments || {};
      const runner = runners[name];
      if (!runner) {
        return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      }
      const appDir = typeof args.appDir === 'string' && args.appDir ? args.appDir : cwd;
      try {
        const result = await runner(appDir);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (e) {
        // A tool failure is an MCP tool-result error (isError), not a transport
        // error, so the agent sees the message in the content channel.
        logErr(`tool ${name} failed: ${e && e.message ? e.message : e}`);
        return rpcResult(id, {
          isError: true,
          content: [
            { type: 'text', text: `Error running ${name}: ${e && e.message ? e.message : String(e)}` },
          ],
        });
      }
    }

    return rpcError(id, -32601, `Method not found: ${String(method)}`);
  };

  const rl = createInterface({ input: stdin, crlfDelay: Infinity });

  await new Promise((resolveRun) => {
    // Serialise line handling so responses preserve request order even though
    // dispatch is async.
    let chain = Promise.resolve();
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      chain = chain.then(async () => {
        let msg;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          // Malformed line: a JSON-RPC parse error, never a crash.
          send(rpcError(null, -32700, 'Parse error'));
          return;
        }
        try {
          const frame = await dispatch(msg);
          if (frame) send(frame);
        } catch (e) {
          logErr(`dispatch error: ${e && e.message ? e.message : e}`);
          const id =
            msg && Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;
          send(rpcError(id, -32603, 'Internal error'));
        }
      });
    });
    rl.on('close', () => {
      // Drain the in-flight chain, then resolve (clean shutdown on stdin end).
      chain.then(() => resolveRun()).catch(() => resolveRun());
    });
  });
}
