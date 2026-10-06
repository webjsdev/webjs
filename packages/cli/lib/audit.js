/**
 * `webjs audit`: the dependency audit with a reviewable allowlist (#1492).
 *
 * A freshly generated app used to fail its own `Security: dependency audit`
 * CI step on the day it was created, because the dev toolchain reaches an
 * advisory with NO patched release (braces, GHSA-vfj7-8cjw-p6xm, through the
 * Tailwind watcher and the test runner's globber). Nothing can be upgraded,
 * so the step was red until someone deleted it, which also throws away the
 * signal for every advisory that DOES have a fix.
 *
 * So the app declares the advisories it accepts, in ONE place, each with the
 * reason it is safe, under `webjs.audit` in package.json:
 *
 *   "audit": {
 *     "level": "high",
 *     "ignore": [{ "id": "GHSA-...", "reason": "why this cannot reach users" }]
 *   }
 *
 * and `webjs audit` runs the package manager's own audit (`npm audit --json`
 * or `bun audit --json`) and filters that report here, the same way for both,
 * since npm has no ignore flag at all. Every other advisory at or above
 * `level` still fails.
 *
 * The config fails CLOSED, like the doctor gate: an entry without an id or a
 * reason, an unknown key, or a bad level exits 1 naming the problem, because
 * an allowlist that silently stopped applying (or silently applied to
 * everything) would be worse than none. An ignored id that no longer appears in
 * the report is printed as stale, so the list shrinks when upstream ships a fix.
 *
 * @module audit
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const AUDIT_LEVELS = ['low', 'moderate', 'high', 'critical'];

/**
 * @typedef {{ id: string, reason: string }} AuditIgnore
 * @typedef {{ level: string, ignore: AuditIgnore[] }} AuditConfig
 * @typedef {{ id: string, url: string, severity: string, title: string, packages: string[] }} Advisory
 */

/**
 * Read and validate `webjs.audit` from a parsed package.json.
 *
 * @param {Record<string, any>} pkg
 * @returns {{ config: AuditConfig, errors: string[] }}
 */
export function readAuditConfig(pkg) {
  /** @type {AuditConfig} */
  const config = { level: 'high', ignore: [] };
  /** @type {string[]} */
  const errors = [];
  const raw = pkg?.webjs?.audit;
  if (raw === undefined) return { config, errors };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { config, errors: ['webjs.audit must be an object'] };
  }
  for (const key of Object.keys(raw)) {
    if (key !== 'level' && key !== 'ignore') errors.push(`webjs.audit: unknown key "${key}" (expected "level" or "ignore")`);
  }
  if (raw.level !== undefined) {
    if (!AUDIT_LEVELS.includes(raw.level)) errors.push(`webjs.audit.level must be one of ${AUDIT_LEVELS.join(', ')}`);
    else config.level = raw.level;
  }
  if (raw.ignore !== undefined) {
    if (!Array.isArray(raw.ignore)) {
      errors.push('webjs.audit.ignore must be an array of { id, reason }');
    } else {
      raw.ignore.forEach((entry, i) => {
        const at = `webjs.audit.ignore[${i}]`;
        if (!entry || typeof entry !== 'object') { errors.push(`${at} must be an object { id, reason }`); return; }
        const extra = Object.keys(entry).filter((k) => k !== 'id' && k !== 'reason');
        if (extra.length) errors.push(`${at}: unknown key "${extra[0]}" (expected "id" and "reason")`);
        if (typeof entry.id !== 'string' || !/^(GHSA(-[0-9a-z]{4}){3}|CVE-\d{4}-\d+)$/i.test(entry.id)) {
          errors.push(`${at}.id must be an advisory id such as GHSA-xxxx-xxxx-xxxx or CVE-2024-12345`);
          return;
        }
        if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
          errors.push(`${at} (${entry.id}) needs a non-empty "reason" saying why it is safe to accept`);
          return;
        }
        config.ignore.push({ id: entry.id, reason: entry.reason });
      });
    }
  }
  return { config, errors };
}

/**
 * Which package manager's audit to run. Walks up from `cwd` to the first
 * lockfile, since an app inside a workspace has its lockfile at the root.
 * Only bun and npm have an audit this command drives; anything else is
 * reported as unsupported by the caller.
 *
 * @param {string} cwd
 * @returns {'bun' | 'npm' | 'pnpm' | 'yarn'}
 */
