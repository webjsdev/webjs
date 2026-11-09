import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Auth Providers (createAuth) | WebJs',
  description:
    'The built-in createAuth() surface: OAuth providers, credentials login, and JWT sessions with no external auth library. Covers setup, the auth API route, reading the session, callbacks, and session strategies.',
};

export default function Auth() {
  return html`
    <h1>Auth Providers (createAuth)</h1>
    <p>WebJs ships <code>createAuth()</code>, a NextAuth-style auth surface with OAuth providers, credentials login, and JWT sessions. Reach for this page when you want providers and sessions handled for you, and no external auth library in the dependency tree.</p>
    <p>It is not the only route. If you want to own the session format, the password hashing, and the route-protection rules yourself, build on the framework primitives instead, which is what <a href="/docs/authentication">Build Your Own Authentication</a> covers and what the blog example does. Pick <code>createAuth()</code> for OAuth and a batteries-included setup, pick the primitives when you want full control of the session.</p>

    <h2>Setup</h2>
    <code-block>// lib/auth.server.ts: create once
import { createAuth, Credentials, Google, GitHub } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';

export const { auth, signIn, signOut, handlers } = createAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await db.query.users.findFirst({
          where: { email: credentials.email }
        });
        if (!user || !verifyPassword(credentials.password, user.passwordHash)) {
          return null;
        }
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    Google(),  // reads AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET from env
    GitHub(),  // reads AUTH_GITHUB_ID, AUTH_GITHUB_SECRET from env
  ],
  secret: process.env.AUTH_SECRET,
});</code-block>

    <h2>Mount the auth API route</h2>
    <code-block>// app/api/auth/[...path]/route.ts
import { handlers } from '#lib/auth.server.ts';
export const GET = handlers.GET;
export const POST = handlers.POST;</code-block>

    <h2>Read the session</h2>
    <code-block>// In any page or server action:
import { auth } from '#lib/auth.server.ts';

export default async function Dashboard() {
  const session = await auth();
  if (!session) throw redirect('/login');
  return html\`&lt;h1&gt;Welcome, \${session.user.name}&lt;/h1&gt;\`;
}</code-block>
    <p>A <code>redirect()</code> thrown during a GET page render (an auth gate like this) defaults to <code>302 Found</code>, the conventional bounce code. The same <code>redirect()</code> thrown from a form-bound server action answers <code>303 See Other</code>, as in Next.js, so the browser follows with a GET and the action runs once; called over RPC from a component, it navigates the client router to the target. An explicit <code>redirect(url, status)</code> overrides the GET-gate default. To type <code>session.user</code> so <code>session.user.name</code> needs no cast, see <a href="/docs/typescript">Typing the auth() Session User</a>.</p>

    <h2>Sign in and sign out</h2>
    <code-block>// modules/auth/actions/session.server.ts, bound as &lt;form action=\${logIn}&gt;
'use server';
import { AuthError } from '@webjsdev/server';
import { signIn, signOut } from '#lib/auth.server.ts';

export async function logIn(formData: FormData) {
  try {
    await signIn('credentials', formData, { redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: 'Wrong email or password.' };
    throw error; // the success redirect
  }
}

export async function logInWithGoogle() {
  await signIn('google', undefined, { redirectTo: '/dashboard' });
}

export async function logOut() {
  await signOut({ redirectTo: '/' });
}</code-block>
    <p><code>signIn</code> and <code>signOut</code> work the way Auth.js v5's do in a Next.js server action. Inside a request they set or clear the session cookie on the response and throw a redirect, which a form-bound action answers with a 303, so the form works with JavaScript off. A credentials sign-in whose <code>authorize</code> returns <code>null</code> throws <code>CredentialsSignin</code>, a subclass of <code>AuthError</code> with <code>type</code> set to <code>'CredentialsSignin'</code>. Catch it to return a message, which re-renders the page with it on <code>actionData</code>. Left uncaught, it redirects to <code>pages.error</code> (or <code>pages.signIn</code>) with <code>?error=CredentialsSignin</code>, as the <code>/api/auth/signin/credentials</code> route does. Pass <code>{ redirect: false }</code> to get the target url back instead of the redirect. Called with no request in scope, from a script, they return the <code>Response</code> the auth routes send.</p>
    <p><code>signOut</code> is also reachable as a route: the mounted <code>handlers</code> serve <code>POST /api/auth/signout</code>, so a plain <code>&lt;form method="POST" action="/api/auth/signout"&gt;</code> logs a user out with no JavaScript. That is how the auth demo in the WebJs gallery renders its logout button. A <code>GET /api/auth/signout</code> never signs out, as in Auth.js: it answers a page whose button posts (or redirects to <code>pages.signOut</code>), because a link prefetch or a crawler following a GET would otherwise log the visitor out. The auth <code>POST</code> routes also refuse a cross-site request, the same origin check server actions get, with <code>webjs.allowedOrigins</code> honoured.</p>

    <h2>Protect routes with middleware</h2>
    <p>As in Auth.js, <code>auth</code> is also middleware. Export it from the root <code>middleware.ts</code> and decide who passes in <code>callbacks.authorized</code>: <code>true</code> continues, <code>false</code> redirects to <code>pages.signIn</code> (or <code>/api/auth/signin</code>) with a <code>callbackUrl</code>, and a returned <code>Response</code> is sent as is. Without the callback the middleware only attaches the session as <code>req.auth</code>.</p>
    <code-block>// middleware.ts
export { auth as middleware } from '#lib/auth.server.ts';

// lib/auth.server.ts
createAuth({
  // ...providers
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ auth, request }) =>
      !!auth || !new URL(request.url).pathname.startsWith('/dashboard'),
  },
});</code-block>
    <p>To run your own logic, wrap it: <code>export default auth((req) =&gt; ...)</code> gives the function <code>req.auth</code>, and returning nothing continues to the page.</p>

    <h2>Return to the page the user started from</h2>
    <p>Pass <code>redirectTo</code> and the user lands there after signing in, for OAuth providers as well as credentials. A plain form is enough: the mounted handler reads the field, carries it through the provider round trip in a short-lived signed cookie, and the callback lands on it.</p>
    <code-block>&lt;form method="POST" action="/api/auth/signin/github"&gt;
  &lt;input type="hidden" name="redirectTo" value="/dashboard/x"&gt;
  &lt;button&gt;Sign in with GitHub&lt;/button&gt;
&lt;/form&gt;</code-block>
    <p>A link works too (<code>/api/auth/signin/github?redirectTo=/dashboard/x</code>), and so does <code>signIn('github', undefined, { redirectTo })</code> from an action. A <code>redirectTo</code> that comes from a request must be a same-origin local path: one leading <code>/</code>, not followed by <code>/</code> or <code>\</code>. An absolute URL or a protocol-relative <code>//host</code> is dropped rather than repaired, and the sign-in lands on <code>/</code>, so the field can never be used as an open redirect. A denied sign-in still goes to <code>pages.error</code>.</p>

    <h2>Showing a failed sign-in</h2>
    <p>A failed credentials sign-in redirects to <code>&#36;{pages.error}?error=CredentialsSignin</code>, falling back to the home page when <code>pages.error</code> is unset (which silently swallows the failure). Point the error page at your login route, then read the code and render a message:</p>
    <code-block>createAuth({
  // ...providers, secret
  pages: { error: '/login' },  // a failed sign-in returns here
});

// app/login/page.ts
export default function LoginPage({ searchParams }) {
  const failed = searchParams.error === 'CredentialsSignin';
  return html\`
    &#36;{failed ? html\`&lt;p role="alert"&gt;Invalid email or password.&lt;/p&gt;\` : ''}
    &lt;form method="POST" action="/api/auth/signin/credentials"&gt;...&lt;/form&gt;
  \`;
}</code-block>
    <p>The auth demo in the WebJs gallery wires exactly this, so a wrong password shows a message on the login page instead of bouncing to the landing page with no feedback.</p>

    <h2>Callbacks</h2>
    <p>Customize the session and JWT with callbacks:</p>
    <code-block>createAuth({
  // ...providers
  callbacks: {
    async jwt({ token, user }) {
      // Add custom fields to the JWT
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose custom fields to auth()
      session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
});</code-block>
    <p>The <code>signIn</code> callback follows Auth.js's rule: return <code>true</code> to allow, a url string to send the visitor there without signing them in, and anything else (including nothing) to deny with <code>AccessDenied</code>.</p>

    <h2>Type the session</h2>
    <p>By default <code>auth()</code> resolves <code>{ user: Record&lt;string, unknown&gt; }</code>, so reading a custom field your callbacks set (like <code>session.user.id</code>) needs a cast and a typo slips past TypeScript. Opt into a typed <code>user</code> one of two ways.</p>

    <p><strong>Augment <code>AuthUser</code></strong> (NextAuth/Auth.js style) to type every <code>auth()</code> call across the app. Declare the fields your <code>session</code>/<code>jwt</code> callbacks set:</p>
    <code-block>// lib/auth.server.ts (or any .d.ts in the project)
declare module '@webjsdev/server' {
  interface AuthUser {
    id: string;
    role: 'admin' | 'member';
  }
}</code-block>
    <p>Now <code>session.user.id</code> is <code>string</code> everywhere, and a misspelling like <code>session.user.idd</code> is a compile error.</p>

    <p><strong>Or parameterise the factory</strong> with <code>createAuth&lt;TUser&gt;()</code> to type just this instance, without a global augmentation:</p>
    <code-block>interface AppUser {
  id: string;
  role: 'admin' | 'member';
}

export const { auth, signIn, signOut, handlers } =
  createAuth&lt;AppUser&gt;({ /* ...providers, secret */ });

const session = await auth();
session?.user.role; // typed as 'admin' | 'member', no cast</code-block>
    <p>Both are types-only and opt-in: leave them out and <code>auth().user</code> stays the loose <code>Record&lt;string, unknown&gt;</code>, so existing code keeps working unchanged. The fields you declare should match what your callbacks actually write onto <code>session.user</code>.</p>

    <h2>Providers</h2>
    <table>
      <thead><tr><th>Provider</th><th>Env vars</th><th>Flow</th></tr></thead>
      <tbody>
        <tr><td><code>Credentials()</code></td><td>None</td><td>Custom authorize function, you handle password verification</td></tr>
        <tr><td><code>Google()</code></td><td><code>AUTH_GOOGLE_ID</code>, <code>AUTH_GOOGLE_SECRET</code></td><td>OAuth 2.0 redirect flow</td></tr>
        <tr><td><code>GitHub()</code></td><td><code>AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code></td><td>OAuth 2.0 redirect flow</td></tr>
      </tbody>
    </table>
    <p>As in Auth.js, an OAuth provider can be listed uncalled, <code>providers: [GitHub]</code>, when its credentials come from the environment variables above.</p>

    <h2>Session strategies</h2>
    <p><strong>JWT (default):</strong> Session data signed in a cookie. Stateless and scales horizontally without Redis. Cannot be revoked before expiry.</p>
    <p><strong>Database:</strong> Session ID in cookie, data in cache store. Can revoke sessions instantly. Requires Redis or similar for horizontal scaling.</p>
    <code-block>createAuth({
  session: { strategy: 'database' },  // default: 'jwt'
  // ...
});</code-block>

    <h2>Cookie names</h2>
    <p>In development the session cookie is <code>webjs.auth</code>, and the OAuth round trip uses <code>webjs.auth.state</code> and <code>webjs.auth.redirect</code>. In production (<code>NODE_ENV=production</code>) each name carries the <code>__Host-</code> prefix: <code>__Host-webjs.auth</code>, <code>__Host-webjs.auth.state</code>, <code>__Host-webjs.auth.redirect</code>. A browser stores a <code>__Host-</code> cookie only when it is <code>Secure</code>, has <code>Path=/</code> and has no <code>Domain</code>, so an app on a sibling subdomain of a shared hosting domain cannot plant its own session cookie in yours and sign a visitor in to the wrong account. Production reads only the prefixed names, so a production app upgrading from an earlier version signs its users in once more. A test or tool that sets the cookie by hand in production uses the prefixed name.</p>

    <h2>Environment variables</h2>
    <code-block>AUTH_SECRET=your-random-secret-32-chars-minimum
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret</code-block>
    <p>Generate a secret: <code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code>. <code>webjs create</code> writes one into <code>.env</code> for you. As in Auth.js, <code>createAuth</code> reads <code>AUTH_SECRET</code> itself when <code>secret</code> is left out, and <code>secret: process.env.AUTH_SECRET</code> type-checks as is. Outside production a missing secret is generated once into the gitignored <code>.webjs/dev-secret</code> with a warning (a fresh clone has no <code>.env</code>); in production it is required and <code>createAuth</code> throws without one.</p>
  `;
}
