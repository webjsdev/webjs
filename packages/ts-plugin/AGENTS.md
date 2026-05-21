# AGENTS.md for @webjsdev/ts-plugin

A **tsserver plugin** that gives editors (VS Code, Neovim, JetBrains)
webjs-aware intelligence inside `` html`` `` tagged templates:
go-to-definition on custom-element tag names, CSS class resolution,
attribute auto-complete sourced from `static properties`, and
suppression of `ts-lit-plugin`'s "Unknown tag / attribute" diagnostics
for tags any reachable file registers via `Class.register('tag')`.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjsdev/ts-plugin`.

## Role

The plugin **wraps** `ts-lit-plugin`. Order in `tsconfig.json` matters:
list `ts-lit-plugin` first, `@webjsdev/ts-plugin` second. The webjs
plugin sits on top and:

1. Scans the program at boot for `Class.register('tag', …)` /
   `customElements.define('tag', Class)` registrations.
2. For every `.ts` / `.js` file being edited, computes its **import
   graph** transitively. Only tags whose registering file is reachable
   from the current file count as "available".
3. Re-routes go-to-definition on custom-element tag names inside
   `html\`\`` templates to the registered class.
4. Filters `ts-lit-plugin`'s "Unknown tag" / "Unknown attribute"
   diagnostics so registered webjs elements aren't red-squiggled.
5. Adds attribute completions from the registered class's
   `static properties = { … }` map.
6. Type-checks interpolated attribute values
   (`<my-counter count=\${expr}>`) against the declared property type
   from `declare propName: T`.

## Module map

```
src/
  index.js         The whole plugin. Single-file by design, since tsserver
                   plugins are tiny by convention.
README.md          User-facing setup instructions.
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
4. **Plugin order matters.** `ts-lit-plugin` first, then this one. Both
   are installed by the scaffold's `tsconfig.json`. Documented in the
   scaffold's `tsconfig.json` comment and in the framework AGENTS.md
   "Editor setup" section.

## Tests

`packages/ts-plugin/test/plugin/ts-plugin.test.mjs` boots a real
tsserver instance against fixture sources and asserts diagnostic
and completion behaviour. Covers tag resolution, attribute
completion, attribute-value type-check, import-graph gating, and
the "lit-plugin diagnostic suppression only when imported" path.

The file is `.mjs` because `@webjsdev/ts-plugin` itself is a
CommonJS package (`"type": "commonjs"`); the test uses ESM
imports so the extension forces the right module type.

See [`../../agent-docs/testing.md`](../../agent-docs/testing.md)
for the overall layout. Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
