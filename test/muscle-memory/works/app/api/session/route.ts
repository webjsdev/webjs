// Next idiom: a route handler that sets a cookie through `cookies().set()`
// and answers with `Response.json()`.
import { cookies } from '@webjsdev/server';

export async function POST() {
  (await cookies()).set('session', 'abc', { httpOnly: true, path: '/' });
  return Response.json({ ok: true });
}
