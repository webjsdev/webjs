---
title: "File Uploads and Storage in WebJs: FileStore, Signed URLs, S3-Ready"
date: 2026-06-10T10:00:00+05:30
slug: file-uploads-and-storage
description: "How WebJs handles file uploads with a built-in FileStore and diskStore default: streaming multipart uploads, path-traversal-safe keys, signed URLs for private files, and an S3-ready swap that never touches your call sites."
tags: file-upload, storage, s3, server-actions, security
author: Vivek
---

Let me set the scene with the feature every app eventually grows: a user wants to upload an avatar. Or attach a PDF to a support ticket. Or drop an image into a post. It sounds like a five-minute job, and then you open your editor and remember why it never is.

You have to parse the multipart request (the special encoding a browser uses to send a file plus form fields in one POST). You have to decide where the bytes actually land, because a file is not a row in your database. You have to serve it back later without letting one user read another user's private file. And you have to do all of that in a way you will not have to rewrite the day you outgrow the local disk and move to S3. Four separate problems wearing one innocent-looking trench coat.

WebJs ships a built-in for this. It is small, it is streaming, and it is deliberately shaped so the local-disk version and the S3 version are the same code.


# The upload half: a File that just arrives

The first pleasant surprise is that you do not hand-parse anything. A WebJs server action (a function in a `*.server.ts` file marked `'use server'`) can receive a native `File`, a `Blob`, or a whole `FormData` as an argument, because the wire serializer round-trips them for you. You call the action from a client component with a normal import, and on the server you get a real `File` object.

```ts
// modules/uploads/actions/upload-avatar.server.ts
'use server';
import { getFileStore, generateKey } from '@webjsdev/server';

export async function uploadAvatar(file: File) {
  const store = getFileStore();
  const key = generateKey(file.name);          // opaque, safe key
  const { size, contentType } = await store.put(key, file);
  return { success: true, data: { key, size, contentType } };
}
```

The `store.put(key, file)` call streams the bytes to storage. Streaming matters more than it sounds. A naive upload reads the entire file into memory before writing it, so a handful of users sending 50 MB videos at once can knock your server over. WebJs pipes the file's stream straight to disk, so a large upload uses roughly constant memory no matter how big it is.

You also want a guardrail on how big an upload is allowed to be in the first place. That lives in your `package.json` config, not in the action.

```jsonc
// package.json
{
  "webjs": {
    "maxMultipartBytes": 10485760
  }
}
```

That cap (default 10 MiB) bounds the request before the bytes ever reach the store, so an oversized upload is rejected at the door. The store stays simple and just keeps streaming whatever it is handed.


# Why you never use the filename as the key

Notice I called `generateKey(file.name)` instead of storing the file under its original name. This is the part beginners get bitten by, so it is worth spelling out.

A "key" is just the identifier the store files the bytes under. If you trust a user-supplied filename as the key, a malicious user names their file `../../etc/passwd` and now your write (or a later read) tries to escape your uploads folder and touch a system file. That escape trick is called path traversal, and it is one of the oldest holes in the book.

WebJs closes it in two layers. Every key is resolved to an absolute path and rejected if it lands outside the store directory, so a key with `..`, a leading slash, a NUL byte, or a backslash throws before any filesystem operation runs. And `generateKey(filename)` hands you a random UUID-based key that keeps only a sanitized, whitelisted file extension from the original name. A hostile `'../../x.sh'` comes back as a bare opaque key with no path and no dangerous extension. Use it, and the traversal problem simply cannot exist in your app.


# The diskStore default, and serving files back

Out of the box the file store is a `diskStore` rooted at `<cwd>/.webjs/uploads`, served under `/uploads`. You add that directory to `.gitignore` (it holds user data, not source) and you are done for local development. Override the location at startup if you want:

```ts
import { setFileStore, diskStore } from '@webjsdev/server';
setFileStore(diskStore({ dir: '/var/data/uploads', baseUrl: '/files' }));
```

Serving a file back is a `route.ts` handler that reads a streaming handle from the store and hands its body to a `Response`, so the file streams to the browser without being loaded into memory. One caveat that is genuinely important. The content-type recorded on an upload is the one the browser claimed at upload time, so it is attacker-controlled. A route that reflects it inline lets someone upload HTML dressed up as an image and run script on your origin (stored XSS). The fix is to send `X-Content-Type-Options: nosniff` and a `Content-Disposition: attachment` for anything a user uploaded, and only ever serve inline from a strict allowlist of inert types you have validated. Serving uploads from a separate cookieless origin is the strongest version of that mitigation.


# Signed URLs: a private file without a session lookup

Some files are public. Some are not, and you do not want the serving route doing a database session check on every image request. That is what a signed URL is for. It is a time-limited link that carries its own proof of permission.

```ts
import { signedUrl, verifySignedUrl } from '@webjsdev/server';

// mint a link that is valid for one hour
const url = signedUrl(key, { secret: process.env.AUTH_SECRET, expiresIn: 3600 });

// in the serving route.ts
const check = verifySignedUrl(new URL(request.url).searchParams, process.env.AUTH_SECRET);
if (!check.valid) return new Response('Forbidden', { status: 403 });
```

Under the hood WebJs signs the exact key plus its expiry with HMAC-SHA256 (a keyed hash, so nobody without the secret can forge or tamper with the link), and the comparison is constant-time. Neither the key nor the expiry can be edited after the fact without the signature failing. A nice safety detail: passing `expiresIn: 0` or a negative number fails closed, so a "no access" intent never silently becomes a one-hour grant. The one-hour default only applies when you omit `expiresIn` entirely.


# The day you move to S3

Here is the payoff that makes all of the above worth it. Every method on the store operates on web-standard objects only: a `File` goes in, a streaming handle comes out. So an S3 (or R2, or GCS, or MinIO) adapter is a drop-in that implements the same `put`, `get`, `delete`, and `url` against the cloud SDK. Because the shape is identical, moving your whole app off local disk is one line at startup.

```ts
setFileStore(s3Store({ /* ... */ }));
```

Not one call site changes. Your `uploadAvatar` action, your serving route, your signed URLs all keep working. WebJs ships no S3 SDK itself (no dependency you did not ask for); the adapter is a thin wrapper you provide. That is the whole point of putting the interface first. The thing you build on a Friday afternoon with `diskStore` is the same thing you scale in production, minus the rewrite.


# The takeaway

File uploads feel like a rite of passage because most stacks make you assemble four things by hand: multipart parsing, a place for the bytes, safe serving, and an eventual cloud migration. WebJs folds them into one built-in. A server action receives a native `File` because the serializer round-trips it, `store.put` streams it so a big upload does not eat your memory, `generateKey` gives you a path-traversal-safe key so a malicious filename cannot escape, and `signedUrl` gates a private file without a session lookup. The `diskStore` default gets you running with zero config, and the web-standard interface means swapping to S3 is one `setFileStore` call with no change to a single call site. Write it once on disk, ship it to the cloud unchanged.
