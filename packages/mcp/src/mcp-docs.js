/**
 * The knowledge + authoring layer for `webjs mcp` (#376).
 *
 * `webjs mcp` (lib/mcp.js) started as four READ-ONLY introspection tools. This
 * module adds the second layer the Next.js MCP (`next-devtools-mcp`) showed is
 * the high-leverage one: the framework knowledge an agent needs to author
 * idiomatic webjs code, surfaced as MCP RESOURCES (the `agent-docs/*.md` corpus
 * plus the `AGENTS.md` contract), an `init` "read first" primer that fights the
 * React/RSC mental model, a `docs` retrieval tool, and guided-workflow PROMPTS
 * built from the recipes.
 *
 * It stays hand-rolled and ZERO-dependency (no `@modelcontextprotocol/sdk`),
 * consistent with webjs being buildless + minimal-deps. Everything here is PURE
 * given its injected `{ docsDir, agentsPath, readFile }` deps, so it is testable
 * in-process without booting a server or touching the real filesystem.
 *
 * Docs resolution (so `npx @webjsdev/cli mcp` is self-contained): a published
 * install reads the corpus bundled under `<cli>/resources/agent-docs` (copied
 * at `prepack`, see `scripts/copy-mcp-resources.js`); a monorepo dev run falls
 * back to the repo-root `agent-docs/`. {@link resolveDocsLocation} encodes that
 * two-path lookup so source stays single (no committed duplicate docs).
 *
 * @module mcp-docs
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The URI scheme for a framework-docs resource: `webjs-docs://<name>`. */
const DOCS_SCHEME = 'webjs-docs://';

/**
 * Resolve where the framework-docs corpus lives, plus the `AGENTS.md` contract
 * path. Tries the BUNDLED location first (a published `@webjsdev/mcp` ships
 * `resources/agent-docs/` + `resources/AGENTS.md` via `prepack`), then falls
 * back to the monorepo-root layout (`agent-docs/` + `AGENTS.md`) used in dev and
 * tests. Returns `{ docsDir, agentsPath }`; either path may not exist, callers
 * fail soft (an empty corpus is valid, never a crash).
 *
 * @param {string} [moduleUrl]  `import.meta.url` of the caller (defaults to this module)
 * @returns {{ docsDir: string, agentsPath: string }}
 */
export function resolveDocsLocation(moduleUrl) {
  const here = dirname(fileURLToPath(moduleUrl || import.meta.url));
  const pkgRoot = resolve(here, '..'); // packages/mcp/src -> packages/mcp
  const repoRoot = resolve(here, '..', '..', '..'); // -> monorepo root

  const bundledDocs = join(pkgRoot, 'resources', 'agent-docs');
  if (existsSync(bundledDocs)) {
    return { docsDir: bundledDocs, agentsPath: join(pkgRoot, 'resources', 'AGENTS.md') };
  }
  return { docsDir: join(repoRoot, 'agent-docs'), agentsPath: join(repoRoot, 'AGENTS.md') };
}

/**
 * A doc's logical name from its filename: `lit-muscle-memory-gotchas.md` ->
 * `lit-muscle-memory-gotchas`. The `AGENTS.md` contract keeps its own name.
 *
 * @param {string} file
 * @returns {string}
 */
function docName(file) {
  return file.replace(/\.md$/i, '');
}

/**
 * A human title for a doc name: `lit-muscle-memory-gotchas` ->
 * `Lit Muscle Memory Gotchas`. Used in the resource listing so a model picks
 * the right doc without reading it.
 *
 * @param {string} name
 * @returns {string}
 */
