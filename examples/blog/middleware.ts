/**
 * Global middleware. Runs on every request before webjs routes it.
 * Return a Response to short-circuit; call next() to continue.
 *
 * Uses logRequest() from lib/server/utils/. Middleware is server-only,
 * so importing from lib/server/* is fine.
 */
import { logRequest } from './lib/server/utils/logger.ts';

export default async function middleware(
  req: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  const resp = await next();
  logRequest(req, resp.status, Date.now() - started);
  resp.headers.set('x-webjs', 'demo');
  return resp;
}
