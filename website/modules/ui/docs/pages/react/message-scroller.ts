import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { installation, table } from '../ai-elements/shared.ts';

/**
 * React / Message Scroller, ported from shadcn's
 * content/docs/react/message-scroller.mdx (#1666). shadcn documents the
 * headless MessageScroller in @shadcn/react; the kit ported it as the
 * <ui-message-scroller> elements, so this page is their element-level
 * reference in shadcn's section order. Every attribute, method, event and
 * data attribute named here is read from
 * packages/ui/packages/registry/components/message-scroller.ts.
 */
export const title = 'Message Scroller';
export const description = 'Use the Message Scroller elements directly, with your own markup and classes on top of the kit\'s.';

const code = (s: string) => html`<code>${s}</code>`;

export default async function body(toc: TocEntry[]) {
  return html`
    <p>shadcn ships <code>MessageScroller</code> as a headless primitive in its <code>@shadcn/react</code> package. WebJs UI ported that primitive as a set of custom elements, <code>&lt;ui-message-scroller&gt;</code> and its parts. The elements own all of the scroll behavior: anchoring turns, following streamed output, keeping the reader's place as history loads, and tracking visibility.</p>
    <p>The kit has no separate unstyled layer. Each element applies the kit's classes to the box it renders, and a <code>class</code> you write on an element is merged with them, so you style the scroller by adding classes, or by editing the copy of the component that the CLI puts in your project.</p>
    <p>For the behavior guide and live examples, see the <a href="/ui/docs/components/message-scroller">Message Scroller</a> component.</p>

    ${await installation(toc, {
      prose: html`The elements ship in the Message Scroller component file. Adding it copies <code>components/ui/message-scroller.ts</code> into your project, together with the <a href="/ui/docs/components/button">Button</a> it styles its scroll button with.`,
      add: 'message-scroller',
      source: 'message-scroller',
      dependencies: ['button'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/message-scroller.ts';`)}
    <p>Importing the file registers the elements. There is no namespace object: each part is its own element, and the behavior is the same one the component page shows.</p>
    ${codeFigure(`<ui-message-scroller>
  <ui-message-scroller-viewport>
    <ui-message-scroller-content aria-label="Conversation">
      \${repeat(messages, (message) => message.id, (message) => html\`
        <ui-message-scroller-item
          message-id=\${message.id}
          ?scroll-anchor=\${message.role === 'user'}
        >
          <!-- your message UI -->
        </ui-message-scroller-item>
      \`)}
    </ui-message-scroller-content>
  </ui-message-scroller-viewport>
  <ui-message-scroller-button></ui-message-scroller-button>
</ui-message-scroller>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Parts')}
    <p>If you are coming from shadcn, its styled parts and its unstyled namespace parts map to the kit's elements like this. The provider and the frame are one element in the kit.</p>
    ${table(['Styled component', 'Unstyled part', 'WebJs UI element'], [
      [code('MessageScrollerProvider'), code('MessageScroller.Provider'), html`${code('<ui-message-scroller>')}`],
      [code('MessageScroller'), code('MessageScroller.Root'), html`${code('<ui-message-scroller>')}`],
      [code('MessageScrollerViewport'), code('MessageScroller.Viewport'), code('<ui-message-scroller-viewport>')],
      [code('MessageScrollerContent'), code('MessageScroller.Content'), code('<ui-message-scroller-content>')],
      [code('MessageScrollerItem'), code('MessageScroller.Item'), code('<ui-message-scroller-item>')],
      [code('MessageScrollerButton'), code('MessageScroller.Button'), code('<ui-message-scroller-button>')],
    ])}
    <p>shadcn's hooks read from the provider. In the kit they are members of the <code>&lt;ui-message-scroller&gt;</code> element, which any code that can reach the element can use:</p>
    ${table(['Hook', 'WebJs UI'], [
      [code('useMessageScroller'), html`The element's ${code('scrollToMessage()')}, ${code('scrollToEnd()')} and ${code('scrollToStart()')} methods.`],
      [code('useMessageScrollerScrollable'), html`The element's ${code('scrollable')} property and its ${code('ui-scrollable-change')} event.`],
      [code('useMessageScrollerVisibility'), html`The element's ${code('visibleMessageIds')} property and its ${code('ui-visibility-change')} event.`],
    ])}
    ${codeFigure(`const scroller = document.querySelector('ui-message-scroller');

scroller.scrollToEnd();
scroller.addEventListener('ui-scrollable-change', (e) => {
  const { start, end } = e.detail;
});
scroller.addEventListener('ui-visibility-change', (e) => {
  const { visibleMessageIds } = e.detail;
});`)}

    ${heading(toc, 2, 'Example')}
    <p>Here is a complete example that adds its own classes and streams the reply from a <code>'use server'</code> action. An action that returns an async generator streams each chunk over one response, and the component reads the chunks with <code>for await</code>, appending each to the reply as it arrives.</p>
    ${codeFigure(`'use server';

export async function* reply(question: string): AsyncGenerator<string> {
  // Yield each chunk as your model or upstream produces it.
  for (const word of \`You asked: \${question}\`.split(' ')) {
    yield word + ' ';
  }
}`, { title: 'modules/chat/actions/reply.server.ts', lineNumbers: true })}
    ${codeFigure(`import { WebComponent, html, signal } from '@webjsdev/core';
import { repeat } from '@webjsdev/core/directives';
import '#components/ui/message-scroller.ts';
import { reply } from '../actions/reply.server.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

export class ChatThread extends WebComponent {
  private messages = signal<ChatMessage[]>([]);
  private busy = signal(false);

  private async send(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const question = String(new FormData(form).get('question') ?? '').trim();
    if (!question) return;
    form.reset();

    const id = crypto.randomUUID();
    const answerId = \`\${id}-answer\`;
    this.messages.set([
      ...this.messages.get(),
      { id, role: 'user', text: question },
      { id: answerId, role: 'assistant', text: '' },
    ]);
    this.busy.set(true);
    try {
      for await (const chunk of await reply(question)) {
        this.messages.set(this.messages.get().map((m) =>
          m.id === answerId ? { ...m, text: m.text + chunk } : m));
      }
    } finally {
      this.busy.set(false);
    }
  }

  render() {
    return html\`
      <div class="flex h-svh w-full flex-col">
        <ui-message-scroller auto-scroll class="flex-1">
          <ui-message-scroller-viewport>
            <ui-message-scroller-content aria-label="Conversation" class="gap-4 p-6 text-base">
              \${repeat(this.messages.get(), (m) => m.id, (m) => html\`
                <ui-message-scroller-item message-id=\${m.id} ?scroll-anchor=\${m.role === 'user'}>
                  <div class="rounded-lg bg-muted p-4">\${m.text}</div>
                </ui-message-scroller-item>
              \`)}
            </ui-message-scroller-content>
          </ui-message-scroller-viewport>
          <ui-message-scroller-button></ui-message-scroller-button>
        </ui-message-scroller>
        <form class="flex gap-2 p-4" @submit=\${(e: SubmitEvent) => this.send(e)}>
          <input name="question" aria-label="Message" class="flex-1 rounded-md border px-3 py-2">
          <button ?disabled=\${this.busy.get()}>Send</button>
        </form>
      </div>
    \`;
  }
}
ChatThread.register('chat-thread');`, { title: 'modules/chat/components/chat-thread.ts', lineNumbers: true })}
    <p>shadcn's example gives the scroll button its own text, "Jump to latest". <code>&lt;ui-message-scroller-button&gt;</code> renders its own arrow icon and its "Scroll to end" or "Scroll to start" label and takes no content, so it can be restyled with <code>class</code>, <code>variant</code> and <code>size</code> but not relabelled.</p>

    ${heading(toc, 2, 'Avoiding a Flash on Reload')}
    <p>A scroll container always opens at the top. HTML has no way to set <code>scrollTop</code>, so a server-rendered transcript would show the oldest messages first, and you would see a jump once JavaScript moves the view to <code>default-scroll-position</code>.</p>
    <p>The kit handles this for you. The frame and the viewport are served with <code>data-pending-scroll</code>, for every opening position, and the viewport's own classes include <code>data-[pending-scroll]:invisible</code>, so the transcript stays hidden until the element has applied the position and removed the attribute. There is no rule to add. Because the attribute is only removed by the element, a transcript also stays hidden while JavaScript is off.</p>
    <p>shadcn's inline script that scrolls the server-rendered viewport to the end before hydration does not port. The scrolling element is rendered by <code>&lt;ui-message-scroller-viewport&gt;</code>, so an <code>id</code> written on that element stays on the host rather than reaching the scrolling box, and the element serves its viewport hidden until it upgrades in any case.</p>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-message-scroller')}
    <p>The root. It is shadcn's <code>MessageScroller.Provider</code> and <code>MessageScroller.Root</code> in one element: it owns the scroll state and the behavior, and renders the frame. The frame fills its parent, so use it inside a height-constrained layout.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('auto-scroll'), code('boolean'), code('false'), 'Follow new content only while the reader is at the live edge. A scroll away from the end releases it, and a scroll back to the end, or scrollToEnd(), resumes it.'],
      [code('default-scroll-position'), code('"end" | "start" | "last-anchor"'), code('"end"'), html`Opening position, applied once after the messages lay out. ${code('"last-anchor"')} opens at the last ${code('scroll-anchor')} item and falls back to ${code('"end"')} when there is none.`],
      [code('class'), code('string'), '-', 'Merged with the frame\'s classes on the frame element.'],
    ])}
    <p>shadcn's <code>scrollEdgeThreshold</code>, <code>scrollMargin</code> and <code>scrollPreviousItemPeek</code> have no attributes in the kit. The distance that still counts as being at an edge is fixed at 24px, and a newly anchored turn keeps a fixed 64px of the previous item in view.</p>
    <p>The frame carries <code>data-slot="message-scroller"</code> and <code>data-pending-scroll</code> until the opening position applies. It does not carry shadcn's <code>data-scrollable</code> or <code>data-autoscrolling</code>: read the scroll state from the <code>scrollable</code> property, and <code>data-autoscrolling</code> is on the viewport.</p>

    ${heading(toc, 3, 'ui-message-scroller-viewport')}
    <p>The scrolling element. It takes no attributes apart from a merged <code>class</code>.</p>
    ${table(['Data attribute', 'Value', 'Description'], [
      [code('data-slot'), code('"message-scroller-viewport"'), 'Identifies the scrolling element.'],
      [code('data-pending-scroll'), 'present', 'Present until the opening position is applied. The viewport is invisible while it is set.'],
      [code('data-autoscrolling'), 'present', 'Present for a frame while auto-scroll moves the viewport to the newest content.'],
    ])}
    <p>Unlike shadcn's viewport it adds no <code>role="region"</code>, no accessible name and no <code>tabindex</code>, and it has no <code>preserveScrollOnPrepend</code> option, since keeping the reader's place when rows are prepended is the browser's own scroll anchoring.</p>

    ${heading(toc, 3, 'ui-message-scroller-content')}
    <p>The transcript. Every direct child should be a <code>&lt;ui-message-scroller-item&gt;</code>.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('aria-label'), code('string'), '-', 'Accessible name for the transcript, passed to the log element.'],
      [code('class'), code('string'), '-', 'Merged with the list\'s classes on the list element.'],
    ])}
    <p>The list it renders has <code>role="log"</code> and <code>aria-relevant="additions"</code>, which are fixed. It also renders the spacer that makes room under a newly anchored turn, as its last child with <code>data-message-scroller-spacer</code>. The spacer is internal, so there is no <code>spacerClassName</code>.</p>

    ${heading(toc, 3, 'ui-message-scroller-item')}
    <p>One transcript row: a message, marker, typing row, separator, or load-more row.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('message-id'), code('string'), '-', 'Stable row id used by scrollToMessage() and visibility tracking.'],
      [code('scroll-anchor'), code('boolean'), code('false'), 'Marks the row as a turn boundary that anchors near the top when it is appended.'],
      [code('class'), code('string'), '-', 'Merged with the item\'s classes on the item itself.'],
    ])}
    <p>The item is the row box, so it carries its classes and <code>data-slot="message-scroller-item"</code> on itself. It keeps your <code>message-id</code> and <code>scroll-anchor</code> attributes as written, so select on those (<code>[scroll-anchor]</code>) where shadcn mirrors them into <code>data-message-id</code> and <code>data-scroll-anchor</code>.</p>

    ${heading(toc, 3, 'ui-message-scroller-button')}
    <p>A button that scrolls to the start or end of the transcript. When there is nothing to scroll toward it is hidden, removed from the tab order with <code>tabindex="-1"</code>, and hidden from assistive technology with <code>aria-hidden="true"</code>.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('direction'), code('"end" | "start"'), code('"end"'), 'Transcript edge the button scrolls toward.'],
      [code('variant'), html`a <a href="/ui/docs/components/button">Button</a> variant`, code('"secondary"'), 'The button\'s variant.'],
      [code('size'), html`a <a href="/ui/docs/components/button">Button</a> size`, code('"icon-sm"'), 'The button\'s size.'],
      [code('class'), code('string'), '-', 'Merged with the button\'s classes on the button element.'],
    ])}
    <p>The button scrolls smoothly, or instantly when the reader prefers reduced motion; it has no <code>behavior</code> attribute. It renders its own icon and label and takes no children or <code>render</code> target.</p>
    ${table(['Data attribute', 'Value', 'Description'], [
      [code('data-direction'), code('"start" | "end"'), 'Mirrors direction.'],
      [code('data-active'), code('"true" | "false"'), 'Whether this button can currently scroll.'],
      [code('data-variant'), code('string'), 'Mirrors variant.'],
      [code('data-size'), code('string'), 'Mirrors size.'],
    ])}

    ${heading(toc, 3, 'Methods')}
    <p>Imperative transcript controls, called on the <code>&lt;ui-message-scroller&gt;</code> element. They are shadcn's <code>useMessageScroller</code>.</p>
    ${table(['Method', 'Type', 'Description'], [
      [code('scrollToMessage'), code('(id: string, options?) => void'), 'Scroll to the mounted item with that message-id. Does nothing when no mounted item has it.'],
      [code('scrollToEnd'), code('() => void'), 'Scroll to the newest message, and follow new ones again when auto-scroll is set.'],
      [code('scrollToStart'), code('() => void'), 'Scroll to the oldest message.'],
      [code('viewport'), code('() => HTMLElement | null'), 'The scrolling element, for a virtualizer or your own listeners.'],
    ])}
    <p>The methods return nothing, where shadcn's return whether the command applied, and <code>scrollToMessage</code> does not queue a target that is not mounted yet: call it once the rows are in the DOM. <code>scrollToEnd</code> and <code>scrollToStart</code> take no options.</p>
    <p><code>scrollToMessage</code> options:</p>
    ${table(['Option', 'Type', 'Default', 'Description'], [
      [code('align'), code('"start" | "center" | "end" | "nearest"'), code('"start"'), 'How the item aligns in the viewport.'],
      [code('behavior'), code('ScrollBehavior'), html`${code('"smooth"')}, ${code('"auto"')} under reduced motion`, 'Native scroll behavior for the command.'],
    ])}

    ${heading(toc, 3, 'scrollable')}
    <p>Which edges the viewport can scroll toward, for UI that needs the values in JavaScript. It is shadcn's <code>useMessageScrollerScrollable</code>, read from the element's <code>scrollable</code> property and reported by the <code>ui-scrollable-change</code> event (which bubbles) each time it changes.</p>
    ${table(['Value', 'Type', 'Description'], [
      [code('start'), code('boolean'), html`Whether the viewport can scroll toward the start. ${code('!start')} means it is at the top.`],
      [code('end'), code('boolean'), html`Whether the viewport can scroll toward the end. ${code('!end')} means it is at the bottom.`],
    ])}

    ${heading(toc, 3, 'visibleMessageIds')}
    <p>Visibility state for outline, search, and active-turn UI. It is shadcn's <code>useMessageScrollerVisibility</code>, read from the element's <code>visibleMessageIds</code> property and reported by the <code>ui-visibility-change</code> event (which bubbles) with <code>{ visibleMessageIds }</code> as its detail.</p>
    ${table(['Value', 'Type', 'Description'], [
      [code('visibleMessageIds'), code('string[]'), 'The message-ids of the items intersecting the viewport, in document order.'],
    ])}
    <p>The kit has no <code>currentAnchorId</code>. To find the current turn, take the last <code>scroll-anchor</code> item at or above the first visible id. Only items with a <code>message-id</code> are tracked.</p>
  `;
}
