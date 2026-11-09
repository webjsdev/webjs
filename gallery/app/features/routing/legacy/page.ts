// A redirect: throw redirect(url) from a page to short-circuit the render into
// a redirect response. This route always sends you to the routing index, the
// pattern for a moved or renamed URL. The status is convention-picked at the
// catching site (302 for a GET page-render gate, 307 for a server-action
// redirect); pass redirect(url, 308) or permanentRedirect(url) for a permanent
// one, or an absolute URL for an external redirect. A route.ts handler may
// throw it too, exactly as in Next.js: it answers 307 there.
import { redirect } from '@webjsdev/core';

export default function LegacyRoute() {
  redirect('/features/routing');
}
