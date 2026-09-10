/**
 * `webjs ci` end to end (#1471): the real bin against temp apps whose
 * package.json declares a `webjs.ci` step list, with real child processes.
 * Pins the exit codes, the Rails-shaped output, the JSON document shape, the
 * env every step sees (CI=true, the step's own env), fail-fast, --only, the
 * missing- and malformed-config refusals, and the GitHub Actions surfaces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');
/** The current runtime, quoted, so a step can run JS without relying on PATH. */
const NODE = JSON.stringify(process.execPath);

function ci(cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [CLI, 'ci', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env, NO_COLOR: '1' },
  });
}

async function fixture(t, webjs) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-ci-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (webjs !== undefined) {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'app', type: 'module', webjs }, null, 2));
  }
  return dir;
}

test('no webjs.ci block: exit 1, names the missing block, and --json carries error.code NO_CI_CONFIG', async (t) => {
  const dir = await fixture(t, {});
  const r = ci(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /declares no "webjs": \{ "ci" \} block/);
  assert.equal(r.stdout, '', 'nothing ran, so nothing was reported as a step');
  const j = ci(dir, ['--json']);
  assert.equal(j.status, 1);
  const doc = JSON.parse(j.stdout);
  assert.equal(doc.error.code, 'NO_CI_CONFIG');
  assert.equal(doc.steps, undefined, 'the refusal shape carries no steps, so a consumer cannot read an empty run as green');
});

test('a workspace root with no block names the members that declare one', async (t) => {
  const dir = await fixture(t, undefined);
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*'] }));
  await mkdir(join(dir, 'apps', 'with', 'app'), { recursive: true });
  await writeFile(join(dir, 'apps', 'with', 'package.json'), JSON.stringify({ name: 'with', webjs: { ci: { steps: ['echo x'] } } }));
  await mkdir(join(dir, 'apps', 'without', 'app'), { recursive: true });
  await writeFile(join(dir, 'apps', 'without', 'package.json'), JSON.stringify({ name: 'without' }));
  const r = ci(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\( cd apps\/with && npx webjs ci \)/);
  assert.doesNotMatch(r.stderr, /apps\/without/, 'a member with no block is not suggested');
});

test('a malformed block: exit 1 naming each problem by JSON path, and nothing runs', async (t) => {
  const marker = join(tmpdir(), `webjs-ci-marker-${process.pid}`);
  const dir = await fixture(t, { ci: { steps: [`${NODE} -e "require('fs').writeFileSync('${marker}', '')"`, { title: 'x' }] } });
  const r = ci(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /webjs\.ci\.steps\[1\]\.run must be a non-empty command string/);
  assert.equal(existsSync(marker), false, 'counterfactual: the valid neighbour did NOT run either');
  const j = ci(dir, ['--json']);
  assert.equal(JSON.parse(j.stdout).error.code, 'INVALID_CI_CONFIG');
});

test('a green list: exit 0, a heading + result line per step, a total line; CI=true and the step env reach the child', async (t) => {
  const dir = await fixture(t, {
    ci: {
      steps: [
        { title: 'Sees CI', run: `${NODE} -e "process.exit(process.env.CI === 'true' ? 0 : 1)"` },
        { title: 'Sees env', run: `${NODE} -e "process.exit(process.env.WEBJS_E2E === '1' ? 0 : 1)"`, env: { WEBJS_E2E: '1' } },
        { title: 'Checks', parallel: 2, steps: ['echo alpha', { title: 'Tests', steps: ['echo beta', 'echo gamma'] }] },
      ],
    },
  });
  const r = ci(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^Continuous Integration\n/);
  assert.match(r.stdout, /\nSees CI\n[\s\S]*✅ Sees CI passed in \d+\.\d\ds/);
  assert.match(r.stdout, /✅ Sees env passed in/);
  assert.match(r.stdout, /\necho alpha\necho alpha\nalpha\n\n✅ echo alpha passed/, 'a captured step replays heading, output, result together');
  assert.match(r.stdout, /\nbeta\n[\s\S]*\ngamma\n/, 'the nested group ran both steps');
  assert.match(r.stdout, /✅ Continuous Integration passed in \d+\.\d\ds\n$/);
  assert.doesNotMatch(r.stdout, /\r/, 'no progress line off a TTY');
});

test('a red list: exit 1, the failed steps are listed, and --fail-fast stops before the next step', async (t) => {
  const marker = join(tmpdir(), `webjs-ci-ff-${process.pid}`);
  const dir = await fixture(t, {
    ci: { steps: [{ title: 'Breaks', run: 'exit 3' }, { title: 'After', run: `${NODE} -e "require('fs').writeFileSync('${marker}', '')"` }] },
  });
  const r = ci(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /❌ Breaks failed in/);
  assert.match(r.stdout, /✅ After passed in/, 'without --fail-fast the rest still runs');
  assert.match(r.stdout, /↳ Breaks failed\n[\s\S]*❌ Continuous Integration failed in/);
  await rm(marker, { force: true });
  const ff = ci(dir, ['--fail-fast']);
  assert.equal(ff.status, 1);
  assert.doesNotMatch(ff.stdout, /After/, 'counterfactual: --fail-fast never reached the second step');
  assert.equal(existsSync(marker), false);
  const short = ci(dir, ['-f']);
  assert.doesNotMatch(short.stdout, /After/, '-f is the short form');
});

