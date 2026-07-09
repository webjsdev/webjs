---
title: "Leaky Error Messages: Sanitizing Production Server-Action Errors"
date: 2026-07-07T10:00:00+05:30
slug: sanitizing-server-action-errors
description: "How WebJs sanitizes production server-action errors so a thrown action returns a generic message plus a digest instead of leaking a database string, internal IP, or filesystem path. Safe by default in prod, with a digest to keep debuggability."
tags: security, server-actions, error-handling, production, observability
author: Vivek
---

Let me show you the leak, because it is easy to ship without noticing.

Your action opens a database connection and the connection fails. The driver throws an error, and the error message is something like `connect ECONNREFUSED 10.0.3.14:5432`. A naive framework catches that throw and sends the message straight to the browser, where it lands in the network tab of anyone who opens dev tools. You just told a stranger your internal database host, its port, and that you run Postgres. You never chose to say any of that. The database driver said it for you, and the framework relayed it.

It is not always a driver. A thrown error can carry a filesystem path (`/home/app/src/lib/secrets.server.ts`), an internal IP, a stack frame, a raw SQL fragment. None of it is author-controlled, and all of it is exactly the reconnaissance an attacker wants. The mistake is treating an error message as safe to display. An error message is a debugging aid for you, not a user-facing string, and the two must not be the same channel.

```ts
// the leak: a raw throw whose message reaches the client verbatim
'use server';
export async function loadDashboard() {
  const rows = await db.query.metrics.findMany();   // driver throws with the host in the message
  return { success: true, data: rows };
}
```

# What WebJs does instead

In production, WebJs sanitizes the error before it leaves the server. A thrown action does not return its real message to the client. The browser receives a generic message plus a short `digest`, and nothing else.

A digest is just a short hash id, a little fingerprint like `a1b9f4c2`. It carries no meaning on its own. Its whole job is to be a shared reference number between the user and your logs. The client sees the digest. The full error, message, stack, and all, is logged server-side keyed by that same digest. So when a user reports "I got an error, the id was a1b9f4c2," you grep your logs for `a1b9f4c2` and find the exact stack trace that produced it. You lose nothing for debugging. You just stop broadcasting the internals to the browser.

```ts
// what the browser receives from a thrown action in prod
{
  "error": "Something went wrong",
  "digest": "a1b9f4c2"
}
// what your server log holds, keyed by a1b9f4c2:
// the full "connect ECONNREFUSED 10.0.3.14:5432" and stack
```

The same sanitization applies to the streaming error frame. If an action returns a stream and throws mid-stream, the error that surfaces from the iterable is sanitized identically. There is no side door where the raw message slips out because the response happened to be a stream.

# Control-flow throws still pass through

There is one category of throw that is NOT an error, and WebJs is careful to let it through untouched. `redirect()`, `notFound()`, `forbidden()`, and `unauthorized()` are implemented as throws, but they are control flow, not failures. You throw `redirect('/login')` to mean "stop here and send the user to the login page," and that intent has to survive.

So the sanitizer recognizes these control-flow throws and passes them through verbatim. A `redirect()` still redirects. A `notFound()` still renders your 404. Only an actual unexpected error, the kind that carries a driver string or a stack, gets collapsed into the generic message plus digest.

# Where your real error messages belong

If the generic message is all the client gets, how do you show a user "Email already taken"? You do not throw it. You return it.

A user-facing message belongs on the `ActionResult` envelope, not on a throw.

```ts
'use server';
export async function signup(input: { email: string }) {
  const existing = await findByEmail(input.email);
  if (existing) {
    // a user-facing message: returned, not thrown, so it is intentional and safe
    return { success: false, error: 'Email already taken' };
  }
  const user = await createUser(input);
  return { success: true, data: user };
}
```

This draws a clean line. A `return { success: false, error }` is a message you deliberately chose to show, so it reaches the client as written. A `throw` is for the unexpected, the thing you did not plan for, so it gets sanitized. The envelope is your intentional-message channel and the throw is your panic channel, and only the panic channel is redacted. Once you internalize that split, you stop reaching for `throw new Error('nice message')` and start returning the message on the envelope where it belongs.

# The boundary this covers, and the one it does not

This protection lives on the action RPC boundary, the path a client component's imported action takes. It does not automatically cover a hand-written `route.ts` REST endpoint, including one built with the `route()` adapter.

A `route.ts` handler is a raw HTTP handler you wrote on purpose, and WebJs does not wrap your own error handling around it. So on a mutating REST endpoint the responsibility is yours. Authenticate it, validate the input, log without leaking secrets into the response, and rate-limit it. The framework hands you the pieces (`validate`, the auth helpers, `rateLimit()`), but it will not redact a message you chose to send from a route you chose to write. The rule of thumb holds from the CSRF story too. Reach for a server action for in-app work and get the safe defaults, reach for `route.ts` when you are exposing a real public API and own its security.

# One more thing: dev still shows you the truth

Sanitization is a production behaviour. In development the real error message still surfaces in the browser and the overlay, because when you are building you WANT the driver string and the stack right there in front of you. It would be miserable to debug a `connect ECONNREFUSED` as "Something went wrong (digest: a1b9f4c2)" on your own machine. Only prod redacts. Dev tells you everything.

# The takeaway

An error message is a debugging aid, not a user-facing string, and shipping the raw one to the browser leaks database hosts, internal IPs, and filesystem paths an attacker loves. WebJs sanitizes production server-action errors so a thrown action returns a generic message plus a short `digest`, logs the full error server-side under that same digest (so you correlate the two and lose no debuggability), and sanitizes the streaming error frame the same way. Control-flow throws (`redirect()`, `notFound()`, `forbidden()`, `unauthorized()`) pass through untouched, a genuinely user-facing message belongs on the `ActionResult` envelope rather than a throw, and dev still shows you the real message. Just remember this guards the action boundary, so a hand-written `route.ts` is yours to secure.
