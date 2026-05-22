#!/usr/bin/env node
/**
 * `wjs`: short alias for the `@webjsdev/cli` `webjs` binary.
 *
 *   npx wjs create my-app
 *   npx wjs dev
 *   npx wjs start
 *   npx wjs check
 *   npx wjs db migrate init
 *
 * The CLI's entry script reads `process.argv` and runs at module load,
 * so importing it transparently dispatches the same command. No argv
 * manipulation, no spawn overhead, no behaviour drift between
 * `webjs <cmd>` and `wjs <cmd>`.
 */
await import('@webjsdev/cli/bin/webjs.js');
