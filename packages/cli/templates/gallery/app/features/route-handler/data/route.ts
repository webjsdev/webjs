// A route.ts is a server-only HTTP handler (named GET / POST / PUT / PATCH /
// DELETE exports). It is NOT isomorphic and never ships to the client, the webjs
// equivalent of a Next route handler. Each handler returns a Response (a plain
// value auto-JSONs). A folder cannot have BOTH page.ts and route.ts, so this
// endpoint lives one segment deeper, at /features/route-handler/data.
export async function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
