/**
 * Shared JSON projector for the app route table (#975).
 *
 * `webjs routes --json` and the `webjs mcp` server's `list_routes` tool BOTH
 * return the identical shape, so the projection lives here once (the same
 * pattern as `check-report.js` for `check --json` / the MCP `check` tool). The
 * input is the raw `RouteTable` from `buildRouteTable(appDir)` (the ONE route
 * walker, reused, never re-implemented); the output is a stable, agent-friendly
 * `{ pages, apis }` shape.
 *
 * This module is a LEAF: it imports only `node:path` and receives the two
 * effectful dependencies it needs (`readFile` to read a `route.{js,ts}` file's
 * source, `extractRouteMethods` to lexically pull its HTTP-verb exports) as
 * injected arguments, the same dependency-injection style the MCP tool runners
 * already use. That keeps it free of any `@webjsdev/mcp` main-entry import (so
 * the CLI can pull just this projector without loading the MCP server) and free
 * of a cycle with `mcp.js`.
 *
 * @module routes-report
 */

import { relative } from 'node:path';

/**
 * The literal URL path for a page/api directory: `blog/[slug]` -> `/blog/[slug]`,
 * the root `.` -> `/`. Route groups `(group)` and `_private` segments drop, the
 * same normalization `buildRouteTable` uses for matching.
 *
 * @param {string} routeDir  POSIX-style, `.` for the app root.
 * @returns {string}
 */
export function routePathFromDir(routeDir) {
  if (!routeDir || routeDir === '.') return '/';
  const segs = routeDir
    .split('/')
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('_'));
  return segs.length ? '/' + segs.join('/') : '/';
}

/**
 * @typedef {{ path: string, file: string, dynamic?: boolean, params?: string[] }} PageRouteReport
 * @typedef {{ path: string, file: string, methods: string[] }} ApiRouteReport
 * @typedef {{ pages: PageRouteReport[], apis: ApiRouteReport[] }} RoutesReport
 */

/**
 * Project a `RouteTable` into the structured `{ pages, apis }` report shared by
 * `webjs routes --json` and the MCP `list_routes` tool. Pure over its inputs
 * (given the same table + deps it produces the same output); the only I/O is
 * the injected `readFile` reading each `route.{js,ts}` source to extract its
 * methods. A `route.{js,ts}` that cannot be read degrades to an empty method
 * list rather than throwing, so one unreadable file never sinks the whole
 * report.
 *
 * @param {{ pages: any[], apis: any[] }} table  the `buildRouteTable(appDir)` result
 * @param {{
 *   appDir: string,
 *   readFile: (path: string, enc: string) => Promise<string>,
 *   extractRouteMethods: (src: string) => string[],
 * }} deps
 * @returns {Promise<RoutesReport>}
 */
export async function projectRoutes(table, { appDir, readFile, extractRouteMethods }) {
  const pages = table.pages.map((r) => {
    /** @type {PageRouteReport} */
    const out = {
      path: routePathFromDir(r.routeDir),
      file: relative(appDir, r.file),
    };
    if (r.paramNames && r.paramNames.length) {
      out.dynamic = true;
      out.params = r.paramNames;
    }
    return out;
  });
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
}
