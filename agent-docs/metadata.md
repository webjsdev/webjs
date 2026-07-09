# Metadata API: full field reference

Page modules export `metadata` (static) or `generateMetadata(ctx)`
(request-scoped). Values flow into `<head>` at SSR time and merge across
nested layouts (deeper wins). Surface is Next.js-compatible.

## Type it with `Metadata`

WebJs exports a `Metadata` type covering every field below, so a typo
(`titel`, `descripton`), wrong nesting, or a wrong-typed value
(`themeColor: 123`) is a tsserver / checkJs error instead of a silently
dropped tag. Import it from `@webjsdev/core` (the same isomorphic surface
a page already imports `html` from). `MetadataContext` types the
`generateMetadata(ctx)` argument.

```ts
import type { Metadata, MetadataContext } from '@webjsdev/core';

// static
export const metadata: Metadata = { title: 'Home', description: 'Welcome' };

// request-scoped
export async function generateMetadata(ctx: MetadataContext): Promise<Metadata> {
  return { title: `Post: ${ctx.params.slug}` };
}
```

Every field is optional. Where the framework accepts a string OR an
object (`title`, `viewport`, `robots`, `appleWebApp`, `icons`), the type
is a union, so both forms type-check. The type lives in
`packages/core/src/metadata.d.ts` (types-only, zero runtime, no build);
it mirrors exactly what `packages/server/src/ssr.js` consumes.

```ts
export const metadata = {
  // ----- Identity -----
  title: 'Blog post title',                          // → <title>
  // OR { template, default, absolute }. The template propagates from
  // outer layouts, and deeper plain-string titles get wrapped via "%s".
  // title: { template: '%s | webjs', default: 'webjs', absolute: 'standalone title' },
  description: 'Short summary',                      // → <meta name="description">
  keywords: ['ai', 'web components'],                // → <meta name="keywords"> (or single string)
  authors: [{ name: 'Vivek', url: 'https://...' }],  // → <meta name="author"> (+ optional <link rel="author">)
  creator: 'Vivek',                                  // → <meta name="creator">
  publisher: 'My Co',                                // → <meta name="publisher">
  applicationName: 'webjs',                          // → <meta name="application-name">
  generator: 'webjs 0.5',                            // → <meta name="generator">
  referrer: 'origin-when-cross-origin',              // → <meta name="referrer">

  // ----- Base URL for relative metadata URLs -----
  metadataBase: 'https://example.com',
  // Any relative URL in openGraph.image, openGraph.url, twitter.image,
  // alternates.canonical / languages / media / types, icons, authors[].url,
  // archives / assets / bookmarks gets resolved against this base.

  // ----- Viewport / theme -----
  viewport: 'width=device-width,initial-scale=1',    // string OR object
  // viewport: { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true },
  // (or split-export: `export const viewport = { … }`, the Next.js 14+ style)
  themeColor: '#1c1613',                             // → <meta name="theme-color">
  colorScheme: 'light dark',                         // → <meta name="color-scheme">

  // ----- Crawler / SEO -----
  robots: { index: true, follow: true, googleBot: 'index, max-snippet:-1' },
  // OR robots: 'noindex, nofollow'
  alternates: {
    canonical: '/post',                              // → <link rel="canonical">
    languages: { 'es-ES': '/es', 'fr-FR': '/fr' },   // → hreflang <link>s
    media: { '(max-width: 600px)': '/mobile' },      // → media alternates
    types: { 'application/rss+xml': '/rss.xml' },    // → RSS / Atom alternates
  },
  verification: {
    google: 'token',                                 // → <meta name="google-site-verification">
    yandex: 'token',                                 // → <meta name="yandex-verification">
    yahoo: 'token',                                  // → <meta name="y_key">
    me: 'https://me.example',                        // → <meta name="me"> (IndieAuth)
    other: { 'facebook-domain-verification': 'fb-token' },
  },

  // ----- Icons + manifest -----
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-32.png', sizes: '32x32' }],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
    other: [{ rel: 'mask-icon', url: '/mask.svg' }],
  },
  manifest: '/manifest.webmanifest',                 // → <link rel="manifest">

  // ----- Open Graph -----
  openGraph: {
    type: 'website',
    title: 'OG title',
    description: 'OG description',
    url: '/post',                                    // relative resolves via metadataBase
    image: '/og.png',                                // ditto
    'image:width': '1200',
    'image:height': '630',
    'image:alt': 'Post cover',
    'site_name': 'My Site',
  },

  // ----- Twitter -----
  twitter: {
    card: 'summary_large_image',                     // required for big-image preview
    title: 'Twitter title',
    description: 'Twitter description',
    image: '/og.png',
  },

  // ----- iOS / mobile -----
  appleWebApp: {
    capable: true,                                   // → apple-mobile-web-app-capable
    title: 'My App',                                 // → apple-mobile-web-app-title
    statusBarStyle: 'black-translucent',
    startupImage: [{ url: '/splash.png', media: '(device-width: 320px)' }],
  },
  formatDetection: { telephone: false, email: false },
  itunes: { appId: '12345', appArgument: 'myapp://open' },

  // ----- Long-tail descriptive -----
  category: 'tech',
  classification: 'documentation',
  abstract: 'A short summary',
  archives: ['/archive-2024', '/archive-2023'],      // → <link rel="archives">
  assets: '/assets-cdn',                             // → <link rel="assets">
  bookmarks: ['/bm-1'],                              // → <link rel="bookmark">

  // ----- Cache-control (response header, not <meta>) -----
  cacheControl: 'public, max-age=60',                // pages default to no-store
  preload: [
    { href: '/public/fonts/Inter.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
  ],

  // ----- Connection-warming hints (#243) -----
  preconnect: [                                      // → <link rel="preconnect">
    'https://api.example.com',                       //   warms DNS + TLS + TCP
    { url: 'https://fonts.gstatic.com', crossorigin: true },
  ],
  dnsPrefetch: 'https://analytics.example.com',      // → <link rel="dns-prefetch"> (DNS only)

  // ----- Catch-all -----
  other: {
    'msvalidate.01': 'bing-token',
    'mobile-web-app-capable': 'yes',
  },

  // ----- JSON-LD structured data (schema.org) -----
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How webjs ships zero dead JS',
    author: { '@type': 'Person', name: 'Vivek' },
    datePublished: '2026-06-01',
  },
};
```

