// app/icon.ts serves /icon (a dynamic favicon). The default export is a
// (possibly async) server function; returning a Response lets you set the exact
// content type, so an inline SVG needs no asset file. Generate it dynamically
// (per-theme, per-tenant) when the mark must be computed at request time.
//
// This is the DEMO of that surface, not the gallery's own favicon. With no
// metadata.icons declared, the framework auto-links an app-root icon: a STATIC
// file (app/icon.svg, app/icon.png) wins that link over this route, and a
// declared metadata.icons wins over both. The gallery declares its WebJs brand
// mark in app/layout.ts, so this route stays browsable at /icon without being
// the tab icon. For an icon that never changes, write app/icon.svg instead
// (what `webjs create` ships); keep a route like this only when the mark must
// be computed at request time (per theme, per tenant).
export default function Icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#1e2226"/>
    <text x="16" y="22" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#94989c" text-anchor="middle">w</text>
  </svg>`;
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' },
  });
}
