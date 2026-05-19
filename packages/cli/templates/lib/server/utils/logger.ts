/**
 * Structured request logger. App-wide, server-only.
 *
 * Lives under lib/server/utils/ to demonstrate the convention: any
 * lib/server/ file is server-only (uses Node-only console.log,
 * server-process timing, never reaches the browser). Sub-folders
 * under lib/server/ are an optional organizational convenience,
 * mirroring how a feature module can have its own utils/.
 *
 * Use from middleware.ts, route.ts, or any .server.{js,ts} file.
 * Never imported from pages, layouts, or components.
 */
export function logRequest(
  req: Request,
  status: number,
  durationMs: number,
): void {
  const path = new URL(req.url).pathname;
  console.log(`[req] ${req.method} ${path} → ${status} (${durationMs}ms)`);
}
