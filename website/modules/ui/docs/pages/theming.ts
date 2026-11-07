import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { loadRegistryItem } from '#modules/ui/queries/registry.server.ts';

/**
 * Theming, ported from shadcn's content/docs/(root)/theming.mdx (#1666). The
 * token convention, the token table and the base colours carry over as they
 * are, since the kit's theme uses shadcn's names. What changes: the stylesheet
 * path (styles/globals.css, what `init` writes), the kit's own radius scale
 * (it stops at 3xl), and the Default Theme CSS, which is read from the
 * registry's theme-neutral item so it is the file `init` installs rather than
 * a copy that can drift. shadcn's `--no-css-variables` mode has no
 * counterpart, so that section says what the kit does instead.
 */
export const title = 'Theming';
export const description = 'Using CSS variables and theme tokens.';

function tokenRow(token: string, controls: string, usedBy: unknown) {
  return html`<tr><td>${token}</td><td>${controls}</td><td>${usedBy}</td></tr>`;
}

export default async function body(toc: TocEntry[]) {
  const theme = await loadRegistryItem('theme-neutral');
  const themeCss = theme?.files?.[0]?.content ?? '';

  return html`
    ${callout(html`Want to build your theme visually? Use <a href="/ui/create">Create</a> to preview colors, radius, fonts, and icons, then generate a preset for your project.`)}
    <p>We use CSS variables for theming.</p>
    <p>This gives you semantic theme tokens like <code>background</code>, <code>foreground</code>, and <code>primary</code> that components use by default. Override those tokens in your CSS to change the look of your app without rewriting component classes.</p>
    ${codeFigure(`<div class="bg-background text-foreground"></div>`)}
    <p><code>init</code> writes the tokens into the stylesheet named by <code>tailwind.css</code> in your <code>components.json</code> file, <code>styles/globals.css</code> by default.</p>
    ${codeFigure(`{
  "$schema": "https://ui.webjs.dev/schema.json",
  "style": "default",
  "tailwind": {
    "css": "styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  }
}`, { title: 'components.json', lang: 'json', lineNumbers: true })}
    <p>Tailwind maps these tokens into utilities like <code>bg-background</code>, <code>text-foreground</code>, <code>border-border</code>, and <code>ring-ring</code>.</p>
    <p>Dark mode works by overriding the same tokens inside a <code>.dark</code> selector. See the <a href="/ui/docs/dark-mode">dark mode docs</a> for setting and toggling the <code>.dark</code> class.</p>
    ${callout(html`An app made with <code>webjs create</code> compiles <code>public/input.css</code>, which imports <code>styles/globals.css</code>, so the tokens there are the ones the page uses. Until you run <code>npm run gallery:clear</code>, though, the gallery's root layout sets its own values for most color tokens and the fonts on <code>:root</code> in <code>app/layout.ts</code>, and those win. Clear the gallery, or delete those values from the layout, before you theme the kit.`, { className: 'mt-4' })}

    ${heading(toc, 2, 'Token Convention')}
    <p>We use semantic background and foreground pairs. The base token controls the surface color and the <code>-foreground</code> token controls the text and icon color that sits on that surface.</p>
    ${callout(html`The background suffix is omitted for the surface token. For example, <code>primary</code> pairs with <code>primary-foreground</code>.`, { className: 'mt-4' })}
    <p>Given the following CSS variables:</p>
    ${codeFigure(`--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);`, { lang: 'css' })}
    <p>The <code>background</code> color of the following component will be <code>var(--primary)</code> and the <code>foreground</code> color will be <code>var(--primary-foreground)</code>.</p>
    ${codeFigure(`<div class="bg-primary text-primary-foreground">Hello</div>`)}

    ${heading(toc, 2, 'Theme Tokens')}
    <p>These tokens live in your CSS file under <code>:root</code> and <code>.dark</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Token</th><th>What it controls</th><th>Used by</th></tr></thead>
        <tbody>
          ${tokenRow('background / foreground', 'The default app background and text color.', 'The page shell, page sections, and default text.')}
          ${tokenRow('card / card-foreground', 'Elevated surfaces and the content inside them.', html`<code>cardClass()</code>, dashboard panels, settings panels.`)}
          ${tokenRow('popover / popover-foreground', 'Floating surfaces and the content inside them.', html`Popover, <code>&lt;ui-dropdown-menu&gt;</code>, <code>&lt;ui-context-menu&gt;</code>, and other overlays.`)}
          ${tokenRow('primary / primary-foreground', 'High-emphasis actions and brand surfaces.', 'Default button, selected states, badges, and active accents.')}
          ${tokenRow('secondary / secondary-foreground', 'Lower-emphasis filled actions and supporting surfaces.', 'Secondary buttons, secondary badges, and supporting UI.')}
          ${tokenRow('muted / muted-foreground', 'Subtle surfaces and lower-emphasis content.', 'Descriptions, placeholders, empty states, helper text, and subdued surfaces.')}
          ${tokenRow('accent / accent-foreground', 'Interactive hover, focus, and active surfaces.', 'Ghost buttons, menu highlight states, hovered rows, and selected items.')}
          ${tokenRow('destructive / destructive-foreground', 'Destructive actions and error emphasis.', 'Destructive buttons, invalid states, and destructive menu items.')}
          ${tokenRow('border', 'Default borders and separators.', 'Cards, menus, tables, separators, and layout dividers.')}
          ${tokenRow('input', 'Form control borders and input surface treatment.', html`<code>inputClass()</code>, <code>textareaClass()</code>, <code>&lt;ui-select&gt;</code>, and outline-style controls.`)}
          ${tokenRow('ring', 'Focus rings and outlines.', 'Buttons, inputs, checkboxes, menus, and other focusable controls.')}
          ${tokenRow('chart-1 ... chart-5', 'The default chart palette.', 'Charts and chart-driven dashboard blocks.')}
          ${tokenRow('sidebar / sidebar-foreground', 'The base sidebar surface and default sidebar text.', html`The <code>&lt;ui-sidebar&gt;</code> container and its default content.`)}
          ${tokenRow('sidebar-primary / sidebar-primary-foreground', 'High-emphasis actions inside the sidebar.', 'Active items, icon tiles, badges, and sidebar CTAs.')}
          ${tokenRow('sidebar-accent / sidebar-accent-foreground', 'Hover and selected states inside the sidebar.', 'Sidebar menu hover states, open items, and interactive rows.')}
          ${tokenRow('sidebar-border', 'Sidebar-specific borders and separators.', 'Sidebar headers, groups, and internal dividers.')}
          ${tokenRow('sidebar-ring', 'Sidebar-specific focus rings.', 'Focused controls inside the sidebar.')}
          ${tokenRow('radius', 'The base corner radius scale.', html`Cards, inputs, buttons, popovers, and the derived <code>radius-*</code> tokens.`)}
        </tbody>
      </table>
    </div>
    <p>The kit's theme also defines <code>destructive-foreground</code>, the text color on a destructive surface, which shadcn's default theme leaves out.</p>
    ${callout(html`The chart tokens are covered in more detail in the <a href="/ui/docs/components/chart">Chart docs</a>.`, { className: 'mt-4' })}

    ${heading(toc, 2, 'Radius Scale')}
    <p><code>--radius</code> is the base radius token for your theme.</p>
    <p>We derive a small radius scale from it so components can use consistent corner sizes while still sharing a single source of truth.</p>
    ${codeFigure(`@theme inline {
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
}`, { title: 'styles/globals.css', lang: 'css', lineNumbers: true })}
    <p>This means:</p>
    <ul>
      <li><code>radius-lg</code> is the base value.</li>
      <li>Smaller radii scale down from <code>--radius</code>.</li>
      <li>Larger radii scale up from <code>--radius</code>.</li>
      <li>Changing <code>--radius</code> updates the entire radius scale.</li>
    </ul>

    ${heading(toc, 2, 'Adding New Tokens')}
    <p>To add a new token, define it under <code>:root</code> and <code>.dark</code>, then expose it to Tailwind with <code>@theme inline</code>.</p>
    ${codeFigure(`:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}`, { title: 'styles/globals.css', lang: 'css', lineNumbers: true })}
    <p>You can now use <code>bg-warning</code> and <code>text-warning-foreground</code> in your components.</p>
    ${codeFigure(`<div class="bg-warning text-warning-foreground"></div>`)}
    <p>A registry item can carry tokens of its own as <code>cssVars</code>. When <code>add</code> installs it, it adds each token your <code>:root</code>, <code>.dark</code> or <code>@theme inline</code> block lacks and leaves the ones you already define alone. That is how the sidebar brings its <code>--sidebar-*</code> tokens to an app whose theme predates them.</p>

    ${heading(toc, 2, 'Base Colors')}
    <p><code>tailwind.baseColor</code> controls the default token values generated for your project when you run <code>init</code>.</p>
    <p>The available base colors are: <strong>Neutral</strong>, <strong>Stone</strong>, <strong>Zinc</strong>, <strong>Mauve</strong>, <strong>Olive</strong>, <strong>Mist</strong>, and <strong>Taupe</strong>.</p>
    ${commandBlock(packageCommands('init --base-color zinc'))}
    <p><code>init</code> writes the theme once, between a <code>/* @webjsdev/ui theme */</code> and a <code>/* @webjsdev/ui theme end */</code> comment, and a later plain run leaves it alone, since the tokens are yours to edit. To switch the base color of an existing project, run <code>init --base-color &lt;name&gt; --overwrite</code>, which replaces the block in place (and also resets the aliases and helper files), or change the values by hand. A block without the end comment, written by an older version, is never replaced, only reported.</p>
    ${heading(toc, 2, 'Presets')}
    <p>To choose the style, the colors, the radius, the fonts and the icon library together, build a design system in <a href="/ui/create">Create</a> and apply the code it prints. <code>init --preset</code> replaces the theme block with the preset's tokens and records the rest in <code>components.json</code>.</p>
    ${commandBlock(packageCommands('init --preset <code>'))}

    ${heading(toc, 2, 'Default Theme CSS')}
    <p>The following is the full default <code>neutral</code> theme, exactly as <code>init</code> installs it. Copy it into your global CSS file and adjust the tokens as needed.</p>
    ${codeFigure(themeCss, { title: 'styles/globals.css', lang: 'css', lineNumbers: true })}
    <p>The file you compile also needs Tailwind itself, imported first:</p>
    ${codeFigure(`@import "tailwindcss";`, { lang: 'css' })}

    ${heading(toc, 2, 'Without CSS Variables')}
    <p>There is no mode without CSS variables. Every component's classes name the theme tokens (<code>bg-primary</code>, <code>text-muted-foreground</code>), so the tokens are the one place a color is decided, and changing them is how you restyle the kit. <code>tailwind.cssVariables</code> is accepted in <code>components.json</code> for compatibility, and <code>init</code> always writes <code>true</code>.</p>
  `;
}
