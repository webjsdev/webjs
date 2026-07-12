// Actionable hints for `webjs db` failure modes that drizzle-kit surfaces
// opaquely. Kept as pure functions so the dispatch path in bin/webjs.js stays a
// thin spawn and the messages are unit-testable without a child process.

/**
 * `webjs db generate` off a non-interactive stdin dead-ends when a table is
 * renamed or swapped: drizzle-kit asks "is <newTable> a rename of <oldTable>?"
 * and, with no TTY to answer, exits with "Interactive prompts require a TTY".
 * That message goes to the inherited stderr (this process never captures it), so
 * we cannot tell the rename-prompt failure apart from any other generate error.
 * The hint therefore reads as CONDITIONAL guidance appended after the real error
 * for a non-TTY `generate` failure, and defers to the error shown above for
 * anything else. Returns null on success, an interactive run, or another
 * subcommand, so those print nothing extra.
 *
 * @param {string} sub  the `webjs db` subcommand (generate|migrate|push|studio)
 * @param {number|null|undefined} code  drizzle-kit's exit code
 * @param {boolean|undefined} isTTY  process.stdin.isTTY
 * @returns {string|null}
 */
export function dbGenerateTtyHint(sub, code, isTTY) {
  if (sub !== 'generate' || !code || isTTY) return null;
  return (
    '\nIf `webjs db generate` stopped at a rename prompt, it needs an interactive\n' +
    'terminal to answer it: run it in a real terminal, or, if the dev database has\n' +
    'no data yet, delete the db/migrations/<initial> folder and re-run to author a\n' +
    'clean create-table migration. Any other failure is described in the error above.'
  );
}
