import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldIgnoreWatchPath } from '../../src/dev.js';

// Regression for #258: the dev server writes `.webjs/routes.d.ts` on startup
// and on every rebuild. The recursive fs.watch on the app root sees that
// write; if it is not ignored it schedules a rebuild, which re-writes the
// file, which fires another watch event, looping forever and storming SSE
// reloads (this broke 38 blog e2e cases). The watcher MUST ignore `.webjs/`.
test('shouldIgnoreWatchPath ignores the generated .webjs/ artefact dir (#258 loop fix)', () => {
  assert.equal(shouldIgnoreWatchPath('.webjs/routes.d.ts'), true);
  assert.equal(shouldIgnoreWatchPath('.webjs/vendor/importmap.json'), true);
  assert.equal(shouldIgnoreWatchPath('.webjs'), true);
});

test('shouldIgnoreWatchPath ignores node_modules, .git, and the SQLite dev DB', () => {
  assert.equal(shouldIgnoreWatchPath('node_modules/foo/index.js'), true);
  assert.equal(shouldIgnoreWatchPath('.git/HEAD'), true);
  assert.equal(shouldIgnoreWatchPath('db/dev.db'), true);
  assert.equal(shouldIgnoreWatchPath('db/dev.db-journal'), true);
  assert.equal(shouldIgnoreWatchPath('db/migrations/0001_init/migration.sql'), true);
});

// Counterfactual: real app changes MUST still trigger a rebuild, otherwise the
// dev server would go deaf to route/component edits. A page added under a new
// route folder is exactly what should re-fire the route-types emit.
test('shouldIgnoreWatchPath does NOT ignore real app source (rebuilds still fire)', () => {
  assert.equal(shouldIgnoreWatchPath('app/page.ts'), false);
  assert.equal(shouldIgnoreWatchPath('app/blog/[slug]/page.ts'), false);
  assert.equal(shouldIgnoreWatchPath('components/counter.ts'), false);
  assert.equal(shouldIgnoreWatchPath('lib/utils/format.ts'), false);
  // db/*.server.ts are SOURCE files (only db/dev.db* + db/migrations are ignored).
  assert.equal(shouldIgnoreWatchPath('db/schema.server.ts'), false);
  assert.equal(shouldIgnoreWatchPath('db/connection.server.ts'), false);
  // Separator-anchored: a sibling whose name merely starts with an ignored
  // token is not caught.
  assert.equal(shouldIgnoreWatchPath('node_modules.bak/foo.js'), false);
  assert.equal(shouldIgnoreWatchPath('app/.webjs-notes/page.ts'), false);
});

// Unserved output and the app's .gitignore never reload the page: a server's
// own `npm run dev > dev.log` used to turn every log line into a reload.
import { isUnservedOutput, parseGitignore, isGitignored } from '../../src/dev/watch-ignore.js';

test('tool output nothing serves is ignored, source is not', () => {
  for (const p of ['dev.log', 'logs/server.log', 'coverage/lcov.info', '.cache/x', 'test-results/a.png', 'playwright-report/index.html', '.DS_Store', 'app/page.ts.swp']) {
    assert.equal(isUnservedOutput(p), true, p);
  }
  for (const p of ['app/page.ts', 'modules/x/coverage-chart.ts', 'public/catalog.json', 'logbook.ts']) {
    assert.equal(isUnservedOutput(p), false, p);
  }
});

test('the scaffold .gitignore rules match like git, with last-match negation', () => {
  const rules = parseGitignore('node_modules/\n**/.webjs/*\n!**/.webjs/vendor/\npublic/tailwind.css\n*.log\n.vscode/*\n!.vscode/settings.json\n/uploads\nbuild/\n');
  assert.equal(isGitignored(rules, 'public/tailwind.css'), true);
  assert.equal(isGitignored(rules, 'public/input.css'), false);
  assert.equal(isGitignored(rules, 'server.log'), true);
  assert.equal(isGitignored(rules, '.vscode/launch.json'), true);
  assert.equal(isGitignored(rules, '.vscode/settings.json'), false);
  assert.equal(isGitignored(rules, 'uploads/a.bin'), true);
  assert.equal(isGitignored(rules, 'modules/uploads/a.ts'), false, 'a leading / anchors to the root');
  assert.equal(isGitignored(rules, 'build'), false, 'a dir-only rule does not match a file of that name');
  assert.equal(isGitignored(rules, 'build', true), true, 'but does match the directory itself');
  assert.equal(isGitignored(rules, 'app/page.ts'), false);
});
