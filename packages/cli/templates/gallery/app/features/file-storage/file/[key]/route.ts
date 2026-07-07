// Serves a stored file back by key. getFileStore().get(key) returns the bytes as
// a web ReadableStream (streamed, never buffered whole into memory) plus the
// content type recorded at upload. A route.ts is server-only, so importing the
// storage singleton here is safe. The [key] segment is validated inside the
// store (traversal-safe), so a crafted key cannot escape the uploads directory.
import { getFileStore } from '@webjsdev/server';

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const file = await getFileStore().get(params.key);
  if (!file) return new Response('Not found', { status: 404 });
  // file.body is a web ReadableStream at runtime (the diskStore streams the
  // bytes); the store's type is a Node/web union, so narrow it for Response.
  return new Response(file.body as ReadableStream<Uint8Array>, {
    headers: {
      'content-type': file.contentType,
      'content-length': String(file.size),
    },
  });
}
