// File storage: a no-JS upload. A multipart <form> posts to this page's `action`
// (the progressive-enhancement write path); the action calls a 'use server'
// helper that streams the bytes into the FileStore. On success it redirects
// (PRG) with the new key in the query, and the page renders a download link that
// streams the file back through file/[key]/route.ts. Works with JS off; the
// client router applies the same flow in place with JS on.
import { html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { cardClass } from '#components/ui/card.ts';
import { pageHeading, lede } from '#lib/utils/ui.ts';
import type { Metadata } from '@webjsdev/core';
import { storeUpload } from '#modules/file-storage/actions/store-upload.server.ts';

export const metadata: Metadata = { title: 'File storage (upload + serve) | features' };

export async function action({ formData }: { formData: FormData }) {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Choose a file to upload.' };
  }
  const result = await storeUpload(file);
  if (!result.success) return result;
  const { key, name, size } = result.data;
  const q = new URLSearchParams({ key, name, size: String(size) });
  return { success: true, redirect: '/features/file-storage?' + q.toString() };
}

export default function FileStorageExample({
  searchParams,
  actionData,
}: {
  searchParams: Record<string, string | undefined>;
  actionData?: { error?: string };
}) {
  const key = (searchParams.key || '').trim();
  const name = (searchParams.name || '').trim();
  const size = (searchParams.size || '').trim();
  return html`
    ${pageHeading('File storage')}
    ${lede(html`
      Upload a file: the bytes stream into the FileStore (a local
      <code class="font-mono">.webjs/uploads</code> directory by default,
      gitignored). Swap the backend for S3/R2 with one
      <code class="font-mono">setFileStore()</code> call, no call-site change.
    `)}
    <form method="post" enctype="multipart/form-data" class="flex flex-wrap gap-3 items-center mb-4">
      <input type="file" name="file" required aria-label="Choose a file to upload"
        class="text-sm text-muted-foreground file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-card file:border file:border-border file:text-foreground file:text-sm file:cursor-pointer" />
      <button type="submit"
        class=${buttonClass()}>Upload</button>
    </form>
    ${actionData?.error
      ? html`<p class="text-destructive text-sm mb-4">${actionData.error}</p>`
      : ''}
    ${key
      ? html`
        <div class="${cardClass('rounded-xl')} px-4 py-3 text-sm">
          Stored <span class="text-foreground font-medium">${name}</span>
          <span class="text-muted-foreground">(${size} bytes)</span>
          <a class="text-primary no-underline ml-2" href="/features/file-storage/file/${key}">download</a>
        </div>`
      : ''}
  `;
}
