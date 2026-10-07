/**
 * The app icon a new scaffold starts with, and how `webjs doctor` recognises
 * an icon that was never replaced.
 *
 * A scaffold ships `app/icon.svg` (auto-linked as the favicon, served at
 * /icon.svg and as the /favicon.ico fallback) and `app/manifest.webmanifest`
 * (auto-linked as the web app manifest). The icon is a deliberately NEUTRAL
 * placeholder: a grey tile with a dashed frame, so a tab strip shows at a
 * glance that the app has no icon of its own yet, and no app ever ships
 * looking like a WebJs demo. It carries `data-webjs-placeholder` so a check
 * (webjs doctor, or any agent's own tester) can tell it apart from a real
 * icon without comparing bytes.
 */

/** The attribute that marks the scaffold's placeholder icon. */
export const PLACEHOLDER_MARKER = 'data-webjs-placeholder';

/** The placeholder `app/icon.svg`. Replace it with the app's own mark. */
export const PLACEHOLDER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" ${PLACEHOLDER_MARKER}="icon">
  <!-- PLACEHOLDER app icon from \`webjs create\`. Replace this file with the
       app's own icon: a simple symbol for what the app is, in its colours,
       legible at 16px. Keep the file name (app/icon.svg) and the framework
       links it, serves it and answers /favicon.ico with it. -->
  <rect width="32" height="32" rx="8" fill="#d4d4d8"/>
  <rect x="7" y="7" width="18" height="18" rx="3" fill="none" stroke="#71717a" stroke-width="2" stroke-dasharray="3 2.4"/>
</svg>
`;

/**
 * The `app/manifest.webmanifest` a scaffold starts with: the app's name, the
 * neutral colours of the scaffold palette, and the icon. Grow it with the app
 * (its real theme colour, a 192 and 512 PNG for installability).
 * @param {string} name the app's display name
 */
export function appManifest(name) {
  return JSON.stringify({
    name,
    short_name: name,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }, null, 2) + '\n';
}

/**
 * Whether an SVG is the WebJs brand mark earlier scaffolds shipped as
 * `public/favicon.svg` (a rounded square with the gallery's grey gradient).
 * Apps made before the placeholder still serve it as their favicon.
 * @param {string} svg
 */
export function isLegacyBrandFavicon(svg) {
  return /aria-label="WebJs"/.test(svg) && /<linearGradient id="wj"/.test(svg);
}
