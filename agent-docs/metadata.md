# Metadata API — full field reference

Page modules export `metadata` (static) or `generateMetadata(ctx)`
(request-scoped). Values flow into `<head>` at SSR time and merge across
nested layouts (deeper wins). Surface is Next.js-compatible.

```ts
export const metadata = {
  // ----- Identity -----
  title: 'Blog post title',                          // → <title>
  // OR { template, default, absolute } — template propagates from
  // outer layouts; deeper plain-string titles get wrapped via "%s".
  // title: { template: '%s — webjs', default: 'webjs', absolute: 'standalone title' },
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
  // (or split-export: `export const viewport = { … }` — Next.js 14+ style)
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

  // ----- Catch-all -----
  other: {
    'msvalidate.01': 'bing-token',
    'mobile-web-app-capable': 'yes',
  },
};
```

## Request-scoped via `generateMetadata`

```ts
export function generateMetadata(ctx: { url: string; params: Record<string,string> }) {
  return {
    title: `Post — ${ctx.params.slug}`,
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
`no-store` for safety; opt into caching by setting this explicitly.
