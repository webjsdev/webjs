/**
 * The scaffold's `db` is usable from TypeScript the way a Drizzle user writes it.
 *
 * `db/connection.server.ts` opens bun:sqlite on Bun and node:sqlite on Node, so
 * `connect()` used to return a UNION of the two drivers' database types.
 * TypeScript cannot resolve an overloaded generic method across a union, so the
 * everyday field-map select, `db.select({ id: users.id }).from(users)`, failed
 * to compile with `TS2554: Expected 0 arguments, but got 1` in every generated
 * app (found by an agent building an app on the scaffold). The relational
 * `db.query` API is checked alongside so a fix for one cannot break the other.
 *
 * Counterfactual: drop the `Promise<Db>` annotation from `connect()` in
 * `packages/cli/lib/create.js` and the field-map select fails to compile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const PROBE = `import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';

export async function fieldMapSelect() {
  const rows = await db.select({ id: users.id, email: users.email }).from(users);
  return rows[0]?.email;
}

export async function relationalQuery() {
  const all = await db.query.users.findMany({ orderBy: { createdAt: 'desc' } });
  return all[0]?.email;
}
`;

test('a scaffolded app compiles a field-map select and a relational query on db', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-db-types-'));
  const log = console.log;
  console.log = () => {};
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false });
    console.log = log;
    const appDir = join(cwd, 'demo');
    await symlink(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));
    await mkdir(join(appDir, 'modules', 'probe'), { recursive: true });
    await writeFile(join(appDir, 'modules', 'probe', 'probe.server.ts'), PROBE);

    const r = spawnSync(process.execPath, [TSC, '--noEmit', '-p', appDir], { encoding: 'utf8' });
    assert.equal(r.status, 0, `tsc failed on a generated app:\n${r.stdout}${r.stderr}`);
  } finally {
    console.log = log;
    await rm(cwd, { recursive: true, force: true });
  }
});
