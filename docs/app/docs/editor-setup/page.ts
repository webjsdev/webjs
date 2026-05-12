import { html } from '@webjskit/core';

export const metadata = { title: 'Editor Setup — webjs' };

export default function EditorSetup() {
  return html`
    <h1>Editor Setup — Neovim &amp; VS Code</h1>
    <p>webjs ships a TypeScript overlay (<code>packages/core/index.d.ts</code> and <code>packages/core/src/component.d.ts</code>) so any editor that speaks the TypeScript Language Server (<code>tsserver</code>) gets autocomplete, hover documentation, and type-checking for the framework APIs with zero build step.</p>

    <p><strong>Neither <code>ts-lit-plugin</code> nor <code>@webjskit/ts-plugin</code> is required for the framework to run</strong> — both are editor-only enhancements. They are also a pair: <code>@webjskit/ts-plugin</code> <em>wraps</em> <code>ts-lit-plugin</code> (loads it from <code>node_modules</code>, proxies its diagnostics, layers webjs-aware behaviour on top). Install both, or neither — installing just one is rarely what you want. The scaffold installs both as devDependencies and lists both in <code>tsconfig.json</code> automatically.</p>

    <p>This page covers three layers of intelligence:</p>
    <ol>
      <li><strong>Type-safe component internals</strong> — <code>this.student: Student</code> inside the class. Works out of the box once <code>tsconfig.json</code> is set up.</li>
      <li><strong>Template-literal intelligence</strong> — type-checking and go-to-definition for <code>&lt;student-card student=\${...}&gt;</code> inside <code>html\`…\`</code> tags. Requires <code>ts-lit-plugin</code>.</li>
      <li><strong>webjs-aware intelligence</strong> — silences <code>ts-lit-plugin</code>'s "unknown tag/attribute" diagnostics for components registered via <code>Class.register('tag')</code>, offers attribute auto-complete sourced from <code>static properties</code>, and type-checks attribute-value interpolations (<code>&lt;auth-forms mode=\${expr}&gt;</code>) against each prop's <code>declare</code> annotation. Requires <code>@webjskit/ts-plugin</code> ≥ 0.3.0.</li>
    </ol>
    <p>There's also an optional standard-TypeScript convention for typing <code>document.querySelector('student-card')</code> — briefly covered at the end.</p>

    <h2>Prerequisites</h2>
    <ul>
      <li><strong>Node 20.6+</strong> for the esbuild loader hook the dev server registers at startup.</li>
      <li><strong>TypeScript 5.6+</strong> as a dev dependency (<code>npm i -D typescript</code>). The framework itself has no TS dependency; you only need it for editor intellisense.</li>
      <li>A <code>tsconfig.json</code> in your app. The scaffold generates one.</li>
    </ul>

    <h2><code>tsconfig.json</code> — baseline</h2>
    <p>The scaffold writes this file. Manual apps should match it:</p>
    <pre>{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "plugins": [
      { "name": "ts-lit-plugin", "strict": true },
      { "name": "@webjskit/ts-plugin" }
    ]
  }
}</pre>
    <p>Key points:</p>
    <ul>
      <li><code>moduleResolution: "NodeNext"</code> — required for the framework's <code>exports</code> map to resolve correctly.</li>
      <li><code>allowImportingTsExtensions: true</code> — lets you write <code>import { x } from './foo.ts'</code>, matching how webjs serves them.</li>
      <li><code>noEmit: true</code> — TypeScript type-checks only; webjs transforms <code>.ts</code> via esbuild at import / request time.</li>
      <li><code>plugins</code> — order matters. <code>ts-lit-plugin</code> runs first; <code>@webjskit/ts-plugin</code> wraps it so it can suppress lit-plugin's webjs-incompatible diagnostics and add attribute completions on top.</li>
    </ul>

    <h2>Layer 1 — Component internals (works everywhere)</h2>
    <p>Type each property with the two-line pattern. The runtime half goes in <code>static properties</code>; the compile-time half goes in a <code>declare</code> field that types the auto-generated accessor:</p>
    <pre>import { WebComponent, html } from '@webjskit/core';
import type { Student } from './student-types.ts';

export class StudentCard extends WebComponent {
  static properties = { student: { type: Object } };
  declare student: Student;
  render() {
    return html\`&lt;p&gt;\${this.student.name}&lt;/p&gt;\`;
  }
}
StudentCard.register('student-card');</pre>

    <p>Inside the class, <code>this.student</code> is a real <code>Student</code> — hover, autocomplete, type-checking all work. <code>this.setState</code>, <code>this.state</code>, <code>this.requestUpdate</code>, and all lifecycle hooks are typed by the framework's <code>.d.ts</code> overlay.</p>

    <h3>Why <code>declare</code> is required</h3>
    <p>The framework installs the reactive getter/setter on <code>this</code> via <code>Object.defineProperty</code> inside the constructor. Without <code>declare</code>, TypeScript emits a <code>student = undefined</code> class-field initializer that runs <em>after</em> <code>super()</code> and overwrites that accessor. <code>declare</code> tells TS "type this field for me, but don't emit any runtime assignment."</p>

    <h2>Layer 2 — <code>ts-lit-plugin</code> for <code>html\`…\`</code> intelligence</h2>
    <p>webjs's <code>html\`…\`</code> is Lit-compatible. Installing <a href="https://www.npmjs.com/package/ts-lit-plugin" target="_blank">ts-lit-plugin</a> unlocks:</p>
    <ul>
      <li><strong>Type-checking</strong> attribute / property values — <code>&lt;student-card student=\${42}&gt;</code> is flagged because <code>42</code> isn't a <code>Student</code>.</li>
      <li><strong>Unknown-tag warnings</strong> when you typo a built-in or Lit-style element name.</li>
      <li><strong>Go-to-definition</strong> for tags it knows about (Lit's <code>@customElement</code> decorator + <code>HTMLElementTagNameMap</code> augmentations).</li>
      <li><strong>Rename-symbol</strong> across template usages.</li>
    </ul>
    <p><strong>Limitation for webjs:</strong> ts-lit-plugin doesn't recognise webjs components — they register at runtime via <code>Class.register('tag')</code>, not via decorator or static map — so it flags every webjs element as "Unknown tag" and offers no attribute completions for them. <code>@webjskit/ts-plugin</code> fills that gap (Layer 3 below). Install ts-lit-plugin first; the webjs plugin sits on top of it.</p>

    <h3>Install</h3>
    <pre>npm i -D typescript ts-lit-plugin</pre>
    <p>Add the plugin to <code>tsconfig.json</code> (already shown in the baseline above):</p>
    <pre>{
  "compilerOptions": {
    "plugins": [{ "name": "ts-lit-plugin", "strict": true }]
  }
}</pre>

    <h3>VS Code</h3>
    <p>After installing, tell VS Code to use your workspace's TypeScript (so it picks up the plugin) — open any <code>.ts</code> file and:</p>
    <pre>Cmd/Ctrl+Shift+P  →  "TypeScript: Select TypeScript Version"  →  "Use Workspace Version"</pre>
    <p>Reload the window. Plugin is now active.</p>

    <h3>Neovim</h3>
    <p>Any LSP client that speaks tsserver will load the plugin automatically — the key is pointing the LSP at your <strong>workspace's</strong> <code>node_modules/typescript</code> so the plugin in <code>tsconfig.json</code> resolves.</p>

    <h4><code>nvim-lspconfig</code></h4>
    <pre>-- lua/plugins/tsserver.lua
return {
  'neovim/nvim-lspconfig',
  config = function()
    require('lspconfig').ts_ls.setup({
      init_options = {
        -- No extra config needed — tsserver picks up tsconfig.json's plugins
        -- as long as typescript is installed in the workspace.
      },
    })
  end,
}</pre>

    <h4><code>typescript-tools.nvim</code> (recommended for large projects)</h4>
    <p>Faster for large projects. Plugin-loading works the same way:</p>
    <pre>return {
  'pmizio/typescript-tools.nvim',
  dependencies = { 'nvim-lua/plenary.nvim', 'neovim/nvim-lspconfig' },
  opts = {},
}</pre>

    <h3>Verify plugin loaded</h3>
    <p>In Neovim: <code>:LspInfo</code> should list <code>ts_ls</code> (or <code>typescript-tools</code>) attached to your <code>.ts</code> file. In VS Code: bottom-right status bar shows the TypeScript version — click it and confirm it matches your workspace version.</p>
    <p>Then write a deliberately wrong attribute:</p>
    <pre>html\`&lt;student-card student=\${42}&gt;&lt;/student-card&gt;\`
//                                    ^^^ squiggle: \`number\` is not assignable to \`Student\`.</pre>

    <h2>Layer 3 — <code>@webjskit/ts-plugin</code> for webjs-aware intelligence</h2>
    <p>The webjs plugin proxies <code>ts-lit-plugin</code>'s output and contributes webjs-specific knowledge it can't statically infer:</p>
    <ul>
      <li><strong>Diagnostic suppression</strong> — drops lit-plugin's "Unknown tag" / "Unknown attribute" reports for any element registered via <code>Class.register('tag-name')</code> or <code>customElements.define('tag-name', Class)</code>.</li>
      <li><strong>Attribute auto-complete</strong> — inside <code>&lt;your-tag |&gt;</code>, completes the keys of the component's <code>static properties = { … }</code> map.</li>
      <li><strong>Attribute-value type-check</strong> — <code>&lt;your-tag mode=\${expr}&gt;</code> assignability-checks <code>typeof expr</code> against the prop's <code>declare</code> type. Works for primitives, type aliases, string-literal unions (<code>'login' | 'signup'</code>), interfaces, and anything else the TypeScript checker understands. Static (non-interpolated) attribute text like <code>mode="login"</code> is deliberately not checked — at runtime it's just template text.</li>
      <li><strong>Go-to-definition</strong> — <code>gd</code> / F12 / Ctrl+Click on a webjs tag jumps to its class declaration. Same for class names inside <code>html\`class="…"\`</code> attributes (jumps to the matching <code>css\`…\`</code> rule).</li>
    </ul>

    <h3>Import-graph reachability</h3>
    <p>The first two are gated by reachability through the current file's import graph. A tag is "known here" only if the file that registers it is imported (directly or transitively) by the file you're editing — otherwise the runtime would fail too, and the squiggle / missing completion is the correct prompt to add the import:</p>
    <table>
      <thead><tr><th>Tag state</th><th>Diagnostic</th><th>Completions</th></tr></thead>
      <tbody>
        <tr><td>Registered &amp; reachable</td><td>suppressed</td><td>offered</td></tr>
        <tr><td>Registered somewhere but not imported here</td><td><strong>kept</strong></td><td>none</td></tr>
        <tr><td>Not registered anywhere in the program</td><td>(lit-plugin's natural warning)</td><td>none</td></tr>
      </tbody>
    </table>

    <h3>Install</h3>
    <pre>npm i -D @webjskit/ts-plugin</pre>
    <p>The baseline <code>tsconfig.json</code> at the top of this page already lists both plugins. Plugin order matters — <code>ts-lit-plugin</code> first, <code>@webjskit/ts-plugin</code> second — because the webjs plugin wraps the lit-plugin to filter its diagnostics and augment its completions.</p>

    <h3>After upgrading the plugin</h3>
    <p>tsserver loads plugins on startup, so an editor restart is required to pick up new plugin code. In Neovim: <code>:LspRestart</code>. In VS Code: <code>Cmd/Ctrl+Shift+P</code> → "TypeScript: Restart TS Server".</p>

    <h2>Optional: typed DOM queries</h2>
    <p>If you want <code>document.querySelector('student-card')</code> to return <code>StudentCard | null</code> instead of <code>Element | null</code>, augment TypeScript's built-in <code>HTMLElementTagNameMap</code> inside your component file. This is a <a href="https://developer.mozilla.org/docs/Web/API/Document/querySelector" target="_blank">standard TypeScript pattern</a> — the same one <a href="https://lit.dev" target="_blank">Lit</a> uses. With <code>@webjskit/ts-plugin</code> active you no longer need this for tag/attribute intelligence inside <code>html\`…\`</code> templates; the augmentation is purely about typing DOM-query call sites.</p>

    <h2>Editor actions — quick reference</h2>
    <table>
      <thead>
        <tr><th>Action</th><th>VS Code</th><th>Neovim</th></tr>
      </thead>
      <tbody>
        <tr><td>Hover type info</td><td>hover cursor</td><td><code>K</code></td></tr>
        <tr><td>Go to definition</td><td>F12 or Ctrl+Click</td><td><code>gd</code></td></tr>
        <tr><td>Find references</td><td>Shift+F12</td><td><code>gr</code></td></tr>
        <tr><td>Rename symbol</td><td>F2</td><td><code>&lt;leader&gt;rn</code></td></tr>
        <tr><td>Code actions</td><td>Ctrl+.</td><td><code>&lt;leader&gt;ca</code></td></tr>
      </tbody>
    </table>

    <h2>Verification walkthrough</h2>
    <p>After setup, open a component file and check each layer:</p>
    <ol>
      <li><strong>Layer 1</strong> — hover <code>this.student</code> inside <code>render()</code>: expect <code>(property) student: Student</code>. Type <code>this.</code> inside the class: expect autocomplete for <code>student</code>, <code>setState</code>, <code>requestUpdate</code>, <code>state</code>, <code>render</code>, etc.</li>
      <li><strong>Layer 2</strong> — type <code>&lt;student-card student=\${42}&gt;</code> in an <code>html\`…\`</code> template: ts-lit-plugin flags it because <code>42</code> isn't <code>Student</code>.</li>
      <li><strong>Layer 3</strong> — write <code>&lt;student-card&gt;</code> with the side-effect import in place: no "Unknown tag" squiggle. Position cursor inside <code>&lt;student-card |&gt;</code>: completions list includes <code>student</code> (and any other key of <code>static properties</code>). Type <code>&lt;student-card student=\${42}&gt;</code>: a webjs diagnostic flags <code>'number' is not assignable to attribute 'student' of type 'Student'</code>. Then comment out the <code>import './student-card.ts'</code> at the top of the file: the squiggle returns, completions disappear, and the value-check goes silent (the missing import is now the surfaced problem). The plugin requires reachability so a missing import always surfaces.</li>
    </ol>
    <p>If any layer misbehaves, the most common cause is tsserver using a different TypeScript install than your workspace's. In Neovim run <code>:LspInfo</code>; in VS Code click the TypeScript version in the status bar. Both should point inside your project's <code>node_modules/</code>.</p>

    <h2>See also</h2>
    <ul>
      <li><a href="/docs/components">Components</a> — the full API surface.</li>
      <li><a href="/docs/typescript">TypeScript</a> — type safety end-to-end.</li>
      <li><a href="/docs/conventions">Conventions</a> — project layout + AI-agent workflow.</li>
    </ul>
  `;
}