test('--json: stdout is exactly one document, failed steps carry their output, human text goes to stderr', async (t) => {
  const dir = await fixture(t, {
    ci: { steps: ['echo fine', { title: 'Noisy failure', run: `${NODE} -e "console.log('why'); console.error('oh no'); process.exit(2)"` }] },
  });
  const r = ci(dir, ['--json']);
  assert.equal(r.status, 1);
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.ok, false);
  assert.equal(typeof doc.seconds, 'number');
  assert.deepEqual(doc.steps.map((s) => [s.title, s.ok, s.code]), [['echo fine', true, 0], ['Noisy failure', false, 2]]);
  assert.equal(doc.steps[0].output, undefined, 'a passing step carries no output');
  assert.match(doc.steps[1].output, /why\n/);
  assert.match(doc.steps[1].output, /oh no\n/);
  assert.match(r.stderr, /❌ Noisy failure failed/, 'the human report went to stderr');
});

test('--only runs the named step or group (case-insensitive) and refuses an unknown title', async (t) => {
  const dir = await fixture(t, {
    ci: { steps: ['echo one', { title: 'Group', parallel: 2, steps: ['echo two', 'echo three'] }] },
  });
  const r = ci(dir, ['--only', 'group']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /two\n/);
  assert.match(r.stdout, /three\n/);
  assert.doesNotMatch(r.stdout, /echo one\none\n/, 'counterfactual: the unselected step did not run');
  const miss = ci(dir, ['--only', 'nope']);
  assert.equal(miss.status, 1);
  assert.match(miss.stderr, /--only "nope" matches no step or group title/);
  // A bare --only (or one followed by a flag) must not fall through to the whole list.
  const bare = ci(dir, ['--only']);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /--only needs a step or group title/);
  assert.doesNotMatch(bare.stdout, /echo one/, 'counterfactual: nothing ran');
  const flagged = ci(dir, ['--only', '--json']);
  assert.equal(flagged.status, 1);
  assert.equal(JSON.parse(flagged.stdout).error.code, 'INVALID_ONLY');
});

test('Ctrl-C: the first signal winds the run down as interrupted (exit 130), a second one exits outright', async (t) => {
  const { spawn } = await import('node:child_process');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const exited = (child) => new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));

  // The signal must land while the CHILD is running, not before the bin has
  // spawned it (under a loaded machine 700ms was not enough and the run ended
  // with nothing to interrupt). Each fixture uses a sleep length unique to
  // this PROCESS so pgrep can wait for exactly its child: this file runs twice
  // in one local CI run (npm test in one slot, the Bun matrix in another), and
  // a fixed length would match the other run's child and fire the signal
  // before this run had spawned anything.
  const { execFileSync } = await import('node:child_process');
  const longSleep = `20.${process.pid}`;
  const shortSleep = `4.${process.pid}`;
  const childUp = async (pattern) => {
    for (let i = 0; i < 100; i++) {
      try { execFileSync('pgrep', ['-f', pattern], { stdio: 'ignore' }); return; } catch {}
      await wait(100);
    }
    throw new Error(`child matching ${pattern} never started`);
  };

  const dir = await fixture(t, { ci: { steps: [{ title: 'G', parallel: 2, steps: [{ title: 'sleeper', run: `sleep ${longSleep}` }] }] } });
  const one = spawn(process.execPath, [CLI, 'ci'], { cwd: dir, env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out1 = '';
  one.stdout.on('data', (d) => { out1 += d; });
  await childUp(`sleep ${longSleep}`);
  one.kill('SIGINT');
  const r1 = await Promise.race([exited(one), wait(6000).then(() => null)]);
  assert.ok(r1, 'a single interrupt winds the run down within the bound (the detached sleep is reaped)');
  assert.equal(r1.code, 130);
  assert.match(out1, /❌ sleeper interrupted[\s\S]*❌ Continuous Integration interrupted/);

  // A captured child that ignores SIGTERM cannot be wound down; the second
  // Ctrl-C is the door out.
  const stubborn = await fixture(t, { ci: { steps: [{ title: 'G', parallel: 2, steps: [{ title: 'stubborn', run: `trap '' TERM INT; sleep ${shortSleep}` }] }] } });
  const two = spawn(process.execPath, [CLI, 'ci'], { cwd: stubborn, env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await childUp(`sleep ${shortSleep}`);
  two.kill('SIGINT');
  await wait(400);
  const stillRunning = two.exitCode === null;
  two.kill('SIGINT');
  const r2 = await Promise.race([exited(two), wait(3000).then(() => null)]);
  assert.ok(stillRunning, 'after one interrupt the stubborn child kept the run alive');
  assert.ok(r2, 'the second interrupt exits within the bound');
  assert.equal(r2.code, 130);
});

test('under GitHub Actions each step is a log group, a failure is annotated, and the step summary is appended', async (t) => {
  const dir = await fixture(t, { ci: { steps: ['echo ok', { title: 'Bad | pipe', run: 'exit 4' }] } });
  const summary = join(dir, 'summary.md');
  const r = ci(dir, [], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::group::echo ok\n[\s\S]*✅ echo ok passed[\s\S]*::endgroup::\n/);
  assert.match(r.stdout, /::error title=Bad \| pipe::Bad \| pipe failed \(exit 4\)\n/);
  const md = await readFile(summary, 'utf8');
  assert.match(md, /^### ❌ Local CI failed in/);
  assert.match(md, /\| Bad \\\| pipe \| `exit 4` \| ❌ failed \(exit 4\) \|/);
});

test('webjs help ci documents every flag', () => {
  const r = spawnSync(process.execPath, [CLI, 'help', 'ci'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  for (const flag of ['--fail-fast', '--only', '--json', '--signoff']) {
    assert.match(r.stdout, new RegExp(flag.replace(/-/g, '\\-')), `help names ${flag}`);
  }
});
