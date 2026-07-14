---
title: "What a No-Build JavaScript Framework Actually Is"
date: 2026-07-12T10:00:00+05:30
slug: no-build-javascript-framework
description: "A no-build JavaScript framework serves the code you wrote straight to the browser, no bundler and no compile step. What replaced the bundler, the honest tradeoff, and how WebJs runs a full-stack app this way."
keyword: "no-build JavaScript framework"
tagline: "The file you write is the file the browser runs. No bundler, no dist folder, no compile step."
tags: no build javascript framework, buildless, es modules, importmap, typescript
author: Vivek
---

When I say WebJs is a no-build JavaScript framework, the first reaction I usually get is that I must be giving something up. No bundler, no compile step, no generated `dist/` folder between the source and the runtime. It sounds like a downgrade, like going back to script tags and hoping for the best. It is not, and the reason is that the platform quietly caught up while everyone kept reaching for a bundler out of habit. Let me show you what actually replaced the build step, and where the tradeoff is real.

# What the build step was doing, and why you needed it

For most of the last decade a build step was not optional, and it is worth being fair about why. Browsers did not handle native ES modules (the built-in `import` / `export` syntax) well enough to ship them directly, so a bundler concatenated your files into a few big scripts to cut down network requests. TypeScript was not something a browser could run, so a compiler turned it into JavaScript first. JSX and other non-standard syntax needed transforming. The bundler earned its place.

Two of those three reasons have quietly expired. Every current browser runs ES modules natively. And in the last couple of years, TypeScript became something you can strip to plain JavaScript by removing the annotations, fast, with no full compile. What is left is mostly bundling for network efficiency, and HTTP/2 changed that math too.

# The three things that replace the bundler

A no-build framework leans on capabilities the platform already ships, and there are only three worth remembering.

**Native ES modules.** The browser fetches your modules directly by their `import` statements. You do not concatenate them ahead of time, you let the browser request the graph.

**Import maps.** An import map (a small JSON block in the HTML that maps a bare name like `dayjs` to a real URL) lets you write `import dayjs from 'dayjs'` in the browser with no bundler resolving it. This is the same model Rails adopted with `importmap-rails`, and I leaned on jspm for the pinning, which I wrote about in [no-build npm packages with import maps](/blog/no-build-via-jspm-io).

**Type stripping instead of compilation.** TypeScript's types are erasable. Removing them leaves valid JavaScript, and Node 24's built-in stripper does exactly that, in place, preserving line positions so a stack trace points at the line you wrote. There is no compiled output and no sourcemap layer. Why I strip instead of running esbuild is its own post, [strip the types, not esbuild](/blog/strip-types-not-esbuild).

The one job the bundler still did, cutting network requests, is handled at serve time by HTTP/2 multiplexing plus `<link rel="modulepreload">` hints, so the module graph loads in parallel over one connection instead of as a waterfall. I measured that tradeoff in [no-build frontend performance](/blog/no-build-frontend-performance).

# What it actually feels like to work in

The practical difference is that there is no compile stage to model in your head, and nothing to keep in sync.

- **The dev loop is edit, save, refresh.** There is no watch-rebuild step between you and the browser, because there is nothing to rebuild.
- **The source in `node_modules` is the source that runs.** WebJs ships as plain JavaScript with JSDoc types, not a minified bundle, so when something surprises you, you can read the framework's actual code. It is also why an AI coding agent can reason about the framework the same way it reads your app.
- **Production and development serve the same files.** There is no `webjs build` command, because there is nothing to build. What you run locally is what runs in production.

WebJs runs a full-stack app this way, on Node 24+ or Bun: file-based routing, server actions, streaming SSR, auth, and sessions, all with no build step. Being buildless is not a party trick, it is what keeps the whole framework small enough to read.

# The honest tradeoff

No-build is not free, and I would rather say so than pretend. You give up build-time optimizations like tree-shaking dead code out of a dependency and aggressive minification. For a large app pulling in heavy third-party libraries, a bundler can still ship fewer bytes. My answer is to lean on the platform (HTTP/2, module preload, caching) and to keep the framework itself small, rather than to bundle. For most apps that is the better trade. For a few it is not, and that is a real decision to make with your eyes open, not a slogan to repeat.

If your instinct is that a build step is just how frontend works, that instinct is a couple of years out of date. The platform caught up. A no-build framework is what you get when you take that seriously and stop paying for a step you no longer need.

## FAQ

### What is a no-build JavaScript framework?

It is a framework that serves your source directly to the browser with no bundler or compile step. Native ES modules load the code by its import statements, an import map resolves bare package names, and TypeScript types are stripped at load rather than compiled ahead of time. WebJs is a full-stack example: the `.ts` file you write is the file that runs, with no generated build output.

### Do no-build frameworks have worse performance?

Not necessarily. The reason bundlers existed was to cut network requests, and HTTP/2 multiplexing plus module-preload hints cover most of that gap by loading the module graph in parallel over one connection. You do give up build-time tree-shaking and minification, so a very large app with heavy dependencies can still ship fewer bytes bundled. For most apps the no-build path is competitive and much simpler.

### How does a no-build framework run TypeScript?

By stripping the types instead of compiling. TypeScript's type annotations are erasable, so removing them leaves valid JavaScript. Node 24 has a built-in stripper that does this in place and preserves line numbers, so stack traces stay accurate with no sourcemap. There is no `tsc` step and no compiled output to keep in sync with your source.

### Is Lit a no-build framework?

Lit can be used without a build step (it works from a CDN with import maps), but it is a component library, not a full-stack framework, so you assemble the server, routing, and data layer yourself. WebJs is a full-stack no-build framework: routing, server actions, SSR, and auth are built in, all served without a bundler.
