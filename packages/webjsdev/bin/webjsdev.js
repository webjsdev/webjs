#!/usr/bin/env node
/**
 * `webjsdev` is the unscoped npm name for `@webjsdev/cli`. Both packages
 * ship the same `webjs` binary; this file is a one-line ESM re-export
 * of the canonical CLI entry script, so behaviour matches exactly.
 *
 *   npm i -g webjsdev && webjs create my-app
 *
 * The CLI's entry script reads `process.argv` and runs at module load,
 * so the import below transparently dispatches the same command. No
 * argv manipulation, no spawn overhead.
 */
await import('@webjsdev/cli/bin/webjs.js');
