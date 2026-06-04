import { html } from '@webjsdev/core';

export const metadata = { title: 'expose(): REST Endpoints from Server Actions | webjs' };

export default function Expose() {
  return html`
    <h1>expose(): REST Endpoints</h1>
    <p><code>expose()</code> lets you tag a server action to also be reachable at a stable REST URL. The same function powers both the RPC call (from components) and the HTTP endpoint (for external consumers, webhooks, mobile apps).</p>

    <h2>When to use</h2>
    <ul>
      <li>You have a server action that external consumers need to call over HTTP (mobile apps, webhooks, third-party integrations).</li>
      <li>You want a stable, documented API endpoint without writing a separate <code>route.ts</code> file.</li>
      <li>You want input validation on the HTTP path but trust the same-origin RPC path.</li>
    </ul>

    <h2>When NOT to use</h2>
    <ul>
      <li>For internal-only server actions that only your components call. Plain server actions with RPC stubs are simpler and CSRF-protected.</li>
      <li>For complex REST resources with multiple methods, use <code>app/api/**/route.ts</code> instead.</li>
    </ul>

    <h2>Basic usage</h2>
    <pre>// modules/posts/actions/create-post.server.ts
import { expose } from '@webjsdev/core';
import { prisma } from '../../../lib/prisma.server.ts';

export const createPost = expose('POST /api/posts', async ({ title, body }) => {
  return prisma.post.create({ data: { title, body } });
});</pre>

    <p>This function is now callable two ways:</p>
    <ul>
      <li><strong>From a component</strong> (RPC): <code>import { createPost } from '../actions/create-post.server.ts';</code> uses an auto-RPC stub and is CSRF-protected.</li>
      <li><strong>Over HTTP</strong>: <code>POST /api/posts</code> with JSON body, with no CSRF (designed for external callers).</li>
    </ul>

    <h2>Input validation</h2>
    <p>Pass a <code>validate</code> function as the third argument. It runs server-side before the action body on BOTH call paths: the internal RPC path (a client component import) AND this HTTP path. So a validator declared once guards both (issue #245):</p>

    <pre>import { expose } from '@webjsdev/core';
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

export const createPost = expose(
  'POST /api/posts',
  async ({ title, body }) => {
    return prisma.post.create({ data: { title, body } });
  },
  { validate: (input) => PostSchema.parse(input) }
);</pre>

    <p>The framework calls <code>validate(input)</code> and interprets the return three ways:</p>
    <ul>
      <li><strong>Returns a structured envelope</strong> <code>{ success: false, fieldErrors }</code> (or <code>{ success: true, data }</code> on pass): a failure becomes a <code>422</code> JSON response carrying <code>fieldErrors</code> here, and a normal result the client reads as <code>result.fieldErrors</code> over RPC. This is the recommended field-error path, matching the <code>ActionResult</code> envelope.</li>
      <li><strong>Throws</strong> (the <code>Schema.parse</code> style above): the HTTP response is <code>400</code> with the error message and any <code>issues</code> array (compatible with Zod/Valibot); over RPC it becomes the same sanitized error a thrown action body produces.</li>
      <li><strong>Returns any other value</strong>: that value replaces the input (a transform/coercion). The <code>Schema.parse</code> form above uses this.</li>
    </ul>

    <p>To attach a validator WITHOUT an HTTP route (a pure-RPC action), use <code>validateInput(fn, validate)</code> from <code>@webjsdev/core</code> instead of <code>expose()</code>. The zod adapter for the structured form is three lines: <code>{ const r = Schema.safeParse(i); return r.success ? { success: true, data: r.data } : { success: false, fieldErrors: r.error.flatten().fieldErrors }; }</code></p>

    <h2>URL parameters</h2>
    <p><code>expose()</code> supports URL parameters. On the HTTP path, the adapter merges <code>{ ...queryParams, ...urlParams, ...jsonBody }</code> into a single object argument:</p>

    <pre>export const getPost = expose('GET /api/posts/:slug', async ({ slug }) => {
  return prisma.post.findUnique({ where: { slug } });
});</pre>

    <h2>Security</h2>
    <p><strong>Important:</strong> <code>expose()</code>d endpoints are NOT CSRF-protected. They're designed for external consumers. You must handle authentication yourself:</p>

    <ul>
      <li>Require a bearer token or API key via <code>headers().get('authorization')</code>.</li>
      <li>Or protect the route with auth middleware.</li>
      <li>Or rely on session cookies but add your own CSRF check for browser-facing endpoints.</li>
    </ul>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/server-actions">Server Actions</a>: the RPC system that expose() builds on</li>
      <li><a href="/docs/api-routes">API Routes</a>: the alternative for complex REST resources</li>
      <li><a href="/docs/rate-limiting">Rate Limiting</a>: protect exposed endpoints from abuse</li>
      <li><a href="/docs/middleware">Middleware</a>: add auth to exposed routes</li>
    </ul>
  `;
}
