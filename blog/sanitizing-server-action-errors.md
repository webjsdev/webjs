---
title: "Leaky Error Messages: Sanitizing Production Server-Action Errors"
date: 2026-07-07T10:00:00+05:30
slug: sanitizing-server-action-errors
description: "How WebJs sanitizes production server-action errors so a thrown action returns a generic message plus a digest instead of leaking a database string, internal IP, or filesystem path. Safe by default in prod, with a digest to keep debuggability."
tags: security, server-actions, error-handling, production, observability
author: Vivek
---

Here is a leak you can ship without ever noticing. An action opens a database connection, the connection fails, and the driver throws `connect ECONNREFUSED 10.0.3.14:5432`. A framework that catches that throw and relays the message hands the string straight to the browser, where it sits in the network tab of anyone who opens dev tools. You just told a stranger your internal database host, its port, and the fact that you run Postgres. You never chose to say any of it. The driver said it, and the framework passed it along.

It is not always the driver. A thrown error can carry a filesystem path like `/home/app/src/lib/secrets.server.ts`, an internal IP, a stack frame, a raw SQL fragment. None of it is author-controlled, and all of it is the reconnaissance an attacker wants. The root mistake is treating an error message as a user-facing string. It is a debugging aid for you, and those are two different channels that must not run down the same wire.

```ts
// the leak: a raw throw whose message reaches the client verbatim
'use server';
export async function loadDashboard() {
  const rows = await db.query.metrics.findMany();   // driver throws with the host in the message
  return { success: true, data: rows };
}
```

# What WebJs does instead

In production, WebJs sanitizes the error before it leaves the server. A thrown action does not return its real message. The browser gets a generic message plus a short `digest`, and nothing else.

A digest is a short hash id, a fingerprint like `a1b9f4c2`. On its own it means nothing. Its whole job is to be a shared reference number between the user and your logs. The client sees the digest. The full error, message and stack and all, is logged server-side under that same digest. So when a user reports "I got an error, the id was a1b9f4c2," you grep your logs for `a1b9f4c2` and land on the exact stack trace that produced it. You lose nothing for debugging. You just stop broadcasting your internals to the browser.

```ts
// what the browser receives from a thrown action in prod
{
  "error": "Something went wrong",
  "digest": "a1b9f4c2"
}
// what your server log holds, keyed by a1b9f4c2:
// the full "connect ECONNREFUSED 10.0.3.14:5432" and stack
```

Streams get the same treatment. If an action returns a stream and throws mid-stream, the error surfacing from the iterable is sanitized identically. There is no side door where the raw message slips out just because the response happened to be a stream.

# The throws that are not errors

One category of throw is not a failure, and WebJs is careful to leave it alone. `redirect()`, `notFound()`, `forbidden()`, and `unauthorized()` are implemented as throws, but they are control flow. You throw `redirect('/login')` to mean "stop here and send the user to login," and that intent has to survive. The sanitizer recognizes these and passes them through verbatim. A `redirect()` still redirects, a `notFound()` still renders your 404. Only an actual unexpected error, the kind that carries a driver string or a stack, collapses into the generic message plus digest.

# Where your real error messages belong

If the generic message is all the client gets, how do you show a user "Email already taken"? You do not throw it. You return it.

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

That is the clean line. A `return { success: false, error }` is a message you deliberately chose to show, so it reaches the client as written. A `throw` is for the unexpected, so it gets sanitized. The envelope is your intentional-message channel, the throw is your panic channel, and only the panic channel is redacted. Once that split clicks, you stop reaching for `throw new Error('nice message')` and start returning the message on the envelope where it belongs.

# The boundary it covers, and dev

Two edges are worth knowing. This protection lives on the action RPC boundary, the path a client component's imported action takes. It does not cover a hand-written `route.ts` REST endpoint, including one built with the `route()` adapter. That handler is raw HTTP you wrote on purpose, so the responsibility is yours. Authenticate it, validate the input, log without leaking secrets into the response, and rate-limit it. The framework hands you the pieces (`validate`, the auth helpers, `rateLimit()`), but it will not redact a message you chose to send from a route you chose to write.

The other edge is that sanitization is a production behaviour only. In development the real message still surfaces in the browser and the error overlay, because when you are building you want the driver string and the stack right in front of you. Debugging a `connect ECONNREFUSED` as "Something went wrong (digest: a1b9f4c2)" on your own machine would be miserable. Only prod redacts. Dev tells you everything.

# Safe by default, still debuggable

An error message is a debugging aid, not a user-facing string. In production WebJs treats it that way by default, redacting a thrown action's real message down to a generic string and handing you a `digest` so you correlate the browser's report with the full stack in your logs and give up no debuggability at all. Keep your intentional messages on the `ActionResult` envelope, let control-flow throws pass through, and remember it guards the action boundary, so a `route.ts` you write is yours to secure.
