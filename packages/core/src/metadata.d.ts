/**
 * TypeScript overlay for the `metadata` / `generateMetadata` return shape.
 *
 * A page or layout exports `metadata` (static) or `generateMetadata(ctx)`
 * (request-scoped). Both return a plain object that the SSR pipeline
 * (packages/server/src/ssr.js) reads field by field and emits into the
 * document `<head>`. This file types that object so authors get
 * autocomplete and typo checking:
 *
 *     import type { Metadata } from '@webjsdev/core';
 *     export const metadata: Metadata = { title: 'Home', description: '…' };
 *     export async function generateMetadata(ctx: MetadataContext): Promise<Metadata> { … }
 *
 * The shape mirrors what ssr.js actually consumes (and agent-docs/metadata.md
 * documents), NOT Next.js's full superset. Every field is optional. Zero
 * runtime cost: nothing in this file ships to the browser.
 */

/** A URL or relative path. Relative values resolve against `metadataBase`. */
type MetadataUrl = string;

/** `title` accepts a plain string or the template object Next.js uses. */
export type TitleMetadata =
  | string
  | {
      /** Wraps a deeper plain-string title via the `%s` placeholder. */
      template?: string;
      /** Title used when a deeper layer supplies none. */
      default?: string;
      /** Bypasses the inherited template entirely for this layer. */
      absolute?: string;
    };

/** An author entry: a bare name, or `{ name, url? }`. */
export type AuthorMetadata = string | { name?: string; url?: MetadataUrl };

/** `viewport` object form (Next.js 14+ split-export shape). */
export interface ViewportMetadata {
  width?: string | number;
  height?: string | number;
  initialScale?: number;
  minimumScale?: number;
  maximumScale?: number;
  /** `false` emits `user-scalable=no`, `true` emits `yes`. */
  userScalable?: boolean;
  viewportFit?: 'auto' | 'contain' | 'cover';
  interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content';
  /** May also carry `themeColor` / `colorScheme` on the split `viewport` export. */
  themeColor?: string;
  colorScheme?: string;
}

/** `robots` object form (a bare string is also accepted). */
export interface RobotsMetadata {
  index?: boolean;
  follow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
  noimageindex?: boolean;
  /** Emitted verbatim as `<meta name="googlebot">`. */
  googleBot?: string;
}

/** `alternates`: canonical + i18n / media / type alternates. */
export interface AlternatesMetadata {
  canonical?: MetadataUrl;
  /** hreflang -> URL, e.g. `{ 'es-ES': '/es' }`. */
  languages?: Record<string, MetadataUrl>;
  /** media query -> URL, e.g. `{ '(max-width: 600px)': '/mobile' }`. */
  media?: Record<string, MetadataUrl>;
  /** MIME type -> URL, e.g. `{ 'application/rss+xml': '/rss.xml' }`. */
  types?: Record<string, MetadataUrl>;
}

/** Site-verification tokens. Each value is a token or list of tokens. */
export interface VerificationMetadata {
  google?: string | string[];
  yandex?: string | string[];
  yahoo?: string | string[];
  /** IndieAuth / personal `<meta name="me">`. */
  me?: string | string[];
  /** Arbitrary `<meta name="…">` verification entries. */
  other?: Record<string, string | string[]>;
}

/** A single icon descriptor. */
export type IconDescriptor =
  | MetadataUrl
  | { url: MetadataUrl; sizes?: string; type?: string };

/** `icons`: a bare URL, a list, or the bucketed object form. */
export type IconsMetadata =
  | MetadataUrl
  | IconDescriptor[]
  | {
      icon?: IconDescriptor | IconDescriptor[];
      apple?: IconDescriptor | IconDescriptor[];
      shortcut?: IconDescriptor | IconDescriptor[];
      /** Catch-all: each entry carries its own `rel`. */
      other?:
        | { rel: string; url: MetadataUrl; sizes?: string; type?: string }
        | Array<{ rel: string; url: MetadataUrl; sizes?: string; type?: string }>;
    };

/**
 * `openGraph`. Each key is emitted as `<meta property="og:<key>">`, so the
 * indexer carries the documented keys plus an open-ended fallback for the
 * `og:image:width` / `image:height` / `image:alt` style entries.
 */
export interface OpenGraphMetadata {
  type?: string;
  title?: string;
  description?: string;
  url?: MetadataUrl;
  image?: MetadataUrl;
  site_name?: string;
  [key: string]: string | undefined;
}

/** `twitter` card. Each key is emitted as `<meta name="twitter:<key>">`. */
export interface TwitterMetadata {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  title?: string;
  description?: string;
  image?: MetadataUrl;
  site?: string;
  creator?: string;
  [key: string]: string | undefined;
}

