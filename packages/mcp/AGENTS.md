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
                         declaration, headed by the owning type (lookupMember). A name that matches
                         nothing is retried once with its first letter's case
                         swapped, so a convention (`generateMetadata`) finds its
                         type (`GenerateMetadata`).
  guides.js              GUIDES + guide(name) (#1692): the pattern guides
                         (`routing`, `modules`, `progressive-enhancement`,
                         `optimistic-ui`, `type-safety`, `data-flow`,
                         `authentication`, `testing`, `uploads`), each how WebJs wants
                         one need built. A guide is printed only when looked
                         up by name; the catalogue does not list them, since
                         a list had agents read several up front.
                         GUIDE_ALIASES maps the file
                         convention names agents look up (`not-found`,
                         `error`, `middleware.ts`, `route.ts`, `page`, ...)
                         onto `routing` (and `upload`, `attachments` onto
                         `uploads`), case-sensitively so `notFound` stays
                         the export; none is an export (guides.test.mjs).
                         conventionPointer(name) is the line an export lookup
                         of `route` or `middleware` appends, since those are
                         exports AND file conventions.
                         `runSourceTool` answers a
                         guide name given as `export`, and the CLI's
                         `webjs source <name>` checks guides before exports.
                         Names are slugs no package exports (`optimistic-ui`,
                         never `optimistic`). See invariant 3.
  catalog.js             FEATURE_CATALOG + featureCatalog(): what WebJs provides,
                         grouped by need (auth, sessions, caching, rate limits,
                         uploads, realtime, SEO, tests, the core component and
                         state APIs), the text a no-args `source` call and a
                         bare `webjs source` print (#1686). Curated, since the
                         export lists mix app-facing API with plumbing;
                         test/catalog.test.mjs holds every name to be a real
                         export of its section's module AND to resolve through
                         lookupExport, the agent's follow-up call.
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
3. **No docs corpus; short pattern guides only.** The `docs` tool, the
   `webjs-docs://*` resources and the recipe prompts were removed along with the
   agent skill they served: Lit and Next.js habits plus the brief are meant to
   be enough, and `webjs check` and the runtime refuse what is not, with the
   fix in the message. Do not bring a bundled corpus back; an exact contract is
   the `source` tool's job. The pattern guides in `guides.js` (#1692, added at
   the owner's direction) are not that corpus: each is one capped page (under
   40 lines) on how WebJs wants one need built, and ends in actions (the
   exports to look up next, the docs page), all checked to exist by
   `test/guides.test.mjs`. A guide is returned only for a lookup by its name
   or an alias, never listed up front. A new guide must keep to that shape;
   anything longer belongs on the docs site.

## Tests

`test/mcp.test.mjs`, `test/mcp-source.test.mjs`, `test/catalog.test.mjs`,
`test/guides.test.mjs`, `test/check-report.test.mjs`. `runMcpServer` is driven in-process with injected
deps, so no real server boots. Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
