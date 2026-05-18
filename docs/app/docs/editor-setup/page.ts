import { html } from '@webjskit/core';

export const metadata = { title: 'Editor Setup | webjs' };

export default function EditorSetup() {
  return html`
    <h1>Editor Setup for Neovim &amp; VS Code</h1>
    <p>webjs ships a TypeScript overlay (<code>packages/core/index.d.ts</code> and <code>packages/core/src/component.d.ts</code>) so any editor that speaks the TypeScript Language Server (<code>tsserver</code>) gets autocomplete, hover documentation, and type-checking for the framework APIs with zero build step.</p>

    <p><strong><code>@webjskit/ts-plugin</code> is editor-only, not required for the framework to run.</strong> As of <code>@webjskit/ts-plugin@0.4.0</code> it bundles <code>ts-lit-plugin</code> internally (loads it programmatically inside its <code>create(info)</code> factory), so users install one plugin and list one plugin in <code>tsconfig.json</code>. The scaffold wires this up automatically.</p>

    <p>This page covers three layers of intelligence. The first works out of the box. The last two arrive together once <code>@webjskit/ts-plugin</code> is installed:</p>
    <ol>
      <li><strong>Type-safe component internals</strong>: <code>this.student: Student</code> inside the class. Works out of the box once <code>tsconfig.json</code> is set up.</li>
      <li><strong>Template-literal intelligence</strong>: type-checking and go-to-definition for <code>&lt;student-card student=\${...}&gt;</code> inside <code>html\`…\`</code> tags. Provided by the bundled <code>ts-lit-plugin</code>.</li>
      <li><strong>webjs-aware intelligence</strong>: silences <code>ts-lit-plugin</code>'s "unknown tag/attribute" diagnostics for components registered via <code>Class.register('tag')</code>, offers attribute auto-complete sourced from <code>static properties</code>, and type-checks attribute-value interpolations (<code>&lt;auth-forms mode=\${expr}&gt;</code>) against each prop's <code>declare</code> annotation.</li>
    </ol>
    <p>There's also an optional standard-TypeScript convention for typing <code>document.querySelector('student-card')</code>, briefly covered at the end.</p>

    <h2>Prerequisites</h2>
    <ul>
      <li><strong>Node 24+</strong> for the built-in TypeScript type-stripping (<code>process.features.typescript === 'strip'</code>). The framework requires it via <code>engines</code>.</li>
      <li><strong>TypeScript 5.8+</strong> as a dev dependency (<code>npm i -D typescript</code>). Needed for the <code>erasableSyntaxOnly</code> compiler option that catches non-erasable syntax in the editor.</li>
      <li>A <code>tsconfig.json</code> in your app. The scaffold generates one.</li>
    </ul>

    <h2><code>tsconfig.json</code>: baseline</h2>
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
    "erasableSyntaxOnly": true,
    "plugins": [
      { "name": "@webjskit/ts-plugin" }
    ]
  }
}</pre>
    <p>Key points:</p>
    <ul>
      <li><code>moduleResolution: "NodeNext"</code>: required for the framework's <code>exports</code> map to resolve correctly.</li>
      <li><code>allowImportingTsExtensions: true</code>: lets you write <code>import { x } from './foo.ts'</code>, matching how webjs serves them.</li>
      <li><code>noEmit: true</code>: TypeScript type-checks only. webjs strips types via Node's built-in stripper at import / request time.</li>
      <li><code>erasableSyntaxOnly: true</code>: rejects non-erasable TypeScript (<code>enum</code>, <code>namespace</code> with values, parameter properties, legacy decorators). Required because Node's stripper only supports erasable TS. See the <a href="/docs/typescript">TypeScript</a> page for the erasable equivalents.</li>
      <li><code>plugins</code>: one entry. <code>@webjskit/ts-plugin@0.4.0+</code> bundles <code>ts-lit-plugin</code> internally and loads it programmatically, so no separate <code>ts-lit-plugin</code> entry is needed.</li>
    </ul>

    <h2>Layer 1: component internals (works everywhere)</h2>
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

    <p>Inside the class, <code>this.student</code> is a real <code>Student</code>. Hover, autocomplete, and type-checking all work. <code>this.setState</code>, <code>this.state</code>, <code>this.requestUpdate</code>, and all lifecycle hooks are typed by the framework's <code>.d.ts</code> overlay.</p>

    <h3>Why <code>declare</code> is required</h3>
    <p>The framework installs the reactive getter/setter on <code>this</code> via <code>Object.defineProperty</code> inside the constructor. Without <code>declare</code>, TypeScript emits a <code>student = undefined</code> class-field initializer that runs <em>after</em> <code>super()</code> and overwrites that accessor. <code>declare</code> tells TS "type this field for me, but don't emit any runtime assignment."</p>

    <h2>Layer 2: template-literal intelligence (bundled)</h2>
    <p><code>@webjskit/ts-plugin</code> bundles <a href="https://www.npmjs.com/package/ts-lit-plugin" target="_blank">ts-lit-plugin</a> as a runtime dependency and loads it programmatically inside its factory, so once you install <code>@webjskit/ts-plugin</code> you also get:</p>
    <ul>
      <li><strong>Type-checking</strong> attribute / property values, for instance <code>&lt;student-card student=\${42}&gt;</code> is flagged because <code>42</code> isn't a <code>Student</code>.</li>
      <li><strong>Unknown-tag warnings</strong> when you typo a built-in or decorator-registered element name.</li>
      <li><strong>Go-to-definition</strong> for tags ts-lit-plugin already knows about (decorator-registered elements + <code>HTMLElementTagNameMap</code> augmentations).</li>
      <li><strong>Rename-symbol</strong> across template usages.</li>
    </ul>
    <p>By itself, <code>ts-lit-plugin</code> doesn't recognise webjs components. They register at runtime via <code>Class.register('tag')</code>, not via decorator or static map, so it would flag every webjs element as "Unknown tag". Layer 3 (next section) silences those false positives and adds webjs-specific completions. Because <code>@webjskit/ts-plugin</code> owns the bundling, both layers ship together, and you don't install or configure <code>ts-lit-plugin</code> directly.</p>

    <h3>Install</h3>
    <pre>npm i -D typescript @webjskit/ts-plugin</pre>
    <p><code>ts-lit-plugin</code> arrives transitively. Make sure the plugin is listed in <code>tsconfig.json</code> (already in the baseline above):</p>
    <pre>{
  "compilerOptions": {
    "plugins": [{ "name": "@webjskit/ts-plugin" }]
  }
}</pre>

    <h3>VS Code</h3>
    <p>After installing, tell VS Code to use your workspace's TypeScript (so it picks up the plugin). Open any <code>.ts</code> file and:</p>
    <pre>Cmd/Ctrl+Shift+P  →  "TypeScript: Select TypeScript Version"  →  "Use Workspace Version"</pre>
    <p>Reload the window. Plugin is now active.</p>

    <h3>Neovim</h3>
    <p>Any LSP client that speaks tsserver will load the plugin automatically. The key is pointing the LSP at your <strong>workspace's</strong> <code>node_modules/typescript</code> so the plugin in <code>tsconfig.json</code> resolves.</p>

    <h4><code>nvim-lspconfig</code></h4>
    <pre>-- lua/plugins/tsserver.lua
return {
  'neovim/nvim-lspconfig',
  config = function()
    require('lspconfig').ts_ls.setup({
      init_options = {
        -- No extra config needed: tsserver picks up tsconfig.json's plugins
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
    <p>In Neovim: <code>:LspInfo</code> should list <code>ts_ls</code> (or <code>typescript-tools</code>) attached to your <code>.ts</code> file. In VS Code: bottom-right status bar shows the TypeScript version. Click it and confirm it matches your workspace version.</p>
    <p>Then write a deliberately wrong attribute:</p>
    <pre>html\`&lt;student-card student=\${42}&gt;&lt;/student-card&gt;\`
//                                    ^^^ squiggle: \`number\` is not assignable to \`Student\`.</pre>

    <h2>Layer 3: <code>@webjskit/ts-plugin</code> for webjs-aware intelligence</h2>
    <p>The webjs plugin proxies <code>ts-lit-plugin</code>'s output and contributes webjs-specific knowledge it can't statically infer:</p>
    <ul>
      <li><strong>Diagnostic suppression</strong>: drops lit-plugin's "Unknown tag" / "Unknown attribute" reports for any element registered via <code>Class.register('tag-name')</code> or <code>customElements.define('tag-name', Class)</code>.</li>
      <li><strong>Attribute auto-complete</strong>: inside <code>&lt;your-tag |&gt;</code>, completes the keys of the component's <code>static properties = { … }</code> map.</li>
      <li><strong>Attribute-value type-check</strong>: <code>&lt;your-tag mode=\${expr}&gt;</code> assignability-checks <code>typeof expr</code> against the prop's <code>declare</code> type. Works for primitives, type aliases, string-literal unions (<code>'login' | 'signup'</code>), interfaces, and anything else the TypeScript checker understands. Static (non-interpolated) attribute text like <code>mode="login"</code> is deliberately not checked, since at runtime it's just template text.</li>
      <li><strong>Go-to-definition</strong>: <code>gd</code> / F12 / Ctrl+Click on a webjs tag jumps to its class declaration. Same for class names inside <code>html\`class="…"\`</code> attributes (jumps to the matching <code>css\`…\`</code> rule).</li>
    </ul>

    <h3>Import-graph reachability</h3>
    <p>The first two are gated by reachability through the current file's import graph. A tag is "known here" only if the file that registers it is imported (directly or transitively) by the file you're editing. Otherwise the runtime would fail too, and the squiggle / missing completion is the correct prompt to add the import:</p>
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
    <p>The baseline <code>tsconfig.json</code> at the top of this page already lists this single plugin. From <code>0.4.0</code> onward there's no separate <code>ts-lit-plugin</code> entry. It's bundled as a runtime dependency of <code>@webjskit/ts-plugin</code> and loaded programmatically.</p>

    <p><strong>Upgrading from a pre-0.4.0 setup?</strong> Remove <code>ts-lit-plugin</code> from your <code>devDependencies</code> and from the <code>plugins</code> array in <code>tsconfig.json</code>, leaving only <code>{ "name": "@webjskit/ts-plugin" }</code>. Run <code>npm install</code>, and <code>ts-lit-plugin</code> will reappear in <code>node_modules</code> as a transitive dep.</p>

    <h3>After upgrading the plugin</h3>
    <p>tsserver loads plugins on startup, so an editor restart is required to pick up new plugin code. In Neovim: <code>:LspRestart</code>. In VS Code: <code>Cmd/Ctrl+Shift+P</code> → "TypeScript: Restart TS Server".</p>

    <h2>Optional: typed DOM queries</h2>
    <p>If you want <code>document.querySelector('student-card')</code> to return <code>StudentCard | null</code> instead of <code>Element | null</code>, augment TypeScript's built-in <code>HTMLElementTagNameMap</code> inside your component file. This is a <a href="https://developer.mozilla.org/docs/Web/API/Document/querySelector" target="_blank">standard TypeScript pattern</a>. With <code>@webjskit/ts-plugin</code> active you no longer need this for tag/attribute intelligence inside <code>html\`…\`</code> templates. The augmentation is purely about typing DOM-query call sites.</p>

    <h2>Editor actions: quick reference</h2>
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
      <li><strong>Layer 1</strong>: hover <code>this.student</code> inside <code>render()</code> and expect <code>(property) student: Student</code>. Type <code>this.</code> inside the class and expect autocomplete for <code>student</code>, <code>setState</code>, <code>requestUpdate</code>, <code>state</code>, <code>render</code>, etc.</li>
      <li><strong>Layer 2</strong>: type <code>&lt;student-card student=\${42}&gt;</code> in an <code>html\`…\`</code> template, and ts-lit-plugin flags it because <code>42</code> isn't <code>Student</code>.</li>
      <li><strong>Layer 3</strong>: write <code>&lt;student-card&gt;</code> with the side-effect import in place and you'll see no "Unknown tag" squiggle. Position cursor inside <code>&lt;student-card |&gt;</code> and the completions list includes <code>student</code> (and any other key of <code>static properties</code>). Type <code>&lt;student-card student=\${42}&gt;</code> and a webjs diagnostic flags <code>'number' is not assignable to attribute 'student' of type 'Student'</code>. Then comment out the <code>import './student-card.ts'</code> at the top of the file. The squiggle returns, completions disappear, and the value-check goes silent (the missing import is now the surfaced problem). The plugin requires reachability so a missing import always surfaces.</li>
    </ol>
    <p>If any layer misbehaves, the most common cause is tsserver using a different TypeScript install than your workspace's. In Neovim run <code>:LspInfo</code>; in VS Code click the TypeScript version in the status bar. Both should point inside your project's <code>node_modules/</code>.</p>

    <h2>See also</h2>
    <ul>
      <li><a href="/docs/components">Components</a>: the full API surface.</li>
      <li><a href="/docs/typescript">TypeScript</a>: type safety end-to-end.</li>
      <li><a href="/docs/conventions">Conventions</a>: project layout + AI-agent workflow.</li>
    </ul>
  `;
}
