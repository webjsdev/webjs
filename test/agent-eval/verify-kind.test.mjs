/**
 * What counts as a check, typecheck or test RUN in an agent transcript
 * (#1686). Only a command segment that starts the runner counts: matching the
 * text anywhere made `grep -rn "node --test" package.json` a failed first test
 * run, which skewed the first-attempt metric of the clean builds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verifyKind } from '../../scripts/agent-eval/replay.mjs';

const CASES = [
  ['npx webjs check', 'check'],
  ['npx webjs check --rules', null],
  ['timeout 170 npx webjs typecheck 2>&1 | tail -30', 'typecheck'],
  ['cd app && npm test 2>&1 | tail', 'test'],
  ['timeout 280 npm test > /tmp/x.log 2>&1; echo done', 'test'],
  ['node --test test/a.test.ts', 'test'],
  ['node --experimental-strip-types --test t.ts', 'test'],
  ['node ../packages/cli/bin/webjs.js typecheck', 'typecheck'],
  ['npx tsc --noEmit', 'typecheck'],
  ['CI=1 npx webjs test --server', 'test'],
  ['npm run typecheck', 'typecheck'],
  // Not runs: the text appears, but nothing starts a runner.
  ['cat node_modules/x.d.ts | head; grep -rn "node --test" package.json', null],
  ['grep -n "npx webjs check" AGENTS.md', null],
  ['ls node_modules/drizzle-orm/node-sqlite/ | grep -i migr', null],
  // A real transcript line: the `\|` inside the quoted pattern is no pipe.
  ['grep -n "paths" tsconfig.json; grep -rn "\\"test\\"\\|node --test\\|strip" node_modules/x/*.js | head -8', null],
  // A heredoc body is file content, not a command.
  ["cat > a.ts <<'EOF'\nnpm test\nEOF\nnpx webjs check", 'check'],
  ["cat > a.ts <<'EOF'\nnpm test\nEOF", null],
];

for (const [cmd, kind] of CASES) {
  test(`${JSON.stringify(cmd).slice(0, 70)} -> ${kind}`, () => {
    assert.equal(verifyKind(cmd), kind);
  });
}

test('the replay never re-runs a command that starts a server or a background process', async () => {
  const { STARTS_PROCESS_RE } = await import('../../scripts/agent-eval/replay.mjs');
  for (const cmd of ['npx webjs dev --port 8921 > /tmp/dev.log 2>&1 &', 'npm run dev', 'nohup node server.js', 'mkdir -p x && (npx webjs start &)']) {
    assert.ok(STARTS_PROCESS_RE.test(cmd), cmd);
  }
  for (const cmd of ["sed -i 's/a/b/' x.ts", 'cat > a.ts <<EOF\nx && y\nEOF', 'mkdir -p app/x && cp a b']) {
    assert.ok(!STARTS_PROCESS_RE.test(cmd), cmd);
  }
});