function titleFor(name) {
  if (name === 'AGENTS') return 'AGENTS.md (the framework contract + invariants)';
  return name
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * The corpus catalogue: every servable doc as `{ name, file, uri, title }`.
 * Reads the docs dir listing (so it tracks the shipped set) plus the `AGENTS.md`
 * contract. PURE given `deps`.
 *
 * @param {{ docsDir: string, agentsPath: string, listDir: (d: string) => string[], exists: (p: string) => boolean }} deps
 * @returns {Array<{ name: string, file: string, uri: string, title: string }>}
 */
export function catalogue(deps) {
  const { docsDir, agentsPath, listDir, exists } = deps;
  /** @type {Array<{ name: string, file: string, uri: string, title: string }>} */
  const out = [];
  if (exists(agentsPath)) {
    out.push({ name: 'AGENTS', file: agentsPath, uri: `${DOCS_SCHEME}AGENTS`, title: titleFor('AGENTS') });
  }
  let files = [];
  try { files = listDir(docsDir).filter((f) => /\.md$/i.test(f)).sort(); } catch { files = []; }
  for (const f of files) {
    const name = docName(f);
    out.push({ name, file: join(docsDir, f), uri: `${DOCS_SCHEME}${name}`, title: titleFor(name) });
  }
  return out;
}

/**
 * MCP `resources/list`: the corpus as resource descriptors.
 *
 * @param {object} deps
 * @returns {Array<{ uri: string, name: string, title: string, mimeType: string }>}
 */
export function listResources(deps) {
  return catalogue(deps).map((d) => ({
    uri: d.uri,
    name: d.name,
    title: d.title,
    mimeType: 'text/markdown',
  }));
}

/**
 * MCP `resources/read`: the markdown text for a `webjs-docs://<name>` URI.
 * Throws a clear Error for an unknown URI (the dispatcher maps it to a JSON-RPC
 * error, never a crash).
 *
 * @param {object} deps
 * @param {string} uri
 * @returns {Promise<{ uri: string, mimeType: string, text: string }>}
 */
export async function readResource(deps, uri) {
  const entry = catalogue(deps).find((d) => d.uri === uri);
  if (!entry) throw new Error(`Unknown resource: ${uri}`);
  const text = await deps.readFile(entry.file, 'utf8');
  return { uri, mimeType: 'text/markdown', text };
}

/**
 * Extract a `## <heading>` section (heading line through the line before the
 * next same-or-higher-level heading) from a markdown doc. Used to source the
 * `init` primer from `AGENTS.md` rather than hand-duplicating it (so it cannot
 * drift). Returns '' when the heading is absent.
 *
 * @param {string} md
 * @param {RegExp} headingRe  matches the section's heading LINE (e.g. /^##\s+Execution model/m)
 * @returns {string}
 */
export function sectionByHeading(md, headingRe) {
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      start = i;
      level = (lines[i].match(/^#+/) || ['##'])[0].length;
      break;
    }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

/**
 * The `init` tool output: the "read first" orientation that fights the
 * React/RSC mental model. Sources the EXECUTION MODEL + INVARIANTS sections
 * from the shipped `AGENTS.md` (no hand-duplication), prepends a short router
 * to the highest-value resources, and lists the corpus so the agent knows what
 * else it can pull. PURE given `deps`.
 *
 * @param {object} deps
 * @returns {Promise<string>}
 */
export async function initText(deps) {
  let agents = '';
  try { agents = await deps.readFile(deps.agentsPath, 'utf8'); } catch { agents = ''; }
  const execModel = sectionByHeading(agents, /^##\s+Execution model/im);
  const invariants = sectionByHeading(agents, /^##\s+Invariants/im);

  const cat = catalogue(deps);
  const resourceList = cat.map((d) => `- \`${d.uri}\` (${d.title})`).join('\n');

  const router = [
    'You are about to write or edit a webjs app. Read this orientation FIRST, then',
    'pull the specific docs you need via the `docs` tool or the `webjs-docs://*`',
    'resources. webjs is web-components-first and looks like Lit + Rails, NOT React/Next:',
    'there is NO RSC, no server/client component split, no `use client`. Components',
    'hydrate (islands); pages and layouts do NOT hydrate. Signals are the default',
    'state primitive. Server-only code lives behind the `.server.{js,ts}` boundary.',
    'When writing a component, read `webjs-docs://lit-muscle-memory-gotchas` first:',
    'the Lit habits that break webjs SSR/reactivity each have a webjs-shaped fix there.',
    '',
    'webjs is buildless: the authored framework source is readable JSDoc in',
    '`node_modules/@webjsdev/<pkg>/src`, and server-side that source runs directly.',
    '(The one built artifact is the `@webjsdev/core` BROWSER bundle in `dist/`;',
    'its authored source is still in `src/`.) When the docs do not answer something,',
    'use the `source` tool to grep or read that real `src/` source (it skips `dist/`).',
  ].join('\n');

  const parts = [
    '# webjs: read first',
    '',
    router,
    '',
    execModel || '(execution-model section unavailable)',
    '',
    invariants || '(invariants section unavailable)',
    '',
    '## Available docs (read via the `docs` tool or these resources)',
    '',
    resourceList || '(no docs bundled)',
  ];
  return parts.join('\n');
}

/**
 * The `docs` tool. With `topic` matching a corpus name, returns that doc's full
 * text. With `query`, keyword-searches every doc and returns the matching lines
 * (each tagged with its source URI and nearest heading). With neither, returns
 * the topic index (the catalogue). PURE given `deps`.
 *
 * @param {object} deps
 * @param {{ topic?: string, query?: string }} [args]
 * @returns {Promise<string>}
 */
export async function searchDocs(deps, args) {
  const { topic, query } = args || {};
  const cat = catalogue(deps);

  if (topic) {
    const entry = cat.find((d) => d.name.toLowerCase() === String(topic).toLowerCase());
    if (!entry) {
      const names = cat.map((d) => d.name).join(', ');
      return `Unknown topic "${topic}". Available topics: ${names}`;
    }
    return await deps.readFile(entry.file, 'utf8');
  }

  if (query) {
    const q = String(query).toLowerCase();
    const MAX_HITS = 40;
    /** @type {string[]} */
    const hits = [];
    let capped = false;
    outer: for (const entry of cat) {
      let text = '';
      try { text = await deps.readFile(entry.file, 'utf8'); } catch { continue; }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(q)) continue;
        // Check the cap BEFORE pushing, so `capped` means a match BEYOND the cap
        // exists (exactly MAX_HITS matches is NOT a truncation, nothing dropped).
        if (hits.length >= MAX_HITS) { capped = true; break outer; }
        // Nearest preceding heading for context.
        let heading = '';
        for (let j = i; j >= 0; j--) {
          if (/^#+\s/.test(lines[j])) { heading = lines[j].replace(/^#+\s/, ''); break; }
        }
        hits.push(`[${entry.uri}] ${heading ? heading + ': ' : ''}${lines[i].trim()}`);
      }
    }
    if (!hits.length) return `No matches for "${query}" in the webjs docs. Topics: ${cat.map((d) => d.name).join(', ')}`;
    // Disclose truncation rather than silently capping (no silent caps).
    if (capped) hits.push(`... (truncated at ${MAX_HITS} matches; refine the query or open a doc with \`topic\`)`);
    return hits.join('\n');
  }

  // No args: the topic index.
  return ['webjs docs topics (pass one as `topic`, or `query` to search):', '', ...cat.map((d) => `- ${d.name}: ${d.title}`)].join('\n');
}

/**
 * The guided-workflow PROMPTS, built from the recipes. Each is a single-message
 * prompt that hands the agent the canonical webjs recipe plus the invariants it
 * must not break, then tells it to pull `webjs-docs://recipes` for the full set.
 * Static metadata; {@link getPrompt} fills the message text.
 */
export const PROMPTS = [
  { name: 'add_page', description: 'Scaffold a webjs page (app/<segment>/page.ts), the idiomatic way.', arguments: [{ name: 'route', description: 'URL path, e.g. /about', required: false }] },
  { name: 'add_dynamic_route', description: 'Scaffold a dynamic page reading params, e.g. app/users/[id]/page.ts.', arguments: [{ name: 'route', description: 'URL path with a [param], e.g. /users/[id]', required: false }] },
  { name: 'add_server_action', description: 'Scaffold a server action (.server.ts + use server) called from a component.', arguments: [{ name: 'feature', description: 'Feature/module name', required: false }] },
  { name: 'add_component', description: 'Scaffold an interactive WebComponent (signals, light DOM, register).', arguments: [{ name: 'tag', description: 'Custom-element tag, e.g. my-thing', required: false }] },
  { name: 'fetch_data_in_component', description: 'Fetch server data IN a component with async render() (co-located, first-paint data), plus webjs-suspense streaming and renderFallback.', arguments: [{ name: 'tag', description: 'Custom-element tag, e.g. user-profile', required: false }] },
  { name: 'add_module', description: 'Scaffold a modules/<feature>/ slice (actions/queries/components/utils).', arguments: [{ name: 'feature', description: 'Feature name', required: false }] },
];

/**
 * The canonical recipe snippet + invariant reminders for each prompt. Kept
 * compact on purpose: the prompt orients + shows the shape, then points at the
 * full `webjs-docs://recipes` resource. The shapes mirror `agent-docs/recipes.md`.
 *
 * @type {Record<string, string>}
 */
const PROMPT_BODIES = {
  add_page: [
    'Add a webjs page. A page is `app/<segment>/page.ts` whose DEFAULT export is a',
    '(possibly async) function returning a `TemplateResult`; it runs ONLY on the server.',
    '',
    '```ts',
    "import { html } from '@webjsdev/core';",
    'export default function About() {',
    '  return html`<h1>About</h1>`;',
    '}',
    '```',
    '',
    'Rules: the default export is a FUNCTION (invariant 6), it does NOT call render().',
    'For interactivity, render a component tag inside it (pages do not hydrate).',
    'Name metadata via a `metadata` / `generateMetadata` named export.',
  ].join('\n'),
  add_dynamic_route: [
    'Add a dynamic page. `app/users/[id]/page.ts` receives `{ params }`; fetch data',
    'through a server action or query, never by importing the DB directly.',
    '',
    '```ts',
    'export default async function User({ params }: { params: { id: string } }) {',
    '  const user = await getUser(params.id); // a `use server` action / query',
    '  return html`<h1>${user.name}</h1>`;',
    '}',
    '```',
    '',
    'Catch-all is `[...rest]`, optional catch-all `[[...rest]]`. Server-only data',
    'access goes through `.server.{js,ts}`, never a direct import into the page.',
  ].join('\n'),
  add_server_action: [
    "Add a server action. A `*.server.ts` file with `'use server'` exports async",
    'functions that round-trip serializer-safe values; a client import is rewritten',
    'to a typed RPC stub (never hand-write fetch).',
    '',
    '```ts',
    '// modules/<feature>/actions/<name>.server.ts',
    "'use server';",
    "import { db } from '../../../db/connection.server.ts';",
    "import { things } from '../../../db/schema.server.ts';",
    'export async function doThing(input: { name: string }) {',
    "  const name = String(input?.name || '').trim();",
    "  if (!name) return { success: false, error: 'name required', status: 400 };",
    '  const [row] = await db.insert(things).values({ name }).returning();',
    '  return { success: true, data: row };',
    '}',
    '```',
    '',
    'Return the `ActionResult<T>` envelope. Server-only code MUST stay in `.server.*`',
    '(invariant 1). Call it from a component via a normal import.',
  ].join('\n'),
  add_component: [
    'Add an interactive WebComponent. One custom element per file; register at module',
    'top level. Signals are the default state; read with `.get()` inside render().',
    '',
    '```ts',
    "import { WebComponent, html, signal } from '@webjsdev/core';",
    'export class MyThing extends WebComponent {',
    '  count = signal(0);',
    '  render() {',
    '    return html`<button @click=${() => this.count.set(this.count.get() + 1)}>',
    '      ${this.count.get()}</button>`;',
    '  }',
    '}',
    "MyThing.register('my-thing');",
    '```',
    '',
    'Tag MUST contain a hyphen (invariant 3). Event/property/boolean holes are',
    'unquoted (invariant 4). Read `webjs-docs://lit-muscle-memory-gotchas` first:',
    'a class-field initializer that overwrites a reactive accessor breaks reactivity',
    '(declare reactive props via the `extends WebComponent({ … })` factory).',
  ].join('\n'),
  fetch_data_in_component: [
    'Fetch server data IN the component that needs it, with an async render() (#469).',
    'No prop-drilling: SSR awaits the render, so the DATA is in the first paint.',
    '',
    '```ts',
    'class UserProfile extends WebComponent({ uid: String }) {',
    '  async render() {',
    '    const u = await getUser(this.uid); // a `use server` action: real fn at SSR, RPC stub on the client',
    '    return html`<h3>${u.name}</h3>`;',
    '  }',
    '}',
    "UserProfile.register('user-profile');",
    '```',
    '',
    'Decoupled model: SSR BLOCKS by default (real data, no fallback). The client',
    're-fetch default is stale-while-revalidate. `renderFallback()` is the OPTIONAL',
    're-fetch loading state (re-fetch only, NEVER first paint). Errors are isolated',
    'per component by default (add `renderError()` only to customize). For SLOW data,',
    'wrap in `<webjs-suspense .fallback=${html`...`}>` to STREAM it (fallback first).',
    'Keep `Task` / signals for client-only data (it shows pending at SSR). Read',
    '`webjs-docs://components` for the full decision guide and anti-patterns.',
  ].join('\n'),
  add_module: [
    'Add a feature module. `modules/<feature>/` holds `actions/*.server.ts` (mutations),',
    '`queries/*.server.ts` (reads), `components/*.ts` (feature UI), `utils/*.ts` (pure),',
    '`types.ts`. One function per action/query file. Routes stay thin: extract anything',
    'over ~20 lines into a module action. Shared presentational primitives go in the',
    'top-level `components/`, cross-cutting infra in `lib/*.server.ts`.',
  ].join('\n'),
};

/**
 * MCP `prompts/get`: the messages for a guided-workflow prompt. Throws for an
 * unknown name (mapped to a JSON-RPC error).
 *
 * @param {string} name
 * @param {Record<string, string>} [args]
 * @returns {{ description: string, messages: Array<{ role: string, content: { type: string, text: string } }> }}
 */
export function getPrompt(name, args) {
  const meta = PROMPTS.find((p) => p.name === name);
  const body = PROMPT_BODIES[name];
  if (!meta || !body) throw new Error(`Unknown prompt: ${name}`);

  // Fold any provided argument values in as a one-line hint at the top.
  const provided = Object.entries(args || {}).filter(([, v]) => v != null && v !== '');
  const argLine = provided.length
    ? `Context: ${provided.map(([k, v]) => `${k}=${v}`).join(', ')}.\n\n`
    : '';

  const text = `${argLine}${body}\n\nSee \`webjs-docs://recipes\` for the full recipe set and \`webjs-docs://AGENTS\` for the invariants.`;
  return {
    description: meta.description,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
