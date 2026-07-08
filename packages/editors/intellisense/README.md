# @webjsdev/intellisense

A **standalone** TypeScript language-service plugin for webjs (no Lit
dependency). Gives editors that speak `tsserver` (VS Code, Neovim via
`nvim-lspconfig` / `typescript-tools.nvim`, Zed, WebStorm) webjs-aware
intelligence inside `` html`` `` tagged templates, driven by its own
HTML-in-template parser:

1. **Go-to-definition**: F12 / Ctrl+Click on `<my-counter>` jumps to the
   component class; on an attribute / property / event name jumps to the
   class member; on a class name inside `class="…"` jumps to the matching
   `` css`` `` rule.
2. **Binding-aware completions**: reachable custom-element tag names after
   `<`, and attribute completions keyed by binding prefix: `.` offers
   property names, plain / `?` offer the hyphenated attribute names
   (`maxLength` → `max-length`), `@event` is permissive.
3. **Diagnostics**: assignability-checks an interpolated value against the
   prop's `declare` annotation (`<my-counter .count=${expr}>`), requires
   `@event` handlers to be callable, flags quoted `@`/`.`/`?` bindings
   (the hole is dropped at SSR), and flags expressionless `.prop` bindings.
4. **Hover**: a tag shows its component class; an attribute / property /
   event shows its declared type.

```ts
import './counter.ts';     // side-effect: Counter.register('my-counter')

render(html`
  <my-counter .count=${3}></my-counter>
  //  ^ F12 jumps to Counter; hover shows the class
  //          ^ completes property names; type-checks the value
`, el);
```

## Why this exists

WebJs components register at runtime with `Class.register('tag')` (a plain
method call, no decorator, no `HTMLElementTagNameMap`), which a generic
TypeScript setup cannot statically trace, so it offers no intelligence for
webjs tags. This plugin scans the program for `Class.register('tag')` and
`customElements.define('tag', Class)` calls, builds a registry of each
component's factory-declared reactive props (the `WebComponent({ ... })`
shape), parses the markup inside `` html`` ``
templates itself, and serves the features above. It used to wrap
`ts-lit-plugin`; as of `0.5.0` it is fully self-contained.

## Install

In your webjs app:

```sh
npm i -D @webjsdev/intellisense
```

Add to `tsconfig.json` (a single plugin entry):

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "@webjsdev/intellisense" }
    ]
  }
}
```

After install, point your editor at the **workspace's** TypeScript
(`:LspInfo` in Neovim, or the TypeScript version indicator in VS Code's
status bar). Tsserver only loads plugins on startup, so restart it after
installing or upgrading: `:LspRestart` in Neovim, "TypeScript: Restart TS
Server" in VS Code.

> **VS Code / Cursor / Windsurf users:** install the **`webjs`** extension
> instead (VS Marketplace / Open VSX). It bundles this plugin and registers
> it automatically (no `tsconfig.json` edit) plus ships template
> highlighting. This package is the path for Neovim / JetBrains and for
> wiring the plugin by hand.

## Import-graph reachability

Completions and diagnostics are gated on whether the file that registers a
tag is reachable from the file you're editing through `import` / `export`
declarations (transitively). A tag registered in some other file but not
imported here would also fail at runtime, so withholding the features is
the correct prompt to add the side-effect import. Go-to-definition is *not*
gated: you can still navigate to a class even from a file that doesn't
import it.

There is deliberately **no** blanket "unknown tag / attribute" diagnostic:
WebJs has no element type map, so flagging an unrecognised tag/attribute
would false-positive on legitimate third-party custom elements.

## What it recognises

A class counts as a webjs component when it appears in the program with
either registration call referencing a locally-declared class:

```ts
class Counter extends WebComponent({ count: Number }) {
}
Counter.register('my-counter');                // method form
// or
customElements.define('my-counter', Counter);  // direct DOM API
```

The tag name must contain a hyphen (HTML spec). The registration calls and
the reactive props from the `WebComponent({ ... })` factory shape are extracted by walking the TypeScript AST;
the template markup is parsed by `src/template/parse.js`. Per-file results
are cached by `SourceFile.version`, so edits incrementally invalidate one
file at a time.

## License

MIT
