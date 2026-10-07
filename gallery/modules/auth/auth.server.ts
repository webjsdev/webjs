// The auth configuration, a server-only utility (no 'use server'): pages and
// route handlers import it server-to-server, the client reaches auth only
// through a 'use server' action. `handlers` mounts at app/api/auth/[...path]
// (createAuth hardcodes /api/auth/signin/* and /api/auth/callback/*, so that
// route stays at the app root while the rest of the card is under
// app/features/auth/).
import { createAuth, Credentials, GitHub, Google } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';
import { compare } from './password.server.ts';

// AUTH_SECRET signs session tokens: a dev fallback keeps a fresh scaffold
// booting, production fails fast without a real value.
const trimmedSecret = process.env.AUTH_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && !trimmedSecret) {
  throw new Error('AUTH_SECRET must be set in production');
}
const authSecret = trimmedSecret || 'dev-insecure-secret-change-me';

export const { auth, signIn, signOut, handlers } = createAuth({
  providers: [
    Credentials({
      async authorize(credentials: { email: string; password: string }) {
        const user = await db.query.users.findFirst({ where: { email: credentials.email } });
        if (!user?.passwordHash || !await compare(credentials.password, user.passwordHash)) return null;
        return { id: String(user.id), name: user.name, email: user.email };
      },
    }),
    // OAuth presets activate once AUTH_<PROVIDER>_ID / _SECRET are set.
    ...(process.env.AUTH_GITHUB_ID ? [GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })] : []),
    ...(process.env.AUTH_GOOGLE_ID ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })] : []),
  ],
  secret: authSecret,
  // A failed sign-in 302s to `${pages.error}?error=CredentialsSignin`; the
  // login page reads searchParams.error and shows a message.
  pages: { error: '/features/auth/login' },
});

// auth(req) reads the session cookie (the ambient request when called with no
// argument), so this works from a page, a segment middleware or an action
// middleware.
export async function getCurrentUser(req?: Request) {
  const session = await auth(req);
  return session?.user ?? null;
}
