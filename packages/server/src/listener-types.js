/**
 * Shared shape passed from `startServer` to whichever listener shell it selects
 * (the node:http path in `dev.js`, the `Bun.serve` path in `listener-bun.js`).
 * Types only; no runtime exports.
 *
 * @typedef {object} ListenerContext
 * @property {any} app  the `createRequestHandler` result (`handle`, `routeFor`,
 *   `getRouteTable`, `getLastDevError`, `warmup`, `appDir`).
 * @property {boolean} dev
 * @property {boolean} compress
 * @property {import('./logger.js').Logger} logger
 * @property {import('./listener-core.js').SseHub} hub
 * @property {number} port
 * @property {string} basePathStr  the configured base path (`''` when unset).
 * @property {{ requestTimeout: number, headersTimeout: number, keepAliveTimeout: number }} timeouts
 * @property {AbortController | null} watcherAbort  the dev fs.watch controller, aborted on close.
 */

export {};
