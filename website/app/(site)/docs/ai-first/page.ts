import { html } from '@webjsdev/core';

export const metadata = { title: 'AI-First Development | WebJs' };

export default function AIFirst() {
  return html`
    <h1>AI-First Development</h1>
    <p>WebJs is designed from the ground up to be <strong>the framework AI agents can read, write, and ship</strong>. Every architectural decision (from the file layout to the naming conventions to the one-function-per-file rule) was made with one question in mind: <em>can an LLM understand this without loading the entire codebase into context?</em></p>

    <h2>Why AI-First Matters</h2>
    <p>Modern AI coding assistants (Claude Code, GitHub Copilot, Cursor, Antigravity, etc.) are increasingly writing production code. But most frameworks were designed for humans who hold the whole project in their head. They rely on:</p>
    <ul>
      <li><strong>Implicit conventions</strong>: "you just know" where to put things.</li>
      <li><strong>Barrel files</strong>: re-exports that hide the real location of code.</li>
      <li><strong>Magic config</strong>: next.config.js, vite.config.ts, webpack aliases.</li>
      <li><strong>Build-time transforms</strong>: what the source says isn't what runs.</li>
      <li><strong>Scattered state</strong>: a single feature touches 5 files across 3 directories with no discoverable link.</li>
    </ul>
    <p>These work fine for experienced developers who've memorised the conventions. They're hostile to AI agents that need to discover structure from the files themselves.</p>

    <h2>How WebJs Solves This</h2>

    <h3>1. AGENTS.md: The Machine-Readable Contract</h3>
    <p>Every WebJs app has an <code>AGENTS.md</code> at the root, and it is short on purpose. WebJs follows Next.js App Router routing and Lit's component APIs, so an agent's existing habits already write most of an app correctly. The file holds only what differs:</p>
    <ul>
      <li><strong>The WebJs brief</strong>: the handful of places WebJs departs from Next.js and Lit (light DOM by default, erasable TypeScript, server code in <code>*.server.ts</code>, imports from <code>@webjsdev/*</code>), the instruction to run <code>webjs check</code> after each edit, and <code>webjs verify</code> to check, typecheck, test and boot every route in one call.</li>
      <li><strong>A build checklist</strong> for the template the app was created from.</li>
      <li><strong>Types and data</strong>: derive every type from its source, and keep data in the database.</li>
    </ul>
    <p>Everything else is enforced rather than documented: <code>webjs check</code> and the runtime refuse a habit that cannot work, with the WebJs fix in the message, and the framework source in <code>node_modules/@webjsdev/*</code> is the exact reference, since there is no build.</p>
    <p>An AI agent reads AGENTS.md once and knows: the shape of the app, what's safe to change, what's not, and how to add any feature. No guessing.</p>

    <h3>2. The WebJs MCP Server</h3>
    <p>Alongside the static <code>AGENTS.md</code> contract, every WebJs app ships a <strong>read-only Model Context Protocol server</strong> agents can wire up for live, version-accurate introspection of THIS app and the framework. It mutates nothing, so it is safe to call freely, and it is preferred over recalling WebJs from training data (which drifts). It is already available with no install (the WebJs CLI, a project dependency, has it built in as <code>webjs mcp</code>, and the equivalent standalone package runs as <code>npx @webjsdev/mcp</code>). It is an MCP STDIO server, so you do not run it in a terminal and read its output. Your MCP host (Claude Code, Cursor, etc.) launches it and surfaces its tools.</p>
    <p>Claude Code is pre-wired by the scaffold. For another host, register the server by pointing it at the package:</p>
    <code-block>// .cursor/mcp.json (or your host's MCP config)
{
  "mcpServers": {
    "webjs": {
      "command": "npx",
      "args": ["@webjsdev/mcp"]
    }
  }
}</code-block>
    <p><strong>Introspection of this app</strong> (read-only, no module load, no DB side effects):</p>
    <ul>
      <li><code>list_routes</code>: the live route table.</li>
      <li><code>list_actions</code>: server actions with their <code>/__webjs/action/&lt;hash&gt;/&lt;fn&gt;</code> RPC endpoints (the real hashes).</li>
      <li><code>list_components</code>: the registered custom-element tags.</li>
      <li><code>check</code>: the structured <code>webjs check</code> violations.</li>
      <li><code>ui</code>: the <code>@webjsdev/ui</code> kit inventory, or one component's helper signatures, paste-ready example, and a11y header.</li>
    </ul>
    <p>Use these to learn the real route, action, and component surface before editing, instead of grepping or assuming.</p>
    <p><strong>The brief and the source:</strong> an <code>init</code> tool returns the WebJs brief, the short list of what differs from Next.js App Router routing and Lit components, which is the same text the scaffold's <code>AGENTS.md</code> opens with. A <code>source</code> tool reads the framework's OWN no-build source from <code>node_modules/@webjsdev/*/src</code> (what actually runs), and its <code>export</code> argument returns one export's signature plus its doc comment. There is no separate docs corpus for agents: WebJs is designed so Lit and Next.js habits produce correct code, and where one cannot, <code>webjs check</code> and the runtime refuse it with the fix in the message.</p>
    <p><code>init</code> warns when the app's installed <code>@webjsdev/mcp</code> is newer than the running server's, so a stale global install is visible instead of silently serving an old brief and old tools.</p>
    <p>An agent has two complementary ways to understand the framework, and either beats guessing from training data: grep the full no-build source under <code>node_modules/@webjsdev/*/src</code> (the real code that runs, no sourcemaps), and the MCP for live app introspection plus the <code>init</code> and <code>source</code> tools.</p>

    <h3>3. Predictable File Layout</h3>
    <code-block>app/
  page.ts              → always the page component for this URL
  layout.ts            → always the wrapping layout
  route.ts             → always the HTTP handler
  middleware.ts         → always the request interceptor
  error.ts             → always the error boundary
  not-found.ts         → always the 404 page
modules/
  &lt;feature&gt;/
    actions/           → mutations, one file per function
    queries/           → reads, one file per function
    components/        → feature-owned UI
    utils/             → pure helpers
    types.ts           → shared type definitions</code-block>
    <p>Every file has one job. An AI agent looking for "the function that creates a post" searches <code>modules/posts/actions/</code>, not a 500-line utils.ts or a re-exported barrel index. One grep, one result.</p>

    <h3>4. One Function Per File</h3>
    <p>Server actions and queries follow a strict <strong>one exported function per file</strong> convention:</p>
    <code-block>modules/posts/actions/create-post.server.ts   → exports createPost()
modules/posts/actions/delete-post.server.ts   → exports deletePost()
modules/posts/queries/list-posts.server.ts    → exports listPosts()
modules/posts/queries/get-post.server.ts      → exports getPost()</code-block>
    <p>This is the single most AI-friendly decision in the architecture. When an LLM needs to modify <code>createPost</code>, it reads exactly one file. It doesn't need to understand the rest of the module. Context window usage is minimal. The blast radius of a change is visible from the filename.</p>

    <h3>5. No Build Step = What You See Is What Runs</h3>
    <p>Frameworks with build pipelines transform source code before it executes. The JSX you write becomes <code>React.createElement</code> calls. Your imports become webpack chunks. Your CSS modules get hashed classnames. An AI agent reading the source sees one thing, while the runtime does another.</p>
    <p>WebJs has <strong>no build step you run</strong>. The <code>.ts</code> file you see is the file that runs. <code>.ts</code> imports are stripped of types by the runtime's stripper (Node 24+'s built-in <code>module.stripTypeScriptTypes</code>, or <code>amaro</code> on Bun), which is whitespace replacement: every <code>(line, column)</code> in the source maps to the same position in the output, so stack traces stay byte-exact. The same transform runs server-side and on browser-bound requests. No intermediate representation, no generated code, no output directory. An AI agent can reason about what the code does by reading the file, because the file IS what runs. See <a href="/docs/no-build">No-Build Model</a> for the full pipeline.</p>

    <h3>6. Explicit Server Boundary</h3>
    <p>The <code>.server.ts</code> extension is a visible, greppable marker that says "this code runs only on the server." An AI agent never accidentally puts a database call in a component, because the naming convention prevents it. And the framework enforces it: <code>.server.ts</code> files are rewritten to RPC stubs for the browser.</p>
    <p>Compare with NextJs where <code>'use client'</code> / <code>'use server'</code> directives are easy to forget and their scope rules are subtle. The <code>.server.ts</code> convention is filename-level. You can't accidentally import server code without the filename literally telling you.</p>

    <h3>7. Typed RPC Without Schema</h3>
    <p>When an AI agent writes a server action:</p>
    <code-block>// modules/posts/actions/create-post.server.ts
export async function createPost(
  input: { title: string; body: string }
): Promise&lt;ActionResult&lt;PostFormatted&gt;&gt; { ... }</code-block>
    <p>The TypeScript signature IS the API contract. No separate schema file, no OpenAPI spec, no GraphQL SDL. The client component imports the function, TypeScript checks the types, and webjs's built-in serializer preserves them on the wire. An AI agent can:</p>
    <ol>
      <li>Read the function signature to understand the API.</li>
      <li>Modify the function and know every call site that breaks (via tsc).</li>
      <li>Add a new action by copying the pattern from an existing one.</li>
    </ol>
    <p>Zero indirection. Zero codegen. Zero schema drift.</p>

    <h3>8. JSDoc or TypeScript: Agent's Choice</h3>
    <p>Some AI agents work better with TypeScript, others prefer JSDoc. WebJs supports both equally. The type-checking story is identical either way, since the TS language server reads both. An agent can generate whichever format it's more fluent in.</p>

    <h3>9. Cross-Agent Config, One Source</h3>
    <p>The scaffold ships a single cross-agent source of truth rather than a per-tool rule duplicate for each agent:</p>
    <ul>
      <li><code>AGENTS.md</code>, read natively by Cursor, opencode, Antigravity, and the Copilot coding agent, opening with the WebJs brief: what differs from Next.js routing and Lit components</li>
      <li>A thin bridge for Claude Code, <code>CLAUDE.md</code>, which imports <code>AGENTS.md</code> (Cursor, opencode, Antigravity and the Copilot coding agent read <code>AGENTS.md</code> natively)</li>
    </ul>
    <p>That is the whole agent doc set, deliberately short. An agent already knows Next.js routing and Lit components, so the brief spends its words only on what differs, and the tokens an agent would have spent reading a long rule file go to the app instead. Your team's own git and review process stays yours.</p>

    <p>For Claude Code the scaffold also wires a <code>PostToolUse</code> hook, <code>.claude/hooks/check-on-edit.sh</code>, that runs <code>webjs check --json</code> after each edit to an app source file and hands that file's violations back to the agent with their fixes, so a wrong Lit or Next.js habit is corrected in the same turn. For a TypeScript file it also runs <code>webjs typecheck</code> and hands back that file's type errors (a few seconds; a module the agent has not written yet is not reported), so the first full typecheck finds a clean draft. It is silent when the file is clean, <code>WEBJS_NO_TYPECHECK_ON_EDIT=1</code> skips the type errors, and <code>WEBJS_NO_CHECK_ON_EDIT=1</code> turns it off.</p>

    <h3>10. Hooks Instead of Rules</h3>
    <p>For Claude Code the scaffold enforces what a rule file would otherwise ask for: a branch guard refuses an edit on <code>main</code>, a tests hook warns when source is committed without a test, and a stop hook asks for a commit before a turn ends with uncommitted work. A hook fires when it matters and costs nothing otherwise.</p>

    <h3>11. Automatic Tests and Docs</h3>
    <p>In a WebJs project, the user never has to say "also write tests" or "also update the docs." Agents do this automatically with every code change. The scaffold's tests hook backs it, and <code>webjs test</code> and <code>webjs check</code> verify it. For an agent lint-and-fix loop, run <code>webjs check --json</code>: the structured output lets the agent parse violations, fix them, and re-run until the report is clean (the same correctness data the MCP <code>check</code> tool returns).</p>

    <h3>12. Scaffold + Persistence Defaults</h3>
    <p>When a layman user says "create a todo app with webjs", the agent should produce a real full-stack app with a real database, not a JSON-file simulation. WebJs enforces this with three guardrails:</p>
    <ul>
      <li><strong>Exactly two scaffolds.</strong> <code>webjs create &lt;name&gt;</code> (full-stack default) and <code>--template api</code>. The CLI rejects any other <code>--template</code> value, so an agent can't hallucinate <code>--template todo</code> or <code>--template blog</code>. Auth is a feature you add (see the <a href="/docs/authentication">authentication docs</a>), not a separate template.</li>
      <li><strong>Drizzle + SQLite wired up by default.</strong> Every scaffold ships <code>db/schema.server.ts</code> (plain Drizzle), <code>db/connection.server.ts</code> (exports <code>db</code>), the <code>webjs.dev.before</code> + <code>webjs.start.before</code> steps running <code>webjs db migrate</code> (idempotent, so a <code>db:generate</code>'d migration applies on the next boot), and <code>npm run db:generate</code> / <code>db:migrate</code> / <code>db:studio</code> / <code>db:seed</code>. The agent edits the schema, runs <code>db:generate</code>, and <code>npm run dev</code> applies it, and won't accidentally fall back to JSON files for persistence.</li>
      <li><strong>Persist with Drizzle, not JSON files.</strong> A <code>data/todos.json</code> or <code>db.json</code> used as a database resets on reload and cannot scale. This is a project convention in <code>AGENTS.md</code>, so an agent reading it takes the database path.</li>
    </ul>
    <p><strong>Picking the right scaffold from the user's prompt:</strong></p>
    <code-block>User asks for…                                          Scaffold
─────────────────────────────────────────────────────────────────────
Todo app, blog, notes, dashboard, marketplace, social   default
App with auth / login / signup / accounts (SaaS)        default
HTTP/JSON API only, no UI                                --template api</code-block>
    <p>The scaffold is REFERENCE, not the final product. The agent's job after scaffolding is to replace the example <code>app/page.ts</code> ("Hello from …"), the example <code>User</code> model in <code>db/schema.server.ts</code>, and the example components with the app the user actually requested. The infrastructure (Drizzle wiring, test config, agent rules, route conventions) stays.</p>

    <p><strong>When the scaffolded <code>AGENTS.md</code> doesn't cover what you need</strong> (an obscure directive, an auth-provider recipe, deployment specifics, edge cases), the full hosted documentation is at <a href="/docs">the rest of these docs</a>. Every API, every recipe, every example lives there. Reach for it before guessing or hand-rolling.</p>

    <h2>What an AI Agent Can Do with webjs</h2>
    <p>Given a WebJs app + AGENTS.md, an AI coding assistant can:</p>
    <ul>
      <li><strong>Add a new page</strong>: create <code>app/about/page.ts</code>, export a function returning <code>html\`...\`</code>. Done. No router config.</li>
      <li><strong>Add a new API endpoint</strong>: create <code>app/api/users/route.ts</code>, export <code>GET</code> / <code>POST</code>. Done. No Express boilerplate.</li>
      <li><strong>Add a server action</strong>: create <code>modules/foo/actions/bar.server.ts</code>, export an async function. Import it from a component. Done. No tRPC setup.</li>
      <li><strong>Add a component</strong>: create a file, extend the <code>WebComponent({ ... })</code> factory with your property shape, implement <code>render()</code>, call <code>ClassName.register('tag-name')</code>. Done. No framework CLI scaffolding.</li>
      <li><strong>Add authentication</strong>: wire <code>createAuth()</code> from <code>@webjsdev/server</code>, or copy the gallery's auth demo (<code>gallery/app/features/auth/</code> and <code>gallery/modules/auth/</code>), which has a login, a signed session and a protected route.</li>
      <li><strong>Add a database model</strong>: edit <code>db/schema.server.ts</code>, run <code>webjs db generate</code> then <code>webjs db migrate</code>. Create queries + actions in a new module. Done.</li>
      <li><strong>Debug an issue</strong>: read the failing route file, trace imports, find the action, check types. No build-artifact archaeology.</li>
    </ul>

    <h2>Design Principles for AI-Friendly Code</h2>
    <p>If you're writing a WebJs app that AI agents will work on (and they will), follow these principles:</p>
    <ol>
      <li><strong>One function per file</strong> for actions and queries. Name the file after the function.</li>
      <li><strong>Type everything.</strong> Function signatures are the API contract. An untyped function is invisible to the agent's reasoning.</li>
      <li><strong>Keep routes thin.</strong> Business logic goes in modules. Routes are 5-line adapters that call a module function and return a Response.</li>
      <li><strong>Use the modules convention.</strong> <code>modules/feature/{actions,queries,components,utils,types.ts}</code>. An agent knows where to look and where to put things.</li>
      <li><strong>Keep AGENTS.md up to date.</strong> When you add a new convention, document it. When you add a new module, add a recipe. The agent reads this file on every session.</li>
      <li><strong>No barrel files.</strong> Import from the specific file, not from an <code>index.ts</code> that re-exports. Agents work with individual files, not module graphs.</li>
      <li><strong>No magic.</strong> If something happens implicitly (auto-registration, runtime transforms, generated code), document it explicitly in AGENTS.md. What the agent can't see, it can't reason about.</li>
    </ol>

    <h2>Comparison: AI-Friendliness</h2>
    <blockquote>This is an opinionated comparison. Every framework has trade-offs.</blockquote>
    <code-block>                       webjs        NextJs       Express
──────────────────────────────────────────────────────────
AGENTS.md contract     ✅ built-in   ❌ none       ❌ none
MCP server (read-only) ✅ webjs mcp  ❌ none       ❌ none
Cross-agent config     ✅ AGENTS.md  ❌ none       ❌ none
Auto tests + docs      ✅ enforced   ❌ manual     ❌ manual
Branch guardrails      ✅ hooks      ❌ none       ❌ none
Convention validator   ✅ webjs check ❌ none      ❌ none
File = function        ✅ one/file   ⚠️ varies     ❌ free-form
No build transforms    ✅ none       ❌ SWC/webpack ✅ none
Explicit server bound. ✅ .server.ts ⚠️ 'use srv'  n/a
Typed RPC (no schema)  ✅ rich types ⚠️ Flight     ❌ manual
Autonomous mode        ✅ defaults   ❌ n/a        ❌ n/a</code-block>

    <h2>The AGENTS.md File</h2>
    <p>Here is the outline of the <code>AGENTS.md</code> a new app gets:</p>
    <code-block>## The WebJs brief
## Build a full-stack app (default template)   (or the api template's checklist)
### Commands
## Types and data (all templates)</code-block>
    <p>You can read the <a href="https://github.com/webjsdev/webjs/blob/main/packages/cli/templates/AGENTS.md">template on GitHub</a>.</p>
  `;
}
