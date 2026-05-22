---
title: "I built a tiny (in size, not in power) full-stack framework for the AI era. I call it webjs"
date: 2025-12-15T10:00:00+05:30
slug: why-webjs
description: "Why I started webjs: an AI-first, web-components-first, no-build full-stack framework designed for AI agents to comprehend end-to-end. The case for staying close to web standards."
tags: webjs, origin, frameworks, ai-first, web-components
author: Vivek
---

I did not want to start another framework.

I had Next.js running production work. Rails on the older stuff. SvelteKit on a side project that ended up needing one anyway. Each tool had matured into something I could ship with, and starting over felt like work for the sake of work.

What changed was watching AI agents try to write code in those frameworks. Not the chat-window kind. The agent dropped into a project, asked to make a change, taking actions on its own. The thing kept failing on details that no human would notice. Stack traces that pointed at minified bundle positions the agent could not read. Conventions that two engineers would interpret differently, which meant the agent guessed. Server / client boundaries that drifted across the file tree without any enforcement.

I started thinking about what a framework would look like if its primary user was an AI agent. Not a human reading docs. A model reading the codebase, the conventions, the lint rules, the file tree. webjs is what I built.

# What webjs is

A small full-stack framework built on web standards. Web components for the view layer. File-based routing in the Next.js shape (`page.ts`, `layout.ts`, `route.ts`, `[param]`, `(group)`, `_private`). Prisma for the database. Tailwind for styling. Server actions for the data layer. Auth, sessions, cookies, cache, rate limiting, all built in and sharing one pluggable store.

The framework is small. About thirty thousand lines of plain JS with JSDoc types across `packages/core` and `packages/server`. Source is what runs. Nothing in `node_modules/@webjsdev/*` is minified. You can open any framework file in your editor and read it like project code.

The tagline is "tiny in size, not in power." That is not a marketing line. It is a literal claim. The full framework, including the dev server, the SSR pipeline, the client router, the slot host, and the property-binding hydration layer, is smaller than most React app's `node_modules/react-dom`. And it ships every feature you would build a full-stack product with: routing, components, server actions, auth, sessions, cache, WebSockets, rate limiting, streaming SSR with Suspense.

There is no build step. None. The `.ts` files you read are the files the browser fetches. Node 24's built-in `module.stripTypeScriptTypes` does whitespace-preserving type erasure, so the source positions and the runtime positions match. DevTools shows accurate stack traces without a sourcemap. The dev loop is edit, save, refresh.

# Why this matters for AI agents

Five things, in order of how much each one pays back:

- **AGENTS.md ships with every scaffold.** When you run `npm create webjs@latest my-app`, the scaffolded project ships with an `AGENTS.md` at its root. It is the agent contract: file conventions (where every kind of file goes), public API of each package, framework invariants (the things that crash in production if you violate them), recipes for the common tasks, and a `Deliberately deferred` list (so the agent does not try to add a bundler because it has seen Next.js do that). The same content lands as `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`. One source of truth, six tools read it.

- **CONVENTIONS.md is project-specific and overridable.** Architecture rules a linter cannot enforce: module layout, styling defaults, testing patterns, git workflow. Sections marked `<!-- OVERRIDE -->` are the customization points. Agents read both files before writing code. The framework's `webjs check` lints the parts that can be checked mechanically. The two together cover the rule space.

- **The framework source is small and readable.** `node_modules/@webjsdev/core/src/component.js` is a real file an agent can `cat` and reason about. No `LitElement.js.min.gz` to decode. If the agent hits an unexpected lifecycle behavior, it reads the source and figures it out. We optimize for `grep` and `read`, not for bundle size at the framework level.

- **No build step means console parity.** When DevTools shows an error at `app/posts/[slug]/page.ts:42:8`, the agent can open that exact path, jump to that exact position, and read the line. No sourcemap lookup, no "the bundle says X but the source says Y." The file on disk is what the runtime sees.

- **TypeScript types span server and client.** Import a server-side function from `actions/create-post.server.ts` into a client component, and TypeScript sees the real signature. webjs's serializer round-trips `Date`, `Map`, `Set`, `BigInt`, `TypedArray`, `Blob`, `File`, `FormData`, and reference cycles. The agent gets type safety across the network boundary, never has to write JSON-shaped adapters.

# Why web components

The other framework choice that gets questioned is "why web components, not React / Vue / Svelte / Solid?"

