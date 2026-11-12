/**
 * The WebJs brief: the whole of what an agent needs to know beyond its Lit and
 * Next.js training data. Lit and Next habits are meant to produce correct WebJs
 * code, and where one cannot, `webjs check` and the runtime refuse it with the
 * fix in the message, so the agent-facing docs are this brief and nothing more.
 *
 * Single source. The MCP `init` tool returns it, and the root `AGENTS.md` plus
 * the scaffold's `packages/cli/templates/AGENTS.md` carry it VERBATIM under the
 * `## The WebJs brief` heading. `test/repo-health/brief-parity.test.mjs`
 * asserts all three agree, so edit it here and paste it there.
 *
 * @module brief
 */

/** The heading both `AGENTS.md` files place the brief under. */
export const BRIEF_HEADING = '## The WebJs brief';

/** The brief itself, as markdown, without its heading. */
export const BRIEF = [
  'WebJs is a no-build full-stack framework. Write it the way you write Next.js',
  'routing and Lit components, with the differences below.',
  '',
  '- Routing follows the Next.js App Router: `app/page.ts`, `layout.ts`,',
  '  `route.ts`, `middleware.ts`, `[param]`, `[...slug]`, `(group)`,',
  '  `loading.ts`, `error.ts`, `not-found.ts`, `metadata` and',
  '  `generateMetadata`, and server actions.',
  '- Components use Lit\'s APIs (`html`, `css`, reactive properties through',
  '  `static properties` plus `declare` or the `WebComponent({ ... })` factory,',
  '  the lifecycle, directives, context, task), imported from `@webjsdev/core`',
  '  and its `/directives`, `/context`, `/task` and `/signals` subpaths. The base',
  '  class is `WebComponent`. Register with `Class.register(\'my-tag\')` or',
  '  `customElements.define`.',
  '- Components render light DOM by default and `<slot>` works there too. Keep',
  '  them light: page styles such as Tailwind and the UI kit do not reach into a',
  '  shadow root. Use `static shadow = true` only when light DOM cannot work.',
  '- TypeScript must be erasable, so no decorators and no enums.',
  '- Server-only code and server actions live in `*.server.ts` files. With',
  '  `\'use server\'` at the top, their exports are callable from components and',
  '  bindable as `<form action=${fn}>`. A failed form action re-renders the page',
  '  with its result on `actionData`.',
  '- `cookies()`, `headers()` and `revalidatePath()` come from `@webjsdev/server`,',
  '  and so does `createAuth()`, which is Auth.js\'s API. Files in `public/` are',
  '  served from the site root.',
  '- Never import `lit`, `next` or `react`.',
  '',
  'Before hand-writing auth, sessions, caching, rate limits, uploads, realtime or',
  'SEO, run `npx webjs source`, which lists what WebJs provides for each need.',
  '`npx webjs source <Export>` then prints one export\'s signature and example.',
  'After each edit run `npx webjs check`. To verify the app, run `npx webjs verify`:',
  'check, typecheck, the tests, and every route booted in-process, in one call,',
  'with no dev server to start, curl or stop. The framework source is in',
  '`node_modules/@webjsdev/*` (no build, so it is the code that runs) and the',
  'human docs are at https://webjs.dev/docs.',
].join('\n');
