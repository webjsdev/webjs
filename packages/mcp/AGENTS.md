# AGENTS.md for @webjsdev/mcp

The WebJs **Model Context Protocol server** (extracted from `@webjsdev/cli` in
#415). A hand-rolled, READ-ONLY MCP stdio server, ZERO runtime dependency
beyond `@webjsdev/server` for its introspection data functions.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build, commit
conventions) live in the **framework root [`../../AGENTS.md`](../../AGENTS.md)**
and apply here. Read that first. This file covers only what is specific to
`@webjsdev/mcp`.

## Entry points

- **`npx @webjsdev/mcp`** (`bin/webjs-mcp.js`): the agent-facing server an MCP
  host registers. The scaffold wires it into `.claude.json`.
- **`webjs mcp`** (the CLI subcommand): delegates to `runMcpServer` from this
  package, so the implementation has a single home. Back-compat only.

Both speak newline-delimited JSON-RPC 2.0 over stdio. STDOUT IS THE PROTOCOL
CHANNEL; every diagnostic goes to stderr. A malformed line is answered with a
parse error and never crashes the loop.

## Module map

```
bin/
  webjs-mcp.js           npx entry: reads the package version, runs runMcpServer
                         with the process streams.
src/
  mcp.js                 runMcpServer({ stdin, stdout, stderr, cwd, version,
                         deps?, initFs?, sourceDeps?, uiDeps? }). The JSON-RPC
                         loop + the tool dispatch. Handshake: initialize ->
                         serverInfo + capabilities (tools only);
                         notifications/initialized -> no reply; tools/list,
                         tools/call. There are no resources and no prompts.
                         INTROSPECTION tools (read-only, appDir-scoped), each
                         projecting a @webjsdev/server function: list_routes
                         (buildRouteTable, via the shared projectRoutes from
                         routes-report.js), list_actions (buildActionIndex +
                         hashFile, now reports verb/cache/tags/invalidates per
                         #488 and excludes reserved config exports from the
                         callable-action list), list_components (scanComponents,
                         a cheap lexical inventory that must not grow anything
                         needing a module graph), check (checkConventions via
                         projectCheck). Export names
                         are extracted LEXICALLY (extractExportNames /
                         extractRouteMethods / extractActionConfig) so no app
                         module is loaded.
                         The `ui` tool (#983) is KIT-scoped, not appDir-scoped:
                         it projects the shared `@webjsdev/ui/registry/extract`
                         leaf (the kit inventory, or one component's helper
                         signatures + paste-ready @example + a11y header + deps),
                         the SAME leaf `webjsui view` renders. Blocks and charts
                         (#1666, D18) ride the same leaf: the no-args call adds
                         their names by category (uiBlockIndex), `type` /
                         `category` list them (uiBlocks), and a block `name`
                         returns uiBlock (install command + file targets). A
                         drift test in mcp.test.mjs asserts the tool output
                         equals that leaf's output, and another caps the
                         no-args payload's byte size.
                         `deps` / `initFs` / `sourceDeps` / `uiDeps` are
                         injectable for in-process tests.
  brief.js               BRIEF + BRIEF_HEADING: the WebJs brief, the whole of the
                         agent-facing docs. The root AGENTS.md and the scaffold's
                         templates/AGENTS.md carry it verbatim, and
                         test/repo-health/brief-parity.test.mjs holds the three
                         copies identical. Edit it here, then paste.
  mcp-init.js            The `init` tool: the brief plus a map of the other
                         tools, prefixed with a warning when the app's installed
                         @webjsdev/mcp is newer than the server's (#1319;
                         compareVersions / readAppMcpVersion / staleWarning).
  mcp-source.js          SOURCE tool (#378): reads the framework's own no-build
                         source from node_modules/@webjsdev/*/src (read-only,
                         traversal-guarded via realpath, loads no module).
                         resolveFrameworkRoots locates each package by probing
                         the require.resolve node_modules dirs. lookupExport
                         (the tool's `export` arg and `webjs source <Export>`)
                         returns ONE export's signature plus the doc above it:
                         the .d.ts declarations under the package root first,
                         the authored src JSDoc as the fallback, overloads all,
                         a miss naming the searched packages (#837). A name
                         that is no export but a member of an exported type
                         (`actionData` on `PageProps`, the most grepped term
                         in the #1686 eval builds) prints that member's doc and
                         declaration, headed by the owning type (lookupMember).
  check-report.js        projectCheck(violations) -> { violations, summary }.
                         The shared shape returned by BOTH the MCP `check` tool
                         and `webjs check --json` (the CLI imports it from
                         `@webjsdev/mcp/check-report`), so the two are identical.
  routes-report.js       routePathFromDir(routeDir) + projectRoutes(table,
                         { appDir, readFile, extractRouteMethods }) ->
                         { pages, apis } (#975). The shared route projector
                         returned by BOTH the MCP `list_routes` tool and
                         `webjs routes --json` (the CLI imports it from
                         `@webjsdev/mcp/routes-report`), so the two are identical.
                         A leaf module: the two effectful deps are injected so it
                         needs no `mcp.js` import (no cycle). A drift test asserts
                         `list_routes` output equals `projectRoutes`.
```

## Invariants

1. **STDOUT is JSON-RPC only.** Never `console.log` in the request path;
   diagnostics go to stderr (`logErr`). A stray stdout write corrupts the
   stream.
2. **Read-only.** Every tool projects an existing `@webjsdev/server` data
   function (or reads the framework source) and mutates nothing. No app module is loaded
   (export names are extracted lexically) so there are no DB-init side effects.
3. **No docs corpus.** The `docs` tool, the `webjs-docs://*` resources and the
   recipe prompts were removed along with the agent skill they served: Lit and
   Next.js habits plus the brief are meant to be enough, and `webjs check` and
   the runtime refuse what is not, with the fix in the message. Do not bring a
   bundled corpus back; an exact contract is the `source` tool's job.

## Tests

`test/mcp.test.mjs`, `test/mcp-source.test.mjs`,
`test/check-report.test.mjs`. `runMcpServer` is driven in-process with injected
deps, so no real server boots. Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
