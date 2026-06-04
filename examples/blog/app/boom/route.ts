/**
 * A route that always returns a 500 with a JSON (non-HTML) body. Used by
 * the #249 e2e probe to drive the client router's in-place
 * navigation-error recovery: a client nav to this URL gets a non-HTML
 * error response, so the router dispatches `webjs:navigation-error` and
 * recovers in place instead of doing a destructive full reload.
 */
export async function GET() {
  return Response.json({ error: 'boom' }, { status: 500 });
}
