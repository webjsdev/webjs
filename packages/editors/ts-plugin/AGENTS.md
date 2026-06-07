# AGENTS.md for @webjsdev/ts-plugin

A **tsserver plugin** that gives editors (VS Code, Neovim, JetBrains)
webjs-aware intelligence inside `` html`` `` tagged templates:
go-to-definition on custom-element tag names / attributes / CSS classes,
binding-aware completions, in-template diagnostics, and hover, all driven
by webjs's OWN HTML-in-template parser. It is **standalone** as of Phase 3
(#386): no `ts-lit-plugin` dependency, no Lit code. The `webjs` VS Code
extension bundles it; Neovim / JetBrains wire it via `tsconfig.json`.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjsdev/ts-plugin`.

## Role

The plugin owns webjs's in-template intelligence. It is **standalone** as of
Phase 3 (#386): it decorates the stock tsserver language service directly and
has no `ts-lit-plugin` dependency (no loader, no wrapping). The plugin:

1. Scans the program at boot for `Class.register('tag', …)` /
   `customElements.define('tag', Class)` registrations into a registry of
   per-member records (`{ propName, attrName, state }`, where `attrName` is
   the hyphenated form of `propName`).
2. For every `.ts` / `.js` file being edited, computes its **import
   graph** transitively. Only tags whose registering file is reachable
   from the current file count as "available". This gates every feature.
3. Parses the markup inside each `` html`` `` template into an AST
   (`src/template/parse.js`) with absolute source spans and binding-modifier
   classification (`@event` / `.property` / `?boolean` / plain).
4. **Go-to-definition** on a custom-element tag (→ class), an attribute /
   property / event name (→ the `declare` member or `static properties`
   key), and a CSS class inside `class="…"` (→ the `css\`\`` rule).
5. **Completions**: reachable custom tag names after `<` / `</`, and
   binding-aware attribute completions keyed by prefix (`.` → property
   names, plain / `?` → hyphenated attribute names; `@event` is permissive).
6. **Diagnostics**: incompatible-type bindings (plain / `.prop` / `@event`
   callable), unquoted `@`/`.`/`?` bindings (invariant 4, code 9002), and
   expressionless `.prop` bindings (code 9003). Deliberately NO blanket
   unknown-tag / unknown-attribute (webjs has no element type map, so it
   would false-positive on third-party customs).
7. **Hover**: a tag shows its class; an attribute / property / event shows
   its declared type.

## Module map

```
src/
  index.js            The language-service decorator: registry, reachability,
                      completions, diagnostics, definitions, hover.
  template/parse.js   The html`` HTML-in-template parser (length-preserving
                      ${} masking → node/attr AST with absolute spans).
test/plugin/
  ts-plugin.test.mjs       Language-service behaviour (definitions, completions,
                           diagnostics, hover) via a real in-memory tsserver.
  template-parse.test.mjs  The parser in isolation.
README.md                  User-facing setup instructions.
```

## Package-specific invariants

1. **Tag recognition is gated on the import graph of the current file.**
   A tag registered somewhere in the program but not imported (directly
   or transitively) by the file you're editing is NOT treated as
   available, since runtime would fail too and surfacing the diagnostic is
   the correct prompt to add the import.
2. **Static (non-interpolated) attribute text is not type-checked.**
   At runtime it's plain template text, so any string is valid. Only
   interpolated holes (`\${expr}`) are checked against the declared
   prop type.
3. **The plugin must not error.** If anything goes wrong (parse error,
   missing source file, type-checker quirk), fall back to passthrough.
   The user's editor must never break because of this plugin. Wrap risky
   logic in try/catch with a silent return.
4. **No `ts-lit-plugin` dependency.** The plugin is self-contained: its own
   parser, completions, diagnostics, and hover never require it, and the
   source must never `require('ts-lit-plugin')` (a test asserts this). A
   single `tsconfig.json` plugin entry, `{ "name": "@webjsdev/ts-plugin" }`.
5. **No blanket unknown-tag / unknown-attribute diagnostics.** webjs has no
   `HTMLElementTagNameMap`, so flagging an unrecognised tag/attribute would
   false-positive on legitimate third-party custom elements. Only
   zero-false-positive rules ship.

## Tests

`packages/ts-plugin/test/plugin/ts-plugin.test.mjs` boots a real
tsserver instance against fixture sources and asserts definition,
completion, diagnostic, and hover behaviour. Covers tag / attribute /
CSS-class resolution, binding-aware completions (incl. hyphenation and
`.prop` vs plain), the diagnostic rules, hover, import-graph gating, and
the "lit-plugin diagnostic suppression only when imported" path.
`template-parse.test.mjs` covers the parser in isolation.

The file is `.mjs` because `@webjsdev/ts-plugin` itself is a
CommonJS package (`"type": "commonjs"`); the test uses ESM
imports so the extension forces the right module type.

See [`../../agent-docs/testing.md`](../../agent-docs/testing.md)
for the overall layout. Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
