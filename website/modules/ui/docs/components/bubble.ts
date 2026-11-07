import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview, type PreviewOptions } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Bubble docs page, ported from shadcn's
 * content/docs/components/radix/bubble.mdx (#1666): the same sections in the
 * same order, every preview in the rhea style shadcn shows it in, the prose
 * rewritten where it describes React.
 */
export const demo = 'bubble-demo';

const RHEA: PreviewOptions = { style: 'rhea', previewClass: 'h-auto theme-blue' };

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>
`;

/** The paragraphs shadcn puts between the lead demo and Installation. */
export function intro(_toc: TocEntry[]) {
  return html`
    <p>The bubble helpers display framed conversational content. Use them for chat text, short structured output, quoted replies, suggestions, and reactions.</p>
    <p>For full-featured chat interfaces, use the <a href="/ui/docs/components/message">Message</a> helpers. A bubble is intentionally scoped to the bubble surface. Place avatars, names, timestamps, metadata, and message-level actions in the <a href="/ui/docs/components/message">Message</a>.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { bubbleClass, bubbleContentClass, bubbleReactionsClass } from '#components/ui/bubble.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="bubble" data-variant="default" data-align="start" class=\${bubbleClass()}>
  <div data-slot="bubble-content" class=\${bubbleContentClass()}>
    I checked the registry output and removed the stale route.
  </div>
  <div data-slot="bubble-reactions" data-side="bottom" data-align="end" class=\${bubbleReactionsClass()}>
    <span>👍</span>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a bubble:</p>
    ${codeFigure(`Bubble
├── BubbleContent
└── BubbleReactions`, { lang: 'text' })}
    <p>Each part is a plain element carrying its helper's classes and its <code>data-slot</code>. Use <code>bubbleGroupClass()</code> to group consecutive bubbles from the same sender:</p>
    ${codeFigure(`BubbleGroup
├── Bubble
│   └── BubbleContent
└── Bubble
    └── BubbleContent`, { lang: 'text' })}

    ${heading(toc, 2, 'Features')}
    <ul>
      <li>Seven visual variants, from a strong primary bubble to unframed ghost content</li>
      <li>Start and end alignment for sender and receiver bubbles</li>
      <li>Reactions that anchor to the bubble edge with configurable side and alignment</li>
      <li>Bubbles size to their content, up to 80% of the container width</li>
      <li>Link and button bubbles: the content helper goes straight on an <code>&lt;a&gt;</code> or <code>&lt;button&gt;</code></li>
      <li>Customizable styling by merging your own classes into any part with <code>cn()</code></li>
    </ul>

    ${heading(toc, 2, 'Variants')}
    <p>Use the <code>variant</code> option (with a matching <code>data-variant</code>) to change the visual treatment of the bubble.</p>
    ${await componentPreview('bubble-variants', RHEA)}
    ${table(['Variant', 'Description'], [
      [html`<code>default</code>`, 'A strong primary bubble, usually for the current user.'],
      [html`<code>secondary</code>`, 'The standard neutral bubble for conversation content.'],
      [html`<code>muted</code>`, 'A lower-emphasis bubble for quiet supporting content.'],
      [html`<code>tinted</code>`, 'A subtle primary-tinted bubble.'],
      [html`<code>outline</code>`, 'A bordered bubble for secondary or rich content.'],
      [html`<code>ghost</code>`, 'Unframed content for assistant text or rich content.'],
      [html`<code>destructive</code>`, 'A destructive bubble for error or failed actions.'],
    ])}
    <p>A bubble sizes to its content, up to 80% of the container width. The <code>ghost</code> variant removes the max-width so assistant text and rich content can span the full row.</p>

    ${heading(toc, 2, 'Alignment')}
    <p>Use <code>data-align</code> on the bubble to align it to the start or end of the conversation.</p>
    ${await componentPreview('bubble-alignment', RHEA)}
    ${table(['data-align', 'Description'], [
      [html`<code>start</code>`, 'Align the bubble to the start of the conversation.'],
      [html`<code>end</code>`, 'Align the bubble to the end of the conversation.'],
    ])}
    <p><strong>Note:</strong> When building chat interfaces, you probably want to set the alignment on the message itself, not the bubble. A bubble inside a message with <code>data-align="end"</code> follows it to the end of the conversation.</p>

    ${heading(toc, 2, 'Bubble Group')}
    <p>Use <code>bubbleGroupClass()</code> to group consecutive bubbles from the same sender. Note the <code>data-align</code> attribute should be set on each bubble itself, not the group.</p>
    ${codeFigure(`BubbleGroup
├── Bubble
│   └── BubbleContent
└── Bubble
    └── BubbleContent`, { lang: 'text' })}
    ${await componentPreview('bubble-group-demo', RHEA)}

    ${heading(toc, 2, 'Links and Buttons')}
    <p>You can turn a bubble into a link or button by putting <code>bubbleContentClass()</code> on an <code>&lt;a&gt;</code> or <code>&lt;button&gt;</code> instead of a <code>&lt;div&gt;</code>. There is no wrapper and no <code>asChild</code>.</p>
    ${await componentPreview('bubble-link-button', RHEA)}
    ${codeFigure(`import { bubbleClass, bubbleContentClass } from '#components/ui/bubble.ts';

export function BubbleLinkDemo() {
  return html\`
    <div data-slot="bubble" data-variant="muted" class=\${bubbleClass({ variant: 'muted' })}>
      <button type="button" data-slot="bubble-content" class=\${bubbleContentClass()}>Click here</button>
    </div>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Reactions')}
    <p>Use <code>bubbleReactionsClass()</code> for bubble reactions. You can use it to display reactions or quick action buttons. Use the <code>side</code> and <code>align</code> options (with matching <code>data-side</code> and <code>data-align</code>) to position the row, where <code>side: 'top'</code> anchors it to the upper edge. Reactions overlap the bubble edge, so leave vertical space between rows. The examples below use a larger <code>gap</code> for this reason.</p>
    ${await componentPreview('bubble-reactions', RHEA)}

    ${heading(toc, 2, 'Show More / Collapsible')}
    <p>Long bubble content can be composed with a <a href="/ui/docs/components/collapsible">Collapsible</a> to allow for a show more or show less interaction. The collapsible is a native <code>&lt;details&gt;</code>, so its <code>&lt;summary&gt;</code> is the trigger and the toggle needs no script.</p>
    ${await componentPreview('bubble-collapsible', RHEA)}

    ${heading(toc, 2, 'Tooltip')}
    <p>Wrap a bubble's control in a <a href="/ui/docs/components/tooltip">Tooltip</a> to reveal metadata on hover, such as when a message was read.</p>
    ${await componentPreview('bubble-tooltip', RHEA)}

    ${heading(toc, 2, 'Popover')}
    <p>Pair a bubble with a <a href="/ui/docs/components/popover">Popover</a> to surface more information on demand, such as the full error message for a failed action.</p>
    ${await componentPreview('bubble-popover', RHEA)}

    ${heading(toc, 2, 'Accessibility')}
    <p>A bubble renders the presentational message surface. Keep conversation-level semantics on the surrounding container and follow the guidelines below.</p>

    ${heading(toc, 3, 'Labeling Reactions')}
    <p>Reactions render as a row of emoji. A screen reader reads each glyph with no context, and counters like <code>+8</code> are announced as "plus eight". Group the row as a single image with a descriptive <code>aria-label</code> so it announces once. <code>role="img"</code> also hides the individual emoji from assistive tech, so no <code>aria-hidden</code> is needed.</p>
    ${codeFigure(`<div data-slot="bubble-reactions" role="img" aria-label="Reactions: thumbs up, fire, and 8 more"
  class=\${bubbleReactionsClass()}>
  <span>👍</span>
  <span>🔥</span>
  <span>+8</span>
</div>`, { lineNumbers: true })}
    <p>When reactions are interactive, render buttons instead and give icon-only buttons an <code>aria-label</code>.</p>
    ${codeFigure(`<div data-slot="bubble-reactions" class=\${bubbleReactionsClass()}>
  <button type="button" aria-label="Thumbs up" class=\${buttonClass({ variant: 'secondary', size: 'icon-xs' })}>
    \${ThumbsUpIcon()}
  </button>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Interactive Bubbles')}
    <p>When a bubble is clickable, put the content helper on a real <code>&lt;button&gt;</code> or <code>&lt;a&gt;</code> so it is focusable and exposes the correct role. The content classes ship a visible focus ring for interactive elements, and the accessible name comes from the bubble text. No extra label is needed.</p>
    ${codeFigure(`<div data-slot="bubble" data-variant="muted" data-align="end" class=\${bubbleClass({ variant: 'muted' })}>
  <button type="button" data-slot="bubble-content" class=\${bubbleContentClass()} @click=\${onReply}>
    I forgot my password
  </button>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Meaning Beyond Color')}
    <p>Bubble variants signal role and tone with color. Pair them with text, alignment, or icons so meaning is not conveyed by color alone. For a <code>destructive</code> bubble, keep the error context in the message text rather than relying on the color treatment.</p>

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a helper that returns classes for a plain element. Set the part's <code>data-slot</code>, and the <code>data-variant</code>, <code>data-align</code> and <code>data-side</code> attributes that match the options you pass, since the styles key on them.</p>

    ${heading(toc, 3, 'bubbleClass')}
    <p>The root bubble wrapper, on <code>data-slot="bubble"</code>. <code>bubbleVariants()</code> is an alias of <code>bubbleClass()</code> that also merges a <code>className</code>.</p>
    ${table(['Option or attribute', 'Type', 'Default', 'Description'], [
      [html`<code>variant</code>`, html`<code>"default" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive"</code>`, html`<code>"default"</code>`, html`The bubble visual treatment. Mirror it in <code>data-variant</code>.`],
      [html`<code>data-align</code>`, html`<code>"start" | "end"</code>`, html`<code>"start"</code>`, 'The inline alignment of the bubble.'],
    ])}

    ${heading(toc, 3, 'bubbleContentClass')}
    <p>The bubble content, on <code>data-slot="bubble-content"</code>. Put it on a <code>&lt;div&gt;</code>, or on an <code>&lt;a&gt;</code> or <code>&lt;button&gt;</code> for an interactive bubble. It takes no options.</p>

    ${heading(toc, 3, 'bubbleReactionsClass')}
    <p>Displays overlapped reactions for a bubble, on <code>data-slot="bubble-reactions"</code>. <code>bubbleReactionsVariants()</code> is an alias of <code>bubbleReactionsClass()</code> that also merges a <code>className</code>.</p>
    ${table(['Option', 'Type', 'Default', 'Description'], [
      [html`<code>side</code>`, html`<code>"top" | "bottom"</code>`, html`<code>"bottom"</code>`, 'The side of the bubble to anchor the reactions.'],
      [html`<code>align</code>`, html`<code>"start" | "end"</code>`, html`<code>"end"</code>`, 'The inline alignment of the reactions.'],
    ])}

    ${heading(toc, 3, 'bubbleGroupClass')}
    <p>Groups consecutive bubbles from the same sender, on <code>data-slot="bubble-group"</code>. It takes no options.</p>
  `;
}
