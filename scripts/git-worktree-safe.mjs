#!/usr/bin/env node
// Keeps the main checkout safe from the recurring core.bare=true corruption
// (issue #166) and the related core.hooksPath reset.
//
// Background. This repo uses git worktrees (the review subagents spawn
// throwaway worktrees under .claude/worktrees/). With git's worktree
// machinery, the shared .git/config can end up carrying core.bare=true.
// The shared value is harmless ONLY while the main worktree has a
// per-worktree override (extensions.worktreeConfig=true plus a
// .git/config.worktree pinning core.bare=false). If that override is
// missing, the main checkout reads the shared core.bare=true and every
// git operation that needs a work tree fails with
// "fatal: this operation must be run in a work tree".
//
// Separately, the old `prepare` wrote a RELATIVE core.hooksPath (.hooks)
// to the SHARED config. A relative hooksPath is resolved at read time and
// the shared surface is the same one worktree events reset, which is how
// the framework hook (.hooks/pre-commit) silently stops firing and the
// absolute default .git/hooks takes over.
//
// This script pins both values on the MAIN worktree (where they survive a
// shared-config reset) and is idempotent, so `prepare` can run it on every
// `npm install` as a self-heal. Nothing here is ever lost on GitHub; this
// only repairs the LOCAL checkout.
//
// Usage:
//   node scripts/git-worktree-safe.mjs            ensure/heal (default)
//   node scripts/git-worktree-safe.mjs --check    assert the invariant; exit 1 if violated

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECK = process.argv.includes('--check');

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function isInsideWorkTree() {
  return git(['rev-parse', '--is-inside-work-tree'], { allowFail: true }) === 'true';
}

// Resolve the work-tree root. When the repo is in the corrupted bare state
// `--show-toplevel` fails, so fall back to the common dir's parent.
function topLevel() {
  const top = git(['rev-parse', '--show-toplevel'], { allowFail: true });
  if (top) return top;
  const commonDir = git(['rev-parse', '--git-common-dir'], { allowFail: true });
  if (commonDir) return resolve(commonDir, '..');
  return process.cwd();
}

function ensure() {
  // 1. Un-break the shared value first so the rest of the commands (which
  //    need a work tree) succeed even if we started corrupted.
  git(['config', '--local', 'core.bare', 'false'], { allowFail: true });

  // 2. Enable per-worktree config and pin the override on the MAIN worktree.
  //    The override wins even if a later worktree event flips the shared
  //    core.bare back to true.
  git(['config', 'extensions.worktreeConfig', 'true'], { allowFail: true });
  git(['config', '--worktree', 'core.bare', 'false'], { allowFail: true });

  // 3. Pin core.hooksPath to an ABSOLUTE path on the main worktree so it is
  //    cwd-independent and survives a shared-config reset. Only when the
  //    tracked .hooks dir exists (the framework repo); a generic repo using
  //    this script keeps its own hooks.
  const top = topLevel();
  const hooksDir = join(top, '.hooks');
  let hooksMsg = 'core.hooksPath: left as-is (.hooks not present)';
  if (existsSync(hooksDir)) {
    git(['config', '--worktree', 'core.hooksPath', hooksDir], { allowFail: true });
    hooksMsg = `core.hooksPath: ${hooksDir}`;
  }

  const resolvedBare = git(['config', 'core.bare'], { allowFail: true });
  console.log('[git-worktree-safe] ensured worktree-safe config:');
  console.log(`  extensions.worktreeConfig: ${git(['config', 'extensions.worktreeConfig'], { allowFail: true })}`);
  console.log(`  core.bare (resolved): ${resolvedBare}`);
  console.log(`  ${hooksMsg}`);
}

function check() {
  const problems = [];

  if (!isInsideWorkTree()) {
    problems.push('repo is not a usable work tree (core.bare resolves true); run: npm run fix:git');
  } else {
    const resolvedBare = git(['config', 'core.bare'], { allowFail: true });
    if (resolvedBare !== 'false') {
      problems.push(`core.bare resolves to "${resolvedBare}" (expected "false")`);
    }
  }

  const wtConfig = git(['config', 'extensions.worktreeConfig'], { allowFail: true });
  if (wtConfig !== 'true') {
    problems.push(`extensions.worktreeConfig is "${wtConfig}" (expected "true"); without it a shared core.bare flip is fatal`);
  }

  const top = topLevel();
  const hooksDir = join(top, '.hooks');
  if (existsSync(hooksDir)) {
    const resolvedHooks = git(['config', 'core.hooksPath'], { allowFail: true });
    if (resolve(resolvedHooks || '') !== resolve(hooksDir)) {
      problems.push(`core.hooksPath is "${resolvedHooks}" (expected "${hooksDir}"); the framework hook is not active`);
    }
  }

  if (problems.length) {
    console.error('[git-worktree-safe] repo health check FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Fix with: npm run fix:git');
    process.exit(1);
  }
  console.log('[git-worktree-safe] repo health check passed (core.bare=false, hooks active).');
}

try {
  if (CHECK) check();
  else ensure();
} catch (err) {
  // Ensure mode must never fail `npm install`. Surface the reason and exit 0.
  if (!CHECK) {
    console.warn(`[git-worktree-safe] could not fully ensure config: ${String(err.message).split('\n')[0]}`);
    process.exit(0);
  }
  throw err;
}
