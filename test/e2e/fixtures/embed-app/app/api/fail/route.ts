// A route that always fails, so a fetch from the page is a 5xx the bridge
// reports as `network`.
export async function GET() {
  return new Response('nope', { status: 503 });
}
