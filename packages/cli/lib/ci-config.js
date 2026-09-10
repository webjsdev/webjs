import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Read the local-CI step list from an app's `package.json` `"webjs": { "ci" }`
 * block (#1471), the list `webjs ci` runs. Modeled on Rails 8.1's `config/ci.rb`
 * and shaped like the #550 `dev` / `start` orchestration: data in the `webjs`
 * block, read by the CLI, never by the server, so every tool (the JSON Schema,
 * `webjs doctor`, a cloud workflow that calls `npm run ci`) learns the list
 * without importing app code.
 *
 * Shape:
 *   "webjs": { "ci": { "steps": [
 *     "webjs check",                                     // shorthand: title = command
 *     { "title": "Types", "run": "webjs typecheck" },
 *     { "title": "Checks", "parallel": 2, "steps": [
 *       { "title": "Tests", "steps": [                   // a nested group takes ONE slot
 *         { "title": "e2e", "run": "webjs test --server", "env": { "WEBJS_E2E": "1" } }
 *       ] }
 *     ] }
 *   ] } }
 *
 * The boot validator (`@webjsdev/server` webjs-config-validate.js) checks only
 * top-level key membership and never follows the schema's `$ref`, so this
 * reader validates the step shapes itself and reports every problem with its
 * JSON path, rather than silently skipping a malformed entry: a step that is
 * dropped is a check that never ran, which is the exact false green local CI
 * exists to prevent. The bin refuses to run on any problem.
 *
 * Pure (reads one file, never spawns / prints / exits), with the reader
 * injectable, matching `app-tasks.js`.
 *
 * @typedef {{ kind: 'step', title: string, run: string, env: Record<string, string> }} CiStep
 * @typedef {{ kind: 'group', title: string, parallel: number, steps: CiNode[] }} CiGroup
 * @typedef {CiStep | CiGroup} CiNode
 */

/**
 * @param {string} appDir
 * @param {(p: string) => string} [readFile] injectable reader for tests
 * @returns {{ declared: boolean, steps: CiNode[], problems: string[] }}
 *   `declared` is false when there is no `webjs.ci` block at all (the bin
 *   turns that into a "nothing declared" error naming where to declare one),
 *   as opposed to a block that is present but malformed (`problems`).
 */
export function readCiConfig(appDir, readFile) {
  const read = readFile || ((p) => readFileSync(p, 'utf8'));
  let pkg;
  try {
    pkg = JSON.parse(read(join(appDir, 'package.json')));
  } catch {
    return { declared: false, steps: [], problems: [] };
  }
  const webjs = pkg && typeof pkg === 'object' ? pkg.webjs : null;
  const ci = webjs && typeof webjs === 'object' ? webjs.ci : undefined;
  if (ci === undefined) return { declared: false, steps: [], problems: [] };
  if (!isPlainObject(ci)) {
    return { declared: true, steps: [], problems: ['webjs.ci must be an object holding a `steps` array'] };
  }
  const problems = [];
  for (const key of Object.keys(ci)) {
    if (key !== 'steps') problems.push(`webjs.ci has an unknown key "${key}" (only \`steps\` is read)`);
  }
  if (ci.steps === undefined) {
    problems.push('webjs.ci.steps is missing');
    return { declared: true, steps: [], problems };
  }
  const r = normalizeSteps(ci.steps, 'webjs.ci.steps', false);
  problems.push(...r.problems);
  return { declared: true, steps: r.steps, problems };
}

/**
 * Normalize a raw step array into `CiNode`s, collecting every shape problem
 * with its JSON path. A string is shorthand for a command titled by itself; an
 * object with `steps` is a group; an object with `run` is a command. Only a
 * TOP-LEVEL group may declare `parallel`: a nested group takes one slot of
 * its parent and runs its steps in order, so `parallel` on it is reported
 * rather than honoured (the Rails rule: sub-groups cannot be parallelized),
 * which is exactly what the JSON Schema's `ciNestedStep` and the
 * `WebjsCiNestedGroup` type say.
 *
 * @param {unknown} raw
 * @param {string} path JSON path used in problem messages
 * @param {boolean} nested whether these steps sit inside a group
 * @returns {{ steps: CiNode[], problems: string[] }}
 */
export function normalizeSteps(raw, path = 'webjs.ci.steps', nested = false) {
  /** @type {CiNode[]} */
  const steps = [];
  /** @type {string[]} */
  const problems = [];
  if (!Array.isArray(raw)) {
    return { steps, problems: [`${path} must be an array of steps`] };
  }
  raw.forEach((item, i) => {
    const at = `${path}[${i}]`;
    if (typeof item === 'string') {
      const run = item.trim();
      if (!run) problems.push(`${at} is an empty command`);
      else steps.push({ kind: 'step', title: run, run, env: {} });
      return;
    }
    if (!isPlainObject(item)) {
      problems.push(`${at} must be a command string, a { title, run } object, or a { title, steps } group`);
      return;
    }
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (Object.prototype.hasOwnProperty.call(item, 'steps')) {
      for (const key of Object.keys(item)) {
        if (!['title', 'steps', 'parallel'].includes(key)) {
          problems.push(`${at} has an unknown key "${key}" (a group takes title, steps, parallel)`);
        }
      }
      if (!title) problems.push(`${at} (a group) needs a non-empty title`);
      let parallel = 1;
      if (item.parallel !== undefined) {
        if (nested) {
          // One rule on every surface (the schema's ciNestedStep, the
          // WebjsCiNestedGroup type, the docs): a nested group never declares
          // parallel, whatever its parent is. It takes one slot and runs in order.
          problems.push(
            `${at}.parallel is not allowed on a nested group (it takes one slot of its parent and runs its steps in order)`,
          );
        } else if (!Number.isInteger(item.parallel) || item.parallel < 1) {
          problems.push(`${at}.parallel must be an integer of at least 1`);
        } else {
          parallel = item.parallel;
        }
      }
      const inner = normalizeSteps(item.steps, `${at}.steps`, true);
      problems.push(...inner.problems);
      if (Array.isArray(item.steps) && item.steps.length === 0) problems.push(`${at}.steps is empty`);
      steps.push({ kind: 'group', title: title || `group ${i}`, parallel, steps: inner.steps });
      return;
    }
    for (const key of Object.keys(item)) {
      if (!['title', 'run', 'env'].includes(key)) {
        problems.push(`${at} has an unknown key "${key}" (a command takes title, run, env)`);
      }
    }
    const run = typeof item.run === 'string' ? item.run.trim() : '';
    if (!run) problems.push(`${at}.run must be a non-empty command string`);
    if (!title) problems.push(`${at}.title must be a non-empty string`);
    /** @type {Record<string, string>} */
    const env = {};
    if (item.env !== undefined) {
      if (!isPlainObject(item.env)) {
        problems.push(`${at}.env must be an object of string values`);
      } else {
        for (const [k, v] of Object.entries(item.env)) {
          if (typeof v === 'string') env[k] = v;
          else problems.push(`${at}.env.${k} must be a string`);
        }
      }
    }
    if (run && title) steps.push({ kind: 'step', title, run, env });
  });
  return { steps, problems };
}

/**
 * Select the steps `--only <title>` names. A matched group is taken WHOLE (its
 * children are not searched further); matching is case-insensitive on the
 * trimmed title. A title that matches nothing is a problem rather than a
 * silent empty run, since "ran zero steps" reads as green.
 *
 * @param {CiNode[]} steps
 * @param {string[]} only
 * @returns {{ steps: CiNode[], problems: string[] }}
 */
export function selectSteps(steps, only) {
  if (!only || only.length === 0) return { steps, problems: [] };
  const wanted = only.map((t) => t.trim().toLowerCase());
  const hit = new Set();
  /** @type {CiNode[]} */
  const picked = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      const key = node.title.trim().toLowerCase();
      const idx = wanted.indexOf(key);
      if (idx !== -1) {
        hit.add(idx);
        picked.push(node);
        continue;
      }
      if (node.kind === 'group') walk(node.steps);
    }
  };
  walk(steps);
  const problems = only
    .filter((_, i) => !hit.has(i))
    .map((t) => `--only "${t}" matches no step or group title`);
  return { steps: picked, problems };
}

