/**
 * A redirect target as an HTTP header value.
 *
 * A header value must be a ByteString, so `new Response(null, { headers: {
 * location: '/日本' } })` throws ("Cannot convert argument to a ByteString")
 * inside the very catch block that is answering a thrown `redirect()`, which
 * turns a navigation into a 500. Next.js percent-encodes the target, so this
 * does the same for every run of characters outside visible ASCII (a space
 * included) and leaves everything else, an existing `%xx` escape among it,
 * untouched. Applied at every site that answers a thrown `redirect()`. A lone
 * surrogate (half an emoji, from truncated user input) is replaced with U+FFFD
 * first, since encodeURIComponent throws URIError on one.
 *
 * @param {unknown} url
 * @returns {string}
 */
export function headerSafeLocation(url) {
  return String(url).replace(/[^\x21-\x7e]+/gu, (run) => encodeURIComponent(run.toWellFormed()));
}
