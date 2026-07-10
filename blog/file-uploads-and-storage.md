---
title: "File Uploads and Storage in WebJs: FileStore, Signed URLs, S3-Ready"
date: 2026-06-10T10:00:00+05:30
slug: file-uploads-and-storage
description: "How WebJs handles file uploads with a built-in FileStore and diskStore default: streaming multipart uploads, path-traversal-safe keys, signed URLs for private files, and an S3-ready swap that never touches your call sites."
tags: file-upload, storage, s3, server-actions, security
author: Vivek
---

A user wants to set an avatar. That is the whole feature, and it is the feature that has humbled me more times than it should have. It reads like a five-minute job, and then you open the editor and remember there are really four problems hiding inside it. You have to parse the upload. You have to decide where the bytes actually land, because a file is not a row in your database. You have to serve it back later without letting one user read another user's private file. And you have to do all of it in a way you will not be rewriting the day you outgrow the local disk. Four problems wearing one innocent-looking trench coat.

I will build it the way I actually build it, one piece at a time, and you will see WebJs take each of the four off the table as we go.

# Start with the form

The browser side is a component with a file input. When the chosen file changes, you call a server action and pass the `File` straight to it.

```ts
class AvatarUpload extends WebComponent({}) {
  async onChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await uploadAvatar(file);   // pass the File itself
    if (result.success) {
      this.dispatchEvent(new CustomEvent('uploaded', { detail: result.data }));
    }
  }

  render() {
    return html`<input type="file" accept="image/*" @change=${(e: Event) => this.onChange(e)} />`;
  }
}
AvatarUpload.register('avatar-upload');
```

That is the part that surprised me the first time. You never touch multipart parsing. Multipart is the special encoding a browser uses to send a file and form fields together in one POST, and normally you pull in a library to dig the file back out of it. Here the file is just an argument. A WebJs server action can receive a native `File`, a `Blob`, or a whole `FormData`, because the wire serializer round-trips them, so on the server you get a real `File` object with a real `.stream()`.

# The action that receives the File

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

Two things earn their keep in those few lines. `store.put(key, file)` streams the bytes to storage instead of reading the whole file into memory first, and that distinction is easy to skim past and expensive to get wrong. A naive handler buffers the entire upload in RAM before it writes a single byte, so a handful of users pushing 50 MB videos at the same time can take the process down. WebJs pipes the file's stream straight to disk, so the memory a big upload costs you stays roughly flat no matter how large it gets.

The second thing is `generateKey`, and it deserves its own section.

# Never trust the filename

A "key" is just the identifier the store files the bytes under, and the tempting move is to use the uploaded filename as the key. Do not. Name a file `../../etc/passwd` and a key you trusted now tries to walk out of your uploads folder and clobber a system file. That escape is path traversal, one of the oldest holes there is.

WebJs closes it in two layers. Every key is resolved to an absolute path and rejected if it lands outside the store directory, so a key with `..`, a leading slash, a NUL byte, or a backslash throws before any filesystem call runs. And `generateKey(filename)` hands you a random UUID-based key that keeps only a sanitized, whitelisted file extension from the original name. A hostile `'../../x.sh'` comes back as a bare opaque key with no path and no dangerous extension. Use it, and the traversal problem cannot exist in your app in the first place.

While we are at the front door, cap the request size there too, in config rather than in the action.

```jsonc
// package.json
{
  "webjs": {
    "maxMultipartBytes": 10485760
  }
}
```

That cap (10 MiB by default) bounds the request before the bytes ever reach the store, so an oversized upload is turned away at the door and the store just keeps streaming whatever it is handed.

# Where the bytes land, and getting them back

Out of the box the store is a `diskStore` rooted at `<cwd>/.webjs/uploads` and served under `/uploads`. Add that directory to `.gitignore` (it holds user data, not source) and local development is done. Move it wherever you want at startup:

```ts
import { setFileStore, diskStore } from '@webjsdev/server';
setFileStore(diskStore({ dir: '/var/data/uploads', baseUrl: '/files' }));
```

Serving a file back is a `route.ts` handler that reads a streaming handle from the store and hands its body to a `Response`, so the file streams to the browser without being loaded into memory on the way out.

One caveat here is genuinely important, not boilerplate. The content-type recorded on an upload is whatever the browser claimed at upload time, which makes it attacker-controlled. A route that reflects that type inline lets someone upload HTML dressed up as an image and run script on your origin, which is stored XSS. Send `X-Content-Type-Options: nosniff` and a `Content-Disposition: attachment` for anything a user uploaded, and only ever serve inline from a strict allowlist of inert types you have validated yourself. Serving uploads from a separate cookieless origin is the strongest version of that.

# Private files without a session lookup on every request

Some files are public and some are not, and you do not want the serving route running a database session check on every single image request. A signed URL is the answer. It is a time-limited link that carries its own proof of permission.

```ts
import { signedUrl, verifySignedUrl } from '@webjsdev/server';

// mint a link that is valid for one hour
const url = signedUrl(key, { secret: process.env.AUTH_SECRET, expiresIn: 3600 });

// in the serving route.ts
const check = verifySignedUrl(new URL(request.url).searchParams, process.env.AUTH_SECRET);
if (!check.valid) return new Response('Forbidden', { status: 403 });
```

WebJs signs the exact key plus its expiry with HMAC-SHA256 (a keyed hash, so nobody without the secret can forge or tamper with the link) and compares in constant time. Edit the key or the expiry after the fact and the signature stops matching. One detail I appreciate is that `expiresIn: 0` or a negative number fails closed, so a "no access" intent never quietly becomes a one-hour grant. The one-hour default only kicks in when you omit `expiresIn` entirely.

# The day you move to S3

This is the part that makes the earlier discipline pay off. Every method on the store speaks web-standard objects only. A `File` goes in, a streaming handle comes out. So an S3 adapter (or R2, or GCS, or MinIO) is a drop-in that implements the same `put`, `get`, `delete`, and `url` against the cloud SDK. Because the shape matches, moving the whole app off local disk is one line at startup.

```ts
setFileStore(s3Store({ /* ... */ }));
```

Not one call site changes. `uploadAvatar`, the serving route, the signed URLs, all of it keeps working untouched. WebJs ships no S3 SDK of its own, so you are not dragging in a dependency you did not ask for; the adapter is a thin wrapper you provide. That is the entire reason for putting the interface first. What you build on a Friday afternoon against `diskStore` is the same thing you run in production, minus the rewrite.

# Four problems in one trench coat

An avatar upload only looks small. It is really four problems in one trench coat: multipart parsing, a home for the bytes, safe serving, and an eventual cloud migration. Built one step at a time in WebJs, each of them quietly falls away. The action receives a native `File` because the serializer round-trips it, `store.put` streams it so a big file does not eat your memory, `generateKey` gives you a traversal-safe key so a malicious filename cannot escape, and `signedUrl` gates a private file without a session lookup. The `diskStore` default runs with zero config, and because the store speaks only web-standard objects, the swap to S3 is one `setFileStore` call with no change to a single call site. Write it once on disk, ship it to the cloud unchanged.
