import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Dark Mode, ported from shadcn's content/docs/dark-mode/ (#1666). shadcn's
 * index is a grid of per-framework guides (next-themes for Next.js, a
 * ThemeProvider for Vite and the rest). WebJs UI targets WebJs apps only, so
 * the section keeps its index page and gives the one guide that is true here,
 * in the shape of shadcn's Next.js guide: the kit keys dark mode on a `.dark`
 * class, an inline script in the root layout sets it before first paint, and
 * a mode toggle flips it. The script and the storage key match what
 * `webjs create` scaffolds (packages/cli/lib/create.js), so a scaffolded app
 * and one following this page agree.
 */
export const title = 'Dark Mode';
export const description = 'Adding dark mode to your site.';

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The theme <code>init</code> installs defines every token twice: once under <code>:root</code> for light mode and once under <code>.dark</code> for dark mode. A <code>dark</code> custom variant matches anything inside a <code>.dark</code> element, so a component's <code>dark:</code> utilities follow the same switch.</p>
    ${codeFigure(`@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}`, { title: 'styles/globals.css', lang: 'css', lineNumbers: true })}
    <p>So dark mode is one class on the <code>&lt;html&gt;</code> element. There is no theme provider to install: the page needs a script that sets the class before it paints, and a control that changes it.</p>
    ${callout(html`An app made with <code>webjs create</code> already has both: the root layout carries the theme script, and <code>components/theme-toggle.ts</code> cycles between system, light and dark. Follow the steps below for an app that does not.`, { className: 'mt-6' })}

    ${heading(toc, 2, 'Add dark mode')}
    <div class=${steps}>
      ${heading(toc, 3, 'Add the theme script')}
      <p>Add an inline script to the root layout. It reads the saved choice, falls back to the operating system's preference, and sets the class before the first paint, so a reader who chose dark never sees the light palette flash. It also follows the system setting when it changes while the page is open.</p>
      ${codeFigure(`import { html, cspNonce } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';

export default function RootLayout({ children }: LayoutProps) {
  return html\`
    <script nonce=\${cspNonce()}>
      (function () {
        try {
          var mq = window.matchMedia('(prefers-color-scheme: dark)');
          function apply() {
            var t = null;
            try { t = localStorage.getItem('webjs_theme'); } catch (_) {}
            document.documentElement.classList.toggle(
              'dark', t === 'dark' || (t !== 'light' && mq.matches),
            );
          }
          apply();
          mq.addEventListener('change', apply);
        } catch (_) {}
      })();
    </script>
    <meta name="color-scheme" content="light dark">
    \${children}
  \`;
}`, { title: 'app/layout.ts', lineNumbers: true })}
      <p>The script must stay inline and come first in the root layout, since a module would run after the first paint. <code>cspNonce()</code> returns the request's nonce when the app turns on a Content Security Policy, and an empty string otherwise.</p>

      ${heading(toc, 3, 'Add a mode toggle')}
      <p>Place a mode toggle on your site to toggle between light and dark mode. This one is a dropdown menu with the three choices. It saves an explicit choice, forgets it for System, and sets the class the same way the script does.</p>
      ${codeFigure(`import { WebComponent, html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dropdown-menu.ts';

type Theme = 'light' | 'dark' | 'system';

export class ModeToggle extends WebComponent {
  setTheme(theme: Theme) {
    try {
      if (theme === 'system') localStorage.removeItem('webjs_theme');
      else localStorage.setItem('webjs_theme', theme);
    } catch {}
    const dark = theme === 'dark'
      || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  render() {
    return html\`
      <ui-dropdown-menu @ui-item-select=\${(e: CustomEvent<{ value: Theme }>) => this.setTheme(e.detail.value)}>
        <ui-dropdown-menu-trigger>
          <button class=\${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'relative')}>
            <svg class="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg class="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            <span class="sr-only">Toggle theme</span>
          </button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content align="end">
          <ui-dropdown-menu-item value="light">Light</ui-dropdown-menu-item>
          <ui-dropdown-menu-item value="dark">Dark</ui-dropdown-menu-item>
          <ui-dropdown-menu-item value="system">System</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    \`;
  }
}

ModeToggle.register('mode-toggle');`, { title: 'components/mode-toggle.ts', lineNumbers: true })}
      <p>Add the dropdown menu and the button to your project first:</p>
      ${codeFigure(`npx @webjsdev/ui add dropdown-menu button`, { lang: 'bash' })}
      <p>Then import the component from a page or layout and render its tag where the toggle belongs. Importing it is what registers the element in the browser.</p>
      ${codeFigure(`import '#components/mode-toggle.ts';

html\`<header>... <mode-toggle></mode-toggle></header>\``)}
    </div>

    ${heading(toc, 2, 'Without JavaScript')}
    <p>With JavaScript off the script never runs and nothing sets the class, so the page renders in light mode and the toggle does nothing. Everything else on the page still works, since the theme is only CSS.</p>
  `;
}
