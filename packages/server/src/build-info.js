import { createRequire } from 'node:module';
import { publishedBuildId } from './importmap.js';

/**
 * Build-info / version probe (issue #239).
 *
 * `GET /__webjs/version` returns a small JSON object a deploy can curl to
 * verify which build is live, alongside the existing `/__webjs/health` and
 * `/__webjs/ready` probes. It carries NO secrets: only the framework version,
 * the published importmap build id (the same value the client router reads
 * from `data-webjs-build` to detect a deploy), the running node version, and
 * process uptime. Served before `ensureReady()` like the other probes, so it
 * answers on a cold instance without blocking on the whole-app analysis.
 *
 * The framework version is read once from this package's own `package.json`,
 * the same single-source pattern `requiredNodeMajor()` uses, so it never drifts
 * from the published version.
 */

/** @type {string} */
let _frameworkVersion = '';
function frameworkVersion() {
  if (_frameworkVersion) return _frameworkVersion;
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    _frameworkVersion = String(pkg?.version || '');
  } catch {
    _frameworkVersion = '';
  }
  return _frameworkVersion;
}

/**
 * Compose the build-info payload. Pure (takes the moment as an argument) so a
 * test can assert the shape without mocking the clock; the handler calls it
 * with `process.uptime()`.
 *
 * @param {{ uptime?: number }} [opts]
 * @returns {{ version: string, build: string, node: string, uptime: number }}
 */
export function buildInfo(opts = {}) {
  return {
    version: frameworkVersion(),
    build: publishedBuildId(),
    node: process.version,
    uptime: typeof opts.uptime === 'number' ? opts.uptime : process.uptime(),
  };
}

/**
 * Build the `GET /__webjs/version` response. `no-store` so a proxy / browser
 * never caches a stale build fingerprint.
 *
 * @returns {Response}
 */
export function buildInfoResponse() {
  return Response.json(buildInfo(), { headers: { 'cache-control': 'no-store' } });
}
