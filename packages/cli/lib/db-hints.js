// Actionable hints for `webjs db` failure modes that drizzle-kit surfaces
// opaquely. Kept as pure functions so the dispatch path in bin/webjs.js stays a
// thin spawn and the messages are unit-testable without a child process.

// drizzle-kit prints this on stderr when a rename prompt has no TTY to answer.
// It is the reliable signal: this drizzle-kit version EXITS 0 on that failure,
// so the exit code cannot be used, and keying on stderr also means an unrelated
// generate failure (a schema type error, a missing config) does NOT misfire.
const TTY_PROMPT = /require a tty|interactive prompt/i;

/**
 * `webjs db generate` off a non-interactive stdin dead-ends when a table is
 * renamed or swapped: drizzle-kit asks "is <newTable> a rename of <oldTable>?"
 * and, with no TTY to answer, prints "Interactive prompts require a TTY" to
 * stderr (and exits 0). Returns the escape-hatch hint only when the captured
 * stderr carries that signature, so it fires on exactly that case and stays
 * silent on success, an interactive run, another subcommand, or an unrelated
 * generate error.
 *
 * @param {string} sub  the `webjs db` subcommand (generate|migrate|push|studio)
 * @param {boolean|undefined} isTTY  process.stdin.isTTY
 * @param {string|undefined} stderr  drizzle-kit's captured stderr
 * @returns {string|null}
 */
export function dbGenerateTtyHint(sub, isTTY, stderr) {
  if (sub !== 'generate' || isTTY) return null;
  if (!TTY_PROMPT.test(stderr || '')) return null;
  return (
    '\nwebjs db generate needs an interactive terminal to resolve a table rename.\n' +
    'Run it in a real terminal to answer the prompt, or, if the dev database has no\n' +
    'data yet, delete the db/migrations/<initial> folder and re-run to author a clean\n' +
    'create-table migration.'
  );
}
