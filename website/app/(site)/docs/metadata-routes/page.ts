import { html } from '@webjsdev/core';

export const metadata = { title: 'Metadata Routes | WebJs' };

export default function MetadataRoutes() {
  return html`
    <h1>Metadata Routes</h1>
    <p>WebJs supports special route files that generate SEO and PWA metadata: sitemaps, robots.txt, web manifest, favicons, and Open Graph images. These files export a function and the framework serves the output at the standard URL.</p>

    <h2>When to use</h2>
    <ul>
      <li>Dynamic sitemaps generated from your database (e.g. all blog post URLs).</li>
      <li>Environment-aware robots.txt (allow everything in production, block staging).</li>
      <li>Dynamic favicons or OG images (e.g. per-post preview images).</li>
    </ul>

    <h2>When NOT to use</h2>
    <ul>
      <li>For an icon or manifest that never changes. Write the plain file at the app root instead (<code>app/icon.svg</code>, <code>app/apple-icon.png</code>, <code>app/manifest.webmanifest</code>, see <a href="#app-icon">App icon and manifest</a>): it is served and linked the same way.</li>
    </ul>

    <h2>Supported files</h2>
    <p>Place these at the root of <code>app/</code> or in any static (non-dynamic) route segment:</p>

    <table>
      <tr><th>File</th><th>Served at</th><th>Use case</th></tr>
      <tr><td><code>sitemap.ts</code></td><td><code>/sitemap.xml</code></td><td>XML sitemap for search engines</td></tr>
      <tr><td><code>robots.ts</code></td><td><code>/robots.txt</code></td><td>Crawler directives</td></tr>
      <tr><td><code>manifest.ts</code></td><td><code>/manifest.json</code></td><td>PWA web app manifest</td></tr>
      <tr><td><code>icon.ts</code></td><td><code>/icon</code></td><td>Dynamic favicon</td></tr>
      <tr><td><code>apple-icon.ts</code></td><td><code>/apple-icon</code></td><td>Apple touch icon</td></tr>
      <tr><td><code>icon.svg</code> / <code>icon.png</code> / <code>icon.ico</code> (app root, static file)</td><td><code>/icon.svg</code> ...</td><td>Favicon, linked with its type and size</td></tr>
      <tr><td><code>apple-icon.png</code> (app root, static file)</td><td><code>/apple-icon.png</code></td><td>Home-screen icon (180x180 PNG)</td></tr>
      <tr><td><code>manifest.webmanifest</code> / <code>manifest.json</code> (app root, static file)</td><td>same name</td><td>Web app manifest</td></tr>
      <tr><td><code>favicon.ico</code> (app root, static file)</td><td><code>/favicon.ico</code></td><td>Legacy favicon, never linked</td></tr>
      <tr><td><code>opengraph-image.ts</code></td><td><code>/opengraph-image</code></td><td>OG preview image</td></tr>
      <tr><td><code>twitter-image.ts</code></td><td><code>/twitter-image</code></td><td>Twitter card image</td></tr>
    </table>

    <h2>What a metadata route receives</h2>
    <p>Every metadata route's default export is called with <code>{ request, url, siteUrl, pages }</code>. <code>siteUrl</code> is the <code>SITE_URL</code> env var (your public origin) when set, else the request origin. <code>pages()</code> lists every public page of the app as sitemap entries. Type the argument with <code>MetadataRouteContext</code> from <code>@webjsdev/server</code>.</p>

    <h2>sitemap.ts</h2>
    <p>The shortest sitemap that stays correct as pages are added returns <code>pages()</code>. A sitemap may return an ARRAY of entries (urls may be paths; they resolve against <code>siteUrl</code>), the same shape Next uses, and the server serializes it:</p>
    <code-block>// app/sitemap.ts
import type { MetadataRouteContext } from '@webjsdev/server';

export default async function sitemap({ pages }: MetadataRouteContext) {
  return [...await pages(), { url: '/feed.xml', changeFrequency: 'daily' }];
}</code-block>
    <p><code>pages()</code> includes every static page (route groups dropped), skips any page whose static metadata, or a layout above it, says <code>robots: { index: false }</code>, and includes a dynamic page only when it exports <code>generateSitemapParams()</code>, which lists the params that route serves, usually from a query:</p>
    <code-block>// app/blog/[slug]/page.ts
import { listPostSlugs } from '#modules/blog/queries/list-post-slugs.server.ts';

export async function generateSitemapParams() {
  const posts = await listPostSlugs();
  return posts.map((p) => ({ params: { slug: p.slug }, lastModified: p.updatedAt }));
}</code-block>
    <p>The <code>sitemap()</code> helper from <code>@webjsdev/server</code> turns an array of entries into spec-valid <code>&lt;urlset&gt;</code> XML for you (escaping each URL, formatting <code>lastModified</code> as a W3C datetime, validating <code>priority</code> and <code>changeFrequency</code>). Return its output from the default export.</p>
    <code-block>// app/sitemap.ts
import { sitemap } from '@webjsdev/server';
import { listPostSlugs } from '#modules/blog/queries/list-post-slugs.server.ts';

export default async function () {
  const posts = await listPostSlugs();
  return sitemap([
    { url: 'https://example.com/', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...posts.map(p => ({
      url: ${'`https://example.com/blog/${p.slug}`'},
      lastModified: p.updatedAt,
    })),
  ]);
}</code-block>
    <p>Each entry is <code>{ url, lastModified?, changeFrequency?, priority? }</code>. The <code>url</code> is REQUIRED and XML-escaped (a value with <code>&amp;</code> or <code>&lt;</code> cannot break the document). A malformed entry (no <code>url</code>), an out-of-range <code>priority</code>, or an unknown <code>changeFrequency</code> is dropped rather than emitted as broken XML. The helper is OPTIONAL: you can still return a raw string or a <code>Response</code> for full control.</p>

    <h3>Sharding a large site (sitemap index)</h3>
    <p>A single sitemap maxes out at 50,000 URLs. To shard past that, serve each chunk from a <code>route.ts</code> handler and point a root <code>sitemapIndex()</code> at them. Both helpers share the same escaping + date rules.</p>
    <code-block>// app/sitemaps/[shard]/route.ts
