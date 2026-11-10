/**
 * The `NODE_ENV` each CLI command runs under when the shell sets none (#1686).
 *
 * `webjs dev` is development and `webjs start` production (Next's
 * convention), each only when `NODE_ENV` is unset, so a value the shell or a
 * spawning process chose is always kept.
 *
 * `webjs test` sets no `NODE_ENV`, as `node --test` itself does not: a value
 * it set would be inherited by every server its tests spawn, and no inherited
 * value can be told apart from one a test sets on purpose, so a `webjs start`
 * a test boots would run as test (`.env.test`, no secure cookies), or a child
 * spawned with `NODE_ENV=test` would lose it. It marks the run instead
 * (`TEST_RUN_ENV`), which only the generated development secret reads: a
 * process in a test run with no `NODE_ENV` may use it (dev-secret.js), while
 * a `webjs start` it spawns, being production, never does.
 *
 * Mutates the env passed in (the CLI passes `process.env`, which its child
 * processes inherit).
 *
 * @module node-env
 */

/** Set by `webjs test` on its own environment; see dev-secret.js. */
export const TEST_RUN_ENV = '__WEBJS_TEST_RUN';

/**
 * Apply a server command's default `NODE_ENV`, only when none is set.
 * @param {Record<string, string | undefined>} env
 * @param {'development' | 'production'} mode
 */
export function defaultNodeEnv(env, mode) {
  if (!env.NODE_ENV) env.NODE_ENV = mode;
}

/**
 * Mark a `webjs test` run, leaving `NODE_ENV` as the shell set it.
 * @param {Record<string, string | undefined>} env
 */
export function markTestRun(env) {
  env[TEST_RUN_ENV] = '1';
}
