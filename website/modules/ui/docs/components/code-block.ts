import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Code Block docs page, ported from shadcn's
 * content/docs/components/radix/code-block.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React or Shiki.
 * The kit ships no highlighter, so the highlighting sections say what it
 * offers instead. Every preview renders in rhea, as shadcn's do, except RTL,
 * which shadcn shows in nova.
 */
/** The demo shown above the Installation section. */
export const demo = 'code-block-demo';

const rhea = { style: 'rhea', previewClass: 'h-auto' };

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  codeBlockClass,
  codeBlockHeaderClass,
  codeBlockTitleClass,
  codeBlockActionsClass,
  codeBlockContentClass,
  codeBlockCodeClass,
  codeBlockLines,
  codeBlockFooterClass,
} from '#components/ui/code-block.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="code-block" data-variant="default" data-size="default" class=\${codeBlockClass()}>
  <div data-slot="code-block-header" class=\${codeBlockHeaderClass()}>
    <div data-slot="code-block-title" class=\${codeBlockTitleClass()}>Terminal</div>
    <div data-slot="code-block-actions" class=\${codeBlockActionsClass()}>
      <ui-code-block-copy-button value=\${output}></ui-code-block-copy-button>
    </div>
  </div>
  <pre data-slot="code-block-content" tabindex="0" dir="ltr" class=\${codeBlockContentClass()}><code
    data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${output}</code></pre>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    ${codeFigure(`code-block                       codeBlockClass()
├── code-block-header            codeBlockHeaderClass()
│   ├── code-block-title         codeBlockTitleClass()
│   └── code-block-actions       codeBlockActionsClass()
│       └── <ui-code-block-copy-button>
├── code-block-actions           (floating, when there is no header)
├── code-block-content           codeBlockContentClass(), on a pre element
│   └── code-block-code          codeBlockCodeClass(), on a code element
│       └── code-block-line      codeBlockLines() or codeBlockLineClass()
└── code-block-footer            codeBlockFooterClass()`, { lang: 'text' })}
    <p>The <code>&lt;code&gt;</code> takes a string or a list of line spans. Use lines, from <code>codeBlockLines()</code>, when you need line numbers or line variants.</p>

    ${heading(toc, 2, 'Features')}
    <ul>
      <li><strong>It stays small.</strong> A string renders as one text node, and <code>codeBlockLines()</code> splits text into line spans only when you need numbers or line variants.</li>
      <li><strong>It copies cleanly.</strong> Line numbers and diff markers are left out of a selection, and blank lines survive the copy.</li>
      <li><strong>It reads left to right.</strong> The content is always <code>dir="ltr"</code>. The header follows the page direction.</li>
      <li><strong>It works with any highlighter.</strong> Lines are plain text, and the token spans of any highlighter fit inside a line. See <a href="#syntax-highlighting">Syntax Highlighting</a>.</li>
      <li><strong>It fits where code shows up.</strong> Use it in a message, a Markdown fence, a Trace line, Tabs, a Dialog or a <code>typeset</code> container.</li>
      <li><strong>It scrolls by keyboard.</strong> The content is focusable, and floating actions show on focus as well as on hover.</li>
    </ul>

    ${heading(toc, 2, 'Basic')}
    <p>Put a string inside the <code>&lt;code&gt;</code>. It renders as one text node, so it stays cheap while output streams.</p>
    ${await componentPreview('code-block-basic', rhea)}

    ${heading(toc, 2, 'Header')}
    <p>The header holds a title and the actions. <code>&lt;ui-code-block-copy-button&gt;</code> copies its <code>value</code>, or the code in its block when it has none.</p>
    ${await componentPreview('code-block-header', rhea)}
    <p>A long title truncates. To link the title to a file, wrap it in an anchor.</p>
    ${codeFigure(`<div data-slot="code-block-header" class=\${codeBlockHeaderClass()}>
  <a href="/files/route.ts">
    <div data-slot="code-block-title" class=\${codeBlockTitleClass()}>app/api/chat/route.ts</div>
  </a>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Actions')}
    <p>The actions hold any number of buttons. For a wrap toggle, keep the state in a component of your own and set <code>data-wrap</code> on the content to match.</p>
    ${await componentPreview('code-block-actions', rhea)}
    ${codeFigure(`<div data-slot="code-block-actions" class=\${codeBlockActionsClass()}>
  <button
    type="button"
    data-slot="button"
    data-variant="ghost"
    data-size="icon-xs"
    aria-label="Wrap lines"
    aria-pressed=\${this.wrap}
    class=\${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), 'aria-pressed:text-foreground')}
    @click=\${() => { this.wrap = !this.wrap; }}
  >
    \${WrapTextIcon()}
  </button>
  <ui-code-block-copy-button value=\${output}></ui-code-block-copy-button>
