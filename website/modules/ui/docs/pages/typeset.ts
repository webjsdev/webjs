import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * Typeset, ported from shadcn's content/docs/(root)/typeset.mdx (#1666): the
 * docs page about the typeset stylesheet. The stylesheet is shadcn's own,
 * served at /ui/typeset.css, and the builder is /ui/typeset. What changes is
 * where the file goes in a WebJs app (public/typeset.css, imported from the
 * public/input.css Tailwind entry, which is what the builder's panel says
 * too) and the markup spelling (class, an html template).
 */
export const title = 'Typeset';
export const description = 'A styling system for HTML and rendered markdown, from blog posts to streaming chat. One CSS file you own.';

const hr = html`<hr>`;

export default async function body(toc: TocEntry[]) {
  return html`
    <p>You render markdown and get back plain unstyled HTML: headings, paragraphs, lists, and tables. So you style the elements one by one: font sizes, line heights, spacing.</p>
    <p>You do it for your blog. Then you do it again for the docs. Then again for the chat app. Every time you're fighting the same thing: sizing and spacing.</p>
    <p>Typeset fixes this. It's one CSS file that styles everything inside a <code>typeset</code> container. The file lives in your project, so you can change it directly when you need to.</p>
    <p>A typeset is just a small preset class. You can have multiple typesets in your app, for different contexts.</p>
    ${codeFigure(`.typeset-docs {
  --typeset-font-body: var(--font-geist);
  --typeset-font-heading: var(--font-geist);
  --typeset-font-mono: var(--font-geist-mono);
  --typeset-size: 15px;
  --typeset-leading: 1.75;
  --typeset-flow: 1.25em;
}`, { lang: 'css' })}
    <a href="/ui/typeset" data-slot="button" class=${cn(buttonClass({ size: 'sm' }), 'mt-6 no-underline!')}>Build your typeset</a>

    ${hr}

    ${heading(toc, 2, 'Principles')}
    <p>There is a lot to read about type: scale ratios, tracking, kerning, optical sizing, measure, leading, the space above and below every element. Exposing all of it is too much. Nobody wants to set a dozen variables to make markdown look right.</p>
    <p>So Typeset condenses everything into three controls: size, leading, and flow. Everything else, heading sizes, list indents, the gap under a heading, the space around a rule, derives from them. Three controls. It's called rhythm.</p>

    ${hr}

    ${heading(toc, 2, 'Features')}
    <ul>
      <li><strong>It fits its container.</strong> Put it in a chat bubble and it follows the smaller type around it. Put it in an article and it scales up with the page. On smaller screens, it gets a small bump for readability.</li>
      <li><strong>It uses your theme.</strong> Colors, fonts, and radius come from your app. Dark mode follows the same tokens.</li>
      <li><strong>It's easy to tune.</strong> Three values control the base size, line height, and space between blocks. Change them in a preset and the whole document follows.</li>
      <li><strong>It works well with streaming.</strong> When a new block arrives, Typeset doesn't make earlier blocks switch margins, borders, or styles.</li>
    </ul>

    ${hr}

    ${heading(toc, 2, 'Building Your Typeset')}
    <p>Create your typeset in the <a href="/ui/typeset">typeset builder</a>. Pick your fonts and rhythm, then preview them on docs, chat, articles, and other real content.</p>
    <p>The panel gives you the <code>typeset.css</code> file, the font setup for a WebJs app, a preset class with your choices, and the wrapper to add around your content. The file is also served on its own at <a href="/ui/typeset.css">/ui/typeset.css</a>.</p>
    <p>A WebJs app compiles one Tailwind entry, <code>public/input.css</code>, into the stylesheet its layout links. Save the file as <code>public/typeset.css</code>, next to that entry, and import it after Tailwind:</p>
    ${codeFigure(`@import "tailwindcss";
@import "./typeset.css";`, { title: 'public/input.css', lang: 'css' })}
    <p>Then wrap your rendered markdown with <code>typeset</code> and your preset class:</p>
    ${codeFigure(`html\`<div class="typeset typeset-docs">\${unsafeHTML(renderedMarkdown)}</div>\``)}
    <p><code>typeset</code> turns the styles on. <code>typeset-docs</code> is the preset you created in the builder. Render markdown on the server with any library you like; <code>unsafeHTML</code> from <code>@webjsdev/core/directives</code> places the trusted HTML it returns. Never pass it user input that has not been sanitized.</p>

    ${hr}

    ${heading(toc, 2, 'Custom Typesets')}
    <p>The file includes defaults, so you can use <code>typeset</code> by itself. Most of the reading rhythm comes from three values:</p>
    ${codeFigure(`.typeset {
  --typeset-font-body: inherit;
  --typeset-font-heading: var(--font-heading);
  --typeset-font-mono: var(--font-mono);

  --typeset-size: 1em; /* body font-size */
  --typeset-leading: 1.75; /* line-height */
  --typeset-flow: 1.25em; /* space between blocks */
}`, { lang: 'css' })}
    <ul>
      <li><strong><code>--typeset-size</code></strong> sets the base text size. <code>1em</code> follows the surrounding layout. On smaller screens, Typeset bumps it up a little.</li>
      <li><strong><code>--typeset-leading</code></strong> sets the space between lines.</li>
      <li><strong><code>--typeset-flow</code></strong> sets the space between blocks. Headings and other elements derive their spacing from it.</li>
    </ul>
    <p>The font variables tell Typeset which families to use. Leave them alone and it follows your app. Colors and radius come from your theme too.</p>
    <p>Typeset doesn't set a maximum width. Your layout owns that. The Measure control in the builder adds a <code>max-width</code> to the wrapper instead of hiding it in the stylesheet.</p>
    <p>You can keep more than one preset in the same app. Here is a tighter one for chat and a roomier one for docs:</p>
    ${codeFigure(`.typeset-chat {
  --typeset-flow: 1em;
  --typeset-leading: 1.6;
}

.typeset-docs {
  --typeset-size: 15px;
  --typeset-flow: 1.5em;
}`, { lang: 'css' })}
    ${codeFigure(`<div class="typeset typeset-chat">\${message}</div>
<article class="typeset typeset-docs">\${page}</article>`)}
    <p>For a one-off change, skip the preset and set a value on the container:</p>
    ${codeFigure(`<article class="typeset [--typeset-flow:1.75em]">...</article>`)}

    ${hr}

    ${heading(toc, 2, 'Custom Themes')}
    <p>A preset can change the whole feel of the content, not just the spacing. You can give readers a serif reading mode, a compact UI mode, or any other style that fits your product.</p>
    ${codeFigure(`/* Reading: serif, larger type, roomy rhythm. */
.typeset-reading {
  --typeset-font-body: var(--font-lora);
  --typeset-font-heading: var(--font-lora);
  --typeset-size: 18px;
  --typeset-leading: 1.9;
  --typeset-flow: 2em;
}

/* Compact: sans, smaller type, tighter rhythm. */
.typeset-compact {
  --typeset-font-body: var(--font-geist);
  --typeset-font-heading: var(--font-geist);
  --typeset-size: 14px;
  --typeset-leading: 1.6;
  --typeset-flow: 1em;
}`, { lang: 'css' })}

    ${hr}

    ${heading(toc, 2, 'Accessibility and Dark Mode')}
    <p>For readers who prefer larger type and more space, create a roomier typeset and expose it as a setting:</p>
    ${codeFigure(`.typeset-large {
  --typeset-size: 16px;
  --typeset-leading: 2;
  --typeset-flow: 2em;
}`, { lang: 'css' })}
    <p>Dark mode already follows your theme colors. If the text feels a little tight on a dark surface, you can loosen the leading there:</p>
    ${codeFigure(`.dark .typeset {
  --typeset-leading: 1.9;
}`, { lang: 'css' })}

    ${hr}

    ${heading(toc, 2, 'Responsive Table')}
    <p>Tables stay real tables and wrap to fit. To scroll a wide one horizontally instead, wrap it in <code>typeset-scroll</code>:</p>
    ${codeFigure(`<div class="typeset-scroll">
  <table>...</table>
</div>`)}
    <p>Do this where your markdown renderer emits a table, or wrap the table in the template that places it. It works for any wide block, not just tables.</p>

    ${hr}

    ${heading(toc, 2, 'Overrides')}
    <p>Typeset lives in the <code>components</code> layer and uses <code>:where()</code> for its element selectors. Tailwind utilities on an element win without <code>!important</code>:</p>
    ${codeFigure(`<div class="typeset typeset-docs">
  <p class="text-lg">...</p>
</div>`)}
    <p>Plain CSS can override Typeset with a normal selector too.</p>

    ${hr}

    ${heading(toc, 2, 'Opting Out')}
    <p>To keep a component out of Typeset, add <code>not-typeset</code> or <code>data-not-typeset</code>:</p>
    ${codeFigure(`<div class="typeset">
  <p>Styled prose.</p>
  <div class=\${cn(cardClass(), 'not-typeset')}>Untouched component.</div>
</div>`)}
    <p>Both options cover the component and everything inside it. Another <code>typeset</code> container inside that subtree stays opted out too.</p>
    <p>An element carrying a <code>data-slot</code> attribute is left out the same way, along with everything inside it. The kit's components put <code>data-slot</code> on their parts, so a button, a card or a dialog dropped into prose keeps its own styles with no opt-out.</p>

    ${hr}

    ${heading(toc, 2, 'Streaming')}
    <p>Typeset is written so that adding a new block does not change the styles of the blocks already on screen.</p>
    <ul>
      <li>No forward-looking selectors. <code>:last-child</code>, <code>:has()</code>, and <code>:empty</code> are left out of layout rules because their matches can change as content is added.</li>
      <li>Spacing flows in one direction, using <code>margin-block-start</code> only. A new block adds its own space.</li>
      <li>Table separators live on the cells being added, so a new row does not restyle the row above it.</li>
    </ul>
    <p>Text that is still streaming can grow and wrap normally. Typeset just avoids restyling the blocks that came before it. That makes it a good fit for a reply streamed from a <code>'use server'</code> action that returns an async generator, or for a <code>&lt;ui-message-scroller&gt;</code> conversation.</p>

    ${hr}

    ${heading(toc, 2, 'Prior Art')}
    <p>The <code>prose</code> class from <code>@tailwindcss/typography</code> is excellent at what it was built for: adding beautiful typographic defaults to plain HTML, including content rendered from Markdown or a CMS.</p>
    <p>Typeset takes a different approach with container-aware sizing, app theme tokens, presets for different contexts, and streaming stability. Here's where they differ:</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th></th><th>@tailwindcss/typography</th><th>Typeset</th></tr></thead>
        <tbody>
          <tr><td>Sizing</td><td>Fixed <code>rem</code> scale, <code>prose-sm</code> to <code>prose-2xl</code></td><td>Relative to the container, any size</td></tr>
          <tr><td>Dark mode</td><td><code>prose-invert</code>, a second palette</td><td>Your tokens flip, nothing to add</td></tr>
          <tr><td>Theming</td><td>Prose color variables; scale baked in</td><td>Your theme tokens, plus font and rhythm controls</td></tr>
          <tr><td>Overrides</td><td><code>prose-a:</code>, <code>prose-headings:</code> modifier API</td><td>Plain utilities and CSS win</td></tr>
          <tr><td>Streaming</td><td>No append-stability contract</td><td>Designed for stable appends</td></tr>
          <tr><td>Distribution</td><td>npm plugin, generated CSS</td><td>One CSS file you own</td></tr>
        </tbody>
      </table>
    </div>
    <p>Typeset borrows the two best ideas from the plugin: the zero-specificity <code>:where()</code> guard pattern, and the escape-hatch class (<code>not-typeset</code>, in the spirit of <code>not-prose</code>).</p>
  `;
}
