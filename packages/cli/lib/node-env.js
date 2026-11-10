/**
 * The `NODE_ENV` each CLI command runs under when none is set (#1686), the
 * conventions an agent already knows: `webjs dev` is development and
 * `webjs start` production, as `next dev` and `next start` are, and
 * `webjs test` is test, as Jest and Vitest are.
 *
 * Each sets it only when it is unset, and keeps any value already there, as
 * `next start` does (`NODE_ENV || defaultEnv`, next.js packages/next/src/bin/
 * next.ts). So a process a test spawns inherits `NODE_ENV=test` from the run,
 * exactly as it would under Jest; a test that wants a production server sets
 * `NODE_ENV=production` on the child, and a value the shell sets always wins.
 *
 * Mutates the env passed in (the CLI passes `process.env`, which its child
 * processes inherit).
 *
 * @module node-env
 */

/**
 * Apply a command's default `NODE_ENV`, only when none is set.
 * @param {Record<string, string | undefined>} env
 * @param {'development' | 'production' | 'test'} mode
 */
export function defaultNodeEnv(env, mode) {
  if (!env.NODE_ENV) env.NODE_ENV = mode;
}
