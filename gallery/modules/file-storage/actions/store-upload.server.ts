'use server';

// The directive comes first: the framework reads it from the file's first
// lines, so a long header above it would stop the file registering as an
// action. The upload form's action pulls the File out of the FormData;
// getFileStore() is the pluggable store (a local diskStore by default, see
// ../store.server.ts) and generateKey() mints a traversal-safe key that keeps
// a whitelisted extension.
import { getFileStore, generateKey } from '@webjsdev/server';
// Importing the config module runs setFileStore() once at load.
import '../store.server.ts';

export async function storeUpload(formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: 'Choose a file to upload.' };
  }
  const key = generateKey(file.name);
  const { size, contentType } = await getFileStore().put(key, file, { contentType: file.type });
  const q = new URLSearchParams({ key, name: file.name, size: String(size) });
  return { success: true as const, redirect: '/features/file-storage?' + q.toString(), data: { key, name: file.name, size, contentType } };
}
