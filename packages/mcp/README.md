# @webjsdev/mcp

The webjs **Model Context Protocol server** for AI coding agents. A read-only
MCP server (newline-delimited JSON-RPC 2.0 over stdio) that gives an agent the
live introspection surface plus the framework knowledge layer it needs while
editing a webjs app.

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

Every webjs scaffold wires this entry automatically. `webjs mcp` (the CLI
subcommand) delegates to this same server, so both routes run identical code.

## What it exposes

- **Introspection tools** (read-only, scoped to an `appDir`): `list_routes`,
  `list_actions` (RPC endpoints plus the full data contract: HTTP verb, cache
  config, and boolean flags for tags/invalidates/validate/middleware; reserved
  config exports are excluded from the callable-action list), `list_components`,
  `check` (the structured `webjs check` violations). Each projects an existing
  `@webjsdev/server` data function and mutates nothing.
- **Knowledge layer**: an `init` mental-model primer, a `docs` retrieval tool,
  MCP `resources` (the `agent-docs/*` corpus + `AGENTS.md` as `webjs-docs://*`),
  and `prompts` (the recipes as guided workflows).
- **`source` tool**: reads the framework's own no-build source from
  `node_modules/@webjsdev/*/src` (read-only, traversal-guarded).

The docs corpus is bundled into the package at `prepack`, so `npx @webjsdev/mcp`
is self-contained; in the monorepo it falls back to the live repo-root docs.

STDOUT is the JSON-RPC channel; every diagnostic goes to stderr.
