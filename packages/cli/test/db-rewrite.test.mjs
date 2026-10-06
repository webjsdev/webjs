// Unit tests for the --db postgres deploy-file transforms (#1490): every
// anchor is asserted, so a template edit that moves one fails here instead of
// shipping a half-rewritten compose.yaml or CI workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresCompose, postgresCi } from '../lib/db-rewrite.js';
import { bunifyCompose, bunifyCi } from '../lib/runtime-rewrite.js';

const T = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const compose = readFileSync(join(T, 'compose.yaml'), 'utf8');
const ci = readFileSync(join(T, '.github', 'workflows', 'ci.yml'), 'utf8');

test('the postgres and bun rewrites commute (they touch disjoint lines)', () => {
  assert.equal(bunifyCompose(postgresCompose(compose, 'x')), postgresCompose(bunifyCompose(compose), 'x'));
  assert.equal(bunifyCi(postgresCi(ci, 'x')), postgresCi(bunifyCi(ci), 'x'));
});

test('a moved anchor throws rather than half-rewriting', () => {
  assert.throws(() => postgresCompose(compose.replace('app-data:/data', 'other:/data'), 'x'), /db-rewrite: compose\.yaml/);
  assert.throws(() => postgresCi(ci.replace('file:./ci.db', 'file:./other.db'), 'x'), /db-rewrite: \.github/);
});
