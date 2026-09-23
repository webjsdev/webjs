# webjs for VSCode

All-in-one editor support for [webjs](https://github.com/webjsdev/webjs), the AI-first, web-components-first framework. **No Lit extension required.**

Works in VSCode and VSCode-based editors (Cursor, Antigravity, Windsurf, VSCodium). The Marketplace listing is live; the [Open VSX](https://open-vsx.org) one is not published yet, so those editors install the `.vsix` directly for now.

## Features

- **Template highlighting.** Markup inside `` html`...` `` and `` css`...` `` (and `` svg`...` ``) tagged templates is highlighted as HTML / CSS / SVG, with `${...}` expressions tokenized as TypeScript. No separate Lit / lit-html extension needed.
- **Language-service intelligence.** Bundles the webjs TypeScript-server plugin and registers it automatically (no `tsconfig.json` edit), with its own in-template engine (no Lit plugin): go-to-definition on tags / attributes / CSS classes, binding-aware completions (tag names, and `.prop` / `?bool` / plain attributes keyed by prefix), in-template diagnostics (value type-checks, unquoted-binding and expressionless-property errors), and hover, all gated on import-graph reachability.
- **Snippets** for the common recipes: `wjpage`, `wjdynamic`, `wjaction`, `wjcomponent`, `wjroute`, `wjlayout`.
- **Commands:** `webjs: Run check`, `webjs: Create a new app`, `webjs: Open documentation`.

## Install

- **VSCode:** search "WebJs" in the Extensions view, or install [`WebJs.WebJs`](https://marketplace.visualstudio.com/items?itemName=WebJs.WebJs) from the Marketplace.
- **Cursor / Antigravity / Windsurf / VSCodium:** these pull from Open VSX, where the extension is not published yet. Until it is, use the **Download Extension** link on the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=WebJs.WebJs) to save the `.vsix`, then install that file with `code --install-extension path/to/the.vsix` (substitute your editor's CLI).

## About

This extension lives in the [webjs monorepo](https://github.com/webjsdev/webjs/tree/main/packages/editors/vscode) and is versioned with the framework. WebJs is buildless: the framework source you read in `node_modules/@webjsdev/*/src` is what runs.

License: MIT.
