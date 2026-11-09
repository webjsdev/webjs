// A redirect: throw redirect(url) from a page to short-circuit the render into
// a redirect response. This route always sends you to the routing index, the
// pattern for a moved or renamed URL. The status is convention-picked at the
// catching site, as in Next.js: 302 for a GET page-render gate (pass
// redirect(url, 308) or permanentRedirect(url) for a permanent one), 307 from a
// route.ts handler, 303 from a form-bound server action, and a client-router
// navigation from an action called over RPC. An absolute URL is an external
// redirect.
import { redirect } from '@webjsdev/core';

export default function LegacyRoute() {
  redirect('/features/routing');
}