import { sitemap } from '@webjsdev/server';
import { listShardUrls } from '#modules/blog/queries/list-shard-urls.server.ts';

export async function GET(req: Request, { params }: { params: { shard: string } }) {
  const entries = await listShardUrls(params.shard);
  return new Response(sitemap(entries), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}</code-block>
    <code-block>// app/sitemap.ts (the index)
import { sitemapIndex } from '@webjsdev/server';

export default function () {
  return sitemapIndex([
    { url: 'https://example.com/sitemaps/posts.xml', lastModified: new Date() },
    { url: 'https://example.com/sitemaps/pages.xml' },
  ]);
}</code-block>

    <h2>robots.ts</h2>
    <p>Return Next's robots object and the server writes robots.txt (the <code>robots()</code> helper from <code>@webjsdev/server</code> is the same serializer, for a route building its own Response). A string or a Response works too.</p>
    <code-block>// app/robots.ts
import type { MetadataRouteContext } from '@webjsdev/server';

export default function robots({ siteUrl }: MetadataRouteContext) {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/api/'] }],
    sitemap: ${'`${siteUrl}/sitemap.xml`'},
  };
}</code-block>

    <h2>manifest.ts</h2>
    <code-block>// app/manifest.ts
export default function manifest() {
  return {
    name: 'My App',
    short_name: 'App',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  };
}</code-block>

    <h2>icon.ts and apple-icon.ts</h2>
    <p>These two are <strong>linked into the head for you</strong>. Writing the file is the whole wiring, with no <code>&lt;link&gt;</code> to add anywhere:</p>
    <code-block>// app/icon.ts  ->  serves /icon AND emits the link