/** A startup-image entry for `appleWebApp.startupImage`. */
export type AppleStartupImage =
  | MetadataUrl
  | { url: MetadataUrl; media?: string };

/** `appleWebApp`: `true` (capable) or the descriptor object. */
export type AppleWebAppMetadata =
  | boolean
  | {
      capable?: boolean;
      title?: string;
      statusBarStyle?: 'default' | 'black' | 'black-translucent';
      startupImage?: AppleStartupImage | AppleStartupImage[];
    };

/** A `metadata.preload` link descriptor (emitted as `<link rel="preload">`). */
export interface PreloadDescriptor {
  href: MetadataUrl;
  as?: string;
  type?: string;
  crossorigin?: string;
  media?: string;
  [attr: string]: string | undefined;
}

/**
 * The return shape of `metadata` / `generateMetadata`.
 *
 * Mirrors exactly what packages/server/src/ssr.js consumes. Every field is
 * optional. Where the framework accepts a string OR an object (`title`,
 * `viewport`, `robots`, `appleWebApp`, `icons`), the type is a union.
 *
 * @see agent-docs/metadata.md for the field-by-field emission reference.
 */
export interface Metadata {
  /** -> `<title>`. Plain string or `{ template, default, absolute }`. */
  title?: TitleMetadata;
  /** -> `<meta name="description">`. */
  description?: string;
  /** -> `<meta name="keywords">`. A list is comma-joined. */
  keywords?: string | string[];
  /** -> `<meta name="author">` (+ optional `<link rel="author">`). */
  authors?: AuthorMetadata | AuthorMetadata[];
  /** -> `<meta name="creator">`. */
  creator?: string;
  /** -> `<meta name="publisher">`. */
  publisher?: string;
  /** -> `<meta name="application-name">`. */
  applicationName?: string;
  /** -> `<meta name="generator">`. */
  generator?: string;
  /** -> `<meta name="referrer">`. */
  referrer?: string;

  /** Base for resolving every relative URL in this object. */
  metadataBase?: string;

  /** -> `<meta name="viewport">`. String form OR object form. */
  viewport?: string | ViewportMetadata;
  /** -> `<meta name="theme-color">`. */
  themeColor?: string;
  /** -> `<meta name="color-scheme">`. */
  colorScheme?: string;

  /** -> `<meta name="robots">`. A string OR the object form. */
  robots?: string | RobotsMetadata;
  /** Canonical + i18n / media / type alternates. */
  alternates?: AlternatesMetadata;
  /** Site-verification tokens. */
  verification?: VerificationMetadata;

  /** Icon links. Bare URL, list, or bucketed object. */
  icons?: IconsMetadata;
  /** -> `<link rel="manifest">`. */
  manifest?: string;

  /** Open Graph tags (`<meta property="og:*">`). */
  openGraph?: OpenGraphMetadata;
  /** Twitter card tags (`<meta name="twitter:*">`). */
  twitter?: TwitterMetadata;

  /** iOS web-app meta. `true` (capable) or the descriptor object. */
  appleWebApp?: AppleWebAppMetadata;
  /** -> `<meta name="format-detection">`. Each value is a boolean. */
  formatDetection?: Record<string, boolean>;
  /** -> `<meta name="apple-itunes-app">`. */
  itunes?: { appId: string; appArgument?: string };

  /** -> `<meta name="category">`. */
  category?: string;
  /** -> `<meta name="classification">`. */
  classification?: string;
  /** -> `<meta name="abstract">`. */
  abstract?: string;
  /** -> `<link rel="archives">`. */
  archives?: string | string[];
  /** -> `<link rel="assets">`. */
  assets?: string | string[];
  /** -> `<link rel="bookmark">`. */
  bookmarks?: string | string[];

  /**
   * Response `Cache-Control` header (NOT a `<meta>` tag). Pages default to
   * `no-store`; a public value (e.g. `public, max-age=60`) also enables
   * conditional GET on the page.
   */
  cacheControl?: string;
  /** `<link rel="preload">` hints (fonts, images, etc.). */
  preload?: PreloadDescriptor[];

  /** Catch-all `<meta name="…">` entries. Value may be a list. */
  other?: Record<string, string | number | Array<string | number>>;
}

/**
 * The argument `generateMetadata(ctx)` receives. Mirrors the page context
 * (the same `{ params, searchParams, url }` a page function gets).
 */
export interface MetadataContext {
  params: Record<string, string>;
  searchParams?: Record<string, string | string[]>;
  url: string;
}
