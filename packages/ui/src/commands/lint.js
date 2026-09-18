import { Command } from 'commander';
import { getConfig } from '../utils/get-config.js';
import { lintApp } from '../lint/index.js';
import { logger } from '../utils/logger.js';

/**
 * Run the linter and shape its report, with no printing and no exit, so the
 * command test calls this directly. `code` is 0 or 1 only, matching `webjs
 * check`'s posture that an agent gates on non-zero: 1 when any error-level
 * violation exists, when the warning count exceeds `maxWarnings` (-1 is no
 * cap), or when the command cannot run at all (no `components.json`, or a
 * config that fails the schema).
 *
 * @param {{ cwd?: string, json?: boolean, maxWarnings?: number|string }} [opts]
 * @returns {{ lines: string[], code: number, report: null | { violations: any[], summary: any, warnings: string[] } }}
 */
export function runLint(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const maxWarnings = Number(opts.maxWarnings ?? -1);
  /** @type {string[]} */
  const lines = [];
  // A run that cannot start still answers in the requested shape, so an agent
  // loop parsing stdout under --json receives an error document, never text.
  const refuse = (error) => {
    if (opts.json) {
      lines.push(JSON.stringify({ error, violations: [], summary: { count: 0, errors: 0, warnings: 0, byRule: {} }, warnings: [], configured: false }, null, 2));
    } else {
      lines.push(`webjsui lint: ${error}`);
    }
    return { lines, code: 1, report: null };
  };
  if (!Number.isInteger(maxWarnings) || maxWarnings < -1) {
    return refuse(`--max-warnings expects an integer (-1 for no cap), got ${JSON.stringify(String(opts.maxWarnings))}`);
  }
  let config;
  try {
    config = getConfig(cwd);
  } catch (e) {
    return refuse(`components.json is invalid: ${firstIssue(e)}`);
  }
  if (!config) return refuse('components.json not found (run `npx @webjsdev/ui init`)');

  const { violations, warnings, configured } = lintApp(cwd, config);
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warns = violations.length - errors;
  /** @type {Record<string, number>} */
  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  const report = {
    violations,
    summary: { count: violations.length, errors, warnings: warns, byRule },
    warnings,
    configured,
  };

  if (opts.json) {
    lines.push(JSON.stringify(report, null, 2));
  } else if (!configured) {
    lines.push('webjsui lint: no rules configured (add a "lint" block to components.json)');
  } else {
    for (const w of warnings) lines.push(`⚠ ${w}`);
    if (violations.length === 0) {
      lines.push('webjsui lint: all checks pass ✓');
    } else {
      lines.push(`webjsui lint: ${violations.length} problem(s) found (${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'})`);
      for (const v of violations) {
        lines.push('');
        lines.push(`  ${v.severity === 'error' ? '✗' : '⚠'} [${v.rule}] ${v.file}:${v.line}:${v.column}`);
        lines.push(`    ${v.message}`);
      }
    }
  }
  const code = errors > 0 || (maxWarnings >= 0 && warns > maxWarnings) ? 1 : 0;
  return { lines, code, report };
}

function firstIssue(e) {
  const issue = e?.issues?.[0];
  if (issue) return `${issue.path?.join('.') || '(root)'}: ${issue.message}`;
  return String(e?.message ?? e);
}

export const lint = new Command()
  .name('lint')
  .description('Check the app against its design system (opt-in, configured in components.json)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('--json', 'emit structured violations for an agent loop')
  .option('--max-warnings <n>', 'fail when warnings exceed this count', '-1')
  .action((opts) => {
    const { lines, code } = runLint(opts);
    for (const l of lines) logger.info(l);
    if (code !== 0) process.exitCode = code;
  });
