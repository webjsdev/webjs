---
title: "How to run TypeScript without a build step"
date: 2026-07-09T09:00:00+05:30
slug: run-typescript-without-a-build-step
description: "How to run TypeScript without compiling it, why type stripping is faster than tsc, and how WebJs serves .ts files straight to Node, Bun, and the browser with no build step."
keyword: "run TypeScript without a build step"
tagline: "Strip the types at load and run the file. No tsc, no dist folder, no sourcemaps."
tags: run typescript without a build step, type stripping, no build, node, bun
author: Vivek
---

You can now run TypeScript without compiling it first. Not with `ts-node`, not with a watch task rebuilding a `dist/` folder, but by handing the `.ts` file straight to the runtime and letting it strip the types at load. This changed recently enough that a lot of setups still carry a build step they no longer need, so let me explain how it works and where it holds up.

# Compiling versus stripping

The old way to run TypeScript was to compile it. `tsc` reads your code, checks every type, resolves the whole type graph, and emits JavaScript plus declaration files and sourcemaps. That is a real amount of work, and it is why a TypeScript project has a build step and a `dist/` folder that has to stay in sync with the source.

The insight behind running TypeScript without a build step is that most of that work is not needed to execute the code. TypeScript's types are erasable, meaning if you delete the type annotations you are left with valid JavaScript. You do not have to check the types to run the program, you only have to remove them. Stripping is orders of magnitude faster than compiling, because it parses and deletes rather than resolving and checking.

# How the runtimes do it now

The platform moved on this fast.

- **Node.** Node 24 strips TypeScript types natively. Run `node app.ts` and it removes the annotations at load and executes the result. It does this in place, preserving line and column positions, so a stack trace points at the exact line you wrote with no sourcemap indirection.
- **Bun.** Bun has run TypeScript directly since the beginning, stripping types as it loads.
- **The browser.** Browsers do not run TypeScript, but a server can strip a `.ts` file to JavaScript before serving it, so the browser fetches valid modules. This is how a no-build framework ships TypeScript to the client without a bundler.

The one thing stripping does not do is check your types. That is a feature, not a gap. Type checking is a separate concern you run in your editor and in CI (`tsc --noEmit`), where a slow, thorough check belongs. Running the program does not need to wait on it.

# The catch: your TypeScript has to be erasable

There is a real constraint. Stripping only works if removing the types leaves valid JavaScript, which means you cannot use TypeScript features that generate runtime code. No `enum`, no `namespace` with a value, no constructor parameter properties, no legacy decorators with metadata. These emit JavaScript that has no plain-JS equivalent, so there is nothing to strip them down to. TypeScript ships an `erasableSyntaxOnly` flag that flags exactly these, so you find out in your editor rather than at runtime.

For most modern TypeScript this costs you nothing, because the erasable subset is what most code already uses. But it is a genuine constraint worth knowing before you rip out your build step.

# How WebJs runs on this

WebJs is built entirely on type stripping, with no build step anywhere. The `.ts` files you write are the files that run on the server and the files the browser fetches, with the types stripped at load by Node's built-in stripper or Bun's. There is no `tsc` in the serving path, no `dist/` folder, and no sourcemap layer, so an error in the browser console points at `app/posts/[id]/page.ts` at the real line. The framework enforces the erasable-TypeScript constraint with a check, so a non-erasable construct is caught before it ships rather than crashing at strip time. The longer story of why WebJs strips instead of bundling is in [strip the types, do not run esbuild](/blog/strip-types-not-esbuild).

If your project still runs `tsc` in a watch loop just to execute your code, you can probably delete that step. Keep `tsc --noEmit` for checking, and let the runtime strip and run.

## FAQ

### Can you run TypeScript without compiling it?

Yes. Modern runtimes strip the type annotations at load and run the resulting JavaScript, with no compile step. Node 24 does this natively (`node app.ts`), Bun has always done it, and a server can strip a `.ts` file before sending it to the browser. Stripping is much faster than compiling because it deletes types rather than checking and resolving them. WebJs runs a full-stack app this way.

### Is type stripping the same as compiling TypeScript?

No. Compiling (`tsc`) checks all your types, resolves the type graph, and emits JavaScript plus declaration files and sourcemaps. Stripping only removes the type annotations, leaving valid JavaScript, and does no type checking. Stripping is far faster and is enough to run the code. You still run `tsc --noEmit` separately in your editor and CI to check types.

### What are the limitations of running TypeScript without a build step?

Your TypeScript has to be erasable, meaning removing the types must leave valid JavaScript. That rules out features that emit runtime code: `enum`, value `namespace`, constructor parameter properties, and legacy decorators with metadata. The `erasableSyntaxOnly` compiler flag flags these so you catch them in the editor. Type checking also does not happen at runtime, so you run it separately in CI.

### Does WebJs need a build step to run TypeScript?

No. WebJs strips TypeScript types at load using Node's built-in stripper or Bun, so the `.ts` files you write run directly on the server and ship to the browser with no bundler, no `tsc` in the serving path, and no `dist/` folder. Stack traces point at your real source lines because stripping preserves positions with no sourcemap.
