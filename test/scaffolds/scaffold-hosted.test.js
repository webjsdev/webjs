/**
 * `webjs create --hosted` (#1658): a host product supplies the agent's working
 * rules, so the app ships a short AGENTS.md and none of the scaffold's own
 * process. The default scaffold keeps the full flow, and #1613 is the record of
 * why: an always-on primer that replaced it was reverted, so these tests pin both
 * sides.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OMITTED = [
  '.agents/rules/workflow.md',
  '.claude/settings.json',
  '.claude/hooks/nudge-uncommitted.sh',
  '.hooks/pre-commit',
  '.github/pull_request_template.md',
];

async function scaffold(opts) {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-hosted-'));
  await scaffoldApp('demo', cwd, { template: 'full-stack', install: false, ...opts });
  return { cwd, app: join(cwd, 'demo') };
}

function agentFileHashes(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

test('hosted: short AGENTS.md that routes to the skill and yields to the host', async () => {
  const { cwd, app } = await scaffold({ hosted: true });
  try {
    const agents = readFileSync(join(app, 'AGENTS.md'), 'utf8');
    assert.ok(agents.length < 2500, `AGENTS.md should stay short, got ${agents.length} bytes`);
    assert.match(agents, /host's rules win/);
    assert.match(agents, /\.agents\/skills\/webjs\/SKILL\.md/);
    assert.match(agents, /# AGENTS\.md for demo/);
    for (const stale of [/gallery/i, /run ci/, /branch/i, /\{\{/, /workflow\.md/]) {
      assert.doesNotMatch(agents, stale, `hosted AGENTS.md must not say ${stale}`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('hosted: omits the scaffold process and every pointer to it', async () => {
  const { cwd, app } = await scaffold({ hosted: true });
  try {
    for (const rel of OMITTED) assert.ok(!existsSync(join(app, rel)), `${rel} must not ship`);
    assert.equal(readFileSync(join(app, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
    assert.doesNotMatch(readFileSync(join(app, 'CONVENTIONS.md'), 'utf8'), /workflow\.md/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('hosted: the whole skill still ships, so no pattern is lost', async () => {
  const { cwd, app } = await scaffold({ hosted: true });
  try {
    const shipped = readdirSync(join(app, '.agents/skills/webjs/references')).sort();
    const canon = readdirSync(join(REPO, '.agents/skills/webjs/references')).sort();
    assert.deepEqual(shipped, canon);
    assert.ok(existsSync(join(app, '.agents/skills/webjs/SKILL.md')));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('hosted on Bun: agent markdown shows bun commands', async () => {
  const { cwd, app } = await scaffold({ hosted: true, runtime: 'bun' });
  try {
    const agents = readFileSync(join(app, 'AGENTS.md'), 'utf8');
    assert.match(agents, /bunx webjs check/);
    assert.doesNotMatch(agents, /npx /);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('default: the full flow still ships, and hosted: false changes nothing', async () => {
  const plain = await scaffold({});
  const off = await scaffold({ hosted: false });
  try {
    const agents = readFileSync(join(plain.app, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Gather context BEFORE you build/);
    assert.match(agents, /Study the gallery, then clear it/);
    for (const rel of OMITTED) assert.ok(existsSync(join(plain.app, rel)), `${rel} must ship by default`);
    assert.notEqual(readFileSync(join(plain.app, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
    assert.deepEqual(agentFileHashes(plain.app), agentFileHashes(off.app));
  } finally {
    await rm(plain.cwd, { recursive: true, force: true });
    await rm(off.cwd, { recursive: true, force: true });
  }
});

test('the components split keeps each section in exactly one reference', () => {
  const refs = join(REPO, '.agents/skills/webjs/references');
  const headings = (f) => readFileSync(join(refs, f), 'utf8').match(/^## .+$/gm)
    .filter((h) => h !== '## What This Covers');
  const core = headings('components.md');
  const advanced = headings('components-advanced.md');
  assert.deepEqual(core.filter((h) => advanced.includes(h)), []);
  for (const h of ['## Ownership: what a component owns', '## Reactive properties: the base-class factory', '## Async render: first-paint server data']) {
    assert.ok(core.includes(h), `${h} stays in components.md`);
  }
  for (const h of ['## Slots', '## Directives (lit-html parity)', '## Display-only elision']) {
    assert.ok(advanced.includes(h), `${h} moved to components-advanced.md`);
  }
  const skill = readFileSync(join(REPO, '.agents/skills/webjs/SKILL.md'), 'utf8');
  assert.match(skill, /references\/components\.md/);
  assert.match(skill, /references\/components-advanced\.md/);
});
