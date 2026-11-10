/**
 * The local agent eval (scripts/agent-eval/) never runs a model in CI, but its
 * harness does: a wrong grader would report a broken app as passing, or a correct
 * one as failing, and nobody would notice until the table was posted. So this
 * drives the real runner with a FAKE agent command that writes a known-correct
 * solution for some tasks and nothing for another, and asserts the verdicts.
 *
 * The guestbook case is the load-bearing one: it proves the grader submits a
 * bound server-action form the way a no-JS browser does (the hidden action
 * identity included) and reads the 422 re-render and the 303 that follow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runTask, agentArgv, parseArgs } from '../../scripts/agent-eval/run.mjs';
import { firstForm } from '../../scripts/agent-eval/grade.mjs';
import { TASKS } from '../../scripts/agent-eval/tasks.mjs';

// The fake agent: argv[2] is the task id, the prompt is appended after it, and
// cwd is the scaffolded app, exactly as a real agent CLI is invoked.
const FAKE_AGENT = `
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const task = process.argv[2];
if (task === 'json-route') {
  put('app/api/health/route.ts', "export async function GET() {\\n  return Response.json({ ok: true });\\n}\\n");
}
if (task === 'guestbook-action') {
  put('modules/guestbook/actions/sign.server.ts', [
    "'use server';",
    "export async function sign(input: { name?: string }) {",
    "  const name = String(input.name || '').trim();",
    "  if (!name) return { success: false as const, error: 'Name is required' };",
    "  return { success: true as const, redirect: '/guestbook?thanks=1' };",
    "}",
    "",
  ].join('\\n'));
  put('app/guestbook/page.ts', [
    "import { html } from '@webjsdev/core';",
    "import { sign } from '#modules/guestbook/actions/sign.server.ts';",
    "export default function Guestbook({ searchParams, actionData }: { searchParams: { thanks?: string }; actionData?: { error?: string } }) {",
    "  if (searchParams.thanks) return html\`<p>Thanks for signing</p>\`;",
    "  return html\`<form action=\${sign}><input name=\\"name\\">\${actionData?.error ? html\`<p>\${actionData.error}</p>\` : ''}<button>Sign</button></form>\`;",
    "}",
    "",
  ].join('\\n'));
}
// Any other task: write nothing, which must grade as a failure.
`;

function mute() {
  const log = console.log, err = console.error, warn = console.warn;
  console.log = () => {}; console.error = () => {}; console.warn = () => {};
  return () => { console.log = log; console.error = err; console.warn = warn; };
}

async function withFakeAgent(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-fake-agent-'));
  const script = join(dir, 'fake-agent.mjs');
  await writeFile(script, FAKE_AGENT);
  try {
    return await fn(script);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const taskById = (id) => TASKS.find((t) => t.id === id);

test('the prompt is passed to the agent as one argument', () => {
  assert.deepEqual(agentArgv('claude -p {prompt} --flag', 'two words'), ['claude', '-p', 'two words', '--flag']);
  assert.deepEqual(agentArgv('codex exec', 'x y'), ['codex', 'exec', 'x y'], 'no placeholder appends the prompt');
  assert.deepEqual(parseArgs(['--task', 'a', '--task', 'b', '--keep']).tasks, ['a', 'b']);
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});

test('every task id is unique and every task has a probe', () => {
  const ids = TASKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TASKS) assert.ok(t.probes.length > 0, `${t.id} has no probe`);
});

test('firstForm reads a bound form with its hidden action identity', () => {
  const form = firstForm('<form method="post" enctype="application/x-www-form-urlencoded"><input type="hidden" name="__webjs_action" value="abc/sign"><input name="name" value=""><button>Sign</button></form>');
  assert.equal(form.method, 'POST');
  assert.equal(form.fields.__webjs_action, 'abc/sign');
  assert.equal(form.fields.name, '');
  assert.equal(firstForm('<p>no form</p>'), null);
});

test('a correct route handler passes and an untouched app fails', async () => {
  const restore = mute();
  try {
    await withFakeAgent(async (script) => {
      const opts = { agent: `${process.execPath} ${script} json-route`, keep: false, timeoutMs: 60_000 };
      const pass = await runTask(taskById('json-route'), opts);
      assert.equal(pass.agentError, null);
      assert.deepEqual(pass.check, [], 'the solution is clean under webjs check');
      assert.equal(pass.boot, null);
      assert.ok(pass.ok, `expected a pass: ${JSON.stringify(pass.probes)}`);

      const failOpts = { ...opts, agent: `${process.execPath} ${script} nothing` };
      const fail = await runTask(taskById('json-route'), failOpts);
      assert.equal(fail.ok, false, 'an app the agent did not change cannot pass');
      assert.match(fail.probes[0].detail, /status 404/);
    });
  } finally {
    restore();
  }
});

test('a no-JS server-action form is graded through the real submission', async () => {
  const restore = mute();
  try {
    await withFakeAgent(async (script) => {
      const r = await runTask(taskById('guestbook-action'), {
        agent: `${process.execPath} ${script} guestbook-action`,
        keep: false,
        timeoutMs: 60_000,
      });
      assert.deepEqual(r.check, [], 'the solution is clean under webjs check');
      for (const p of r.probes) assert.ok(p.ok, `${p.probe}: ${p.detail}`);
      assert.ok(r.ok);
    });
  } finally {
    restore();
  }
});
