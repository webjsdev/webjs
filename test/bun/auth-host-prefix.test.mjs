/**
 * Run the cross-runtime `__Host-` auth cookie proof (#1538) under whichever
 * runtime executes the suite. CI runs `bun test/bun/auth-host-prefix.mjs` for
 * the Bun side. The proof is a plain assert script (`auth-host-prefix.mjs`,
 * not `*.test.mjs`) so the runner does not double-run it.
 */
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('auth cookies are __Host- prefixed in production on this runtime (#1538)', () => {
  const script = fileURLToPath(new URL('./auth-host-prefix.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`proof failed:\n${r.stdout}\n${r.stderr}`);
});