Web components are a browser standard. Custom elements, shadow DOM, `<slot>` projection. They have been in every browser since 2018. They do not require a framework to render. They survive framework changes. When the next big thing arrives, your `<my-counter>` element still works.

For AI agents specifically, web components have one more advantage: the corpus knows them. Every model has seen `customElements.define`, `extends HTMLElement`, `static observedAttributes`, lifecycle hooks like `connectedCallback`. If the framework's runtime mirrors what the platform offers, the agent's training data already covers the API.

webjs's `WebComponent` base class is lit-shaped on purpose. `static properties`, `render() { return html\`\` }`, `ReactiveController`, the full lit-html directive set. An agent that has written lit before writes correct webjs without prompting. The runtime is hand-rolled (so we control the SSR story end-to-end), but the public API is what lit users expect. See [Betting on lit's mental model](/blog/betting-on-lits-mental-model) for the full rationale.

# Why no build step

I wrote about this separately in [Strip types, not esbuild](/blog/strip-types-not-esbuild), but the short version: Node 24 shipped a built-in TypeScript stripper that preserves source positions byte-exactly. Whitespace replaces the type annotations. Stack traces point at the source. No sourcemap. No transformation. The wire bytes drop by about 70% versus an esbuild-with-sourcemap pipeline, and the agent's debugging loop converges in fewer steps because the file on disk matches what the runtime sees.

Production runs the same files dev runs. There is no `webjs build` command. `webjs start` serves source-as-ESM with `<link rel="modulepreload">` hints emitted at SSR time, and HTTP/2 multiplex at the edge makes per-file ESM competitive with bundling. Same model as Rails 7 + `importmap-rails`. The Rails team got there first; we adopted their architecture for Node-shaped web apps.

# Stack defaults

The scaffold ships with sensible defaults so you do not have to make 30 decisions before writing your first feature:

- **Database:** Prisma + SQLite (swap to PostgreSQL / MySQL by changing one line in `schema.prisma`).
- **Styling:** Tailwind via CLI (no browser runtime; CSS is built at startup and served as a static file).
- **Auth:** built-in `createAuth()` with Google, GitHub, and Credentials providers.
- **Server actions:** import a function from a `.server.ts` file with `'use server'`, the dev server rewrites the import into a typed RPC stub.
- **Type-safe serializer:** the wire serializer handles `Date`, `Map`, `Set`, `BigInt`, `TypedArray`, `Blob`, `File`, `FormData`, and cycles. Inspired by Superjson, hand-rolled to share code paths with the framework renderer.
- **Tests:** node:test for server-side, web-test-runner + Playwright for browser, both wired up out of the box.

You can swap any of them. Each has a clean replacement path. But out of the box, they all work together.

# What ships in the box

The framework is more than the runtime. Every scaffolded webjs app includes:

- A working auth flow (Google / GitHub / Credentials).
- A protected dashboard.
- A starter test suite for both server and browser.
- AGENTS.md, CONVENTIONS.md, CLAUDE.md, and per-tool agent configs (cursorrules, windsurfrules, copilot-instructions).
- A pre-commit hook that blocks commits to `main`, runs `npm test`, and auto-generates changelog entries when package versions bump.
- The `@webjsdev/ui` component library installed and ready (`webjs ui add button card dialog`).
- A `.env.example` and a Prisma schema with a working example.

You run `npm create webjs@latest my-app`, the scaffold auto-installs dependencies, and you have a working full-stack app with auth in under thirty seconds.

# Where it stands

Pre-1.0 as of this writing. 1151 unit tests, 271 browser tests, 61 puppeteer e2e tests. The framework is small enough to read end-to-end in an afternoon. The example blog under `examples/blog/` exercises every feature.

I am writing more posts in this blog. Each one covers a design decision in depth: why the lit-API parity, why signals replaced setState, how the client router avoids the white flash between navigations, what light-DOM `<slot>` projection looks like, the npm naming saga that took a Saturday afternoon longer than it should have.

The thesis is that the right shape for an AI-era framework is small, readable, web-standards-first, with conventions enforced by tooling rather than docs. webjs is my attempt at it. Source is open. Issues and PRs welcome.

The site is at [webjs.dev](https://webjs.dev). The repo is at [github.com/webjsdev/webjs](https://github.com/webjsdev/webjs). The CLI is on npm at `@webjsdev/cli`, or scaffold directly with `npm create webjs@latest my-app`.
