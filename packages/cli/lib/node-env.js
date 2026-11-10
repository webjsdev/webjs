/**
 * The `NODE_ENV` each CLI command runs under when the shell sets none (#1686).
 *
 * `webjs dev` is development, `webjs start` production (Next's convention) and
 * `webjs test` test (Jest's and Vitest's), each only when `NODE_ENV` is unset.
 * A test run's default is inherited by everything its tests spawn, so a smoke
 * or e2e test that boots `npm start` would run the server as test: it would
 * load `.env.test`, drop the secure cookie flag, and fall back to the
 * generated dev secret. So `webjs test` marks the value as its own default,
 * and `dev` / `start` replace a marked `test` with theirs. An explicit
 * `NODE_ENV=test` from the shell carries no marker and is kept.
 *
 * Mutates the env passed in (the CLI passes `process.env`, which its child
 * processes inherit).
 *
 * @module node-env
 */

/** Set alongside a `NODE_ENV=test` that `webjs test` chose, not the shell. */
export const TEST_DEFAULT_MARKER = '__WEBJS_NODE_ENV_DEFAULTED';

/**
 * Apply a command's default `NODE_ENV`.
 * @param {Record<string, string | undefined>} env
 * @param {'development' | 'production' | 'test'} mode
 */
export function defaultNodeEnv(env, mode) {
  // A `test` that an enclosing `webjs test` defaulted is not this command's.
  if (env[TEST_DEFAULT_MARKER] === '1') {
    if (env.NODE_ENV === 'test' && mode !== 'test') delete env.NODE_ENV;
    if (mode !== 'test') delete env[TEST_DEFAULT_MARKER];
  }
  if (!env.NODE_ENV) {
    env.NODE_ENV = mode;
    if (mode === 'test') env[TEST_DEFAULT_MARKER] = '1';
  }
}
