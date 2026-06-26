/**
 * The Bun zero-install vs transparent-install boot decision (#704).
 *
 * Bun's runtime auto-install is latest-only, so a prerelease, a non-inline-safe
 * value, or a committed `bun.lock` (a reproducibility request) cannot be served
 * zero-install. This decides, at boot (Bun-only, `node_modules`-absent), whether
 * to BLOCK on a one-time `bun install` before listening (then run in installed
 * mode, pin hook off) or to serve immediately on the zero-install pin and
 * converge the box via a DETACHED background install.
 *
 * Kept in its own lean module (only `node:*` + the two pure helpers) so the
 * decision logic is unit-testable without importing the full dev server.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyBunDeps } from './bun-pin-rewrite.js';
import { startTransparentInstall } from './bun-bg-install.js';

/**
 * @param {string} appDir
 * @param {{ _install?: typeof startTransparentInstall, _existsSync?: typeof existsSync, _readFileSync?: typeof readFileSync }} [opts]
 *   injectable for tests
 * @returns {Promise<boolean>} whether to register the zero-install pin hook
 */
export async function prepareBunZeroInstall(appDir, opts = {}) {
  const install = opts._install || startTransparentInstall;
  const exists = opts._existsSync || existsSync;
  const readFile = opts._readFileSync || readFileSync;
  // Already installed (or a workspace member): the #698 gate disables pinning;
  // Bun resolves from node_modules.
  if (exists(join(appDir, 'node_modules'))) return false;
  let pkgText;
  try { pkgText = readFile(join(appDir, 'package.json'), 'utf8'); } catch { return true; }
  let lockText = null;
  try { lockText = readFile(join(appDir, 'bun.lock'), 'utf8'); } catch { /* optional */ }
  const { needsInstall, hasLock } = classifyBunDeps(pkgText, lockText);

  if (needsInstall.length > 0 || hasLock) {
    // Proactive blocking install (before the first request can ENOENT).
    const ok = await install(appDir, { mode: 'blocking' });
    if (ok && exists(join(appDir, 'node_modules'))) return false; // installed mode
    return true; // install failed (offline / no bun): fail-open to the zero-install pin
  }

  // Fast path: serve zero-install now, converge the box in the background.
  void install(appDir, { mode: 'detached' });
  return true;
}
