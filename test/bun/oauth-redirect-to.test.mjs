/**
 * Run the cross-runtime OAuth `redirectTo` proof (#1495) under whichever
 * runtime executes the suite. CI runs `bun test/bun/oauth-redirect-to.mjs` for
 * the Bun side. The proof is a plain assert script (`oauth-redirect-to.mjs`,
 * not `*.test.mjs`) so the runner does not double-run it.
 */
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('OAuth redirectTo round trip holds on this runtime (#1495)', () => {
  const script = fileURLToPath(new URL('./oauth-redirect-to.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`proof failed:\n${r.stdout}\n${r.stderr}`);
});
