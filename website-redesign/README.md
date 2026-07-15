# website-redesign (candidate)

A futuristic WebJs marketing homepage built on web components with **no build
step**. It is the starting point for the WebJs site redesign: a Three.js
particle background, an animated brand-cycle color system, a loading screen,
glowing typography, and full-height scroll sections.

The layout and engine began as a port of the open-source
[`remix-run/remix-website`](https://github.com/remix-run/remix-website) (MIT)
that proved WebJs can carry this class of site. The branding, copy, and
wordmark are WebJs.

## What is here

- **Design + CSS**: the black canvas, JetBrains Mono + Inter typography, the
  `@property --brand-cycle` animated color, glow text-shadows, frosted-glass
  panels, nav, footer, and loading screen. Plain CSS served unbundled
  (`public/global.css`, `public/home.css`).
- **The WebGL engine**: the Three.js particle system under
  `app/landing/engine/` is framework-agnostic TypeScript. It boots client-side
  only, through a dynamic import, so SSR never touches WebGL.
- **Structure**: the hero and feature sections are server-rendered by
  `app/page.ts`; interactivity (particle background, loading-screen dismissal,
  scroll-spy section nav, shrinking wordmark) lives in the components under
  `components/`.

## Run

```sh
npm run dev   # http://localhost:5010
```

Three.js is served through the importmap (no bundler), pinned in
`.webjs/vendor/importmap.json`. The framework strips TypeScript types at
request time, so the engine is fully type-erasable (no constructor parameter
properties).
