// Actionable hints for `webjs db` failure modes that drizzle-kit surfaces
// opaquely. Kept as pure functions so the dispatch path in bin/webjs.js stays a
// thin spawn and the messages are unit-testable without a child process.

/**
 * `webjs db generate` off a non-interactive stdin dead-ends: when a table is
 * renamed or swapped, drizzle-kit asks "is <newTable> a rename of <oldTable>?"
 * and, with no TTY to answer, exits with "Interactive prompts require a TTY".
 * Returns the escape-hatch hint for exactly that case, else null (so the
 * interactive path and every other subcommand print nothing extra).
 *
 * @param {string} sub  the `webjs db` subcommand (generate|migrate|push|studio)
 * @param {number|null|undefined} code  drizzle-kit's exit code
 * @param {boolean|undefined} isTTY  process.stdin.isTTY
 * @returns {string|null}
 */
export function dbGenerateTtyHint(sub, code, isTTY) {
  if (sub !== 'generate' || !code || isTTY) return null;
  return (
    '\nwebjs db generate needs an interactive terminal to resolve a table rename.\n' +
    'Run it in a real terminal to answer the prompt, or, if the dev database has\n' +
    'no data yet, delete the db/migrations/<initial> folder and re-run to author a\n' +
    'clean create-table migration.'
  );
}
