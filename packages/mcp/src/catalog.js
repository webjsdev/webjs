/**
 * The feature catalogue: what WebJs provides beyond the brief, grouped by what
 * an app needs (auth, sessions, caching, uploads, realtime, ...). An agent that
 * does not know an export's name cannot ask `source` for it, so before #1686 a
 * feature the brief does not name (rate limiting, file storage, broadcast) was
 * found only by reading the framework source, or hand-written instead.
 *
 * `npx webjs source` with no name prints it, and so does the MCP `source` tool
 * with no arguments. Every name here resolves through `lookupExport`, so the
 * second call (`npx webjs source <Name>`) returns the signature and example;
 * `packages/mcp/test/catalog.test.mjs` holds that, and holds each name to be a
 * real export of the module named for its group.
 *
 * Curated rather than derived: the export lists mix the app-facing surface
 * with framework plumbing (`buildModuleGraph`, `jspmGenerate`), and a need is
 * not a property any export carries. Add an entry when an app-facing export
 * lands; the test fails on one that disappears.
 *
 * @module catalog
 */
import { GUIDES } from './guides.js';

/**
 * @typedef {{ need: string, names: string[], note?: string }} CatalogGroup
 * @typedef {{ module: string, groups: CatalogGroup[] }} CatalogSection
 */

/** @type {CatalogSection[]} */
export const FEATURE_CATALOG = [
  {
    module: '@webjsdev/server',
    groups: [
      { need: 'Auth', names: ['createAuth', 'Credentials', 'GitHub', 'Google', 'AuthError'], note: "Auth.js's API: auth(), signIn(), signOut(), handlers" },
      { need: 'Sessions and cookies', names: ['session', 'getSession', 'cookies', 'headers'] },
      { need: 'Redirects and errors', names: ['redirect', 'permanentRedirect', 'notFound', 'forbidden', 'unauthorized'] },
      { need: 'Caching', names: ['cache', 'revalidatePath', 'revalidateTag', 'revalidateAll'] },
      { need: 'Rate limits and CORS', names: ['rateLimit', 'cors', 'clientIp'] },
      { need: 'File uploads', names: ['getFileStore', 'setFileStore', 'diskStore', 'generateKey', 'signedUrl', 'verifySignedUrl'] },
      { need: 'Realtime', names: ['broadcast'], note: 'a route.ts exporting WS handles WebSocket connections' },
      { need: 'Streaming responses', names: ['stream', 'streamResponse', 'acceptsStream'] },
      { need: 'Route handlers', names: ['json', 'readBody', 'route'] },
      { need: 'SEO', names: ['sitemap', 'sitemapIndex', 'robots'] },
      { need: 'Env validation', names: ['validateEnv'], note: 'an env.ts schema checks process.env at boot' },
      { need: 'Server tests', names: ['testRequest', 'submitForm', 'invokeActionForTest', 'loginAndGetCookies', 'createRequestHandler'] },
    ],
  },
  {
    module: '@webjsdev/core',
    groups: [
      { need: 'Components', names: ['WebComponent', 'html', 'css', 'nothing', 'unsafeHTML'] },
      { need: 'Directives', names: ['classMap', 'styleMap', 'repeat', 'map', 'when', 'choose', 'ref', 'live', 'until', 'guard', 'keyed', 'ifDefined'] },
      { need: 'State', names: ['signal', 'computed', 'effect', 'Task', 'createContext'] },
      { need: 'Client navigation and data', names: ['navigate', 'refreshPage', 'revalidate', 'optimistic', 'connectWS'] },
      { need: 'Streaming and assets', names: ['Suspense', 'asset', 'cspNonce'] },
    ],
  },
  {
    module: '@webjsdev/core/testing',
    groups: [
      { need: 'Component tests', names: ['fixture', 'ssrFixture', 'waitForUpdate', 'click'] },
    ],
  },
];

/**
 * The catalogue as the text `npx webjs source` and the MCP `source` tool print.
 * @param {CatalogSection[]} [catalog]
 * @returns {string}
 */
export function featureCatalog(catalog = FEATURE_CATALOG) {
  // Generate first, look up second: the generators lead, since starting a
  // feature by writing it is the costliest mistake. They are commands, not
  // exports, so they sit outside the name-checked sections.
  const out = [
    'Start a feature by generating it, as in Rails, then edit what it wrote',
    '(`npx webjs help generate`):',
    '  A feature: npx webjs g scaffold post title:string! body:text (also resource, model, migration, controller)',
    '  Auth: npx webjs g authentication (sign-up, log-in, a protected /dashboard)',
    '',
    'What WebJs provides, by need. `npx webjs source <Name>` (or the MCP `source`',
    'tool with `export`) prints one name\'s signature and a working example. Use',
    'these before writing your own.',
  ];
  for (const section of catalog) {
    out.push('', section.module);
    for (const g of section.groups) {
      out.push(`  ${g.need}: ${g.names.join(', ')}${g.note ? ` (${g.note})` : ''}`);
    }
  }
  out.push('', 'Guides, how WebJs wants it built (`npx webjs source <guide>`)');
  for (const [name, g] of Object.entries(GUIDES)) out.push(`  ${name}: ${g.need}`);
  return out.join('\n');
}