## Request-scoped via `generateMetadata`

```ts
import type { Metadata, MetadataContext } from '@webjsdev/core';

export function generateMetadata(ctx: MetadataContext): Metadata {
  return {
    title: `Post: ${ctx.params.slug}`,
    metadataBase: new URL(ctx.url).origin,
  };
}
```

## Split viewport export (Next.js 14+ pattern)

All fields above under `metadata.viewport` are equally valid here, plus
`themeColor` and `colorScheme` bubble up to their own meta tags.

```ts
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1613',
  colorScheme: 'light dark',
};
```

## Special: `cacheControl`

Emitted as a **response header**, not a `<meta>` tag. Pages default to
`no-store` for safety. Opt into caching by setting this explicitly.

A **public** value (e.g. `public, max-age=60`) also enables conditional
GET on the page (#240): the buffered HTML response gets a weak content-hash
`ETag` (`W/"..."`) and a repeat request whose `If-None-Match` matches it
returns a `304 Not Modified` with no body. A `no-store` or `private` page
gets NO ETag and never 304s, so private / per-user content is never
revalidated across sessions. A streamed Suspense response is not ETagged.
See the conditional-GET section in the framework root `AGENTS.md`.

## Connection-warming: `preconnect` / `dnsPrefetch` (#243)

Warm a cross-origin connection the page is about to use (an API host, a
font / image CDN) so the browser pays the DNS + TLS + TCP cost ahead of the
first real request:

```ts
export const metadata = {
  preconnect: [
    'https://api.example.com',                              // bare URL
    { url: 'https://fonts.gstatic.com', crossorigin: true },// crossorigin set
  ],
  dnsPrefetch: 'https://analytics.example.com',             // a single URL
};
```

- **`preconnect`** emits `<link rel="preconnect" href="..." [crossorigin]>`,
  warming DNS + TLS + TCP. Each entry is a URL string or
  `{ url, crossorigin? }` (`crossorigin: true` / `''` emits a bare
  `crossorigin`; a string like `'anonymous'` emits its value). A font CDN
  needs `crossorigin`.
- **`dnsPrefetch`** emits `<link rel="dns-prefetch" href="...">`, which
  resolves DNS only (a lighter-weight precursor; it never carries
  `crossorigin`).
- Each field takes a URL string, the object form, or an array of either.
  Every href is HTML-escaped.

**Auto vendor preconnect.** For an UNPINNED app resolving vendors live from
a cross-origin CDN, the framework auto-emits ONE
`<link rel="preconnect" href="<cdn-origin>" crossorigin>` (the resolved
vendor CDN origin, e.g. `https://ga.jspm.io`, derived from the importmap so
a `--from jsdelivr` app preconnects to jsdelivr), so the browser warms that
connection before the importmap resolves. It is DEDUPED against an
author-declared `preconnect` to the same origin, and NONE is emitted for a
same-origin pinned app (vendors served from the app's own origin) or an app
with no cross-origin vendors.

## JSON-LD structured data (`jsonLd`)

`metadata.jsonLd` emits schema.org structured data as one or more
`<script type="application/ld+json">` blocks in `<head>`. This is the
highest-leverage modern SEO surface (Google's Article, Product,
BreadcrumbList, Organization, and FAQ rich results all read it). WebJs
stays true to its no-build identity here. JSON-LD is a web standard
rendered as a plain script tag, so the framework ONLY serializes and
escapes. There is no schema library and no validation. **You own the
schema.org object.**

**Single object** emits one script:

```ts
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How webjs ships zero dead JS',
    author: { '@type': 'Person', name: 'Vivek' },
    datePublished: '2026-06-01',
    image: 'https://example.com/og.png',
  },
};
```

renders:

```html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article",...}</script>
```

**An array** emits one script PER element. Use it to ship several graphs
for one page (a Product alongside its BreadcrumbList, say):

```ts
export const metadata: Metadata = {
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Acme Widget',
      offers: { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Shop', item: 'https://example.com/shop' },
        { '@type': 'ListItem', position: 2, name: 'Widget', item: 'https://example.com/shop/widget' },
      ],
    },
  ],
};
```

**Per-request data** works the same way through `generateMetadata`, so a
dynamic route can build the Article from the loaded record:

```ts
import type { Metadata, MetadataContext } from '@webjsdev/core';

export async function generateMetadata(ctx: MetadataContext): Promise<Metadata> {
  const post = await getPost(ctx.params.slug);   // via a server query
  return {
    title: post.title,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      datePublished: post.publishedAt,
      author: { '@type': 'Person', name: post.authorName },
    },
  };
}
```

### Escaping guarantee

The serialized JSON is HTML-safe-escaped automatically. `<`, `>`, `&`,
and the line separators U+2028 / U+2029 are replaced with their JSON
Unicode escapes (`<` and friends). A JSON parser decodes those back to
the original characters, so the embedded data still parses to your exact
object, while the literal byte sequence `</script>` can never form in the
served HTML. So a value containing `</script><img src=x onerror=...>`
cannot break out of the script tag. You do not escape anything yourself.

The block is a NON-EXECUTABLE data island (`type="application/ld+json"`),
so a Content-Security-Policy `script-src` does not gate it and it carries
NO nonce.

### Robustness

The framework fails SAFE per element. An entry that is not a plain object,
or an object with a circular reference that `JSON.stringify` cannot
serialize, is skipped (with a one-line `console.warn`) and never breaks
the rest of the head. Absent `jsonLd` emits nothing (the field is purely
additive).
