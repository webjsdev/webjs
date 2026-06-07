# AGENTS.md for the `webjs` VSCode extension

The all-in-one editor extension for webjs, shipping to the **VS
Marketplace** and **Open VSX** (the latter is what Cursor, Antigravity,
Windsurf, and VSCodium pull from). It is phase 1 of the editor-plugin
epic (#381).

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build, commit
conventions, autonomous-mode behaviour) live in the framework root
[`../../AGENTS.md`](../../AGENTS.md) and apply here. Read that first.
This file only covers what is specific to the extension.

## What it contributes (all DECLARATIVE, in `package.json`)

1. **Template highlighting.** Three original TextMate injection grammars
   (`syntaxes/webjs-{html,css,svg}.json`) open an embedded HTML / CSS /
   SVG block inside `` html` `` / `` css` `` / `` svg` `` tagged
   templates and scope `${...}` holes as TypeScript. Authored from
   scratch (NOT copied from lit-html), so there is no Lit dependency and
   no attribution burden.
2. **Language-service intelligence.** The bundled `@webjsdev/ts-plugin`
   tsserver plugin, auto-registered via
   `contributes.typescriptServerPlugins` (no `tsconfig.json` edit). Gives
   webjs-aware go-to-definition, attribute completion from
   `static properties`, and tag diagnostics.
3. **Snippets** (`snippets/webjs.json`) for the common recipes and
   **commands** (`webjs.check` / `webjs.create` / `webjs.docs`, wired in
   `src/extension.js`).

## The no-Lit-dependency invariant (the whole point of phase 1)

The extension must NOT depend on any Lit extension or grammar. Two
mechanisms keep it that way, and both are load-bearing:

- **Highlighting** uses our own grammars, never `vscode-lit-html`.
- **Intelligence** bundles `@webjsdev/ts-plugin`, which is standalone as
  of Phase 3 (#386): it has its own template parser and no `ts-lit-plugin`
  dependency, so the esbuilt bundle (`scripts/build.mjs`) is the whole
  webjs language service with no Lit code at all.

`test/extension.test.mjs` asserts no `ts-lit-plugin` / `lit-html` string
appears in the manifest and that the built bundle neither requires nor
references `ts-lit-plugin`.

## Build + packaging (the monorepo gotcha)

VSCode resolves a contributed `typescriptServerPlugins` entry by NAME
from `<extension>/node_modules/<name>`, so the plugin must ship inside
the vsix under that exact path. But vsce's npm path runs
`npm list --production`, which from a workspace member resolves the
WHOLE monorepo (repo root + every sibling), ballooning the vsix to
~86 MB. So:

- `scripts/build.mjs` esbuilds the plugin into a single self-contained
  CJS bundle at `node_modules/@webjsdev/ts-plugin/` (real files, no
  further deps).
- `scripts/package.mjs` copies the publishable tree into a standalone
  staging dir OUTSIDE the workspace, with a manifest whose only
  dependency is the vendored plugin, then runs vsce there. Result: a
  ~13-file, ~100 KB vsix carrying only the extension and the one plugin.

Always package via `npm run package` (never bare `vsce package` from
this dir, or you get the 86 MB blowup). `npm run build` alone just
regenerates the vendored plugin (what the tests exercise).

## Not on npm

The extension ships to the VS Marketplace + Open VSX, NOT npm. It is
`private: true`, it is NOT in `scripts/backfill-changelog.js`'s
`PACKAGES` list, and the pre-commit hook skips `vscode` in its
changelog-generation gate. Do not add it to any npm publish flow.

## Module map

```
package.json              The manifest. `contributes` is where the value lives.
src/extension.js          CommonJS entry; wires the three commands only.
syntaxes/webjs-*.json      TextMate injection grammars (html/css/svg).
snippets/webjs.json        Recipe snippets.
scripts/build.mjs          esbuild the vendored, Lit-free tsserver plugin.
scripts/package.mjs        Stage outside the workspace + run vsce.
test/extension.test.mjs    Dependency-free manifest + grammar + bundle checks.
icon.png                   Marketplace icon (the webjs brand mark).
PUBLISHING.md              How to publish to both registries.
```

## Tests

`test/extension.test.mjs` is dependency-free (no vscode-textmate /
oniguruma): it validates the manifest as data, checks every contributed
file exists and is consistent, converts each grammar `begin` pattern to
a JS RegExp and asserts it matches the real `` tag` `` forms while
rejecting look-alikes (`` nothtml` ``), and runs `build.mjs` to prove
the vendored plugin is self-contained and Lit-free. Run from the repo
root via `npm test` (picked up under `packages/vscode/test`).

Full per-feature behaviour of the tsserver plugin itself lives in
[`../ts-plugin/AGENTS.md`](../ts-plugin/AGENTS.md).

---

Framework-wide rules and full API reference:

@../../AGENTS.md