export function detectAuditManager(cwd) {
  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb'))) return 'bun';
    if (existsSync(join(dir, 'package-lock.json')) || existsSync(join(dir, 'npm-shrinkwrap.json'))) return 'npm';
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.versions.bun ? 'bun' : 'npm';
}

/** The advisory id at the end of a GitHub advisory url. */
function idFromUrl(url) {
  const m = /(GHSA(?:-[0-9a-z]{4}){3})/i.exec(url || '');
  return m ? m[1] : '';
}

/**
 * The source advisories in an `npm audit --json` (v2 report format) report,
 * deduplicated by id. A vulnerability entry whose `via` holds only package
 * NAMES is a dependent of one of these, not an advisory of its own, so it is
 * covered by filtering the advisories it inherits from.
 *
 * @param {any} report
 * @returns {Advisory[]}
 */
export function npmAdvisories(report) {
  /** @type {Map<string, Advisory>} */
  const byId = new Map();
  for (const [name, vuln] of Object.entries(report?.vulnerabilities || {})) {
    for (const via of /** @type {any} */ (vuln).via || []) {
      if (!via || typeof via !== 'object') continue;
      const id = idFromUrl(via.url) || String(via.source ?? via.url);
      const cur = byId.get(id);
      if (cur) { if (!cur.packages.includes(name)) cur.packages.push(name); continue; }
      byId.set(id, { id, url: via.url || '', severity: via.severity || 'low', title: via.title || '', packages: [name] });
    }
  }
  return [...byId.values()];
}

/**
 * Split advisories into the ones that still fail and the ones the allowlist
 * accepted, keeping only those at or above `level`.
 *
 * @param {Advisory[]} advisories
 * @param {AuditConfig} config
 * @returns {{ failing: Advisory[], ignored: Advisory[], stale: AuditIgnore[] }}
 */
export function applyAuditConfig(advisories, config) {
  const floor = AUDIT_LEVELS.indexOf(config.level);
  const atLevel = advisories.filter((a) => AUDIT_LEVELS.indexOf(a.severity) >= floor);
  const ids = new Set(config.ignore.map((i) => i.id.toUpperCase()));
  const failing = atLevel.filter((a) => !ids.has(a.id.toUpperCase()));
  const ignored = atLevel.filter((a) => ids.has(a.id.toUpperCase()));
  const seen = new Set(advisories.map((a) => a.id.toUpperCase()));
  const stale = config.ignore.filter((i) => !seen.has(i.id.toUpperCase()));
  return { failing, ignored, stale };
}

/**
 * The source advisories in a `bun audit --json` report, which is keyed by
 * package name with a list of advisories each.
 *
 * @param {any} report
 * @returns {Advisory[]}
 */
export function bunAdvisories(report) {
  /** @type {Map<string, Advisory>} */
  const byId = new Map();
  for (const [name, list] of Object.entries(report || {})) {
    if (!Array.isArray(list)) continue;
    for (const adv of list) {
      const id = idFromUrl(adv?.url) || String(adv?.id ?? adv?.url);
      const cur = byId.get(id);
      if (cur) { if (!cur.packages.includes(name)) cur.packages.push(name); continue; }
      byId.set(id, { id, url: adv?.url || '', severity: adv?.severity || 'low', title: adv?.title || '', packages: [name] });
    }
  }
  return [...byId.values()];
}

/**
 * Parse a package manager's `audit --json` stdout into advisories. Both
 * managers exit non-zero when they find anything, so the exit code says
 * nothing; an unparseable stdout (a registry outage, an old manager) returns
 * `null` and the caller fails closed.
 *
 * @param {'bun' | 'npm'} pm
 * @param {string} stdout
 * @returns {Advisory[] | null}
 */
export function parseAuditReport(pm, stdout) {
  let report;
  try { report = JSON.parse(stdout); } catch { return null; }
  if (!report || typeof report !== 'object') return null;
  if (pm === 'npm') {
    if (report.error) return null;
    return npmAdvisories(report);
  }
  return bunAdvisories(report);
}

/**
 * Read `webjs.audit` from the package.json in `cwd`.
 *
 * @param {string} cwd
 */
export function readAuditConfigFrom(cwd) {
  const p = join(cwd, 'package.json');
  if (!existsSync(p)) return { config: { level: 'high', ignore: [] }, errors: ['no package.json in this directory'] };
  try {
    return readAuditConfig(JSON.parse(readFileSync(p, 'utf8')));
  } catch (e) {
    return { config: { level: 'high', ignore: [] }, errors: [`package.json is not valid JSON: ${/** @type {Error} */ (e).message}`] };
  }
}
