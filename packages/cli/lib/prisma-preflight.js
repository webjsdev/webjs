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
 *
 * Detection (verified against a real Prisma 6 install): the GENERATED
 * `.prisma/client` target is resolved through standard Node resolution from the
 * app (so a hoisted monorepo, where the client lives at a PARENT `node_modules`,
 * resolves correctly), then read. An ABSENT target, or a present-but-stub target
 * (the ungenerated client whose `PrismaClient` constructor throws the init
 * error), is "ungenerated". A real generated target older than the schema is
 * "stale". We do NOT grep the static `@prisma/client` re-export shim: it is
 * present in both states and never carries the init-error string itself.
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

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

// Marker the ungenerated `prisma-client-js` stub embeds in its generated target
// (`node_modules/.prisma/client/index.js`). Verified against a real Prisma 6
// install: after `npm i @prisma/client` but before `prisma generate`, the
// generated `.prisma/client` entry IS present but its `PrismaClient` constructor
// throws `@prisma/client did not initialize yet. Please run "prisma generate"`.
// A real `prisma generate` replaces that stub with the generated client, which
// does NOT contain this string. So the marker, read from the GENERATED target
// (not the static `@prisma/client` shim), is the reliable ungenerated signal.
const UNGENERATED_MARKER = 'did not initialize yet';

/**
 * Resolve the GENERATED Prisma client entry (`.prisma/client/index.js`) for an
 * app, following standard Node resolution so a hoisted monorepo layout (the
 * generated client at a PARENT `node_modules`, the app under `apps/<x>`) still
 * resolves. Returns a discriminated result so the caller can tell the three
 * cases apart:
 *   - `{ kind: 'unresolved' }`        - `@prisma/client` itself is not resolvable.
 *   - `{ kind: 'no-target' }`         - the package resolves but `.prisma/client`
 *                                       does not (a custom `output`, ambiguous).
 *   - `{ kind: 'target', path }`      - the generated target resolves.
 *
 * @param {string} cwd
 * @returns {{ kind: 'unresolved' } | { kind: 'no-target' } | { kind: 'target', path: string }}
 */
function resolveGeneratedClient(cwd) {
  let clientDir;
  try {
    // Resolve @prisma/client AS THE APP would (hoisting-aware), then locate its
    // package dir. The shim itself loads `.prisma/client/default` relative to
    // here, so resolving from this dir follows the same (possibly hoisted) path.
    const appRequire = createRequire(join(cwd, 'noop.js'));
    clientDir = dirname(appRequire.resolve('@prisma/client'));
  } catch {
    return { kind: 'unresolved' };
  }
  const shimRequire = createRequire(join(clientDir, 'noop.js'));
  for (const entry of ['.prisma/client/index.js', '.prisma/client/default.js']) {
    try {
      return { kind: 'target', path: shimRequire.resolve(entry) };
    } catch { /* try the next entry */ }
  }
  return { kind: 'no-target' };
}

/**
 * Inspect the generated Prisma client state for a Prisma app.
 *
 * Returns one of:
 *   - `{ status: 'ok' }`         - client generated and not older than the schema.
 *   - `{ status: 'missing' }`    - schema/dep present but no generated client.
 *   - `{ status: 'stale' }`      - client exists but the schema is newer than it.
 *
 * Detection resolves the GENERATED `.prisma/client` target through standard Node
 * resolution (so hoisted monorepos are handled) and reads it: an absent target,
 * or a present-but-stub target (the ungenerated `PrismaClient` that throws on
 * construction), is `missing`. A real generated client that is older than the
 * schema is `stale`. A custom-`output` generator whose target Node cannot
 * resolve falls back to `ok` rather than nag a working app (false positives are
 * worse than a missed hint here).
 *
 * @param {string} cwd
 * @returns {{ status: 'ok' | 'missing' | 'stale' }}
 */
export function prismaClientState(cwd) {
  const resolved = resolveGeneratedClient(cwd);

  // @prisma/client not resolvable: the app declared the dep (usesPrisma gated
  // us here) but it is not installed/generated. That is the boot-crash case.
  if (resolved.kind === 'unresolved') return { status: 'missing' };

  // The package resolves but the default `.prisma/client` target does not: a
  // custom `output` whose location we cannot cheaply verify. Fall back to `ok`
  // rather than nag a working app (false positives are worse than a missed hint).
  if (resolved.kind === 'no-target') return { status: 'ok' };

  const generatedIndex = resolved.path;

  // The generated target exists. Is it still the ungenerated stub (its
  // PrismaClient constructor throws the init error)?
  try {
    const body = readFileSync(generatedIndex, 'utf8');
    if (body.includes(UNGENERATED_MARKER)) return { status: 'missing' };
  } catch { /* unreadable: fall through to the stale check, then ok */ }

  // Generated for real. Is it older than the schema (a stale client)?
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
