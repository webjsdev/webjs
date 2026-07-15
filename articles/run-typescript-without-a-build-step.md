---
title: "How to Run TypeScript Without a Build Step"
date: 2026-07-12T10:00:00+05:30
slug: run-typescript-without-a-build-step
description: "You can run TypeScript without compiling it by stripping the types at load. Why stripping is faster than tsc, the one real constraint, and how WebJs serves .ts files straight to Node, Bun, and the browser."
keyword: "run TypeScript without a build step"
tagline: "Strip the types at load and run the file. No tsc, no dist folder, no sourcemaps."
tags: run typescript without a build step, type stripping, no build, node, bun
author: Vivek
---

For years I ran a `tsc` watch task in the background of every project, rebuilding a `dist/` folder just so I could execute my own code. It turns out I did not need it, and neither do you. You can run TypeScript without compiling it first: hand the `.ts` file straight to the runtime and let it strip the types at load. This changed recently enough that a lot of setups still carry a build step that no longer earns its keep, so let me explain how it works and, more importantly, where it holds up.

# Compiling versus stripping

The old way to run TypeScript was to compile it. `tsc` reads your code, checks every type, resolves the whole type graph, and emits JavaScript plus declaration files and sourcemaps. That is real work, and it is why a TypeScript project grows a build step and a `dist/` folder that has to stay in sync with the source you actually edit.

The insight that makes the build step optional is that almost none of that work is needed to run the code. TypeScript's types are erasable, which means if you delete the annotations you are left with valid JavaScript. You do not have to check the types to execute the program, you only have to remove them. Stripping is orders of magnitude faster than compiling, because it parses and deletes rather than resolving and checking.

# How the runtimes do it now

The platform moved on this fast, and it is worth knowing who does what.

- **Node.** Node 24 strips TypeScript types natively. Run `node app.ts` and it removes the annotations at load and executes the result. It does this in place, preserving line and column positions, so a stack trace points at the exact line you wrote with no sourcemap in between.
- **Bun.** Bun has run TypeScript directly since the start, stripping types as it loads.
- **The browser.** Browsers do not run TypeScript, but a server can strip a `.ts` file to JavaScript before serving it, so the browser fetches valid modules. This is how a no-build framework ships TypeScript to the client with no bundler.

The one thing stripping does not do is check your types, and that is a feature, not a hole. Type checking is a separate concern you run in your editor and in CI (`tsc --noEmit`), where a slow, thorough check belongs. Running the program should not have to wait on it, and now it does not.

# The catch: your TypeScript has to be erasable

There is a real constraint, and I would rather you hear it from me than from a runtime error. Stripping only works if removing the types leaves valid JavaScript, which rules out TypeScript features that generate runtime code. No `enum`, no `namespace` with a value, no constructor parameter properties, no legacy decorators with metadata. Each of those emits JavaScript that has no plain-JS equivalent, so there is nothing to strip them down to. TypeScript ships an `erasableSyntaxOnly` flag that flags exactly these, so you find out in your editor instead of at runtime.

For most modern TypeScript this costs you nothing, because the erasable subset is what the code you write already uses. But it is a genuine constraint, and it is worth checking before you rip out your build step and assume everything just works.

# How WebJs runs on this

WebJs is built entirely on type stripping, with no build step anywhere. The `.ts` files you write are the files that run on the server and the files the browser fetches, with the types stripped at load by Node's built-in stripper or Bun's. There is no `tsc` in the serving path, no `dist/` folder, and no sourcemap layer, so an error in the browser console points at `app/posts/[id]/page.ts` at the real line. The framework enforces the erasable constraint with a check, so a non-erasable construct is caught before it ships rather than blowing up at strip time. Why I chose stripping over running esbuild, and what that cost, is in [strip the types, not esbuild](/blog/strip-types-not-esbuild).

If your project still runs `tsc` in a watch loop only to execute your code, you can almost certainly delete that step today. Keep `tsc --noEmit` for checking, and let the runtime strip and run. That was the change that made my own dev loop feel immediate again.

## FAQ

### Can you run TypeScript without compiling it?

Yes. Modern runtimes strip the type annotations at load and run the resulting JavaScript, with no compile step. Node 24 does this natively (`node app.ts`), Bun has always done it, and a server can strip a `.ts` file before sending it to the browser. Stripping is much faster than compiling because it deletes types rather than checking and resolving them. WebJs runs a full-stack app this way.

### Is type stripping the same as compiling TypeScript?

No. Compiling (`tsc`) checks all your types, resolves the type graph, and emits JavaScript plus declaration files and sourcemaps. Stripping only removes the type annotations, leaving valid JavaScript, and does no type checking. Stripping is far faster and is enough to run the code. You still run `tsc --noEmit` separately in your editor and CI to check types.

### What are the limitations of running TypeScript without a build step?

Your TypeScript has to be erasable, meaning removing the types must leave valid JavaScript. That rules out features that emit runtime code: `enum`, value `namespace`, constructor parameter properties, and legacy decorators with metadata. The `erasableSyntaxOnly` compiler flag flags these so you catch them in the editor. Type checking also does not happen at runtime, so you run it separately in CI.

### Does WebJs need a build step to run TypeScript?

No. WebJs strips TypeScript types at load using Node's built-in stripper or Bun, so the `.ts` files you write run directly on the server and ship to the browser with no bundler, no `tsc` in the serving path, and no `dist/` folder. Stack traces point at your real source lines because stripping preserves positions with no sourcemap.
