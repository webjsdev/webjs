/**
 * Run the cross-runtime prod load / settled-RSS guard (#1644) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * the `npm test` CI job exercises the node:http shell); CI also runs
 * `bun test/bun/prod-load-rss.mjs` for the Bun.serve shell. The proof is a
 * plain assert script (not `*.test.mjs`, so the runner does not double-run
 * it); importing it runs it and throws on any failure. It drives 20,000
 * requests and then polls for up to a minute, so it is on the Bun runner's
 * denylist for `bun test`'s per-test timeout and runs there as the plain
 * script instead.
 *
 * Gated on `CI` (set by GitHub Actions) or `WEBJS_LOAD_GUARD=1`: an 80 s
 * burst whose assertion is about an allocator's timing does not belong in
 * every developer `npm test`, where a busy host or a second worktree running
 * the suite would make it flake rather than inform.
 */
import { test } from 'node:test';

const gated = !process.env.CI && !process.env.WEBJS_LOAD_GUARD;

test('a production server releases memory after a load burst on this runtime (#1644)', {
  timeout: 240_000,
  skip: gated && 'an 80 s load guard: runs under CI, or locally with WEBJS_LOAD_GUARD=1',
}, async () => {
  await import('./prod-load-rss.mjs');
});