export default function Icon() {
  const svg = '&lt;svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"&gt;...&lt;/svg&gt;';
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}</code-block>
    <code-block>&lt;!-- what lands in &lt;head&gt; --&gt;
&lt;link rel="icon" href="/icon"&gt;
&lt;link rel="apple-touch-icon" href="/apple-icon"&gt;</code-block>
    <p>The href carries your <code>basePath</code>, because that is where the route answers. No <code>type</code> or <code>sizes</code> is asserted: a metadata route picks its content type at request time, which is the reason to use one, so declaring a type here could contradict the bytes it serves. Browsers sniff the served type.</p>
    <p>Reach for a route when the mark must be computed per request (per theme, per tenant). For a favicon that never changes, the static <code>app/icon.svg</code> below is simpler and cacheable.</p>

    <h3 id="app-icon">App icon and manifest</h3>
    <p>Every app should carry its <strong>own</strong> icon. <code>webjs create</code> ships <code>app/icon.svg</code> as a neutral placeholder (a grey tile with a dashed frame) and <code>app/manifest.webmanifest</code> with the app's name. Replace the placeholder with a simple symbol for what the app is, in its own colours, on a 32x32 view box: a filled rounded tile in the primary colour with one bold shape in its foreground colour stays legible at 16 pixels. <code>webjs doctor</code> warns (<code>APP_ICON</code>) while the placeholder is still there.</p>
    <p>The static files are served at their own names and linked with what is known about them:</p>
    <code-block>&lt;!-- app/icon.png (192x192), app/icon.svg, app/apple-icon.png, app/manifest.webmanifest --&gt;
&lt;link rel="icon" href="/icon.png" sizes="192x192" type="image/png"&gt;
&lt;link rel="icon" href="/icon.svg" sizes="any" type="image/svg+xml"&gt;
&lt;link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" type="image/png"&gt;
&lt;link rel="manifest" href="/manifest.webmanifest"&gt;</code-block>
    <p>Raster icons come first, because Google's favicon crawler takes the first usable icon and wants a square raster; a browser that reads SVG picks it regardless. iOS reads only a PNG <code>apple-touch-icon</code>, so add <code>app/apple-icon.png</code> (180x180) for the home screen. When an app has a static icon and an <code>icon.ts</code> route, the file wins the link and the route still serves at <code>/icon</code>. A declared <code>metadata.manifest</code> wins over the manifest file, and <code>manifest: null</code> turns the link off.</p>
    <p><code>/favicon.ico</code> always answers: <code>public/favicon.ico</code> if it exists, else <code>app/favicon.ico</code>, else the app's icon (an <code>.ico</code> or PNG ahead of SVG, then the <code>icon.ts</code> route). Feed readers, bookmark imports and crawlers that read no markup request that path directly.</p>

    <h3>Declaring icons wins</h3>
    <p>A <code>metadata.icons</code> declaration <strong>replaces</strong> the icon files and routes rather than merging with them, the same precedence Next applies to its static icon files. An app that outgrows a placeholder <code>app/icon.ts</code> names its real icons and the route stops being linked, without the file having to be deleted:</p>
    <code-block>// app/layout.ts  ->  these win; /icon is no longer linked
