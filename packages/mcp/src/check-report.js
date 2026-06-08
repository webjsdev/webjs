/**
 * Shared JSON projector for `webjs check` violations (#262).
 *
 * `webjs check --json` and the `webjs mcp` server's `check` tool BOTH return
 * the identical shape, so the projection lives here once. The input is the raw
 * `Violation[]` from `checkConventions(appDir)` (each `{ rule, file, message,
 * fix }`); the output adds a `summary` count plus a per-rule breakdown so an
 * agent consuming the structured output never has to regex-scrape stdout.
 *
 * Pure and side-effect-free: it neither reads files nor prints. The caller owns
 * running `checkConventions` and (for the CLI) the non-zero exit when there are
 * violations.
 *
 * @module check-json
 */

/**
 * @typedef {{ rule: string, file: string, message: string, fix: string }} Violation
 */

/**
 * @typedef {{
 *   violations: Violation[],
 *   summary: { count: number, byRule: Record<string, number> },
 * }} CheckReport
 */

/**
 * Project a raw `Violation[]` into the structured `{ violations, summary }`
 * report shared by `check --json` and the MCP `check` tool. `violations` is
 * passed through verbatim (the `{ rule, file, message, fix }` shape), and
 * `summary.byRule` tallies how many violations each rule produced.
 *
 * @param {Violation[]} violations
 * @returns {CheckReport}
 */
export function projectCheck(violations) {
  /** @type {Record<string, number>} */
  const byRule = {};
  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] || 0) + 1;
  }
  return {
    violations,
    summary: { count: violations.length, byRule },
  };
}
