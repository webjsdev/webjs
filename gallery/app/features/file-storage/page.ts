// A no-JS upload: a form bound to a 'use server' action streams the bytes into
// the FileStore (the framework emits the multipart enctype). On success the
// action redirects with the key in the query and the page links to
// file/[key]/route.ts, which streams the file back.
import { html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { cardClass } from '#components/ui/card.ts';
import { pageHeading, lede } from '#lib/utils/ui.ts';
import type { Metadata } from '@webjsdev/core';
import { storeUpload } from '#modules/file-storage/actions/store-upload.server.ts';

export const metadata: Metadata = { title: 'File storage (upload + serve) | features' };

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
    <form action=${storeUpload} class="flex flex-wrap gap-3 items-center mb-4">
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
