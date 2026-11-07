import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview, type PreviewOptions } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Message Scroller docs page, ported from shadcn's
 * content/docs/components/radix/message-scroller.mdx (#1666): the same
 * sections in the same order. The prose describes the kit's elements
 * where shadcn's describes the React provider, props and hooks. The lead
 * demo is the chat card, shown as modules/ui/docs/lead-previews.ts says.
 */
export const demo = 'message-scroller-demo';

// Every preview on the page renders as shadcn's does: rhea, in the
// blue theme, on the surface colour.
const PREVIEW: PreviewOptions = {
  style: 'rhea',
  className: 'rounded-[34px] sm:rounded-4xl',
  previewClass: 'h-auto theme-blue bg-surface dark:bg-background p-4 min-[480px]:p-8 min-[560px]:p-10 sm:px-10 sm:py-16',
};

const TABLE = 'typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full';

/** The two sections shadcn puts between the lead demo and Installation. */
export function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'What Makes a Great Streaming Chat Experience')}
    <p>Building a chat interface used to be simple. You create an inverted list with an input. Type a message, it appends at the bottom. When a reply comes in, the list grows and scrolls. Done.</p>
    <p>Streaming breaks that model. Messages arrive in chunks while you may still be reading, scrolling, or looking somewhere else entirely.</p>
    <p>Now the challenge is preserving the reader's place while the conversation keeps changing. Get that wrong and the experience feels jumpy: people are pulled to the bottom, lose context, and have to find their way back.</p>
    <p>In practice, this comes down to scroll: when to follow, when to hold, and when to let the reader decide. A great streaming chat should:</p>
    <ol>
      <li><strong>Move only when the reader asked to move.</strong> If someone is reading, don't pull them somewhere else. Auto-scroll should never be the default.</li>
      <li><strong>Follow only while they're following.</strong> If they're at the live edge, keep the stream in view. If they scroll away, leave them there.</li>
      <li><strong>Every interaction is a signal.</strong> Scrolling is not the only one. Selecting text, using the keyboard, opening a link, or searching should all stop the interface from moving.</li>
      <li><strong>Start a new turn near the top of the viewport.</strong> This gives the new turn somewhere it can be read from the beginning.</li>
      <li><strong>Then stream in the answer.</strong> The answer should grow into the screen, not immediately push everything away.</li>
      <li><strong>Keep part of the previous conversation in context.</strong> The prompt and reply should stay visually connected, and enough of the previous turn should remain visible so the reader knows where they are.</li>
      <li><strong>Let new content arrive offscreen.</strong> The conversation can keep streaming without changing what the reader is looking at.</li>
      <li><strong>Show what's happening out of view.</strong> Make it clear when a response is still streaming or when new messages have arrived.</li>
      <li><strong>Make it easy to return to the latest reply.</strong> A "Jump to latest" action should bring the reader back and resume following.</li>
      <li><strong>Let people jump anywhere in the conversation.</strong> Long threads need message links, search, unread markers, and direct navigation.</li>
      <li><strong>Reopen where the reader left off.</strong> A saved conversation should open at the last meaningful turn. Often this is the last user message. Not the absolute bottom.</li>
      <li><strong>Keep the reader's place when layout changes.</strong> Images load. Markdown expands. Code blocks render. Older messages appear above. None of that should make the reader lose their place.</li>
      <li><strong>Handle interruptions without stealing position.</strong> Stopping, retrying, regenerating, branching, or errors should not unexpectedly move the conversation.</li>
      <li><strong>Stay responsive in long threads.</strong> Streaming text, markdown, code, images, and long history should still feel responsive.</li>
      <li><strong>Be accessible without the noise.</strong> Keep the transcript navigable, preserve keyboard focus, and announce important events at a comfortable pace.</li>
    </ol>
    <p><strong>Never move the reader against their intent.</strong></p>

    ${heading(toc, 2, 'MessageScroller')}
    <p>MessageScroller is a chat transcript scroller built for these behaviors. <code>&lt;ui-message-scroller&gt;</code> owns the scroll state and transcript-row behavior: opening position, streamed output, new-turn anchoring, prepended history, visibility, and scroll controls. It is also the styled frame the transcript renders inside, so the kit has one element where shadcn has a provider and a frame.</p>
    <p>MessageScroller is scoped to the scroll viewport. It does not own messages, AI state, transport, persistence, branching, or model state. Your product code stays focused on composing messages, markers, tools, attachments, and prompt inputs.</p>
    <p>It gives you the scroll behavior that chat needs, without taking over the rest of the chat UI. And it stays fast, even in long conversations with rich markdown.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/message-scroller.ts';
