// Regression guard for issue #409.
//
// The repo-root Dockerfile copies each workspace manifest individually
// (for layer caching) before `npm install`. A `COPY <src> <dst>` whose
// source path does not exist is a HARD Docker error ("not found"), not a
// warning, so a single stale path fails the image build for every in-repo
// app on every platform.
//
// This bit us in #404: the editor/wrapper package reorg moved
// packages/ts-plugin to packages/editors/ts-plugin and updated all the JS
// path tooling, but the Dockerfile's hard-coded `COPY packages/ts-plugin/
// package.json` line was missed. Every Railway deploy failed from #404
// until #409, and nothing local caught it: the four-app boot check runs
// createRequestHandler in-process, never the Docker build.
//
// This asserts every file-source COPY in the Dockerfile points at a path
// that exists in the repo, so a future move/rename of a workspace dir
// fails CI immediately instead of only at deploy time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Parse `COPY <src...> <dst>` instructions, returning each source token.
 * Skips `COPY --from=...` (multi-stage, source is another stage, not the
 * build context) and treats the last token on the line as the destination.
 */
function dockerfileCopySources() {
  const text = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
  // Join backslash-continued lines so a multi-line COPY reads as one.
  const logical = text.replace(/\\\n/g, ' ');
  const sources = [];
  for (const raw of logical.split('\n')) {
    const line = raw.trim();
    if (!/^COPY\b/i.test(line)) continue;
    if (/--from=/i.test(line)) continue; // multi-stage copy, not a context path
    const tokens = line.split(/\s+/).slice(1).filter((t) => !t.startsWith('--'));
    if (tokens.length < 2) continue; // need at least one src + a dst
    // Everything but the final token (the destination) is a source.
    for (const src of tokens.slice(0, -1)) sources.push(src);
  }
  return sources;
}

test('every Dockerfile COPY source path exists in the repo', () => {
  const sources = dockerfileCopySources();
  assert.ok(sources.length > 0, 'expected the Dockerfile to have COPY instructions');

  const missing = [];
  for (const src of sources) {
    // Sources may contain globs (e.g. `COPY packages ./packages`); a bare
    // directory or file path is what we can statically verify. Skip tokens
    // with glob metacharacters (none today, but stay robust).
    if (/[*?\[]/.test(src)) continue;
    if (!existsSync(join(ROOT, src))) missing.push(src);
  }

  assert.deepEqual(
    missing,
    [],
    `Dockerfile COPY sources that do not exist (a moved/renamed workspace?): ${missing.join(', ')}`,
  );
});
