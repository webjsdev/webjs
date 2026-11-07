import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Registry Examples, ported from shadcn's content/docs/registry/examples.mdx
 * (#1666): the same sections in the same order, each example rewritten to
 * what `webjsui add` does with it (packages/ui/src/commands/add.js). Three
 * facts reshape shadcn's examples: registry dependencies resolve in the
 * item's own registry, `cssVars` adds missing variables and never replaces
 * one, and `css`, `envVars` and `font` are not applied, so those sections
 * ship a file instead.
 */
export const title = 'Examples';
export const description = 'Examples of registry items: styles, components, css vars, etc.';

const json = (text: string, title: string) => codeFigure(text, { lang: 'json', title, lineNumbers: true });

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'registry:style')}
    ${callout(html`<p><strong>Note:</strong> The look of the WebJs UI components is chosen by the <code>style</code> field of <code>components.json</code>, which the CLI bakes into every file it writes. A <code>registry:style</code> item does not change that. It installs like any other item: its files, its dependencies and its CSS variables.</p>`)}

    ${heading(toc, 3, 'Custom style that builds on the kit')}
    <p>The following registry item bundles a starting point for Acme apps. On <code>add</code>, it will:</p>
    <ul>
      <li>Install <code>date-fns</code> as a dependency.</li>
      <li>Add the <code>login-01</code> and <code>calendar</code> items from the same registry.</li>
      <li>Set the <code>font-sans</code> variable to <code>Inter, sans-serif</code>, if the stylesheet does not set it.</li>
      <li>Install a <code>brand</code> color in light and dark mode.</li>
    </ul>
    ${json(`{
  "name": "example-style",
  "type": "registry:style",
  "dependencies": ["date-fns"],
  "registryDependencies": ["login-01", "calendar"],
  "cssVars": {
    "theme": {
      "font-sans": "Inter, sans-serif",
      "color-brand": "var(--brand)"
    },
    "light": {
      "brand": "oklch(0.205 0.015 18)"
    },
    "dark": {
      "brand": "oklch(0.985 0 0)"
    }
  }
}`, 'example-style.json')}

    ${heading(toc, 3, 'Custom style from scratch')}
    <p>A style from scratch is a style item whose <code>registryDependencies</code> are all your own items, and whose CSS variables are new names. The CLI installs exactly what an item lists.</p>
    ${json(`{
  "name": "new-style",
  "type": "registry:style",
  "registryDependencies": ["button", "input", "label", "select"],
  "cssVars": {
    "theme": {
      "color-main": "var(--main)",
      "color-bg": "var(--bg)"
    },
    "light": {
      "main": "#88aaee",
      "bg": "#dfe5f2"
    },
    "dark": {
      "main": "#88aaee",
      "bg": "#272933"
    }
  }
}`, 'example-style.json')}
    <p>Here <code>button</code>, <code>input</code>, <code>label</code> and <code>select</code> are fetched from your registry. Each lands in the user's <code>components/ui</code> folder, and <code>add</code> asks before replacing a file of the same name that is already there.</p>

    ${heading(toc, 2, 'registry:theme')}
    ${heading(toc, 3, 'Custom theme')}
    <p>A theme item's <code>cssVars</code> add the variables a project does not define. A project that ran <code>webjs ui init</code> already defines <code>--background</code>, <code>--primary</code> and the rest, so to change those values, ship the theme as a CSS file and tell users to import it after their theme.</p>
    ${json(`{
  "name": "custom-theme",
  "type": "registry:theme",
  "files": [
    {
      "path": "themes/blue.css",
      "type": "registry:file",
      "target": "styles/theme-blue.css"
    }
  ]
}`, 'example-theme.json')}
    ${codeFigure(`:root {
  --primary: oklch(0.546 0.245 262.881);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --ring: oklch(0.746 0.16 232.661);
}

.dark {
  --primary: oklch(0.707 0.165 254.624);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --ring: oklch(0.707 0.165 254.624);
}`, { lang: 'css', title: 'themes/blue.css', lineNumbers: true })}

    ${heading(toc, 3, 'Custom colors')}
    <p>The following item adds a custom <code>brand</code> color to a project that has the default theme.</p>
    ${json(`{
  "name": "custom-colors",
  "type": "registry:theme",
  "cssVars": {
    "theme": {
      "color-brand": "var(--brand)"
    },
    "light": {
      "brand": "oklch(0.99 0.00 0)"
    },
    "dark": {
      "brand": "oklch(0.14 0.00 286)"
    }
  }
}`, 'example-colors.json')}

    ${heading(toc, 2, 'registry:block')}
    ${heading(toc, 3, 'Custom block')}
    <p>This block installs a login page and the form component it renders.</p>
    ${json(`{
  "name": "login-01",
  "type": "registry:block",
  "description": "A simple login form.",
  "categories": ["authentication", "login"],
  "registryDependencies": ["button", "card", "input", "label"],
  "files": [
    {
      "path": "blocks/login-01/page.ts",
      "content": "import { html } from '@webjsdev/core'; ...",
      "type": "registry:page",
      "target": "app/login/page.ts"
    },
    {
      "path": "blocks/login-01/components/login-form.ts",
      "content": "...",
      "type": "registry:block",
      "target": "components/login-form.ts"
    }
  ]
}`, 'login-01.json')}
    <p>Every file of a block names its <code>target</code>, so the page lands at its route. An existing block file is kept unless <code>add</code> is run with <code>--overwrite</code>, since it is app code the user owns.</p>

    ${heading(toc, 3, 'Install a block with your own primitives')}
    <p>A block's registry dependencies come from the block's own registry. So a block that depends on <code>button</code>, <code>input</code> and <code>label</code> installs your versions of them, not the WebJs UI ones, and the user is asked before an existing file is replaced.</p>
    ${json(`{
  "name": "custom-login",
  "type": "registry:block",
  "registryDependencies": ["login-01", "button", "input", "label"]
}`, 'custom-login.json')}

    ${heading(toc, 2, 'registry:ui')}
    ${heading(toc, 3, 'UI component')}
    <p>A <code>registry:ui</code> item is a reusable UI component. It can have dependencies, registry dependencies, and CSS variables. A Tier-1 component is a set of class helpers, a Tier-2 component a custom element built on <code>@webjsdev/core</code>.</p>
    ${json(`{
  "name": "button",
  "type": "registry:ui",
  "files": [
    {
      "path": "components/button.ts",
      "content": "...",
      "type": "registry:ui"
    }
  ]
}`, 'button.json')}

    ${heading(toc, 3, 'UI component with CSS variables')}
    ${json(`{
  "name": "sidebar",
  "type": "registry:ui",
  "registryDependencies": ["button", "separator", "sheet", "tooltip"],
  "files": [
    {
      "path": "components/sidebar.ts",
      "content": "...",
      "type": "registry:ui"
    }
  ],
  "cssVars": {
    "light": {
      "sidebar": "oklch(0.985 0 0)",
      "sidebar-foreground": "oklch(0.141 0.005 285.823)",
      "sidebar-border": "oklch(0.92 0.004 286.32)"
    },
    "dark": {
      "sidebar": "oklch(0.141 0.005 285.823)",
      "sidebar-foreground": "oklch(0.985 0 0)",
      "sidebar-border": "oklch(0.274 0.006 286.033)"
    }
  }
}`, 'sidebar.json')}
    <p>On <code>add</code>, each variable the user's stylesheet lacks is added to its <code>:root</code> or <code>.dark</code> block, so the component renders in an app whose theme predates it.</p>

    ${heading(toc, 2, 'registry:lib')}
    ${heading(toc, 3, 'Utility library')}
    <p>A <code>registry:lib</code> item is a utility library. Use it to share helper functions, constants, or other non-component code. Its files land in the <code>lib</code> folder <code>components.json</code> names.</p>
    ${json(`{
  "name": "format",
  "type": "registry:lib",
  "dependencies": ["date-fns"],
  "files": [
    {
      "path": "lib/format.ts",
      "content": "export { format } from 'date-fns';",
      "type": "registry:lib"
    }
  ]
}`, 'format.json')}

    ${heading(toc, 2, 'registry:hook')}
    ${heading(toc, 3, 'Custom controller')}
    <p>A <code>registry:hook</code> file lands in <code>hooks/</code>, which suits reusable component logic such as a reactive controller.</p>
    ${json(`{
  "name": "media-query",
  "type": "registry:hook",
  "files": [
    {
      "path": "hooks/media-query.ts",
      "content": "...",
      "type": "registry:hook"
    }
  ]
}`, 'media-query.json')}

    ${heading(toc, 2, 'Targets')}
    <p>A <code>target</code> is a path from the project root, written as is, and it decides where the file lands even when it differs from the file <code>type</code>.</p>
    ${json(`{
  "name": "type-mismatch",
  "type": "registry:item",
  "files": [
    {
      "path": "lib/format-date.ts",
      "type": "registry:ui",
      "target": "lib/format-date.ts",
      "content": "..."
    }
  ]
}`, 'type-mismatch.json')}
    <p>To land a file in the user's configured folder instead, leave out <code>target</code> and let the file <code>type</code> pick it: <code>registry:ui</code> for <code>aliases.ui</code>, <code>registry:component</code> for <code>aliases.components</code>, <code>registry:lib</code> for <code>aliases.lib</code>.</p>

    ${heading(toc, 2, 'registry:font')}
    <p>Ship the font family as a theme variable, and the font files, if any, as <code>registry:file</code> entries.</p>
    ${json(`{
  "name": "font-inter",
  "type": "registry:font",
  "cssVars": {
    "theme": {
      "font-sans": "'Inter Variable', sans-serif"
    }
  }
}`, 'font-inter.json')}

    ${heading(toc, 2, 'registry:base')}
    <p>A <code>registry:base</code> item gets no special handling either. A whole design system ships as a style item whose <code>registryDependencies</code> list its components, as in <a href="#custom-style-from-scratch">Custom style from scratch</a>.</p>

    ${heading(toc, 2, 'Common Fields')}
    ${heading(toc, 3, 'Author')}
    <p>Use the <code>author</code> field to add attribution to your registry items. It is kept in the item, and the CLI does not print it.</p>
    ${json(`{
  "name": "custom-component",
  "type": "registry:ui",
  "author": "Acme",
  "files": [
    {
      "path": "components/custom-component.ts",
      "content": "...",
      "type": "registry:ui"
    }
  ]
}`, 'example-item.json')}
    ${heading(toc, 3, 'Dev dependencies')}
    <p>Use the <code>devDependencies</code> field to install packages as dev dependencies.</p>
    ${json(`{
  "name": "custom-item",
  "type": "registry:item",
  "devDependencies": ["@types/node"],
  "files": [
    {
      "path": "lib/paths.ts",
      "content": "...",
      "type": "registry:lib"
    }
  ]
}`, 'example-item.json')}
    ${heading(toc, 3, 'Metadata')}
    <p>Use the <code>meta</code> field to attach arbitrary metadata to your registry items. This can be used to store custom data that your tools or scripts can use.</p>
    ${json(`{
  "name": "custom-component",
  "type": "registry:ui",
  "meta": {
    "category": "forms",
    "version": "2.0.0"
  },
  "files": [
    {
      "path": "components/custom-component.ts",
      "content": "...",
      "type": "registry:ui"
    }
  ]
}`, 'example-item.json')}

    ${heading(toc, 2, 'CSS Variables')}
    ${heading(toc, 3, 'Custom Theme Variables')}
    <p>Add custom theme variables to the <code>theme</code> object. They land in the stylesheet's <code>@theme inline</code> block.</p>
    ${json(`{
  "name": "custom-theme",
  "type": "registry:theme",
  "cssVars": {
    "theme": {
      "font-heading": "Inter, sans-serif",
      "shadow-card": "0 0 0 1px rgba(0, 0, 0, 0.1)"
    }
  }
}`, 'example-theme.json')}
    ${heading(toc, 3, 'Override Tailwind CSS variables')}
    <p>A <code>theme</code> entry for one of Tailwind's own variables overrides Tailwind's default, because the default lives in Tailwind and not in the project's stylesheet. A variable the stylesheet already defines is left alone.</p>
    ${json(`{
  "name": "custom-theme",
  "type": "registry:theme",
  "cssVars": {
    "theme": {
      "spacing": "0.2rem",
      "breakpoint-sm": "640px",
      "breakpoint-md": "768px",
      "breakpoint-lg": "1024px",
      "breakpoint-xl": "1280px",
      "breakpoint-2xl": "1536px"
    }
  }
}`, 'example-theme.json')}

    ${heading(toc, 2, 'Add custom CSS')}
    <p>Base styles, component styles, <code>@utility</code> rules, <code>@import</code>, <code>@plugin</code> and <code>@keyframes</code> all ship the same way: as a CSS file the user imports.</p>
    ${json(`{
  "name": "acme-css",
  "type": "registry:style",
  "files": [
    {
      "path": "styles/acme.css",
      "type": "registry:file",
      "target": "styles/acme.css"
    }
  ]
}`, 'acme-css.json')}
    ${codeFigure(`@layer base {
  h1 {
    font-size: var(--text-2xl);
  }
}

@utility content-auto {
  content-visibility: auto;
}

@keyframes wiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}`, { lang: 'css', title: 'styles/acme.css', lineNumbers: true })}
    <p>Users then import it after Tailwind in their stylesheet:</p>
    ${codeFigure(`@import "tailwindcss";
@import "./acme.css";`, { lang: 'css' })}

    ${heading(toc, 2, 'Add environment variables')}
    <p>Ship example variables as a file.</p>
    ${json(`{
  "name": "custom-item",
  "type": "registry:item",
  "files": [
    {
      "path": "env/.env.example",
      "type": "registry:file",
      "target": ".env.example"
    }
  ]
}`, 'example-item.json')}
    ${callout(html`<p><strong>IMPORTANT:</strong> Ship development or example variables only. Do NOT put production values or secrets in a registry item.</p>`)}

    ${heading(toc, 2, 'Universal Items')}
    <p>An item whose files all name a <code>target</code> installs the same way in any project, whatever its <code>components.json</code> aliases say. The project still needs a <code>components.json</code>, since <code>add</code> stops without one.</p>
    <p>Here's an example of a registry item that installs agent rules:</p>
    ${json(`{
  "name": "acme-rules",
  "type": "registry:item",
  "files": [
    {
      "path": "rules/acme.md",
      "type": "registry:file",
      "target": ".agents/rules/acme.md",
      "content": "..."
    }
  ]
}`, 'acme-rules.json')}
    <p>You can also have a universal item that installs multiple files:</p>
    ${json(`{
  "name": "my-custom-starter-template",
  "type": "registry:item",
  "dependencies": ["zod"],
  "files": [
    {
      "path": "starter/app/page.ts",
      "type": "registry:file",
      "target": "app/page.ts",
      "content": "..."
    },
    {
      "path": "starter/modules/home/queries/get-home.server.ts",
      "type": "registry:file",
      "target": "modules/home/queries/get-home.server.ts",
      "content": "..."
    }
  ]
}`, 'my-custom-starter-template.json')}
  `;
}
