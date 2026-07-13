# remix-website (feasibility experiment)

A faithful rebuild of the [Remix 3](https://remix.run) marketing homepage on
web components with **no build step**, to test how far the framework can go
toward "extremely futuristic" marketing sites: a Three.js particle background,
a brand-cycling color system, a loading screen, glowing typography, and
full-height scroll sections.

**This is an internal experiment, not a real Remix property.** The design,
copy, and assets are ported from the open-source
[`remix-run/remix-website`](https://github.com/remix-run/remix-website) repo
(MIT) purely to measure feasibility. It is not deployed or presented as Remix.

## What is ported

- **Design + CSS**: the black canvas, JetBrains Mono + Inter typography, the
  `@property --brand-cycle` animated color, glow text-shadows, frosted-glass
  panels, nav, footer, and loading screen. Plain CSS served unbundled
  (`public/global.css`, `public/home.css`).
- **The WebGL engine**: the Three.js particle system under
  `app/landing/engine/` is a near-verbatim copy of the Remix engine (framework
  agnostic TypeScript). It boots client-side only, through a dynamic import, so
  SSR never touches WebGL.
- **Structure**: the hero and five feature sections are server-rendered by
  `app/page.ts`; interactivity (particle background, loading-screen dismissal,
  scroll-spy section nav) lives in the components under `components/`.

## Run

```sh
npm run dev   # http://localhost:5002
```

Three.js is served through the importmap (no bundler). The framework strips
TypeScript types at request time, which is why the ported engine had to be
made fully type-erasable (no constructor parameter properties).