/**
 * Every command step in tree order (groups flattened), for counting and for
 * the JSON report.
 *
 * @param {CiNode[]} steps
 * @returns {CiStep[]}
 */
export function flattenSteps(steps) {
  /** @type {CiStep[]} */
  const out = [];
  for (const node of steps) {
    if (node.kind === 'group') out.push(...flattenSteps(node.steps));
    else out.push(node);
  }
  return out;
}

/**
 * The refusal `webjs ci` prints when the directory declares no `webjs.ci`
 * block: what is missing, where it goes, and (at a workspace root) which
 * member apps already declare one. Mirrors `notAnAppMessage` in
 * check-target.js. A run with nothing declared exits 1 rather than 0, because
 * "ran zero steps" would read as green.
 *
 * @param {string} cwd
 * @param {string[]} apps workspace members that DO declare a `webjs.ci` block
 */
export function noCiConfigMessage(cwd, apps) {
  const lines = [
    'webjs ci: nothing to run, this package.json declares no "webjs": { "ci" } block.',
    '',
    `  ${cwd}`,
    '',
    'Declare the steps once and every tool reads the same list:',
    '',
    '  "webjs": { "ci": { "steps": [',
    '    "webjs check",',
    '    { "title": "Tests", "run": "webjs test" }',
    '  ] } }',
    '',
  ];
  if (apps.length > 0) {
    lines.push('These workspace members declare one. Run it inside each:', '');
    for (const app of apps) lines.push(`  ( cd ${app} && npx webjs ci )`);
    lines.push('');
  }
  lines.push('`webjs help ci` shows the flags.');
  return lines.join('\n');
}

/** @param {unknown} v */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
