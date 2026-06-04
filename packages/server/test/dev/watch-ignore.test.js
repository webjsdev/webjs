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

test('shouldIgnoreWatchPath ignores node_modules, .git, and prisma dev artefacts', () => {
  assert.equal(shouldIgnoreWatchPath('node_modules/foo/index.js'), true);
  assert.equal(shouldIgnoreWatchPath('.git/HEAD'), true);
  assert.equal(shouldIgnoreWatchPath('prisma/dev.db'), true);
  assert.equal(shouldIgnoreWatchPath('prisma/dev.db-journal'), true);
  assert.equal(shouldIgnoreWatchPath('prisma/migrations/0001_init/migration.sql'), true);
});

// Counterfactual: real app changes MUST still trigger a rebuild, otherwise the
// dev server would go deaf to route/component edits. A page added under a new
// route folder is exactly what should re-fire the route-types emit.
test('shouldIgnoreWatchPath does NOT ignore real app source (rebuilds still fire)', () => {
  assert.equal(shouldIgnoreWatchPath('app/page.ts'), false);
  assert.equal(shouldIgnoreWatchPath('app/blog/[slug]/page.ts'), false);
  assert.equal(shouldIgnoreWatchPath('components/counter.ts'), false);
  assert.equal(shouldIgnoreWatchPath('lib/utils/format.ts'), false);
  // Separator-anchored: a sibling whose name merely starts with an ignored
  // token is not caught.
  assert.equal(shouldIgnoreWatchPath('node_modules.bak/foo.js'), false);
  assert.equal(shouldIgnoreWatchPath('app/.webjs-notes/page.ts'), false);
});
