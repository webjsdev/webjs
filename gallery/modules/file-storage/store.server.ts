// Server-only file-store configuration, imported by the upload action and the
// serve route. `setFileStore()` swaps the active store (`diskStore()` here, an
// S3 / R2 / GCS adapter of the same shape in production). `signedUrl()` mints a
// time-limited download URL and `verifySignedUrl()` checks it, so a private file
// can be shared by link without a public serve route.
import { setFileStore, diskStore, signedUrl, verifySignedUrl } from '@webjsdev/server';

// Once at module load; this mirrors the framework default.
setFileStore(diskStore({ dir: '.webjs/uploads' }));

const URL_SECRET = process.env.FILE_URL_SECRET || 'dev-file-url-secret-change-me';

// A 1-hour signed link to the serve route for a given key.
export function signedDownloadUrl(key: string): string {
  return signedUrl(key, {
    secret: URL_SECRET,
    base: `/features/file-storage/file/${encodeURIComponent(key)}`,
    expiresIn: 3600,
  });
}

// True when a request's ?key&exp&sig params are a valid, unexpired signature.
export function isValidSignedRequest(url: string): boolean {
  return verifySignedUrl(url, URL_SECRET).valid;
}
