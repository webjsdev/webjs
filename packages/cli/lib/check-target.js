/**
 * `webjs check` invocation-target guard (#1301).
 *
 * `webjs check` is an APP-level tool: every rule assumes one application,
 * meaning one module graph, one custom-element registry, one runtime. Run at a
 * workspace root it walks whatever JS/TS happens to live under that path (two
 * apps, every package's test suite, editor fixtures, the scaffold templates)
 * and reports collisions no single runtime ever sees. At this repo's root that
 * was 67 findings, all false.
 *
 * The predicate is the presence of an `app/` directory, nothing else. That is
 * the same test `check.js` already applies per-rule, `app/` cannot be renamed
 * (AGENTS.md "App layout"), and BOTH scaffold templates create it. Next.js
 * refuses on the identical predicate in
 * `packages/next/src/lib/find-pages-dir.ts`. A `workspaces` key is NOT part of
 * the predicate (a directory with no `app/` is not an app either way); it only
 * enriches the MESSAGE with the member apps to run instead.
 *
 * PURE apart from directory reads: it never prints and never exits. The bin
 * owns rendering and the exit code.
 *
 * @module check-target
 */

import { statSync } from 'node:fs';
import { readFile, glob } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

/**
 * @typedef {{ isApp: boolean, workspaceApps: string[] }} CheckTarget
 */

/**
 * Whether `dir` holds an `app/` DIRECTORY. A plain file named `app` is not one,
 * and `existsSync` alone would call it one, so the type is checked. A broken
 * symlink or an unreadable parent throws out of `statSync` rather than
 * returning false, so it is caught: an unreadable path is not an app either.
 *
 * @param {string} dir
 * @returns {boolean}
 */
function hasAppDir(dir) {
  try {
    return statSync(join(dir, 'app')).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Classify `cwd` as a checkable app or not, and (when it declares npm
 * workspaces) list the member directories that ARE apps, sorted, as
 * cwd-relative POSIX paths.
 *
 * @param {string} cwd
 * @returns {Promise<CheckTarget>}
 */
export async function findCheckTarget(cwd) {
  if (hasAppDir(cwd)) return { isApp: true, workspaceApps: [] };
  return { isApp: false, workspaceApps: await workspaceApps(cwd) };
}

/**
 * Expand `package.json` `workspaces` (the array form and yarn's
 * `{ packages: [...] }` form) and keep the members that have an `app/`
 * directory. Any read / parse failure yields an empty list: the message
 * degrades to the generic form and the refusal still stands.
 *
 * @param {string} cwd
 * @returns {Promise<string[]>}
 */
export async function workspaceApps(cwd) {
  let patterns;
  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
    const ws = pkg.workspaces;
    patterns = Array.isArray(ws) ? ws : Array.isArray(ws?.packages) ? ws.packages : null;
  } catch {
    return [];
  }
  if (!patterns) return [];
  /** @type {Set<string>} */
  const apps = new Set();
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue;
    try {
      for await (const match of glob(pattern, { cwd })) {
        // `glob` yields whatever matched, files included, so the app test is
        // what filters a stray same-named file out too.
        if (hasAppDir(join(cwd, match))) apps.add(match.split('\\').join('/'));
      }
    } catch {
      // A malformed pattern drops out of the listing, never out of the refusal.
    }
  }
  return [...apps].sort();
}

/**
 * The nearest STRICT ancestor of `cwd` that holds an `app/` directory, or
 * `null`. Started from inside an app (its `app/` or `components/` dir), this is
 * the app the user meant.
 *
 * @param {string} cwd
 * @returns {string | null}
 */
export function findAncestorApp(cwd) {
  let dir = dirname(cwd);
  for (;;) {
    if (hasAppDir(dir)) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * Where a server command (`webjs dev` / `webjs start`) that was started outside
 * an app should have been started (#1526): the workspace's member apps when
 * `cwd` is a workspace root, else the nearest ancestor app, else nothing.
 * `isApp` is the same `app/` predicate `webjs check` refuses on (#1301).
 *
 * @param {string} cwd
 * @returns {Promise<{ isApp: boolean, workspaceApps: string[], ancestorApp: string | null }>}
 */
export async function findServeTarget(cwd) {
  const target = await findCheckTarget(cwd);
  if (target.isApp) return { ...target, ancestorApp: null };
  return { ...target, ancestorApp: target.workspaceApps.length ? null : findAncestorApp(cwd) };
}

/**
 * The refusal `webjs dev` / `webjs start` print when started where there is no
 * app (#1526). Without it the server boots, says it is ready, and answers 404
 * for every route, which is how a launch from a workspace root used to look.
 *
 * @param {'dev' | 'start'} command
 * @param {string} cwd
 * @param {{ workspaceApps: string[], ancestorApp: string | null }} target
 * @returns {string}
 */
export function notAnAppServeMessage(command, cwd, { workspaceApps, ancestorApp }) {
  const lines = [
    `webjs ${command}: this directory is not a WebJs app, so there is nothing to serve.`,
    '',
    `  ${cwd}`,
    '',
    'There is no `app/` directory here. Started anyway, the server would answer',
    '404 for every route.',
    '',
  ];
  if (workspaceApps.length) {
    lines.push('This is a workspace root. Start the server inside the app:', '');
    for (const app of workspaceApps) lines.push(`  cd ${app} && webjs ${command}`);
  } else if (ancestorApp) {
    lines.push('This directory is inside an app. Start the server from the app root:', '');
    lines.push(`  cd ${relative(cwd, ancestorApp) || '.'} && webjs ${command}`);
  } else {
    lines.push('Change into your app directory (the one holding `app/`) and re-run.');
  }
  return lines.join('\n');
}

/**
 * The human refusal, for stderr.
 *
 * @param {string} cwd
 * @param {string[]} apps
 * @returns {string}
 */
export function notAnAppMessage(cwd, apps) {
  const lines = [
    'webjs check: this directory is not a WebJs app, so nothing was checked.',
    '',
    `  ${cwd}`,
    '',
    'There is no `app/` directory here. Every check assumes ONE application',
    '(one module graph, one custom-element registry, one runtime), so running',
    'them over a workspace root reports collisions no single runtime ever sees.',
    '',
  ];
  if (apps.length) {
    lines.push('This is a workspace root. Run the check inside each app:', '');
    for (const app of apps) lines.push(`  ( cd ${app} && npx webjs check )`);
  } else {
    lines.push('Change into your app directory (the one holding `app/`) and re-run.');
  }
  lines.push('', '`webjs check --rules` lists the rules and works from anywhere.');
  return lines.join('\n');
}

/**
 * The `--json` refusal. It carries NO `violations` key on purpose: a consumer
 * that ignores the exit code and reads `report.violations.length` must throw
 * rather than be told the workspace is clean.
 *
 * @param {string} cwd
 * @param {string[]} apps
 * @returns {{ error: { code: string, message: string, cwd: string, apps: string[] } }}
 */
export function notAnAppJson(cwd, apps) {
  return {
    error: {
      code: 'NOT_AN_APP',
      message: 'No `app/` directory here, so webjs check has no application to check.',
      cwd,
      apps,
    },
  };
}