import { messageClass, messageContentClass } from '#components/ui/message.ts';`)}
    ${codeFigure(`<ui-message-scroller>
  <ui-message-scroller-viewport>
    <ui-message-scroller-content aria-label="Conversation">
      \${repeat(messages, (m) => m.id, (m) => html\`
        <ui-message-scroller-item
          message-id=\${m.id}
          ?scroll-anchor=\${m.role === 'user'}
        >
          <div data-slot="message" class=\${messageClass()}>...</div>
        </ui-message-scroller-item>
      \`)}
    </ui-message-scroller-content>
  </ui-message-scroller-viewport>
  <ui-message-scroller-button></ui-message-scroller-button>
</ui-message-scroller>`)}
    <p><code>&lt;ui-message-scroller&gt;</code> fills its parent, so place it inside a height-constrained container.</p>
    ${codeFigure(`<div class="flex h-screen flex-col">
  <ui-message-scroller class="flex-1">...</ui-message-scroller>
</div>`)}

    ${heading(toc, 2, 'Composition')}
    ${codeFigure(`<ui-message-scroller>
  <ui-message-scroller-viewport>
    <ui-message-scroller-content>
      <ui-message-scroller-item>
        <!-- a message, marker, or row -->
      </ui-message-scroller-item>
      <ui-message-scroller-item></ui-message-scroller-item>
      <ui-message-scroller-item></ui-message-scroller-item>
    </ui-message-scroller-content>
  </ui-message-scroller-viewport>
  <ui-message-scroller-button></ui-message-scroller-button>
</ui-message-scroller>`)}
    <ul>
      <li><strong><code>&lt;ui-message-scroller&gt;</code></strong>: the root and the styled frame. Owns the scroll state and the attributes for opening position and auto-scroll, carries the scroll methods, and tracks visibility. It lays out the viewport, content, and controls inside it.</li>
      <li><strong><code>&lt;ui-message-scroller-viewport&gt;</code></strong>: the scrollable element. Receives native scroll events, and stays hidden until the opening position applies.</li>
      <li><strong><code>&lt;ui-message-scroller-content&gt;</code></strong>: the transcript container. Holds the rows and is the live region that announces new messages.</li>
      <li><strong><code>&lt;ui-message-scroller-item&gt;</code></strong>: the transcript row boundary. Wrap every direct child of the content so the scroller can measure, anchor, track visibility, and jump to it. An item can be a message, marker, typing indicator, separator, join/leave event, or "load earlier" row.</li>
      <li><strong><code>&lt;ui-message-scroller-button&gt;</code></strong>: the scroll control. Scrolls to the start or end of the transcript and is hidden and out of the tab order until there is content in its direction.</li>
    </ul>

    ${heading(toc, 2, 'Core Concepts')}
    ${heading(toc, 3, 'Anchoring Turns')}
    <p>A turn is the part of the conversation that starts a new exchange. In a simple AI chat, that is usually the user's message and the assistant reply that follows.</p>
    <p>An anchor is the row the viewport should treat as the start of that turn. Mark that row with the <code>scroll-anchor</code> attribute. When a new anchor is appended, the viewport moves it near the top and keeps a peek of the previous item above it, so the new turn does not feel detached from its context.</p>
    ${codeFigure(`<!-- This tells the scroller to anchor the user's message for the next turn. -->
<ui-message-scroller-item
  message-id=\${message.id}
  ?scroll-anchor=\${message.role === 'user'}
></ui-message-scroller-item>`)}
    <p>Scroll anchors are not tied to message role. You can turn any row into an anchor: a user message, a system marker, a handoff event, or anything else that starts a meaningful turn. The scroller only needs to know which row should anchor the viewport.</p>
    <p>In the following example, the user's message is anchored. When you send a new message, the viewport anchors it near the top and appends the assistant reply below it. Toggle the anchor to the assistant's message to see the difference.</p>
    ${await componentPreview('message-scroller-anchoring', PREVIEW)}

    ${heading(toc, 3, 'Group Chat')}
    <p>In a group chat, the turn boundary is more specific than "the user message". It is often the message that asks the model to respond, or a marker like "Marcus joined the chat". Typing indicators and history controls usually should not anchor.</p>
    <p>Because anchoring is role-independent, you can anchor a marker just as easily as a message.</p>
    ${codeFigure(`<ui-message-scroller-item message-id="marcus-joined" scroll-anchor>
  <div data-slot="marker" data-variant="separator" class=\${markerClass({ variant: 'separator' })}>
    <span data-slot="marker-content" class=\${markerContentClass()}>Marcus joined the chat</span>
  </div>
</ui-message-scroller-item>`)}
    ${await componentPreview('message-scroller-group-chat', PREVIEW)}

    ${heading(toc, 3, 'Keeping Context Visible')}
    <p>When a new turn starts, it should still feel like part of the same continuous thread. The scroller keeps a slice of the previous item visible above the anchor, so the reader keeps their context instead of feeling like the conversation restarted on a blank page.</p>
    <p>The kit keeps 64px of the previous turn in view, which is shadcn's default for <code>scrollPreviousItemPeek</code>. The amount is fixed: there is no attribute to change it.</p>
    ${codeFigure(`<!-- 64px of the previous turn stays visible above a newly anchored row. -->
<ui-message-scroller>...</ui-message-scroller>`)}
    <p>In the example below, the slider is the one shadcn's demo uses to adjust the peek. With the kit it stays at 64px.</p>
    ${await componentPreview('message-scroller-previous-context', PREVIEW)}

    ${heading(toc, 3, 'Following the Live Edge')}
    <p>When the reader is at the live edge, either because they stayed there or returned there, <code>auto-scroll</code> keeps streamed replies in view as they grow. Scrolling away from the live edge releases the view, whether by wheel, touch, keyboard scroll keys, or dragging the scrollbar. New chunks can then arrive without moving the reader.</p>
    <p><code>auto-scroll</code> composes with turn anchoring. When a new turn anchors near the top, the view stays put while the reply streams into the room below it. Once the reply fills the viewport, the reader is back at the live edge and follow-output takes over from the anchor.</p>
    ${codeFigure(`<ui-message-scroller auto-scroll>...</ui-message-scroller>`)}
    ${await componentPreview('message-scroller-streaming', PREVIEW)}
    <p>Calling <code>scrollToEnd()</code> on the element, or pressing <code>&lt;ui-message-scroller-button&gt;</code>, re-engages follow-output when <code>auto-scroll</code> is set, so a reader who scrolled away can return to the live edge and keep following. The viewport exposes <code>data-autoscrolling</code> while it follows new output, so you can conditionally apply styles during the transition.</p>

    ${heading(toc, 3, 'Opening Saved Threads')}
    <p>It can seem reasonable to reopen a saved thread at the absolute end of the transcript, but that often drops the reader into the conversation without enough context. A better default is <code>"last-anchor"</code>: show the last meaningful turn, like the user's latest message, with the reply below it.</p>
    <p>That gives the reader an immediate place in the thread. They can see what they asked, where the answer starts, and continue from there without reconstructing the conversation from the bottom edge.</p>
    ${codeFigure(`<ui-message-scroller default-scroll-position="last-anchor">...</ui-message-scroller>`)}
    ${await componentPreview('message-scroller-opening-position', { ...PREVIEW, hideCode: true })}
    <p><code>"last-anchor"</code> is keyed on <code>scroll-anchor</code>, not message role. If no anchor exists, it falls back to <code>"end"</code>.</p>
    <p>Use <code>"start"</code> when you want to resume at the beginning of a conversation, or <code>"end"</code> (the default) when the absolute latest message is the right place to land.</p>

    ${heading(toc, 3, 'Avoiding a Flash on Reload')}
    <p>A scroll container always opens at the top. HTML has no way to set <code>scrollTop</code>, so a server-rendered transcript shows the oldest messages first. After JavaScript runs, <code>default-scroll-position</code> moves the view, and you would see a jump.</p>
    <p>The kit's viewport carries <code>data-pending-scroll</code> from the server render until the element applies the opening position, for every position including <code>"start"</code>. The styled viewport stays hidden while the attribute is present, so you see the frame instead of the jump.</p>
    <p>shadcn also shows an inline script that scrolls a server-rendered viewport to the end before JavaScript loads. The kit has no such recipe: the element renders its own viewport and applies the position once it upgrades, so the hidden frame is what shows until then.</p>

    ${heading(toc, 3, 'Loading Earlier Messages')}
    <p>Loading earlier messages should not move the conversation the reader is already looking at. When older rows are prepended above the current transcript, the browser's own scroll anchoring keeps the visible row in place, so the reader stays where they are while history loads above them.</p>
    <p>This needs no setting. The kit has no <code>preserveScrollOnPrepend</code> option, because the behavior is the browser's (<code>overflow-anchor</code>), and it is on by default.</p>
    ${await componentPreview('message-scroller-load-history', PREVIEW)}
    <p>Use stable <code>message-id</code> values for message rows, and render the list with <code>repeat()</code> keyed on them, so a prepend inserts new rows rather than rewriting the ones the reader is looking at.</p>

    ${heading(toc, 3, 'Animating New Messages')}
    <p><code>&lt;ui-message-scroller-item&gt;</code> can be animated directly. Keep <code>message-id</code> and <code>scroll-anchor</code> on it, and use transform and opacity for the entrance.</p>
    <p>A common chat pattern is to animate the user's message when it is sent, then let the assistant reply stream into a regular row below it. Start the user row below its final position so it feels like it rises from the live edge of the viewport.</p>
    ${codeFigure(`item.animate(
  [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
  { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
);`)}
    <p>Run it once, when the row is first added, with <code>element.animate()</code> rather than a CSS animation: the content's slot can re-insert an item, which would restart a CSS animation.</p>
    ${await componentPreview('message-scroller-animation', PREVIEW)}
    <p>Avoid animating height, margin, or padding for row entrances; those changes can fight the scroller's positioning work. If the reader prefers reduced motion, skip the entrance animation and keep the scroll behavior the same.</p>

    ${heading(toc, 3, 'Jumping to Messages')}
    <p>Search results, permalinks, outline items, and toolbar buttons often need to drive the transcript from outside the message list. Call the methods on the <code>&lt;ui-message-scroller&gt;</code> element for those controls. Any code that can reach the element can call them, including controls rendered outside the frame.</p>
    ${codeFigure(`const scroller = document.querySelector('ui-message-scroller');`)}
    ${codeFigure(`scroller.scrollToMessage(id, { align: 'start' });
scroller.scrollToEnd();
scroller.scrollToStart();`)}
    ${await componentPreview('message-scroller-commands', { ...PREVIEW, hideCode: true })}
    <p><code>scrollToMessage</code> targets the <code>message-id</code> on <code>&lt;ui-message-scroller-item&gt;</code>, so rows that need to be addressable should have stable ids. It returns nothing, and does nothing when no mounted row has that id.</p>
    <p>shadcn's <code>scrollToMessage</code> can queue a target before the rows exist, for a permalink resolved while the transcript mounts. The kit's does not queue: call it once the rows are in the DOM.</p>

    ${heading(toc, 3, "Tracking the Reader's Position")}
    <p>Use the element's <code>visibleMessageIds</code> and its <code>ui-visibility-change</code> event to track the reader's position in the conversation. A common example is a table-of-contents or a jump menu that highlights the current anchored turn.</p>
    ${codeFigure(`scroller.addEventListener('ui-visibility-change', (e) => {
  const { visibleMessageIds } = e.detail;
});`)}
    ${await componentPreview('message-scroller-visibility', { ...PREVIEW, hideCode: true })}
    <p><code>visibleMessageIds</code> answers "what is on screen", in document order. The kit has no <code>currentAnchorId</code>: to answer "where am I", take the last anchored row at or above the first visible id.</p>
    <p>Visibility tracking runs for every item that has a <code>message-id</code>, and rows need one to participate.</p>

    ${heading(toc, 3, 'Reading Scroll State')}
    <p>Use the element's <code>scrollable</code> property and its <code>ui-scrollable-change</code> event when you need scroll state in JavaScript, such as a status indicator or a custom "jump to latest" control. It reports which edges the viewport can still scroll toward; "at the start/end" is the negation (<code>!start</code> / <code>!end</code>), and "scrollable at all" is <code>start || end</code>. The button styles itself from its <code>data-active</code> attribute.</p>
    ${codeFigure(`scroller.addEventListener('ui-scrollable-change', (e) => {
  const { start, end } = e.detail;
});`)}
    ${await componentPreview('message-scroller-scrollable', PREVIEW)}

    ${heading(toc, 2, 'Performance')}
    <p>Our performance goal for the scroller is to keep the scroll hot path off the render path: no re-render of transcript rows when the reader scrolls, and as little off-screen paint work as the browser can avoid.</p>
    <p>Scroll position, anchoring, and follow-output are tracked imperatively, by a scroll listener, a <code>ResizeObserver</code> and an <code>IntersectionObserver</code>, and mirrored onto the viewport and button through <code>data-*</code> attributes, so scrolling and streaming do not re-render transcript rows.</p>
    <p>The styled <code>&lt;ui-message-scroller-item&gt;</code> also ships with <code>content-visibility: auto</code> and <code>contain-intrinsic-size</code>. Rows stay in the DOM for selection, copy, find-in-page, SSR, and assistive tech, but the browser can skip rendering work for rows far outside the viewport.</p>
    <p>This is comfortable for the expected range of a chat transcript: hundreds to low thousands of turns, including messages with markdown and composed components.</p>

    ${heading(toc, 2, 'Virtualization')}
    <p>Virtualization is intentionally left outside the element. The scroller renders real DOM rows, so most transcripts never need it (see <a href="#performance">Performance</a>).</p>
    <p>When a transcript is large enough to need virtualization, hand the scroller's scrolling element to your virtualizer and let the virtualizer own the rows. The element returns it from <code>viewport()</code>.</p>
    ${codeFigure(`const scroller = document.querySelector('ui-message-scroller');
const viewport = scroller.viewport(); // the scrolling element`)}

    ${heading(toc, 2, 'Accessibility')}
    <p>The scroller keeps the transcript announceable without forcing a specific message UI.</p>
    <p><code>&lt;ui-message-scroller-content&gt;</code> marks the transcript as a live region with <code>role="log"</code> and <code>aria-relevant="additions"</code>. New rows can be announced, but streamed text mutations do not have to be announced token by token. Label the transcript with <code>aria-label</code> on the element, which passes it to the log.</p>
    ${codeFigure(`<ui-message-scroller-content aria-label="Conversation">
  ...
</ui-message-scroller-content>`)}
    <p>The viewport is a plain scroll container: unlike shadcn's, it does not add <code>role="region"</code>, a label, or <code>tabindex="0"</code>, so add those yourself if keyboard users should focus the transcript directly.</p>
    <p><code>&lt;ui-message-scroller-button&gt;</code> renders a real button named "Scroll to end" or "Scroll to start". When there is nothing to scroll toward, it uses <code>tabindex="-1"</code> and <code>aria-hidden="true"</code>, and exposes <code>data-active="false"</code>, so inactive scroll controls do not create extra focus stops.</p>

    ${heading(toc, 2, 'Unstyled')}
    <p>The kit has no separate headless package. The behavior lives in the elements, and the classes they apply are exported as helpers (<code>messageScrollerClass()</code>, <code>messageScrollerViewportClass()</code>, <code>messageScrollerContentClass()</code>, <code>messageScrollerItemClass()</code>, <code>messageScrollerButtonClass()</code>), so you can read or restyle them. A <code>class</code> on any part is merged with that part's classes.</p>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-message-scroller')}
    <p>The root and the styled frame.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>auto-scroll</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>default-scroll-position</code></td><td><code>"end" | "start" | "last-anchor"</code></td><td><code>"end"</code></td></tr>
        </tbody>
      </table>
    </div>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Method or property</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>scrollToEnd()</code></td><td>Scrolls to the newest message and follows new ones again.</td></tr>
          <tr><td><code>scrollToStart()</code></td><td>Scrolls to the oldest message.</td></tr>
          <tr><td><code>scrollToMessage(id, { align?, behavior? })</code></td><td>Scrolls the item with that <code>message-id</code> into view. <code>align</code> is <code>"start" | "center" | "end" | "nearest"</code>, <code>"start"</code> by default.</td></tr>
          <tr><td><code>viewport()</code></td><td>Returns the scrolling element.</td></tr>
          <tr><td><code>scrollable</code></td><td><code>{ start: boolean, end: boolean }</code>, the edges the viewport can still scroll toward.</td></tr>
          <tr><td><code>visibleMessageIds</code></td><td>The <code>message-id</code>s on screen, in document order.</td></tr>
        </tbody>
      </table>
    </div>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          <tr><td><code>ui-scrollable-change</code></td><td><code>{ start: boolean, end: boolean }</code></td></tr>
          <tr><td><code>ui-visibility-change</code></td><td><code>{ visibleMessageIds: string[] }</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-message-scroller-viewport')}
    <p>The scrolling element. It takes no attributes. It carries <code>data-pending-scroll</code> until the opening position applies and <code>data-autoscrolling</code> while it follows new output.</p>

    ${heading(toc, 3, 'ui-message-scroller-content')}
    <p>The transcript, a <code>role="log"</code> with <code>aria-relevant="additions"</code>. Its <code>aria-label</code> is passed to the log.</p>

    ${heading(toc, 3, 'ui-message-scroller-item')}
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>message-id</code></td><td><code>string</code></td><td>none</td></tr>
          <tr><td><code>scroll-anchor</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-message-scroller-button')}
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>direction</code></td><td><code>"end" | "start"</code></td><td><code>"end"</code></td></tr>
          <tr><td><code>variant</code></td><td>a <a href="/ui/docs/components/button">Button</a> variant</td><td><code>"secondary"</code></td></tr>
          <tr><td><code>size</code></td><td>a <a href="/ui/docs/components/button">Button</a> size</td><td><code>"icon-sm"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
