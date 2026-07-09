// webjs-scaffold-placeholder. Metadata route. Keep and adapt it, or prune it
// (delete this file), then delete this marker line. webjs check fails while the
// marker remains.
//
// app/manifest.ts serves /manifest.json (the web app manifest). The default
// export returns an object, serialized to JSON. Adapt the name, colors, and
// icons to your app; pair it with the opt-in service worker for an installable
// PWA. See agent-docs/service-worker.md.
export default function Manifest() {
  return {
    name: '{{APP_NAME}}',
    short_name: '{{APP_NAME}}',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1c1613',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
