/**
 * Bun `--preload` entry that registers the #685 inline-pin `onLoad` for a
 * SPAWNED subprocess (drizzle-kit via `webjs db`, `bun test`, the app's `tsc`,
 * a dev task, etc.), so the subprocess's bare dependency imports resolve the
 * package.json-pinned version instead of `latest`.
 *
 * Why this is needed: Bun's runtime auto-install forces a BARE import (`import
 * 'drizzle-orm'`) to the `latest` dist-tag, ignoring package.json, when there is
 * no `node_modules` (a confirmed Bun bug, oven-sh/bun#21832: the resolver's
 * `with_auto_version` substitutes `latest` for an empty inline version). The
 * webjs server already works around this by rewriting bare imports to inline
 * EXACT specifiers (#685) in its own process. A tool webjs SPAWNS runs in a
 * fresh Bun process with no such hook, so it hits the bug directly and pulls the
 * wrong major. Passing this module to `bun --preload` installs the same rewrite
 * in that process BEFORE the tool's entry loads.
 *
 * Pin-only: SSR action-result seeding (#472) is the server's concern and is left
 * off here. `process.cwd()` is the app root (the spawn sets `cwd`). On Node this
 * is a no-op (the inline-version pin is Bun-specific and seeding is off), so the
 * same `--preload` is harmless if ever used cross-runtime.
 */
import { registerSeedHooks } from './action-seed.js';

await registerSeedHooks({ appDir: process.cwd(), seedEnabled: false, pinEnabled: true });
