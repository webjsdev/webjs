// 'use server' so the page's action can call it (server-side, a direct call) and
// it never crashes the browser module that imports it (the client gets a safe
// RPC stub, not the node:fs code). getFileStore() is the pluggable storage
// singleton: a local diskStore rooted at <cwd>/.webjs/uploads by default
// (gitignored), swappable for S3/R2/GCS with one setFileStore() call at boot.
// generateKey() mints a collision-free, traversal-safe key preserving a
// whitelisted extension.
'use server';
import { getFileStore, generateKey } from '@webjsdev/server';

export async function storeUpload(file: File) {
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: 'No file provided.' };
  }
  const key = generateKey(file.name);
  const { size, contentType } = await getFileStore().put(key, file, { contentType: file.type });
  return { success: true as const, data: { key, name: file.name, size, contentType } };
}
