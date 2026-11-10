/**
 * Guards the boundary between the monorepo's OWN agent skills and what a
 * generated app ships.
 *
 * The framework keeps a set of workflow skills for working on WebJs itself
 * (`.claude/skills/*`, exposed cross-agent through `.agents/skills/*`
 * symlinks). None of them belongs in a generated app: they are monorepo
 * process (how we file issues, sync docs, review our own PRs), and shipping
 * any of it would push our process onto a team that already has its own. A
 * generated app's agent docs are the brief in `AGENTS.md` and nothing else,
 * so `.agents/` must not exist at all.
 *
 * Nothing structural enforces that: a future change that copies the skills
 * DIRECTORY would ship the lot silently, and the app would look fine. These
 * assertions are that enforcement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

for (const template of ['full-stack', 'api']) {
  test(`${template} scaffold ships no agent skills or rules, only AGENTS.md`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'webjs-scaffold-skills-'));
    try {
      await scaffoldApp('demo', cwd, { template, install: false });
      const app = join(cwd, 'demo');
      assert.ok(!existsSync(join(app, '.agents', 'skills')),
        'a generated app ships no .agents/skills/ (the brief in AGENTS.md replaces the skill)');
      assert.ok(existsSync(join(app, 'AGENTS.md')), 'AGENTS.md ships');
      assert.ok(!existsSync(join(app, '.agents')), 'no .agents/ at all (the brief is the whole agent doc set)');
      const agents = await readFile(join(app, 'AGENTS.md'), 'utf8');
      assert.doesNotMatch(agents, /SKILL\.md|\.agents\/skills/, 'AGENTS.md points at no skill');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}

test('the generated agent rules do not mandate a review process', async () => {
  // WebJs is opinionated about the code (conventions, `webjs check`, the test
  // layers) and deliberately silent on how a team reviews a PR. The scaffold
  // used to ship a mandatory multi-round self-review loop plus a PR-template
  // checkbox pointing at a CONVENTIONS.md section that did not exist.
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-scaffold-skills-'));
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false });
    for (const rel of ['.agents/rules/workflow.md', '.github/pull_request_template.md']) {
      const p = join(cwd, 'demo', rel);
      if (!existsSync(p)) continue;
      const src = await readFile(p, 'utf8');
      assert.doesNotMatch(src, /self-review/i, `${rel} must not mandate a self-review loop`);
      assert.doesNotMatch(src, /fresh-context review/i, `${rel} must not mandate review rounds`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
