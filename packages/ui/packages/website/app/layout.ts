import { html } from '@webjskit/core';

const env = (globalThis as any).process?.env ?? {};
const WEBSITE_URL = env.WEBSITE_URL || 'https://webjs.dev';
const DOCS_URL = env.DOCS_URL || 'https://docs.webjs.dev';

export const metadata = {
  title: '@webjskit/ui — shadcn-style components for web components',
  description: 'A shadcn-equivalent component registry. Source-copied into your project. Works in webjs, Next, Astro, Vite, vanilla — any project with Tailwind v4.',
  themeColor: '#1c1613',
  openGraph: { type: 'website', title: '@webjskit/ui', description: 'shadcn-style components for web components' },
};

export default function Layout({ children }: { children: any }) {
  return html`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/public/tailwind.css" />
        <style>
          :root {
            color-scheme: light dark;
            --fg:            oklch(0.18 0.015 60);
            --fg-muted:      oklch(0.42 0.02 65);
            --fg-subtle:     oklch(0.62 0.015 70);
            --bg:            oklch(0.985 0.008 80);
            --bg-elev:       oklch(1 0 0);
            --bg-subtle:     oklch(0.96 0.008 80);
            --bg-sunken:     oklch(0.94 0.008 80);
            --border:        oklch(0.88 0.01 75 / 0.95);
            --border-strong: oklch(0.78 0.01 75 / 0.95);
            --accent:        oklch(0.58 0.15 55);
            --accent-hover:  oklch(0.5 0.15 55);
            --accent-fg:     oklch(1 0 0);
            --accent-tint:   oklch(0.58 0.15 55 / 0.08);
            --font-sans:  -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            --font-serif: ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, Cambria, serif;
            --font-mono:  ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
          }
          @media (prefers-color-scheme: dark) {
            :root:not([data-theme='light']) {
              --fg:            oklch(0.96 0.015 60);
              --fg-muted:      oklch(0.72 0.02 60);
              --fg-subtle:     oklch(0.55 0.02 60);
              --bg:            oklch(0.14 0.01 55);
              --bg-elev:       oklch(0.18 0.01 55);
              --bg-subtle:     oklch(0.16 0.01 55);
              --bg-sunken:     oklch(0.11 0.008 55);
              --border:        oklch(0.26 0.012 55 / 0.9);
              --border-strong: oklch(0.38 0.012 55 / 0.9);
              --accent:        oklch(0.78 0.14 55);
              --accent-hover:  oklch(0.85 0.14 55);
              --accent-fg:     oklch(0.15 0.01 55);
              --accent-tint:   oklch(0.78 0.14 55 / 0.12);
            }
          }
          html, body { margin: 0; font-family: var(--font-sans); }
          body { background: var(--bg); color: var(--fg); font: 400 16px/1.55 var(--font-sans); -webkit-font-smoothing: antialiased; }
          a { color: var(--accent); text-decoration: none; }
          a:hover { color: var(--accent-hover); }
          .text-muted-foreground { color: var(--fg-muted); }
          .text-foreground { color: var(--fg); }
          .bg-background { background: var(--bg); }
          .bg-muted { background: var(--bg-subtle); }
          .bg-primary { background: var(--accent); }
          .text-primary { color: var(--accent); }
          .text-primary-foreground { color: var(--accent-fg); }
          .bg-accent { background: var(--accent-tint); }
          .hover\\:bg-accent:hover { background: var(--accent-tint); }
          .hover\\:bg-primary\\/90:hover { background: var(--accent-hover); }
          .border, .border-b, .border-t { border-color: var(--border); border-style: solid; border-width: 0; }
          .border { border-width: 1px; }
          .border-b { border-bottom-width: 1px; }
          .border-t { border-top-width: 1px; }
          pre code { font-family: var(--font-mono); font-size: 12.5px; }
          .prose h1 { font: 700 clamp(2rem, 1.5rem + 1.6vw, 2.6rem)/1.15 var(--font-serif); letter-spacing: -0.025em; color: var(--accent); margin: 0 0 16px; }
          .prose h2 { font: 700 1.4rem/1.2 var(--font-serif); margin: 40px 0 12px; padding-top: 24px; border-top: 1px solid var(--border); }
          .prose p, .prose li { color: var(--fg); margin: 12px 0; }
          .prose code { font-family: var(--font-mono); font-size: 0.9em; padding: 1px 5px; background: var(--bg-subtle); border-radius: 4px; }
          .prose pre { background: var(--bg-sunken); padding: 16px; border-radius: 8px; overflow-x: auto; }
          .prose pre code { background: transparent; padding: 0; }
          .announce { width: 100%; background: var(--accent-tint); border-bottom: 1px solid var(--border); padding: 8px 16px; text-align: center; font-size: 13px; }
          .announce .tag { display: inline-block; font: 700 10px/1 var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); background: color-mix(in oklch, var(--accent) 15%, transparent); padding: 3px 7px; border-radius: 999px; margin-right: 8px; vertical-align: middle; }
        </style>
      </head>
      <body>
        <div class="announce">
          <span class="tag">v1</span>
          <a href=${WEBSITE_URL} target="_blank" rel="noopener noreferrer">Part of webjs - the AI-first, web components framework</a>
        </div>
        <header class="border-b">
          <div class="max-w-5xl mx-auto flex h-14 items-center px-6 gap-6">
            <a href="/" class="font-bold text-base" style="color: var(--fg)">
              <span style="display:inline-block; width:22px; height:22px; border-radius:6px; background:linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 55%, var(--fg))); vertical-align:middle; margin-right:8px"></span>
              @webjskit/ui
            </a>
            <nav class="flex gap-4 text-sm" style="color: var(--fg-muted); margin-left: auto">
              <a href="/" style="color: var(--fg-muted)">Components</a>
              <a href="/docs" style="color: var(--fg-muted)">Docs</a>
              <a href=${WEBSITE_URL} target="_blank" style="color: var(--fg-muted)">webjs.dev</a>
              <a href=${DOCS_URL} target="_blank" style="color: var(--fg-muted)">Framework Docs</a>
              <a href="https://github.com/vivek7405/webjs" target="_blank" style="color: var(--fg-muted)">GitHub</a>
            </nav>
          </div>
        </header>
        <main class="max-w-5xl mx-auto px-6 py-10">${children}</main>
        <footer class="border-t mt-20 py-8" style="color: var(--fg-subtle); font-size: 13px">
          <div class="max-w-5xl mx-auto px-6">
            <a href=${WEBSITE_URL} target="_blank">webjs.dev</a> ·
            <a href=${DOCS_URL} target="_blank">Docs</a> ·
            <a href="https://github.com/vivek7405/webjs" target="_blank">GitHub</a> · MIT
          </div>
        </footer>
      </body>
    </html>
  `;
}