</div>
<pre data-slot="code-block-content" ?data-wrap=\${this.wrap} tabindex="0" dir="ltr" class=\${codeBlockContentClass()}><code
  data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${output}</code></pre>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Floating Actions')}
    <p>Without a header, put the actions directly inside the code block. The actions float at the top end and stay hidden until the block is hovered or focused. They always show on touch screens.</p>
    ${await componentPreview('code-block-floating-actions', rhea)}

    ${heading(toc, 2, 'Line Numbers')}
    <p>Add <code>data-numbered</code> to the content and render the text with <code>codeBlockLines()</code>, which splits it into lines. The numbers are not copied with a selection.</p>
    ${await componentPreview('code-block-line-numbers', rhea)}

    ${heading(toc, 2, 'Start Line')}
    <p>Set <code>counter-reset: line N</code> on the content to number lines from <code>N + 1</code>, for a snippet from the middle of a file. The gutter grows to fit the widest number.</p>
    ${await componentPreview('code-block-start-line', rhea)}

    ${heading(toc, 2, 'Wrap')}
    <p>Long lines scroll by default. Add <code>data-wrap</code> to wrap them, which suits tool output and error messages. To let the reader toggle it, see <a href="#actions">Actions</a>.</p>
    ${await componentPreview('code-block-wrap', rhea)}

    ${heading(toc, 2, 'Highlighted Lines')}
    <p>Pass <code>variants</code> to <code>codeBlockLines()</code>, mapping a line number (from 1) to <code>'highlighted'</code> for the lines to call out.</p>
    ${await componentPreview('code-block-highlighted-lines', rhea)}

    ${heading(toc, 2, 'Diff')}
    <p>Map a line to <code>'added'</code> or <code>'removed'</code>. Each one adds a <code>+</code> or <code>−</code> marker.</p>
    ${await componentPreview('code-block-diff', rhea)}

    ${heading(toc, 2, 'Height')}
    <p>Cap the height with a <code>max-h-*</code> class on the content. The content scrolls inside the block.</p>
    ${await componentPreview('code-block-height', rhea)}
    <p>The content fades its edges with <code>scroll-fade</code> as it scrolls: left and right by default, top and bottom when it wraps. Add <code>scroll-fade-y</code> to a capped block that does not wrap.</p>

    ${heading(toc, 2, 'Show More')}
    <p>The footer is a slot below the content. For Show More, cap the content while it is collapsed and put a native <code>&lt;details&gt;</code> in the footer, its <code>&lt;summary&gt;</code> styled as a ghost <code>xs</code> button. While it is open, <code>group-has-[details[open]]/code-block</code> variants lift the cap, so it works with no script.</p>
    ${await componentPreview('code-block-show-more', rhea)}
    ${codeFigure(`<pre
  id="chat-source"
  data-slot="code-block-content"
  tabindex="0"
  dir="ltr"
  class=\${cn(codeBlockContentClass(), 'max-h-64 scroll-fade-y overflow-y-hidden group-has-[details[open]]/code-block:max-h-none group-has-[details[open]]/code-block:overflow-y-auto')}
><code data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${code}</code></pre>
<div data-slot="code-block-footer" class=\${cn(codeBlockFooterClass(), 'justify-center')}>
  <details class="group/show-more">
    <summary
      aria-controls="chat-source"
      class=\${cn(buttonClass({ variant: 'ghost', size: 'xs' }), 'list-none [&::-webkit-details-marker]:hidden')}
    >
      <span class="group-open/show-more:hidden">Show more</span>
      <span class="hidden group-open/show-more:inline">Show less</span>
    </summary>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Max Height')}
    <p>To keep a long block from taking over the page, raise the cap instead of removing it. The expanded content scrolls, and the edges fade as you scroll.</p>
    ${await componentPreview('code-block-show-more-scroll', rhea)}

    ${heading(toc, 2, 'Size')}
    <p>Use <code>data-size="sm"</code> on the code block for tool and <a href="#trace">Trace</a> output. It has tighter padding and <code>text-xs</code> text.</p>
    ${await componentPreview('code-block-size', rhea)}

    ${heading(toc, 2, 'Destructive')}
    <p>Use <code>codeBlockClass({ variant: 'destructive' })</code> with <code>data-variant="destructive"</code> for errors and failed output.</p>
    ${await componentPreview('code-block-destructive', rhea)}

    ${heading(toc, 2, 'Trace')}
    <p>Put a code block with <code>data-size="sm"</code> in a trace step's collapsible content for tool and terminal output. Add <code>data-wrap</code> and a <code>max-h-64</code> class to the content so long output wraps and scrolls inside the trace. The block sets its own text color, so the trace content does not mute it.</p>
    ${await componentPreview('code-block-trace', rhea)}

    ${heading(toc, 2, 'Tabs')}
    <p>Show several files with <a href="/ui/docs/components/tabs">Tabs</a>, one code block in each <code>&lt;ui-tabs-content&gt;</code>.</p>
    ${await componentPreview('code-block-tabs', rhea)}

    ${heading(toc, 2, 'Message')}
    <p>Put a code block between paragraphs inside a <a href="/ui/docs/components/message">Message</a>.</p>
    ${await componentPreview('code-block-chat', rhea)}

    ${heading(toc, 2, 'Typeset')}
    <p>A code block inside a <a href="/ui/docs/typeset"><code>typeset</code></a> container keeps its own styles and gets the same space above as a paragraph.</p>
    ${await componentPreview('code-block-typeset', rhea)}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>. Code always reads left to right. The header follows the page direction.</p>
    ${await componentPreview('code-block-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'Syntax Highlighting')}
    <p><code>codeBlockLines()</code> renders plain text, so a block that only shows plain output stays small and no grammar reaches the browser. To highlight, run the highlighter of your choice and put its token spans inside each line, built with <code>codeBlockLineClass()</code>.</p>
    ${await componentPreview('code-block-highlighting', rhea)}
    ${codeFigure(`// tokens: one array of { text, className } per line, from your highlighter.
<pre data-slot="code-block-content" tabindex="0" dir="ltr" class=\${codeBlockContentClass()}><code
  data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${tokens.map((line) => html\`<span
    data-slot="code-block-line" data-variant="default" class=\${codeBlockLineClass()}><span
    data-slot="code-block-line-content" class="min-w-0">\${line.map((t) => html\`<span class=\${t.className}>\${t.text}</span>\`)}</span></span>\`)}</code></pre>`, { lineNumbers: true })}
    <p>The preview shows the plain lines the kit renders.</p>

    ${heading(toc, 3, 'Languages')}
    <p>The kit loads no languages. Every block renders the text it is given, whatever its language, so the language list lives in the highlighter you bring.</p>
    ${await componentPreview('code-block-languages', rhea)}

    ${heading(toc, 3, 'Terminal Output')}
    <p>The kit does not read ANSI escape codes, so without a converter they show as text. The preview reads the few codes its output uses into colored spans inside each line, which is all a line needs.</p>
    ${await componentPreview('code-block-ansi', rhea)}
    <p>ANSI colors do not carry from one line to the next.</p>

    ${heading(toc, 3, 'Server Rendering')}
    <p>Highlight in a <code>'use server'</code> module and call it from the page, so the highlighter never reaches the browser and the page receives the finished tokens.</p>
    ${codeFigure(`import { html } from '@webjsdev/core';
import { highlightCode } from '#modules/docs/queries/highlight-code.server.ts';

export default async function Page() {
  // A 'use server' function that runs your highlighter on the server.
  const tokens = await highlightCode(code, 'tsx');

  return html\`
    <div data-slot="code-block" data-variant="default" data-size="default" class=\${codeBlockClass()}>
      <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" class=\${codeBlockContentClass()}><code
        data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${tokens.map(renderLine)}</code></pre>
    </div>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 3, 'Streaming')}
    <p>A block renders the text it is given, so a component that holds the streaming text in a signal re-renders its lines as the text grows. The preview shows the settled result.</p>
    ${await componentPreview('code-block-streaming', rhea)}

    ${heading(toc, 3, 'Markdown')}
    <p>The kit does not parse Markdown. Render the message with the Markdown renderer of your choice and route each fenced code block to a code block titled by its language. Inline code stays an inline <code>&lt;code&gt;</code>.</p>
    ${await componentPreview('code-block-markdown', rhea)}
    <p>While a fence is still streaming, leave the copy button out, and add it once the closing fence arrives.</p>

    ${heading(toc, 2, 'Accessibility')}
    <ul>
      <li>The content is a <code>&lt;pre&gt;</code> with a <code>&lt;code&gt;</code> element. Keep <code>dir="ltr"</code> on it, so code reads left to right on an RTL page.</li>
      <li>The content has <code>tabindex="0"</code>, so keyboard users can focus it and scroll it. Set <code>tabindex="-1"</code> to remove the tab stop.</li>
      <li>Floating actions show when focus is inside the block, not only on hover, so keyboard users can reach them.</li>
      <li>Line numbers are hidden from screen readers.</li>
      <li>Diff lines carry a <code>+</code> or <code>−</code> marker as well as a tint, so the change does not rely on color.</li>
      <li><code>&lt;ui-code-block-copy-button&gt;</code> is labelled "Copy", and a polite live region announces "Copied" after a successful copy.</li>
      <li>Give a wrap toggle <code>aria-pressed</code> so its state is announced.</li>
      <li>A Show More <code>&lt;details&gt;</code> announces its own expanded state. Point <code>aria-controls</code> on its <code>&lt;summary&gt;</code> at the <code>id</code> of the content.</li>
    </ul>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'codeBlockClass')}
    <p>The surface that holds the header, the content and the footer. Put it on a <code>&lt;div data-slot="code-block"&gt;</code> with <code>data-variant</code> and <code>data-size</code> to match. <code>codeBlockVariants()</code> is an alias of <code>codeBlockClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option or attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "destructive"</code></td><td><code>"default"</code></td><td>The tone of the block. Mirror it in <code>data-variant</code>.</td></tr>
          <tr><td><code>data-size</code></td><td><code>"default" | "sm"</code></td><td><code>"default"</code></td><td><code>"sm"</code> has tighter padding and <code>text-xs</code> code, for tool output.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'codeBlockHeaderClass')}
    <p>A row above the content for a title and actions, on a <code>&lt;div data-slot="code-block-header"&gt;</code>. It takes no options.</p>

    ${heading(toc, 3, 'codeBlockTitleClass')}
    <p>A filename or a label, with an optional icon, on a <code>&lt;div data-slot="code-block-title"&gt;</code>. It truncates. It takes no options.</p>

    ${heading(toc, 3, 'codeBlockActionsClass')}
    <p>Holds buttons at the end of the header, on a <code>&lt;div data-slot="code-block-actions"&gt;</code>. As a direct child of the code block, it floats. It takes no options.</p>

    ${heading(toc, 3, 'ui-code-block-copy-button')}
    <p>A ghost icon button that copies its <code>value</code> to the clipboard, or the code in its block when it has no <code>value</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td><td>The text to copy. Empty copies the block's code.</td></tr>
          <tr><td><code>variant</code></td><td><code>string</code></td><td><code>"ghost"</code></td><td>A <a href="/ui/docs/components/button">Button</a> variant.</td></tr>
          <tr><td><code>size</code></td><td><code>string</code></td><td><code>"icon-xs"</code></td><td>A Button size.</td></tr>
        </tbody>
      </table>
    </div>
    <p>After a successful copy it fires <code>ui-copy</code>, which bubbles, with <code>{ detail: { text } }</code>.</p>

    ${heading(toc, 3, 'codeBlockContentClass')}
    <p>The <code>&lt;pre data-slot="code-block-content"&gt;</code> that scrolls or wraps. It holds a <code>&lt;code data-slot="code-block-code"&gt;</code> with <code>codeBlockCodeClass()</code>. Its behaviour is set with attributes.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>data-wrap</code></td><td><code>boolean</code></td><td>absent</td><td>Wrap long lines instead of scrolling.</td></tr>
          <tr><td><code>data-numbered</code></td><td><code>boolean</code></td><td>absent</td><td>Number each line. Render the text with <code>codeBlockLines()</code>.</td></tr>
          <tr><td><code>style="counter-reset: line N"</code></td><td><code>number</code></td><td><code>0</code></td><td>One less than the number of the first line, when <code>data-numbered</code> is set.</td></tr>
          <tr><td><code>tabindex</code></td><td><code>number</code></td><td><code>0</code></td><td>Makes the content focusable so it can be scrolled by keyboard.</td></tr>
          <tr><td><code>dir</code></td><td><code>"ltr"</code></td><td><code>"ltr"</code></td><td>Keeps code reading left to right on any page.</td></tr>
          <tr><td><code>class</code></td><td><code>string</code></td><td>-</td><td>Merge extra classes, such as <code>max-h-72</code>, with <code>cn</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'codeBlockLines')}
    <p><code>codeBlockLines(text, { variants })</code> returns one line span per line of <code>text</code>, keeping an empty line as a newline. <code>codeBlockLineClass({ variant })</code> styles a line span of your own. <code>codeBlockLineVariants()</code> is an alias of <code>codeBlockLineClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>variants</code></td><td><code>Record&lt;number, CodeBlockLineVariant&gt;</code></td><td>-</td><td>Maps a line number, from 1, to its variant.</td></tr>
          <tr><td><code>variant</code></td><td><code>"default" | "added" | "removed" | "highlighted"</code></td><td><code>"default"</code></td><td>The state of the line, for <code>codeBlockLineClass()</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'codeBlockFooterClass')}
    <p>A row below the content, such as for a Show More button, on a <code>&lt;div data-slot="code-block-footer"&gt;</code>. It takes no options.</p>

    ${heading(toc, 3, 'useHighlightedCode')}
    <p>See <a href="#syntax-highlighting">Syntax Highlighting</a> for how token spans from a highlighter of your own go into the lines.</p>
  `;
}
