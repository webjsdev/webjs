// Next idiom: a NAMED `middleware` export with `config.matcher`, reading
// `request.cookies`, redirecting with the platform Response, and returning
// nothing to let the request continue (Next's NextResponse.next()).
export function middleware(request: Request & { cookies: { get(name: string): { value: string } | undefined } }) {
  if (!request.cookies.get('session')?.value) {
    return Response.redirect(new URL('/login', request.url), 307);
  }
}

export const config = {
  matcher: '/admin/:path*',
};