export const metadata = {
  icons: {
    icon: [
      { url: '/public/favicon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/public/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: { url: '/public/apple-touch-icon.png', sizes: '180x180' },
  },
};</code-block>
    <p>Declare a favicon one of those ways, never as a hand-written <code>&lt;link rel="icon"&gt;</code>: only the root layout may write a document shell at all, so a hand-written tag is unavailable to every other layout. A <code>public/favicon.ico</code> needs no declaration either way, since it is served at the origin root for crawlers that read no markup.</p>
    <h3>opengraph-image.ts and twitter-image.ts</h3>
    <p>These are linked too, the way Next does it: a page that declares no <code>openGraph.images</code> gets <code>og:image</code> pointing at the nearest <code>opengraph-image</code> route above it (absolute against your site URL), and likewise <code>twitter:image</code>. A nested one answers under its segment, so <code>app/blog/opengraph-image.ts</code> is <code>/blog/opengraph-image</code> and covers the blog pages. A page that declares its own image keeps it.</p>

    <h2>Page-level metadata</h2>
    <p>For per-page title, description, and Open Graph tags, export a <code>metadata</code> object from any <code>page.ts</code>. Annotate it with the <code>Metadata</code> type (imported from <code>@webjsdev/core</code>) so a misspelled field or a wrong-typed value is a compile-time error:</p>

    <code-block>// app/blog/[slug]/page.ts
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  title: 'My Post | Blog',
  description: 'A post about webjs',
  openGraph: { title: 'My Post', type: 'article' },
};</code-block>

    <p>The SSR pipeline reads <code>metadata</code> and injects <code>&lt;title&gt;</code>, <code>&lt;meta&gt;</code>, and <code>&lt;meta property="og:..."&gt;</code> tags into the HTML head. For a request-scoped title (a dynamic route building its metadata from the loaded record), export an async <code>generateMetadata(ctx)</code> returning <code>Promise&lt;Metadata&gt;</code> instead. See <a href="/docs/typescript">TypeScript</a> for the typed-metadata surface.</p>

    <h3>Search and share defaults</h3>
    <p>Set <code>SITE_URL</code> to your public origin (for example <code>https://shop.example.com</code>) in production. It becomes the default <code>metadataBase</code>, and every page then gets, unless it sets its own:</p>
    <ul>
      <li>a <code>&lt;link rel="canonical"&gt;</code> of the site URL plus the page path (the query is dropped). Opt a page out with <code>alternates: { canonical: null }</code>. With no site URL configured, no canonical is emitted, because the request host can be set by a client.</li>
      <li><code>og:title</code> and <code>og:description</code> from <code>title</code> and <code>description</code>, <code>og:type</code> <code>website</code>, and <code>og:url</code> equal to the canonical.</li>
      <li><code>twitter:card</code>: <code>summary_large_image</code> when the page has an image, else <code>summary</code>.</li>
    </ul>
    <p><code>openGraph</code> and <code>twitter</code> accept Next's shapes: <code>images</code> may be a string, a <code>URL</code>, an object <code>{ url, width, height, alt, type }</code>, or an array of these, and emits <code>og:image</code> with its <code>og:image:width</code> / <code>height</code> / <code>alt</code>; camelCase keys become snake_case (<code>siteName</code> is <code>og:site_name</code>); <code>publishedTime</code>, <code>modifiedTime</code>, <code>authors</code>, <code>section</code> and <code>tags</code> emit <code>article:*</code>. So a public page usually needs only a specific <code>title</code> and <code>description</code>, and a private page needs <code>robots: { index: false }</code> (on its section's layout, so every page under it inherits it).</p>

    <h3>JSON-LD structured data</h3>
    <p><code>metadata.jsonLd</code> emits schema.org structured data as one or more <code>&lt;script type="application/ld+json"&gt;</code> blocks in <code>&lt;head&gt;</code>. This is the highest-leverage modern SEO surface (Google's Article, Product, BreadcrumbList, Organization, and FAQ rich results all read it). WebJs stays true to its no-build identity here. JSON-LD is a web standard rendered as a plain script tag, so the framework ONLY serializes and escapes. There is no schema library and no validation, so you own the schema.org object.</p>
    <p>A single object emits one script:</p>
    <code-block>import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How webjs ships zero dead JS',
    author: { '@type': 'Person', name: 'Vivek' },
    datePublished: '2026-06-01',
    image: 'https://example.com/og.png',
  },
};</code-block>
    <p>An array emits one script PER element, so you can ship several graphs for one page (a Product alongside its BreadcrumbList, say). Per-request data works the same way through <code>generateMetadata</code>, so a dynamic route can build the Article from the loaded record.</p>
    <code-block>import type { Metadata, MetadataContext } from '@webjsdev/core';

