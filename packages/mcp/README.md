# @webjsdev/mcp

The WebJs **Model Context Protocol server** for AI coding agents. A read-only
MCP server (newline-delimited JSON-RPC 2.0 over stdio) that gives an agent the
WebJs brief, the live introspection surface, and the framework source it needs
while editing a WebJs app.

## Run it

Register it with any MCP host (Claude, Cursor, etc.). It runs straight from npm,
no install:

```jsonc
// .claude.json / .cursor/mcp.json
{
  "mcpServers": {
    "webjs": { "command": "npx", "args": ["@webjsdev/mcp"] }
  }
}
```

Every WebJs scaffold wires this entry automatically. `webjs mcp` (the CLI
subcommand) delegates to this same server, so both routes run identical code.

## What it exposes

- **`init` tool**: the WebJs brief, the short list of what differs from Next.js
  App Router routing and Lit components, plus what each other tool is for.
  WebJs is designed so Lit and Next.js habits produce correct code, and where
  one cannot, `webjs check` and the runtime refuse it with the fix in the
  message, so the brief is the whole of the agent-facing documentation. The
  human docs live at https://webjs.dev/docs. `init` prepends a warning when the
  app's installed `@webjsdev/mcp` is strictly newer than the running server's,
  naming every way the server may have been started (a global install, the
  `npx` package cache, `@webjsdev/cli` behind `webjs mcp`, or a checkout).
- **Introspection tools** (read-only, scoped to an `appDir`): `list_routes`,
  `list_actions` (RPC endpoints plus the full data contract: HTTP verb, cache
  config, and boolean flags for tags/invalidates/validate/middleware; reserved
  config exports are excluded from the callable-action list), `list_components`,
  `list_elision` (the display-only elision verdict: which component modules the
  browser never downloads, the evidence behind each one that ships, every
  page/layout as inert / import-only / shipped, and any orphan class that gets
  no verdict at all; identical to `webjs elision --json`),
  `check` (the structured `webjs check` violations, each with its fix). Each
  projects an existing `@webjsdev/server` data function and mutates nothing.
- **`source` tool**: reads the framework's own no-build source from
  `node_modules/@webjsdev/*/src` (read-only, traversal-guarded). Pass `export`
  for one export's signature plus doc comment, the cheapest way to check a
  contract.
- **`ui` tool**: the `@webjsdev/ui` kit. With no args it returns the
  component inventory plus the block and chart NAMES grouped by category (a
  block is a ready-made view you install and then edit: a login or signup
  page, a sidebar shell, a dashboard, a chart). `type` (`ui` / `block` /
  `chart` / `all`) and `category` (`login`, `sidebar`, `area`, ...) list the
  matches with one-line descriptions. `name` returns one component's helper
  signatures, paste-ready structural example, a11y header and deps, or one
  block's description, dependencies, install command
  (`npx @webjsdev/ui add <name>`) and files with their targets; `source: true`
  adds a block's sources. Everything it returns is baked plain Tailwind, never
  a `cn-*` name, and a test caps the no-args payload size. Kit-scoped (not
  `appDir`-scoped); shares one projector with `webjsui view`.

STDOUT is the JSON-RPC channel; every diagnostic goes to stderr.
