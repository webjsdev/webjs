#!/usr/bin/env node
/**
 * `webjs-mcp` (and `npx @webjsdev/mcp`): start the webjs MCP server over stdio.
 *
 * The agent-facing entry point. An MCP host (Claude, Cursor, etc.) registers
 * this and speaks newline-delimited JSON-RPC 2.0 over the child process's
 * stdin/stdout. STDOUT IS THE PROTOCOL CHANNEL, so nothing here writes to it;
 * `runMcpServer` routes every diagnostic to stderr. Read-only: the tools
 * project existing `@webjsdev/server` data functions and mutate nothing.
 *
 * `webjs mcp` (the CLI subcommand) delegates here too, so the implementation
 * has a single home in this package.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMcpServer } from '../src/mcp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  version = pkg.version || version;
} catch {}

await runMcpServer({
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
  version,
});