export async function generateMetadata(ctx: MetadataContext): Promise&lt;Metadata&gt; {
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
}</code-block>
    <p>The serialized JSON is HTML-safe-escaped automatically. <code>&lt;</code>, <code>&gt;</code>, <code>&amp;</code>, and the line separators U+2028 / U+2029 are replaced with their JSON Unicode escapes, so the literal byte sequence <code>&lt;/script&gt;</code> can never form in the served HTML (a value containing <code>&lt;/script&gt;</code> cannot break out of the script tag). You escape nothing yourself. The block is a NON-EXECUTABLE data island, so a Content-Security-Policy <code>script-src</code> does not gate it and it carries NO nonce. The framework fails SAFE per element: an entry that is not a plain object, or one with a circular reference <code>JSON.stringify</code> cannot serialize, is skipped (with a one-line <code>console.warn</code>) rather than breaking the rest of the head. Absent <code>jsonLd</code> emits nothing.</p>

    <h3>Connection-warming: <code>preconnect</code> / <code>dnsPrefetch</code></h3>
    <p>Warm a cross-origin connection the page is about to use (an API host, a font / image CDN) so the browser pays the DNS + TLS + TCP cost ahead of the first real request (#243):</p>
    <code-block>import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  preconnect: [
    'https://api.example.com',                              // bare URL
    { url: 'https://fonts.gstatic.com', crossorigin: true },// crossorigin set
  ],
  dnsPrefetch: 'https://analytics.example.com',             // a single URL
};</code-block>
    <ul>
      <li><strong>preconnect</strong> emits <code>&lt;link rel="preconnect" href="..." [crossorigin]&gt;</code>, warming DNS + TLS + TCP. Each entry is a URL string or <code>{ url, crossorigin? }</code> (<code>crossorigin: true</code> emits a bare <code>crossorigin</code>; a string like <code>'anonymous'</code> emits its value). A font CDN needs <code>crossorigin</code>.</li>
      <li><strong>dnsPrefetch</strong> emits <code>&lt;link rel="dns-prefetch" href="..."&gt;</code>, which resolves DNS only (a lighter-weight precursor that never carries <code>crossorigin</code>).</li>
      <li>Each field takes a URL string, the object form, or an array of either. Every href is HTML-escaped.</li>
    </ul>
    <p><strong>Auto vendor preconnect.</strong> For an UNPINNED app resolving vendors live from a cross-origin CDN, the framework auto-emits ONE <code>&lt;link rel="preconnect" href="&lt;cdn-origin&gt;" crossorigin&gt;</code> (the resolved vendor CDN origin, e.g. <code>https://ga.jspm.io</code>, derived from the importmap so a <code>--from jsdelivr</code> app preconnects to jsdelivr), so the browser warms that connection before the importmap resolves. It is DEDUPED against an author-declared <code>preconnect</code> to the same origin, and NONE is emitted for a same-origin pinned app (vendors served from the app's own origin) or an app with no cross-origin vendors.</p>

    <h2>Constraints</h2>
    <ul>
      <li>Metadata route files must live at the root or in static segments, not inside <code>[dynamic]</code> folders.</li>
      <li>They are scanned at server startup, not on every request.</li>
      <li>A crawler gets a real 404 status for an unknown URL and for a page that throws <code>notFound()</code>, so missing records never index as empty pages.</li>
    </ul>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a>: file conventions for pages and layouts</li>
      <li><a href="/docs/ssr">Server-Side Rendering</a>: how metadata is injected into HTML</li>
      <li><a href="/docs/deployment">Deployment</a>: serving metadata in production</li>
    </ul>
  `;
}
