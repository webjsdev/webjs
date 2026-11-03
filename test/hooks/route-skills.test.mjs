// Tests for the UserPromptSubmit skill-routing hook
// (.claude/hooks/route-skills.sh). The hook reads a prompt on stdin and
// emits hookSpecificOutput.additionalContext that routes the prompt to the
// skills it matches, so a relevant skill is never silently skipped.
//
// We exercise the hook as a black box: feed it the JSON the harness would,
// parse its stdout, and assert which skills it routed to. The standing
// policy must always be present; per-skill routing must fire on the
// documented trigger phrases and stay quiet on unrelated prompts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../../.claude/hooks/route-skills.sh');
const REPO = resolve(here, '../..');

/**
 * Run the hook with a prompt and return { code, ctx } where ctx is the
 * parsed additionalContext string (or '' if none).
 */
function run(prompt) {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({ prompt }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `hook exited non-zero: ${r.stderr}`);
  if (!r.stdout.trim()) return { code: 0, ctx: '' };
  const parsed = JSON.parse(r.stdout);
  return { code: 0, ctx: parsed.hookSpecificOutput?.additionalContext ?? '' };
}

/** A git env var inherited from a calling hook would override `git -C`. */
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  return env;
}

/** Run the hook at `hook` for a session in `cwd`. Returns its raw stdout. */
function runIn(cwd, hook = HOOK) {
  const r = spawnSync('bash', [hook], {
    input: JSON.stringify({ prompt: 'file a task for X', cwd }),
    encoding: 'utf8',
    env: cleanEnv(),
  });
  assert.equal(r.status, 0, `hook exited non-zero: ${r.stderr}`);
  return r.stdout;
}

