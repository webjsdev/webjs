# @webjskit/ts-plugin

A TypeScript language-service plugin for webjs. Gives editors that speak
`tsserver` (VS Code, Neovim via `nvim-lspconfig` / `typescript-tools.nvim`,
Zed, WebStorm) three webjs-aware capabilities inside `` html`` `` tagged
templates:

1. **Go-to-definition** — `gd` / F12 / Ctrl+Click on `<my-counter>` jumps
   to the class declaration. Same for class names inside
   `html\`class="…"\`` attributes (jumps to the matching `` css`` `` rule).
2. **Diagnostic suppression** — drops `ts-lit-plugin`'s "Unknown tag" /
   "Unknown attribute" reports for elements that are reachable through
   the current file's import graph.
3. **Attribute auto-complete** — inside `<my-counter |>`, completes the
   keys of the component's `static properties = { … }` map.
4. **Attribute-value type-check** — `<my-counter count=${expr}>`
   assignability-checks `typeof expr` against the prop's `declare`
   annotation. Works for primitives, string-literal unions, interfaces,
   generics — anything the TypeScript checker understands. Static
   (non-interpolated) attribute text is deliberately not checked.

```ts
import './counter.ts';     // side-effect: Counter.register('my-counter')

render(html`
  <my-counter count=${3}></my-counter>
  //  ^ no "Unknown tag" squiggle; gd jumps to Counter
  //                   ^ attribute completions list "count"
`, el);
```

## Why this exists

`ts-lit-plugin` — the standard tsserver plugin for `` html`` `` intelligence —
recognises tag names through one of these static signals:

- `customElements.define('my-el', MyEl)` direct calls
- `@customElement('my-el')` decorators
- `declare global { interface HTMLElementTagNameMap { 'my-el': MyEl } }`
- `@customElement my-el` JSDoc

webjs components register at runtime with `Class.register('tag')` (a
plain method call, no decorator, no static map), which is indirection
ts-lit-plugin can't statically trace. Without help it red-squiggles
every webjs element as "Unknown tag" and offers no attribute completions.

This plugin closes the gap. It runs *alongside* `ts-lit-plugin` and
proxies its language-service output: it scans the program for
`Class.register('tag')` and `customElements.define('tag', Class)` calls,
then uses that map to (a) filter lit-plugin's diagnostics, (b) extend
its completions, and (c) provide its own go-to-definition.

## Install

In your webjs app:

```sh
npm i -D @webjskit/ts-plugin
```

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "ts-lit-plugin", "strict": true },
      { "name": "@webjskit/ts-plugin" }
    ]
  }
}
```

Plugin order matters — list `ts-lit-plugin` first so the webjs plugin
can wrap its output to suppress webjs-incompatible diagnostics and
augment its completions.

After install, point your editor at the **workspace's** TypeScript
(`:LspInfo` in Neovim, or the TypeScript version indicator in VS Code's
status bar). Tsserver only loads plugins on startup, so restart it
after installing or upgrading the plugin: `:LspRestart` in Neovim,
"TypeScript: Restart TS Server" in VS Code.

## Import-graph reachability

Diagnostic suppression and attribute completions are gated on whether
the file that registers the tag is reachable from the file you're
editing through `import` / `export` declarations (transitively).

| Tag state                                       | "Unknown tag" diagnostic  | Completions | Value type-check |
|-------------------------------------------------|---------------------------|-------------|------------------|
| Registered & reachable                          | suppressed                | offered     | runs             |
| Registered somewhere but not imported here      | **kept**                  | none        | skipped          |
| Not registered anywhere in the program          | (lit-plugin's natural)    | none        | skipped          |

A tag registered in some other file but not imported here would also
fail at runtime, so the squiggle is the correct prompt to add the
side-effect import. Go-to-definition is *not* gated on reachability —
you can still navigate to a class even from a file that doesn't import
it.

## What it recognises

A class counts as a webjs component when it appears in the program with
either of these registration calls referencing a locally-declared class:

```ts
class Counter extends WebComponent {
  static properties = { count: { type: Number } };
}
Counter.register('my-counter');                // method form
// or
customElements.define('my-counter', Counter);  // direct DOM API
```

The tag name must contain a hyphen (HTML spec). Both the registration
calls and the `static properties` keys are extracted by walking the
TypeScript AST. Per-file results are cached by `SourceFile.version`, so
edits incrementally invalidate one file at a time.

## License

MIT
