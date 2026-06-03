/**
 * #263: `webjs check` is report-only. The CLI handles `--rules` but never read
 * or applied `--fix`, yet the docs advertised `check [--fix]`, giving an agent
 * false confidence that running it fixed its code. The flag was struck from the
 * docs (none of the rules can be auto-fixed safely: they rewrite code or rename
 * files). This guards that no doc re-introduces the phantom flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('no doc advertises a webjs check --fix flag (it is report-only)', () => {
  // Scan EVERY tracked markdown file so a re-introduction anywhere (a nested
  // AGENTS.md, a scaffold template, a guide) is caught, not just the two files
  // this fix edited.
  const files = execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  for (const f of files) {
    const md = readFileSync(resolve(ROOT, f), 'utf8');
    // The advertising forms that imply --fix is a usable flag (a bracketed
    // option after `check`). A prose mention that there is NO --fix is allowed.
    assert.ok(!/check\s+\[--fix\]/.test(md), `${f} must not advertise check [--fix]`);
    assert.ok(
      !/\[--rules\s*\\?\|\s*--fix\]/.test(md),
      `${f} must not advertise [--rules|--fix]`,
    );
  }
});