/** A throwaway git repo. `router` is its .claude/hooks/route-skills.sh, if any. */
function tempRepo(t, router) {
  const dir = mkdtempSync(join(tmpdir(), 'route-skills-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const init = spawnSync('git', ['init', '-q', dir], { env: cleanEnv() });
  assert.equal(init.status, 0);
  if (router) {
    mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
    router(join(dir, '.claude/hooks/route-skills.sh'));
  }
  return dir;
}

test('a repo with its own router silences this one', (t) => {
  const dir = tempRepo(t, (p) => writeFileSync(p, '#!/bin/sh\n', { mode: 0o755 }));
  assert.equal(runIn(dir), '');
  // From a subdirectory too: the check goes by the git toplevel, not the cwd.
  mkdirSync(join(dir, 'app'));
  assert.equal(runIn(join(dir, 'app')), '');
});

test('routing is unchanged where no other router applies', (t) => {
  const noRouter = tempRepo(t);
  assert.match(runIn(noRouter), /webjs-file-issue/, 'a repo with no router');

  const notGit = mkdtempSync(join(tmpdir(), 'route-skills-'));
  t.after(() => rmSync(notGit, { recursive: true, force: true }));
  assert.match(runIn(notGit), /webjs-file-issue/, 'a cwd outside any git repo');

  assert.match(runIn('/nonexistent/route-skills'), /webjs-file-issue/, 'a cwd that is gone');

  const notExecutable = tempRepo(t, (p) => writeFileSync(p, '#!/bin/sh\n', { mode: 0o644 }));
  assert.match(runIn(notExecutable), /webjs-file-issue/, 'a router that cannot run');
});

test('this script does not silence itself', (t) => {
  assert.match(runIn(REPO), /webjs-file-issue/, 'its own repo');

  // The user-level wiring: run through a symlink, from this repo.
  const home = mkdtempSync(join(tmpdir(), 'route-skills-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const link = join(home, 'route-skills.sh');
  symlinkSync(HOOK, link);
  assert.match(runIn(REPO, link), /webjs-file-issue/, 'through a symlink');

  // A project whose router is a symlink to this very file.
  const linked = tempRepo(t, (p) => symlinkSync(HOOK, p));
  assert.match(runIn(linked), /webjs-file-issue/, 'a project router linked to this file');
});

/** Count how many times a skill name was routed (one bullet per skill). */
function routed(ctx, skill) {
  const re = new RegExp(`^- ${skill}:`, 'm');
  return re.test(ctx);
}

test('standing policy is injected on every prompt', () => {
  for (const p of ['file a task for X', 'explain the SSR pipeline', '']) {
    const { ctx } = run(p);
    if (p === '') {
      // Empty prompt is a no-op (nothing to route).
      assert.equal(ctx, '');
    } else {
      assert.match(ctx, /skill policy/i);
      // Newlines wrap the sentence, so match the salient tokens flexibly.
      assert.match(ctx, /invoke that skill via the[\s\S]*Skill tool BEFORE other work/i);
    }
  }
});

test('webjs-file-issue routes on its trigger phrases', () => {
  for (const p of [
    'file a task for adding dark mode',
    'create an issue for the streaming bug',
    'track this as a todo: refactor the rate limiter',
    'make this an issue',
    'add a new task to investigate the SSR race',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-file-issue'), `expected file-issue route for: ${p}`);
  }
});

test('webjs-start-work routes on its trigger phrases', () => {
  for (const p of [
    'work on #112',
    "let's start work on the rate-limit issue",
    'pick up #114',
    'tackle the dist issue (#113)',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-start-work'), `expected start-work route for: ${p}`);
  }
});

test('webjs-list-todos routes on its trigger phrases', () => {
  for (const p of [
    "what's pending",
    'what should I work on next',
    'show me the open issues',
    'list webjs todos',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-list-todos'), `expected list-todos route for: ${p}`);
  }
});

test('use-railway routes on infra phrases', () => {
  for (const p of [
    'redeploy the docs service',
    'check the railway deployment',
    'the build failed on deploy',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'use-railway'), `expected railway route for: ${p}`);
  }
});

test('webjs-research-record routes on research/design phrases', () => {
  for (const p of [
    'research whether we should switch the default ORM',
    'investigate the SSR partial-nav approach and write it up',
    'evaluate Drizzle vs Prisma and record the decision',
    'write up the design for the streaming protocol',
    'this is a design record, where should it go',
    'spike path-alias imports and capture the findings',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-research-record'), `expected research-record route for: ${p}`);
  }
});

test('webjs-ready-for-dev routes on issue-planning phrases', () => {
  for (const p of [
    'get #1253, #1258 and #1264 ready for development',
    'ready these issues for dev: 1261, 1263',
    'prep #1265 for development',
    'make those todos implementation-ready',
    'write the implementation plans for the low risk issues',
    'scope out #1269 so an agent can pick it up',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-ready-for-dev'), `expected ready-for-dev route for: ${p}`);
  }
});

test('webjs-ready-for-dev stays quiet on PR-readiness phrases', () => {
  // "ready" about a PR is a merge or review question, not issue planning.
  for (const p of [
    'is the PR ready to merge',
    'mark it ready for review',
    'the branch is ready, can we merge',
  ]) {
    const { ctx } = run(p);
    assert.ok(!routed(ctx, 'webjs-ready-for-dev'), `PR-readiness prompt must not route: ${p}`);
  }
});

test('webjs-blog-write routes on blog-writing phrases', () => {
  for (const p of [
    'write a blog post about streaming actions',
    'draft an SEO blog for the path-alias imports',
    'author a blog covering CSRF without tokens',
    'we shipped verb actions but never blogged it',
    'add a new blog explaining elision',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-blog-write'), `expected blog-write route for: ${p}`);
  }
});

test('webjs-blog-write stays quiet on a docs-sync prompt', () => {
  // Syncing framework reference docs is doc-sync work, not a blog post.
  const { ctx } = run('sync the docs for the new path-alias feature');
  assert.ok(!routed(ctx, 'webjs-blog-write'), 'doc-sync prompt must not route to blog-write');
});

test('webjs-instagram-post routes on instagram-posting phrases', () => {
  for (const p of [
    'post this to instagram',
    'publish an instagram post about the new feature',
    'share the why page on instagram for SEO',
    'promote the streaming actions on instagram',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'webjs-instagram-post'), `expected instagram route for: ${p}`);
  }
});

test('webjs-instagram-post stays quiet without instagram intent', () => {
  const { ctx } = run('publish the release notes to the changelog');
  assert.ok(!routed(ctx, 'webjs-instagram-post'), 'non-instagram publish must not route to instagram');
});

test('pr-review routes on review phrases', () => {
  for (const p of [
    'review the PR',
    'review my changes',
    'can you do a code review',
    'review the diff for bugs',
    'review the branch',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'pr-review'), `expected pr-review route for: ${p}`);
  }
});

// The routing test above only proves a skill NAMED pr-review is reached. It
// says nothing about what the injected directive tells the model to DO, and
// the rules below are the whole point of the skill: reviews happen inline,
// the reviewer only reviews, and it never blocks on CI. Nothing else in the
// suite would notice if a round count, a reviewer subagent, or a CI wait
// were put back, so both carriers of those rules are pinned here.
//
// This replaces test/hooks/review-loop-exit.test.mjs, which guarded the
// previous review cycle's load-bearing wording across the same two files and
// caught them drifting apart once.
test('the pr-review directive and skill both keep the review contract', () => {
  const { ctx } = run('review the PR');
  const directive = ctx.split('\n').find((l) => l.startsWith('- pr-review:'));
  assert.ok(directive, 'expected a pr-review directive line');
  const skill = readFileSync(resolve(REPO, '.claude/skills/pr-review/SKILL.md'), 'utf8');

  // Inline, never delegated: a subagent reviewer is what this replaced.
  assert.match(directive, /NEVER spawn a reviewer subagent/);
  assert.match(skill, /Never spawn a reviewer subagent/i);
  // One read, not a cycle. A round count coming back is the regression.
  assert.match(directive, /NEVER run a multi-round review cycle/);
  assert.match(skill, /never run a multi-round\s+review cycle/i);
  // A plain review stops at the findings, but a fix ask (/code-review --fix)
  // is honoured: commenting INSTEAD of fixing is the regression this guards.
  assert.match(directive, /A plain review ask stops at the findings/);
  assert.match(directive, /APPLY the fixes/);
  assert.match(directive, /never comment instead of fixing/);
  assert.match(skill, /Findings are the deliverable, unless a fix was asked for/);
  assert.match(skill, /Nothing in this skill overrides\s+a fix the user asked for/);
  // Never blocks on CI, which is the merge gate's business.
  assert.match(directive, /never waits on or reports CI/);
  assert.match(skill, /\*\*No CI\.\*\* Never wait on, read, or report CI/);
  // The output is a real GitHub review object, not a chat-only reply.
  assert.match(directive, /post the review through the GitHub review API as ONE review object/);
  assert.match(skill, /pulls\/<N>\/reviews/);
});

test('verify routes on verify / dogfood phrases', () => {
  for (const p of [
    'verify the fix works',
    'confirm the change works',
    'manually test the app',
    'boot the dogfood apps',
  ]) {
    const { ctx } = run(p);
    assert.ok(routed(ctx, 'verify'), `expected verify route for: ${p}`);
  }
});

test('research-record stays quiet on a plain file-issue prompt', () => {
  // "add a new task to investigate the SSR race" is file-issue work, not a
  // research writeup; research-record must not steal it.
  const { ctx } = run('add a new task to investigate the SSR race');
  assert.ok(routed(ctx, 'webjs-file-issue'));
  assert.ok(!routed(ctx, 'webjs-research-record'));
});

test('unrelated prompt routes to no skill but still carries the policy', () => {
  const { ctx } = run('explain how the SSR pipeline works');
  assert.match(ctx, /skill policy/i);
  assert.ok(!routed(ctx, 'webjs-file-issue'));
  assert.ok(!routed(ctx, 'webjs-start-work'));
  assert.ok(!routed(ctx, 'webjs-list-todos'));
  assert.ok(!routed(ctx, 'use-railway'));
  assert.ok(!routed(ctx, 'webjs-research-record'));
  // The no-match branch tells the model to apply the policy if the task
  // turns out to match a skill mid-stream.
  assert.match(ctx, /if you determine mid-task that the work matches a skill/i);
});

test('a single prompt routes each matched skill exactly once', () => {
  const { ctx } = run('file a task for dark mode');
  const count = (ctx.match(/^- webjs-file-issue:/gm) || []).length;
  assert.equal(count, 1);
});

test('every skill the hook can route to is committed in-repo (no dangling reference)', () => {
  // The hook names skills it routes to; each PROJECT skill MUST have a
  // committed `.claude/skills/<name>/SKILL.md`, or a fresh clone routes a
  // prompt at a skill that does not exist (the #543 portability bug). The
  // regex matches only project-skill names (webjs-*, use-railway,
  // pr-review); the built-in Claude Code skill the hook also routes
  // (verify) ships with the CLI for everyone, so it is intentionally
  // exempt.
  // Extract the project-skill names from the hook source and assert each is
  // present in the repo.
  const hookSrc = readFileSync(HOOK, 'utf8');
  const names = [...new Set((hookSrc.match(/\b(?:webjs-[a-z-]+|use-railway|pr-review)\b/g) || []))];
  assert.ok(names.length >= 4, `expected the hook to reference its skills; found ${names.join(', ')}`);
  for (const name of names) {
    const skillFile = resolve(REPO, '.claude/skills', name, 'SKILL.md');
    assert.ok(
      existsSync(skillFile),
      `route-skills.sh routes to '${name}' but ${skillFile} is not committed; a clone would dangle`,
    );
  }
});
