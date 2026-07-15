import { html } from '@webjsdev/core';

/*
 * Root layout for the WebJs redesign candidate.
 *
 * Ports the essential <head> setup from the source Document shell
 * (app/ui/document.tsx): forced dark theme, self-hosted fonts, the global
 * and landing stylesheets, and a high-priority preload of the loading-screen
 * runner image. The framework splices the importmap, modulepreload hints,
 * and title into <head> for us, so this only owns the static shell.
 */

const TITLE = 'WebJs - A web framework for the AI era';
const DESCRIPTION =
  'The WebJs marketing site, built on web components with a Three.js particle engine and no build step. Server-rendered and works without JavaScript.';

export function generateMetadata() {
  return {
    title: TITLE,
    description: DESCRIPTION,
  };
}

export default function RootLayout({ children }: { children: unknown }) {
  return html`
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />

    <link rel="icon" href="/public/favicon.svg" type="image/svg+xml" sizes="any" />

    <!-- The two LCP text faces plus the mono UI face, preloaded so they fetch
         in parallel with the stylesheet instead of after the CSS parses. -->
    <link rel="preload" href="/public/font/inter-roman-latin-var.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/public/font/jet-brains-mono.woff2" as="font" type="font/woff2" crossorigin />

    <!-- The loading-screen runner is the first paint, so fetch it eagerly. -->
    <link rel="preload" as="image" href="/public/landing/remix-runner.avif" type="image/avif" fetchpriority="high" />

    <link rel="stylesheet" href="/public/global.css" />
    <link rel="stylesheet" href="/public/home.css" />
    <noscript><style>.loading-screen-overlay { display: none; }</style></noscript>

    <div class="rmx-app">
      ${children}
    </div>
  `;
}
