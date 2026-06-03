/**
 * Compile-time type tests for the webjs `Metadata` type (#257).
 *
 * This file is NOT executed by `node:test`. It is consumed by tsserver in
 * your editor and by `tsc --noEmit`. A valid metadata object must type-check
 * clean; every `// @ts-expect-error` line asserts that a typo or wrong-typed
 * value is REJECTED (tsc fails if the line stops being an error, so this
 * doubles as the counterfactual: removing a field from the type, or widening
 * it, breaks the build here).
 *
 * To verify manually:
 *   npx -p typescript@5.6 tsc --noEmit --strict --target esnext \
 *     --moduleResolution bundler test/types/metadata-types.test-d.ts
 */

import type { Metadata, MetadataContext } from '@webjsdev/core';

/* ------------- A fully-populated, valid metadata object ------------- */

const full: Metadata = {
  title: 'Blog post',
  description: 'Short summary',
  keywords: ['ai', 'web components'],
  authors: [{ name: 'Vivek', url: 'https://example.com' }],
  creator: 'Vivek',
  publisher: 'My Co',
  applicationName: 'webjs',
  generator: 'webjs',
  referrer: 'origin-when-cross-origin',
  metadataBase: 'https://example.com',
  viewport: { width: 'device-width', initialScale: 1, userScalable: true },
  themeColor: '#1c1613',
  colorScheme: 'light dark',
  robots: { index: true, follow: true, googleBot: 'index, max-snippet:-1' },
  alternates: {
    canonical: '/post',
    languages: { 'es-ES': '/es' },
    media: { '(max-width: 600px)': '/mobile' },
    types: { 'application/rss+xml': '/rss.xml' },
  },
  verification: { google: 'token', other: { 'facebook-domain-verification': 'fb' } },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-32.png', sizes: '32x32' }],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
    other: [{ rel: 'mask-icon', url: '/mask.svg' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    title: 'OG title',
    url: '/post',
    image: '/og.png',
    'image:width': '1200',
    site_name: 'My Site',
  },
  twitter: { card: 'summary_large_image', title: 'T', image: '/og.png' },
  appleWebApp: { capable: true, title: 'My App', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  itunes: { appId: '12345', appArgument: 'myapp://open' },
  category: 'tech',
  classification: 'documentation',
  abstract: 'A short summary',
  archives: ['/archive-2024'],
  assets: '/assets-cdn',
  bookmarks: ['/bm-1'],
  cacheControl: 'public, max-age=60',
  preload: [{ href: '/fonts/Inter.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }],
  other: { 'msvalidate.01': 'bing-token' },
};
void full;

/* ------------- Accepted union variants ------------- */

const stringForms: Metadata = {
  title: { template: '%s | webjs', default: 'webjs' },
  viewport: 'width=device-width,initial-scale=1',
  robots: 'noindex, nofollow',
  appleWebApp: true,
  icons: '/favicon.ico',
  authors: 'Vivek',
};
void stringForms;

/* ------------- Rejected: misspelled top-level fields ------------- */

// @ts-expect-error `titel` is a typo for `title`.
const typo1: Metadata = { titel: 'Home' };
void typo1;

// @ts-expect-error `descripton` is a typo for `description`.
const typo2: Metadata = { descripton: 'x' };
void typo2;

/* ------------- Rejected: wrong-typed values ------------- */

// @ts-expect-error themeColor must be a string, not a number (#257 acceptance).
const wrong1: Metadata = { themeColor: 123 };
void wrong1;

// @ts-expect-error description must be a string.
const wrong2: Metadata = { description: 42 };
void wrong2;

// @ts-expect-error openGraph must be an object, not a string.
const wrong3: Metadata = { openGraph: 'website' };
void wrong3;

// @ts-expect-error twitter.card is a fixed union; 'huge' is not a member.
const wrong4: Metadata = { twitter: { card: 'huge' } };
void wrong4;

// @ts-expect-error robots.index must be a boolean, not a string.
const wrong5: Metadata = { robots: { index: 'yes' } };
void wrong5;

/* ------------- generateMetadata return + context typing ------------- */

async function generateMetadata(ctx: MetadataContext): Promise<Metadata> {
  return { title: `Post: ${ctx.params.slug}`, metadataBase: new URL(ctx.url).origin };
}
void generateMetadata;

export {};
