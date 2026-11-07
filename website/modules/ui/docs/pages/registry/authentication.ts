import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Authentication, ported from shadcn's
 * content/docs/registry/authentication.mdx (#1666). shadcn's CLI expands
 * environment variables into request headers and query parameters. This
 * CLI calls `fetch(<url>/<name>.json)` with no options
 * (packages/ui/src/registry/fetcher.js), so it sends no token, no header
 * and no cookie, and a query string in the base URL breaks the item path.
 * The page says so, then covers what does protect a registry under that
 * contract: network access, and a secret path segment the server checks.
 */
export const title = 'Authentication';
export const description = 'Keep a registry private when the CLI sends no credentials.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>A private registry keeps internal components to the people allowed to install them. This guide shows what the WebJs UI CLI can and cannot send, and how to protect a registry within that.</p>
    ${callout(html`The CLI fetches <code>&lt;url&gt;/&lt;name&gt;.json</code> with a plain <code>fetch</code>. It sends no <code>Authorization</code> header, no API key header, no cookie, and it does not expand environment variables into a request. shadcn's token, API key and query parameter patterns therefore do not apply. Protection has to come from where the registry is reachable, or from the URL itself.`, { title: 'The CLI sends no credentials.' })}

    ${heading(toc, 2, 'Common Patterns')}

    ${heading(toc, 3, 'Private Network')}
    <p>Serve the registry where only your team can reach it: on an internal network, behind a VPN, or behind an IP allowlist at your proxy or host. The CLI needs no change, since the registry answers anyone who can connect.</p>
    ${commandBlock(packageCommands('add auth-utils --registry https://registry.internal.acme.com/r'))}

    ${heading(toc, 3, 'Secret Path Segment')}
    <p>The base URL is any prefix the CLI appends <code>/&lt;name&gt;.json</code> to, so it can carry a long random segment that the server checks. Anyone without the segment gets a <code>404</code>.</p>
    ${codeFigure(`REGISTRY_URL=https://registry.acme.com/r/9f2c6b1e4d8a7f03c5e9b2d1a6f4e8c7`, { lang: 'bash', title: '.env' })}
    <p>Treat the full URL as the secret. It appears in shell history, in CI logs when a command echoes it, and in the CLI's own error messages, which print the URL they requested. Keep it in <code>REGISTRY_URL</code> from a secret store rather than in a committed script.</p>

    ${heading(toc, 3, 'Query Parameters')}
    <p>A token in a query string does not work. The CLI appends the item path after the base URL, so <code>https://registry.acme.com/r?token=abc</code> requests <code>https://registry.acme.com/r?token=abc/auth-utils.json</code>.</p>

    ${heading(toc, 2, 'Server-Side Implementation')}
    <p>A WebJs route handler can check the segment in constant time and serve the files <code>webjsui build</code> wrote.</p>
    ${heading(toc, 3, 'WebJs Route Example')}
    ${codeFigure(`import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const OUT = join(process.cwd(), 'registry-out');
const SECRET = Buffer.from(process.env.REGISTRY_SECRET ?? '');

function allowed(token: string): boolean {
  const given = Buffer.from(token);
  return SECRET.length > 0 && given.length === SECRET.length && timingSafeEqual(given, SECRET);
}

export async function GET(_req: Request, { params }: { params: { token: string; name: string } }) {
  const name = params.name.replace(/\\.json$/, '');
  // The same 404 for a wrong token and a missing item, so a probe learns nothing.
  if (!allowed(params.token) || !/^[a-z0-9-]+$/.test(name)) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  try {
    const body = await readFile(join(OUT, \`\${name}.json\`), 'utf8');
    return new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
    });
  } catch {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
}`, { title: 'app/r/[token]/[name]/route.ts', lineNumbers: true })}
    <p>Users then install with the full URL.</p>
    ${commandBlock(packageCommands('add auth-utils --registry https://registry.acme.com/r/<secret>'))}

    ${heading(toc, 2, 'Team-Based Access')}
    <p>Give each team its own secret segment and its own output folder, so a team's URL serves only the items built for it. Revoking a team is removing its segment.</p>

    ${heading(toc, 2, 'Security Best Practices')}
    ${heading(toc, 3, 'Use Environment Variables')}
    <p>Keep the registry URL in <code>REGISTRY_URL</code>, set from your secret store or CI secrets, never committed. Every command reads it when there is no <code>--registry</code> flag.</p>
    ${heading(toc, 3, 'Use HTTPS')}
    <p>The secret travels in the request line, so serve the registry over HTTPS only.</p>
    ${heading(toc, 3, 'Add Rate Limiting')}
    <p>A WebJs app has a rate limiter built in. Put it in the middleware for the registry's segment so guessing segments is slow.</p>
    ${codeFigure(`import { rateLimit } from '@webjsdev/server';

export default rateLimit({ window: '1m', max: 60 });`, { title: 'app/r/middleware.ts', lineNumbers: true })}
    ${heading(toc, 3, 'Rotate Secrets')}
    <p>Change the segment when someone leaves or a URL leaks, and send the new URL to the people who still need it.</p>
    ${heading(toc, 3, 'Log Access')}
    <p>Log which items are fetched and when, without logging the full URL, which carries the secret.</p>

    ${heading(toc, 2, 'Testing Authentication')}
    ${codeFigure(`# Test with curl.
curl https://registry.acme.com/r/<secret>/auth-utils.json

# Test with the CLI.
npx @webjsdev/ui view auth-utils --registry https://registry.acme.com/r/<secret>`, { lang: 'bash' })}

    ${heading(toc, 2, 'Error Handling')}
    <p>The CLI reports a failed request with its status and the URL it requested, for example <code>HTTP 404</code> or <code>HTTP 401</code>. It does not read an error body, so a custom error message in the response is not shown to the user. Document the expected URL format where your users get the URL instead.</p>

    ${heading(toc, 2, 'Next Steps')}
    <ul>
      <li>Read <a href="/ui/docs/registry/getting-started">Getting Started</a> to build and serve a registry.</li>
      <li>Read <a href="/ui/docs/registry/namespace">Namespaces</a> for working with more than one registry.</li>
    </ul>
  `;
}
