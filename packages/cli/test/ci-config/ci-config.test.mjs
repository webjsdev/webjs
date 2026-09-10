/**
 * `readCiConfig` / `normalizeSteps` / `selectSteps` (#1471): the pure reader
 * behind `webjs ci`. Injects the file reader like the app-tasks tests do, so
 * nothing touches disk. Every rule the reader enforces has a counterfactual:
 * the malformed shape produces a PROBLEM naming its JSON path rather than a
 * silently dropped step (a dropped step is a check that never ran).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCiConfig, normalizeSteps, selectSteps, flattenSteps } from '../../lib/ci-config.js';

function reader(pkgJson) {
  return (_p) => (pkgJson === null ? (() => { throw new Error('ENOENT'); })() : pkgJson);
}

test('no package.json, or no webjs.ci block, reads as not declared with no problems', () => {
  assert.deepEqual(readCiConfig('/app', reader(null)), { declared: false, steps: [], problems: [] });
  assert.deepEqual(readCiConfig('/app', reader('{}')), { declared: false, steps: [], problems: [] });
  assert.deepEqual(
    readCiConfig('/app', reader(JSON.stringify({ webjs: { dev: { before: ['x'] } } }))),
    { declared: false, steps: [], problems: [] },
  );
});

test('a declared block normalizes strings, commands, and groups, in order', () => {
  const pkg = JSON.stringify({
    webjs: {
      ci: {
        steps: [
          'webjs check',
          { title: 'Types', run: 'webjs typecheck' },
          {
            title: 'Checks',
            parallel: 2,
            steps: [
              'webjs doctor',
              { title: 'Tests', steps: [{ title: 'e2e', run: 'webjs test --server', env: { WEBJS_E2E: '1' } }] },
            ],
          },
        ],
      },
    },
  });
  const r = readCiConfig('/app', reader(pkg));
  assert.equal(r.declared, true);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.steps, [
    { kind: 'step', title: 'webjs check', run: 'webjs check', env: {} },
    { kind: 'step', title: 'Types', run: 'webjs typecheck', env: {} },
    {
      kind: 'group',
      title: 'Checks',
      parallel: 2,
      steps: [
        { kind: 'step', title: 'webjs doctor', run: 'webjs doctor', env: {} },
        {
          kind: 'group',
          title: 'Tests',
          parallel: 1,
          steps: [{ kind: 'step', title: 'e2e', run: 'webjs test --server', env: { WEBJS_E2E: '1' } }],
        },
      ],
    },
  ]);
  assert.deepEqual(flattenSteps(r.steps).map((s) => s.title), ['webjs check', 'Types', 'webjs doctor', 'e2e']);
});

test('a malformed block is declared AND reports each problem with its JSON path', () => {
  const cases = [
    [{ ci: [] }, /webjs\.ci must be an object/],
    [{ ci: {} }, /webjs\.ci\.steps is missing/],
    [{ ci: { steps: 'webjs check' } }, /webjs\.ci\.steps must be an array/],
    [{ ci: { steps: [], stpes: [] } }, /unknown key "stpes"/],
    [{ ci: { steps: [''] } }, /steps\[0\] is an empty command/],
    [{ ci: { steps: [42] } }, /steps\[0\] must be a command string/],
    [{ ci: { steps: [{ run: 'x' }] } }, /steps\[0\]\.title must be a non-empty string/],
    [{ ci: { steps: [{ title: 'x' }] } }, /steps\[0\]\.run must be a non-empty command string/],
    [{ ci: { steps: [{ title: 'x', run: 'y', evn: {} }] } }, /steps\[0\] has an unknown key "evn"/],
    [{ ci: { steps: [{ title: 'x', run: 'y', env: { A: 1 } }] } }, /steps\[0\]\.env\.A must be a string/],
    [{ ci: { steps: [{ title: 'g', steps: [] }] } }, /steps\[0\]\.steps is empty/],
    [{ ci: { steps: [{ title: 'g', parallel: 0, steps: ['x'] }] } }, /steps\[0\]\.parallel must be an integer of at least 1/],
    [{ ci: { steps: [{ title: 'g', steps: ['x'], run: 'y' }] } }, /steps\[0\] has an unknown key "run"/],
  ];
  for (const [webjs, re] of cases) {
    const r = readCiConfig('/app', reader(JSON.stringify({ webjs })));
    assert.equal(r.declared, true, JSON.stringify(webjs));
    assert.ok(r.problems.some((p) => re.test(p)), `${JSON.stringify(webjs)} -> ${JSON.stringify(r.problems)}`);
  }
});

test('a group nested inside a PARALLEL group may not itself be parallel (it takes one slot)', () => {
  const r = normalizeSteps([
    { title: 'outer', parallel: 2, steps: [{ title: 'inner', parallel: 3, steps: ['a', 'b'] }] },
  ]);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /steps\[0\]\.steps\[0\]\.parallel is not allowed on a group nested inside a parallel group/);
  // The offending value is NOT honoured: the nested group is normalized to one slot.
  assert.equal(r.steps[0].steps[0].parallel, 1);
  // Counterfactual: the same nesting under a SEQUENTIAL parent is fine.
  const ok = normalizeSteps([{ title: 'outer', steps: [{ title: 'inner', parallel: 3, steps: ['a', 'b'] }] }]);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.steps[0].steps[0].parallel, 3);
});

test('a problem never drops a sibling step silently: valid neighbours survive', () => {
  const r = normalizeSteps(['webjs check', { title: 'bad' }, 'webjs typecheck']);
  assert.equal(r.problems.length, 1);
  assert.deepEqual(r.steps.map((s) => s.title), ['webjs check', 'webjs typecheck']);
});

test('selectSteps picks by title (case-insensitive), takes a matched group whole, and reports a miss', () => {
  const { steps } = normalizeSteps([
    'webjs check',
    { title: 'Checks', parallel: 2, steps: ['webjs doctor', { title: 'Tests', steps: ['webjs test'] }] },
  ]);
  const one = selectSteps(steps, ['tests']);
  assert.deepEqual(one.problems, []);
  assert.deepEqual(one.steps.map((s) => s.title), ['Tests']);
  const group = selectSteps(steps, ['CHECKS']);
  assert.deepEqual(group.steps.map((s) => s.title), ['Checks']);
  assert.equal(group.steps[0].steps.length, 2, 'the whole group, not its children individually');
  const many = selectSteps(steps, ['webjs check', 'Tests']);
  assert.deepEqual(many.steps.map((s) => s.title), ['webjs check', 'Tests']);
  // Counterfactual: an unknown title is a problem, never a silent empty run.
  const miss = selectSteps(steps, ['nope']);
  assert.deepEqual(miss.steps, []);
  assert.deepEqual(miss.problems, ['--only "nope" matches no step or group title']);
  // No --only at all passes the list through untouched.
  assert.equal(selectSteps(steps, []).steps, steps);
});
