---
title: "Running One Web Framework on Node and Bun Found Five Bugs"
date: 2026-06-02T09:30:00+05:30
slug: node-and-bun-no-build
description: "WebJs runs the same buildless source on Node 24+ and Bun. Adding the second runtime meant a runtime-neutral listener seam, two TypeScript strippers, and a parity test matrix that surfaced five genuine Node-versus-Bun divergences."
tags: bun, node, runtime, no-build, cross-runtime
author: Vivek
---

WebJs runs on Node 24+ and on Bun, from the same source, with no build step. You start a Bun app with `bun --bun run dev` and the server runs on Bun. Same files, same routes, same components. The interesting part was not making it start on both. It was the five real bugs the parity work surfaced, each one a place where Node and Bun disagree about something I had assumed was standard.

# Why two runtimes at all

The honest reason is that Bun is fast and a lot of people want to use it, and a no-build framework is exactly the kind of thing that should not care which runtime executes it. There is no bundler output that bakes in a target. The source IS the runtime. So the only thing standing between WebJs and Bun was the set of places where the framework touches a runtime API directly, and those places turned out to be worth mapping carefully.

The work landed under #508. Node 24+ is the floor because that is where the built-in TypeScript stripper and a few other primitives arrived. A boot-time preflight enforces the floor and admits Bun.

# The listener seam

The biggest runtime-specific surface is the HTTP listener. On Node the framework uses `node:http`. On Bun the native answer is `Bun.serve`, which is a different shape with a different request object.

The wrong move would be a compatibility shim that makes `Bun.serve` pretend to be `node:http`. That leaves performance on the table, because you are paying for a bridge on every request. So instead `startServer` selects a runtime-neutral listener shell: a `node:http` shell on Node, and a `Bun.serve` shell on Bun that skips the compat bridge entirely. On the listening path that is worth about 1.9x more requests per second on Bun, because the request never gets marshalled through a Node-shaped intermediary.

The seam is deliberately general, not a two-way `if`. It is the same place a future `Deno.serve` shell or an embedded adapter would plug in. The framework code above the seam does not know which runtime it is on.

There is exactly one feature that does not cross: 103 Early Hints. `Bun.serve` has no informational-response API, so the Bun shell cannot send them. Everything else reaches parity. I would rather document one honest gap than ship a leaky shim that pretends the gap is not there.

# Two strippers for the same TypeScript

WebJs serves `.ts` files by stripping the types at request time, buildless. On Node that is the built-in `module.stripTypeScriptTypes`. Bun does not have that function, so on Bun the framework uses `amaro`, the same stripper Node's own implementation is built on.

The requirement is that both produce byte-identical, position-preserving output, because the stripped source is what the browser fetches and what stack traces point into. If the two strippers disagreed by even a character, a line number in an error would be wrong on one runtime. They match, and there is a forced-amaro parity test on Node that keeps them matching.

# The parity matrix, and the five bugs

Here is the part that actually earned its keep. `node scripts/run-bun-tests.js` re-runs the entire `node:test` suite under Bun. Not a separate Bun-specific suite. The same tests, on the other runtime. A divergence is a failure, and a failure is a real framework bug to fix, not a test to skip.

It found five.

**A FormData serializer crash.** The rich-type serializer round-trips `FormData` across the RPC wire. On Bun, a freshly constructed `FormData` had a subtly different internal identity that the serializer's fast path did not expect, and it threw. This only showed up because an action test sent a `FormData` and asserted the round-trip, and that test ran on both runtimes.

**A `Readable.fromWeb` hang.** The file-storage layer bridges a web `ReadableStream` into a Node stream with `Readable.fromWeb`. On Bun, a `put()` through that path hung instead of completing, because the reader loop had a different back-pressure timing. The fix was in how the framework drives the stream, and the no-orphan-on-mid-stream-error invariant is now asserted on Bun directly.

**The TypeScript strip error code.** When you feed non-erasable TypeScript to the stripper, it throws. Node's built-in and amaro threw with different error codes for the same bad input. The framework catches that error to produce a helpful message, and the catch was keyed on Node's code. On Bun it fell through. Fixed by normalising both.

**A JavaScriptCore versus V8 error-message format.** One test asserted on the text of a thrown error. JSC (Bun) and V8 (Node) word the same error differently. That is not a framework bug in the strict sense, but it is a framework bug in the sense that the framework's own error handling was matching on the wording. Fixed to match on the stable part.

**A link-unsafe `node:module` named import.** A named import from `node:module` that resolved fine on Node did not on Bun. Small, but it would have crashed the boot on Bun, so it counts.

None of these were things I would have found by reading the code. They are the kind of divergence you only see when you actually execute the same assertion on both engines. That is the entire argument for the matrix: it is not there to prove Bun works, it is there to catch the specific line where Node and Bun quietly disagree.

# Keeping it honest going forward

The trap with cross-runtime support is that it rots the moment you stop looking. Someone touches the serializer, tests pass on Node, ships, and Bun breaks silently until a user hits it.

So the framework treats any change to a runtime-sensitive surface as incomplete until it is proven on Bun. The serializer, the listener path, streams, `node:crypto`, the stripper, auth and session dispatch: a change there has to ship a cross-runtime assertion under `test/bun/`, and a pre-commit hook blocks a commit that stages runtime-sensitive source without one. The discipline is in the tooling, not in my memory, because my memory is exactly the thing that fails to remember Bun on a busy day.

A handful of tests are legitimately Node-only. They assert a `node:http` internal, or the built-in stripper as the byte-reference, or the Node `ws` subsystem. Those sit on a documented denylist in the matrix runner, each with a reason and a note of where the Bun behaviour is covered instead. The denylist is explicit precisely so that "this is Node-only" is a decision someone wrote down, not a test that quietly stopped running on Bun.

# What shipped around it

Because the CLI's own tooling stopped needing Node anywhere in the container, the Bun scaffold ships a pure `oven/bun:1` Dockerfile (#595). The database, test, and check tooling still run on Node, but the deployed server image is Bun all the way down. `bun create webjs my-app` picks the runtime automatically, and the `--runtime bun` flag re-flavours any of the templates for Bun.

# The takeaway

Supporting a second runtime for a no-build framework is mostly not about making it start. It is about finding the small set of places where the two runtimes disagree, isolating them behind a seam, and then running your existing test suite on both engines so the disagreements surface as failures instead of as user reports. The five bugs the matrix caught were all invisible to code review and all real. If you are going cross-runtime, do not write a Bun test suite. Run your Node suite on Bun, and fix what turns red.
