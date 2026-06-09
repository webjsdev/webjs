/**
 * Prisma-client preflight for `webjs dev` (#452).
 *
 * The scaffold's `dev` npm script is `webjs dev`, and `npm run dev` runs the
 * `predev` hook (`prisma generate`) FIRST. Invoking the `webjs dev` binary
 * directly (easy to do, and tempting for an AI/CLI) skips `predev`, so the dev
 * server boots against an ungenerated `@prisma/client` and crashes with a raw
 * "did not initialize yet" error and no hint that the canonical command is
 * `npm run dev`. This turns that crash into a one-line, actionable message.
 *
 * Scope is deliberately narrow: it only fires for an app that actually uses
 * Prisma (a `prisma/schema.prisma` OR an `@prisma/client` dependency), and it
 * only HINTS. It never auto-runs an arbitrary `predev` script and never shells
 * out to `prisma generate` on its own, keeping the no-build promise intact.
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Does this app use Prisma? True if a schema is checked in OR `@prisma/client`
 * is a declared dependency. Either alone is enough; a non-Prisma app has
 * neither and gets no warning.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
export function usesPrisma(cwd) {
  if (existsSync(join(cwd, 'prisma', 'schema.prisma'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(deps && deps['@prisma/client']);
  } catch {
    return false;
  }
}

/**
 * Inspect the generated Prisma client state for a Prisma app.
 *
 * Returns one of:
 *   - `{ status: 'ok' }`         - client generated and not older than the schema.
 *   - `{ status: 'missing' }`    - schema/dep present but no generated client.
 *   - `{ status: 'stale' }`      - client exists but the schema is newer than it.
 *
 * The default `prisma-client-js` generator writes to `node_modules/.prisma/client`
 * (re-exported by `@prisma/client`), which is the scaffold's setup. A custom
 * `output` would land elsewhere; in that case we cannot cheaply prove staleness,
 * so we fall back to "ok" rather than nag a working app (false positives are
 * worse than a missed hint here).
 *
 * @param {string} cwd
 * @returns {{ status: 'ok' | 'missing' | 'stale' }}
 */
export function prismaClientState(cwd) {
  const generatedDir = join(cwd, 'node_modules', '.prisma', 'client');
  // The generator drops an index plus a default entry; either marks "generated".
  const generatedIndex = ['index.js', 'default.js', 'index.d.ts']
    .map((f) => join(generatedDir, f))
    .find((p) => existsSync(p));

  if (!generatedIndex) {
    // No generated client at the default location. If a custom `output` is in
    // use the artifacts live elsewhere and `@prisma/client` itself resolves, so
    // only flag "missing" when the package entry is ALSO absent, otherwise a
    // custom-output app would get a spurious hint.
    const pkgClient = join(cwd, 'node_modules', '@prisma', 'client', 'default.js');
    const pkgClientAlt = join(cwd, 'node_modules', '@prisma', 'client', 'index.js');
    if (!existsSync(pkgClient) && !existsSync(pkgClientAlt)) {
      return { status: 'missing' };
    }
    // @prisma/client is installed but the default .prisma/client output is not
    // there: either a custom output (can't cheaply verify) or ungenerated.
    // Probe the package's own generated marker before deciding.
    try {
      const marker = readFileSync(pkgClient, 'utf8');
      // The placeholder shipped before `generate` references the init error.
      if (/did not initialize yet/.test(marker)) return { status: 'missing' };
    } catch { /* fall through to ok */ }
    return { status: 'ok' };
  }

  // Generated. Is it older than the schema (a stale client)?
  const schema = join(cwd, 'prisma', 'schema.prisma');
  try {
    if (existsSync(schema)) {
      const schemaMtime = statSync(schema).mtimeMs;
      const clientMtime = statSync(generatedIndex).mtimeMs;
      if (schemaMtime > clientMtime) return { status: 'stale' };
    }
  } catch { /* if we can't stat, treat as ok */ }

  return { status: 'ok' };
}

/**
 * Build the actionable hint for an ungenerated/stale client, or `null` when the
 * app is fine or does not use Prisma. The caller prints it (a warning, not a
 * hard exit) before booting the dev server.
 *
 * @param {string} cwd
 * @returns {string | null}
 */
export function prismaDevHint(cwd) {
  if (!usesPrisma(cwd)) return null;
  const { status } = prismaClientState(cwd);
  if (status === 'ok') return null;

  const reason =
    status === 'stale'
      ? 'Your Prisma client looks stale (the schema changed since it was generated).'
      : 'Your Prisma client is not generated yet.';
  return (
    `webjs: ${reason}\n` +
    `  The dev server will crash on an ungenerated client. Fix it with either:\n` +
    `    npm run dev          # canonical: runs \`prisma generate\` (predev) first\n` +
    `    webjs db generate    # just regenerate the client, then re-run\n`
  );
}
