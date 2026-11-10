// Agent-knowledge coverage gate (tier-2, un-skippable CI enforcement).
//
// This keeps the surfaces that counter agents' WRONG PRIORS honest, which is
// where agents actually fail. Every LIVE `webjs check` RULE is explained on the
// docs site (the symptom-keyed troubleshooting page or any other docs page,
// matched by rule name) OR exempted with a reason in knowledge-coverage.json. A
// new rule that ships with no "here is the symptom and the fix" turns CI red.
// The docs site is the canonical documentation since the agent skill was
// replaced by the brief, so every page under website/app/(site)/docs counts. (The
// MCP `init` primer returns the brief, whose copies
// test/repo-health/brief-parity.test.mjs holds identical.)
//
// The reconcile core is pure; failure modes are proven with synthetic inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../../packages/server/src/check.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const MANIFEST = JSON.parse(readFileSync(join(__dirname, 'knowledge-coverage.json'), 'utf8'));

/** Every docs-site page source, the troubleshooting page included. */
function docsPages(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) docsPages(f, out);
    else if (e.name.endsWith('.ts')) out.push(f);
  }
  return out;
}
const EXPLAIN_SURFACES = docsPages(join(REPO, 'website', 'app', '(site)', 'docs'));

/** True when the rule name appears as a whole token in any explanation surface. */
function ruleIsExplained(name) {
  const re = new RegExp(`\\b${name.replace(/[-]/g, '\\-')}\\b`);
  return EXPLAIN_SURFACES.some((f) => {
    try { return re.test(readFileSync(f, 'utf8')); } catch { return false; }
  });
}

/**
 * Pure reconciliation of check rules against the explanation surfaces + exempt
 * map. Returns error strings; empty means covered. `explained` is injectable so
 * synthetic cases need no fs.
 */
export function reconcileRules(liveRules, exempt, explained) {
  const errors = [];
  const exemptNames = new Set(Object.keys(exempt));
  const live = new Set(liveRules);

  for (const name of liveRules) {
    const isExplained = explained(name);
    const isExempt = exemptNames.has(name);
    if (!isExplained && !isExempt) {
      errors.push(
        `check rule "${name}" is neither explained (on a docs-site page, ideally the troubleshooting page) ` +
        `nor exempted in test/knowledge/knowledge-coverage.json. Add a symptom-keyed entry that ` +
        `names the rule, or an exemption with a reason.`,
      );
    }
  }
  // Stale exemption: a name exempted that is no longer a live rule.
  for (const name of exemptNames) {
    if (!live.has(name)) errors.push(`stale exemption "${name}": no longer a webjs check rule, remove it from knowledge-coverage.json.`);
    else if (typeof exempt[name] !== 'string' || !exempt[name].trim()) errors.push(`exemption "${name}" needs a non-empty reason.`);
  }
  return errors;
}

const liveRules = RULES.map((r) => r.name);

test('every webjs check rule is explained in an agent-facing surface or exempted', () => {
  const errors = reconcileRules(liveRules, MANIFEST.checkRulesExempt, ruleIsExplained);
  const explained = liveRules.filter(ruleIsExplained).length;
  console.log(`[knowledge-coverage] ${liveRules.length} check rules: ${explained} explained, ${Object.keys(MANIFEST.checkRulesExempt).length} exempted.`);
  assert.deepEqual(errors, [], `check-rule knowledge gaps:\n  - ${errors.join('\n  - ')}`);
});

// --- counterfactuals: prove each failure mode fires ---

test('reconcileRules FAILS on a new unexplained, unexempted rule', () => {
  const errors = reconcileRules(['brand-new-rule'], {}, () => false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /check rule "brand-new-rule" is neither explained/);
});

test('reconcileRules FAILS on a stale exemption', () => {
  const errors = reconcileRules([], { 'gone-rule': 'reason' }, () => false);
  assert.ok(errors.some((e) => /stale exemption "gone-rule"/.test(e)), errors.join('\n'));
});

test('reconcileRules FAILS on an empty exemption reason', () => {
  const errors = reconcileRules(['x'], { x: '  ' }, () => false);
  assert.ok(errors.some((e) => /needs a non-empty reason/.test(e)), errors.join('\n'));
});

test('reconcileRules passes an explained rule with no exemption', () => {
  const errors = reconcileRules(['real-rule'], {}, (n) => n === 'real-rule');
  assert.deepEqual(errors, []);
});
