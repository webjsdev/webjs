'use server';

/**
 * The shape `createAuth().signIn` returns: a redirect that ALSO sets the
 * session cookie. The redirect's own response is invisible to `fetch`, which
 * follows it, so nothing on the client can see that a cookie changed. That is
 * exactly what makes the layout go stale without the post-mutation render.
 */
export async function signIn(_data: FormData): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: { location: '/recipes', 'set-cookie': 'fixture_session=1; Path=/; HttpOnly; SameSite=Lax' },
  });
}

/** The reverse: clear the cookie and send the reader home. */
export async function signOut(_data: FormData): Promise<Response> {
  return new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': 'fixture_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' },
  });
}
