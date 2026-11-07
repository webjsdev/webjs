import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { table } from '../ai-elements/shared.ts';

/**
 * AI SDK, ported from shadcn's content/docs/helpers/ai-sdk.mdx (#1666).
 * shadcn's page documents @shadcn/helpers, which scripts a conversation and
 * replays it through React's useChat. WebJs has neither: a 'use server'
 * action that is an async generator already streams over one response, so
 * the page teaches that shape under shadcn's headings. The lead demo is the
 * settled thread (every scripted turn sent), as the Chat pattern's is.
 */
export const title = 'AI SDK';
export const description = 'Script a conversation in a streaming server action and render it through the kit\'s message scroller, with no model, no hand-written endpoint, and no API key.';

const ts = (code: string, opts: { title?: string; lineNumbers?: boolean } = {}) => codeFigure(code, { lang: 'ts', ...opts });

// --------------------------------------------------------------------------
// Code samples. Every one is WebJs code: an action in a .server.ts file with
// 'use server', a WebComponent consuming it, the kit's elements.
// --------------------------------------------------------------------------

const INTRO_ACTION = `// modules/chat/actions/reply.server.ts
'use server';
import type { Message, Part } from '#modules/chat/types.ts';

const replies = [
  'The release adds keyboard shortcuts and faster search.',
  'Press ⌘K to search and ⌘Enter to submit.',
];

export async function* reply(messages: Message[]): AsyncGenerator<Part> {
  const turn = messages.filter((m) => m.role === 'user').length - 1;
  yield { id: 'text', type: 'text', text: replies[turn] };
}`;

const INTRO_LOOP = `const assistant: Message = { id: crypto.randomUUID(), role: 'assistant', parts: [] };
this.messages.set([...transcript, assistant]);

for await (const part of await reply(transcript)) {
  this.update(assistant.id, part);
}`;

const QUESTIONS = `// modules/chat/script.ts (browser-safe: the component reads it)
export const questions = [
  'What changed in this release?',
  'Can you show me the shortcuts?',
];`;

const USAGE_ACTION = `// modules/chat/actions/reply.server.ts
'use server';
import type { Message, Part } from '#modules/chat/types.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One part, a word at a time: each chunk is the part so far, under one id.
async function* words(id: string, type: 'text' | 'reasoning', text: string, delayMs = 50): AsyncGenerator<Part> {
  let sent = '';
  for (const word of text.split(/(?<= )/)) {
    sent += word;
    yield { id, type, text: sent };
    await sleep(delayMs);
  }
}

const turns = [
  async function* () {
    yield* words('text', 'text', 'The release adds keyboard shortcuts and faster search.');
  },
  async function* () {
    yield* words('text', 'text', 'Press ⌘K to search and ⌘Enter to submit.');
  },
];

export async function* reply(messages: Message[]): AsyncGenerator<Part> {
  const turn = turns[messages.filter((m) => m.role === 'user').length - 1];
  if (!turn) {
    yield { id: 'text', type: 'text', text: 'This demo has no more predefined replies.' };
    return;
  }
  yield* turn();
}`;

const USAGE_COMPONENT = `// modules/chat/components/scripted-chat.ts
import { WebComponent, signal, html } from '@webjsdev/core';
import { reply } from '#modules/chat/actions/reply.server.ts';
import { questions } from '#modules/chat/script.ts';
import type { Message, Part } from '#modules/chat/types.ts';

// A part whose id the message already holds replaces it; a new id appends.
const upsert = (parts: Part[], part: Part) =>
  parts.some((p) => p.id === part.id)
    ? parts.map((p) => (p.id === part.id ? part : p))
    : [...parts, part];

// renderPart(part) draws one part with the kit's helpers (see Message Parts).

export class ScriptedChat extends WebComponent {
  private messages = signal<Message[]>([]);
  private busy = signal(false);

  private nextQuestion() {
    return questions[this.messages.get().filter((m) => m.role === 'user').length];
  }

  private update(id: string, part: Part) {
    this.messages.set(this.messages.get().map((m) =>
      m.id === id ? { ...m, parts: upsert(m.parts, part) } : m));
  }

  private async stream(id: string, transcript: Message[]) {
    this.busy.set(true);
    try {
      for await (const part of await reply(transcript)) this.update(id, part);
    } finally {
      this.busy.set(false);
    }
  }

  private async send() {
    const text = this.nextQuestion();
    if (!text || this.busy.get()) return;
    const user: Message = { id: crypto.randomUUID(), role: 'user', parts: [{ id: 'text', type: 'text', text }] };
    const transcript = [...this.messages.get(), user];
    const id = crypto.randomUUID();
    this.messages.set([...transcript, { id, role: 'assistant', parts: [] }]);
    await this.stream(id, transcript);
  }

  render() {
    return html\`
      <ui-message-scroller auto-scroll class="h-96">
        <ui-message-scroller-viewport>
          <ui-message-scroller-content aria-label="Conversation">
            \${this.messages.get().map((m) => html\`
              <ui-message-scroller-item message-id=\${m.id} ?scroll-anchor=\${m.role === 'user'}>
                \${m.parts.map(renderPart)}
              </ui-message-scroller-item>\`)}
          </ui-message-scroller-content>
        </ui-message-scroller-viewport>
        <ui-message-scroller-button></ui-message-scroller-button>
      </ui-message-scroller>
      <button ?disabled=\${!this.nextQuestion() || this.busy.get()} @click=\${() => this.send()}>Send</button>
    \`;
  }
}
ScriptedChat.register('scripted-chat');`;

const TYPES = `// modules/chat/types.ts
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ToolState =
  | 'input-available' | 'approval-requested'
  | 'output-available' | 'output-error' | 'output-denied';

export type Part =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'reasoning'; text: string }
  | { id: string; type: 'tool'; name: string; state: ToolState; input: Json; output?: Json; errorText?: string; approved?: boolean }
  | { id: string; type: 'data'; name: string; data: Json }
  | { id: string; type: 'file'; filename: string; mediaType: string; url: string }
  | { id: string; type: 'source'; title: string; url: string };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Part[];
}`;

const RENDER_PART = `import { bubbleClass, bubbleContentClass } from '#components/ui/bubble.ts';
import { traceClass, traceLineClass, traceTitleClass } from '#components/ui/trace.ts';

function renderPart(part: Part) {
  switch (part.type) {
    case 'text':
      return html\`<div data-slot="bubble" class=\${bubbleClass()}>
        <div data-slot="bubble-content" class=\${bubbleContentClass()}>\${part.text}</div>
      </div>\`;
    case 'reasoning':
      return html\`<p class="text-sm text-muted-foreground">\${part.text}</p>\`;
    case 'tool':
      return html\`<div data-slot="trace" class=\${traceClass()}>
        <div data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-title" class=\${traceTitleClass()}>\${part.name}: \${part.state}</span>
        </div>
      </div>\`;
    default:
      return '';
  }
}`;

export function whatItsFor(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, "What It's For")}
    <p>The script decouples your chat UI from the model, so you can work on the frontend on its own. It needs no model and no API key, and it streams the same way every time.</p>
    <ul>
      <li><strong>Build components.</strong> Develop message bubbles, tool cards, and reasoning panels against realistic streaming output, without wiring up a model first.</li>
      <li><strong>Preview and demo.</strong> Ship reproducible previews, screenshots, and videos that never depend on a live model.</li>
      <li><strong>Write docs.</strong> Power documentation examples with conversations that render the same way on every load.</li>
      <li><strong>Test.</strong> On the server the action is a plain async generator, so a test can call it directly and assert on what it yields, with no network calls, token spend, or flaky model output.</li>
    </ul>
  `;
}

export function installation(toc: TocEntry[], realModel: unknown) {
  return html`
    ${heading(toc, 2, 'Installation')}
    <p>There is no package to install. WebJs streams an action's results on its own, so the helper is three files you write: the message types, the scripted action, and the chat component, all shown below. The thread renders with the kit's components:</p>
    ${commandBlock(packageCommands('add message-scroller message bubble'))}
    <p>${realModel}</p>
  `;
}

export function userMessages(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'User Messages')}
    <p>Messages use the <code>user</code> and <code>assistant</code> roles. The component builds the person's message itself, as the next scripted question, before it calls the action.</p>
    ${ts(`const user: Message = {
  id: crypto.randomUUID(),
  role: 'user',
  parts: [{ id: 'text', type: 'text', text: 'What changed in this release?' }],
};`)}
    <p>The id is yours to choose, and any other field you need goes on the <code>Message</code> type. See <a href="#metadata-and-ids">Metadata and IDs</a>.</p>
    <p>User messages can also carry files. See <a href="#files">Files</a>.</p>
  `;
}

export function assistantMessages(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Assistant Messages')}
    <p>The component adds an empty assistant message, then fills it with what the action yields. A reply that is one string is one text part.</p>
    ${ts(`yield { id: 'text', type: 'text', text: 'The release adds keyboard shortcuts and faster search.' };`)}
    <p>Yield several parts, under different ids, when the message has more than plain text.</p>
    ${ts(`yield* words('thinking', 'reasoning', 'I should summarize the release.');
yield* words('text', 'text', 'The release adds keyboard shortcuts and faster search.');`)}
    <p>The parts land in the order the action yields them.</p>
  `;
}

export function messageParts(toc: TocEntry[], lead: unknown) {
  return html`
    ${heading(toc, 2, 'Message Parts')}
    <p>${lead}</p>
    ${ts(TYPES, { lineNumbers: true })}
    <p>The component renders each part with the kit's helpers: a <a href="/ui/docs/components/bubble">Bubble</a> for text, a <a href="/ui/docs/components/trace">Trace</a> line for a tool call.</p>
    ${ts(RENDER_PART, { lineNumbers: true })}
  `;
}

export function text(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Text')}
    <p>Yield a <code>text</code> part. The <code>words()</code> helper in the action streams it a word at a time, yielding the part so far under one id, so the component replaces it in place on each chunk.</p>
    ${ts(`yield* words('text', 'text', 'The release adds keyboard shortcuts.');
yield* words('more', 'text', 'Search is faster too.');`)}
    <p>Each id makes a separate part. To send a whole part at once, yield it once. To change the pace, pass a delay.</p>
    ${ts(`yield { id: 'done', type: 'text', text: 'Done.' };
yield* words('slow', 'text', 'This part streams more slowly.', 100);`)}
  `;
}

export function reasoning(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Reasoning')}
    <p>Yield a <code>reasoning</code> part.</p>
    ${ts(`yield* words('thinking', 'reasoning', 'I should check the latest conditions first.');
yield* words('text', 'text', 'Let me check the weather.');`)}
    <p>Reasoning streams the same way as text. Render it as a <a href="/ui/docs/ai-elements/reasoning">Reasoning</a> trace, or in a muted block as the demo above does.</p>
  `;
}

export function toolCalls(toc: TocEntry[], hitl = '#human-in-the-loop') {
  return html`
    ${heading(toc, 2, 'Tool Calls')}
    <p>Yield a <code>tool</code> part with its input, then yield it again under the same id once it has a result. The component replaces it, so the card moves from input to output.</p>
    ${ts(`const call = { id: 'weather', type: 'tool', name: 'getWeather', input: { city: 'San Francisco' } } as const;

yield { ...call, state: 'input-available' };
await sleep(900);
yield { ...call, state: 'output-available', output: { city: 'San Francisco', temperature: 18, condition: 'Breezy' } };

yield* words('text', 'text', 'It is 18°C and breezy in San Francisco.');`)}
    <p>The call can finish with an output, an error, or a denial.</p>
    ${ts(`yield { ...call, state: 'output-error', errorText: 'The weather service is down.' };
yield { ...call, state: 'output-denied' };`)}
    <p>To type each tool's input and output, make the tool member of <code>Part</code> a union with one member per tool name, and narrow on <code>name</code> where you render it.</p>
    ${ts(`type WeatherCall = {
  id: string; type: 'tool'; name: 'getWeather'; state: ToolState;
  input: { city: string };
  output?: { city: string; temperature: number; condition: string };
};`)}
    <p>A tool call can also wait for the person instead of finishing in the script. See <a href=${hitl}>Human in the Loop</a>.</p>
  `;
}

export function files(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Files')}
    <p>Add files to a user message as parts.</p>
    ${ts(`const user: Message = {
  id: crypto.randomUUID(),
  role: 'user',
  parts: [
    { id: 'text', type: 'text', text: 'Summarize this report.' },
    { id: 'report', type: 'file', filename: 'report.pdf', mediaType: 'application/pdf', url: 'https://example.com/report.pdf' },
  ],
};`)}
    <p>A file the person picks can also travel as the <code>File</code> itself, in a <code>file: File</code> field on the part, since action arguments round-trip <code>File</code> and <code>Blob</code> values. Yield a file part to attach one to the assistant's message.</p>
    ${ts(`yield { id: 'summary', type: 'file', filename: 'summary.md', mediaType: 'text/markdown', url: 'https://example.com/summary.md' };`)}
  `;
}

export function readingMessages(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Reading Messages')}
    <p>The transcript is the component's signal. Read it like any array.</p>
    ${ts(`this.messages.get();            // Every message.
this.messages.get().slice(0, 2); // The first two messages.`)}
    <p>The next scripted question is the entry after the questions already sent, or <code>undefined</code> when none remain.</p>
    ${ts(`const sent = this.messages.get().filter((m) => m.role === 'user').length;
const next = questions[sent];`)}
  `;
}

export function existingMessages(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Start from Existing Messages')}
    <p>To open on a saved conversation, declare the transcript as a reactive property instead of a signal and pass it from the page. The page renders the saved thread on the server, and the property arrives with the element when it hydrates.</p>
    ${ts(`export class ScriptedChat extends WebComponent({
  messages: prop<Message[]>(Array),
}) {
  constructor() {
    super();
    this.messages = [];
  }
  // ...writes become this.messages = [...this.messages, message]
}`)}
    ${ts(`// app/chat/page.ts
const saved = await loadConversation(params.id);
return html\`<scripted-chat .messages=\${saved}></scripted-chat>\`;`)}
    <p>The action keys its script on the transcript it receives, so it continues from wherever the saved conversation stops.</p>
  `;
}

/** The Transport section up to its sub-headings. */
export function transportLead(toc: TocEntry[], realModel: unknown) {
  return html`
    ${heading(toc, 2, 'Transport')}
    <p>The import is the transport. In the browser, importing a <code>'use server'</code> file gives you an RPC stub, so <code>await reply(transcript)</code> sends the transcript to the server in one POST and resolves to an async iterable once the response starts. Each value the action yields is serialized with the same wire format action results use (so a <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>File</code> or <code>Blob</code> arrives as itself) and flushed as it is produced.</p>
    <p>To stop a reply, break out of the loop. That cancels the response, and the server stops pulling the generator. Inside the action, <code>actionSignal()</code> from <code>@webjsdev/server</code> aborts when the person cancels, so pass it on to any upstream request.</p>
    ${ts(`for await (const part of await reply(transcript)) {
  if (this.stopped) break;
  this.update(id, part);
}`)}
    <p>${realModel}</p>
  `;
}

export function options(toc: TocEntry[]) {
  return html`
    ${heading(toc, 3, 'Options')}
    <p>The stub takes no options. The call is one request to your own server, and the pace of the reply is set in the action. See <a href="#timing">Timing</a>.</p>
  `;
}

export function fallback(toc: TocEntry[]) {
  return html`
    ${heading(toc, 3, 'Fallback')}
    <p>When the script has no reply left for the transcript, have the action yield one anyway. This keeps a demo usable after its scripted replies are exhausted.</p>
    ${ts(`export async function* reply(messages: Message[]): AsyncGenerator<Part> {
  const turn = turns[messages.filter((m) => m.role === 'user').length - 1];
  if (!turn) {
    yield { id: 'text', type: 'text', text: \`This example already has \${messages.length} messages.\` };
    return;
  }
  yield* turn();
}`)}
    <p>The fallback receives the transcript like every other reply, so it can answer from the current state.</p>
  `;
}

export function timing(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Timing')}
    <p>Use delays in the action to reproduce the pace of a real response.</p>
    ${ts(`async function* () {
  await sleep(800);
  yield { id: 'first', type: 'text', text: 'The first milestone is complete.' };
  await sleep(500);
  yield* words('next', 'text', 'The next one is ready.');
}`)}
    <ul>
      <li><code>await sleep(ms)</code> before the first yield waits before the reply starts.</li>
      <li><code>await sleep(ms)</code> between yields waits between parts, or between a tool's input and its result.</li>
      <li>The last argument of <code>words()</code> sets the delay between words.</li>
      <li>Yielding a whole part once sends it in one chunk.</li>
    </ul>
    <p>For fast tests, read the delay from an environment variable in the action and set it to <code>0</code>.</p>
  `;
}

export function errors(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Errors')}
    <p>Throw from the action when the reply should fail. A throw after parts have streamed ends the response with an error frame, and the component's <code>for await</code> loop throws, so the parts already applied stay on screen. Catch it there, and show it from an <code>error</code> signal on the component.</p>
    ${ts(`yield* words('text', 'text', 'I found the report.');
throw new Error('The connection closed before it could be read.');`)}
    ${ts(`try {
  await this.stream(id, transcript);
} catch (error) {
  this.error.set(error instanceof Error ? error.message : String(error));
}`)}
    <p>In development the error carries your message. In production it carries a generic message and a digest, and the full error is logged on the server. When the reader should see the words, yield them as a part instead of throwing.</p>
  `;
}

export function metadataAndIds(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Metadata and IDs')}
    <p>Metadata is a field you add to the <code>Message</code> type. It crosses the wire as it is, rich types included.</p>
    ${ts(`export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Part[];
  metadata?: { model: string; createdAt: Date };
}`)}
    <p>The component mints message ids with <code>crypto.randomUUID()</code> when it adds a message. Part ids are the action's, and they matter: a chunk whose id the message already holds replaces that part instead of adding one. For a fixture with fixed ids, write them into the script.</p>
  `;
}

export function apiReference(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'API Reference')}
    <p>There is no helper API. The pieces are the streaming action, the stub the browser gets for it, and the kit's message scroller.</p>
    ${heading(toc, 3, 'Streaming Action')}
    ${table(['Piece', 'Behavior'], [
      [html`<code>'use server'</code> async generator`, html`Each <code>yield</code> is one chunk, serialized and flushed as it is produced. Returning an async iterable or a <code>ReadableStream</code> streams the same way.`],
      ['Arguments', 'Serializer-safe values, the same as any action, so the transcript can carry Date, Map, Set, File and Blob values.'],
      [html`<code>throw</code>`, 'Ends the stream with an error frame. The message is yours in development, and generic with a digest in production.'],
      [html`<code>actionSignal()</code>`, html`From <code>@webjsdev/server</code>. Aborts when the client disconnects or cancels.`],
      ['Caching', 'A streamed result is never cached, ETagged or seeded into the page.'],
    ])}
    ${heading(toc, 3, 'RPC Stub')}
    ${table(['Piece', 'Behavior'], [
      [html`<code>await action(...args)</code>`, 'Sends one POST and resolves to an async iterable once the response starts.'],
      [html`<code>for await</code>`, 'Yields each chunk as it arrives, and returns when the action finishes.'],
      [html`<code>break</code>`, 'Cancels the response, and the server stops the generator.'],
      ['Errors', 'An error frame, or a response cut off before its end, throws from the loop.'],
    ])}
    ${heading(toc, 3, 'Message Scroller')}
    ${table(['Element', 'Attributes'], [
      [html`<code>&lt;ui-message-scroller&gt;</code>`, html`<code>auto-scroll</code>, <code>default-scroll-position</code> (<code>"end"</code>, <code>"start"</code> or <code>"last-anchor"</code>). Methods <code>scrollToEnd()</code>, <code>scrollToStart()</code>, <code>scrollToMessage(id)</code>.`],
      [html`<code>&lt;ui-message-scroller-viewport&gt;</code>`, 'None.'],
      [html`<code>&lt;ui-message-scroller-content&gt;</code>`, html`A <code>role="log"</code>. Give it an <code>aria-label</code>.`],
      [html`<code>&lt;ui-message-scroller-item&gt;</code>`, html`<code>message-id</code>, <code>scroll-anchor</code>.`],
      [html`<code>&lt;ui-message-scroller-button&gt;</code>`, html`<code>direction</code> (<code>"end"</code> or <code>"start"</code>).`],
    ])}
    <p>See <a href="/ui/docs/components/message-scroller">Message Scroller</a> for the full reference.</p>
    ${heading(toc, 3, 'Types')}
    <p>The <code>Message</code> and <code>Part</code> types are yours. The ones this page uses are under <a href="#message-parts">Message Parts</a>.</p>
  `;
}

export function intro(opts: { hitl?: string } = {}) {
  return html`
    <p>Write an AI conversation in code and stream it to the page, with no model, API route, network request, or API key. WebJs needs no helper package for this: a <code>'use server'</code> action that is an async generator already streams its results over one response. So the script lives in an action that yields message parts, and a component appends each part as it arrives.</p>
    ${ts(INTRO_ACTION, { lineNumbers: true })}
    <p>The component sends the transcript and folds each part into the assistant message it is building. The parts arrive as the action yields them, so your components behave as they would with a real model.</p>
    ${ts(INTRO_LOOP, { lineNumbers: true })}
    <p>The action receives the whole transcript, so it can pick the reply that follows it. Text, reasoning, tool calls, data, files and sources are all just parts, and a tool call can pause for the person. See <a href=${opts.hitl ?? '#human-in-the-loop'}>Human in the Loop</a>.</p>
  `;
}

export async function usage(toc: TocEntry[], demo: string) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>List the scripted questions where the component can read them, script the replies in the action, then send each question from the component.</p>
    ${ts(QUESTIONS, { lineNumbers: true })}
    ${ts(USAGE_ACTION, { lineNumbers: true })}
    ${ts(USAGE_COMPONENT, { lineNumbers: true })}
    ${await componentPreview(demo, {
      style: 'rhea',
      className: 'rounded-[34px] sm:rounded-4xl',
      previewClass: 'h-auto theme-blue bg-surface p-4 min-[480px]:p-8 min-[560px]:p-10 sm:px-10 sm:py-16 dark:bg-background',
    })}
  `;
}

export default async function body(toc: TocEntry[]) {
  const realModel = html`To answer from a real model, the same action can call the AI SDK's <code>streamText</code> (from the <code>ai</code> package) on the server and yield parts as its stream produces them. No client package is needed, since the component is a WebComponent. See the <a href="https://ai-sdk.dev/docs">AI SDK docs</a> for the stream it returns.`;
  return html`
    ${intro()}

    ${whatItsFor(toc)}
    ${installation(toc, realModel)}
    ${await usage(toc, 'ai-sdk-helper-demo')}
    ${userMessages(toc)}
    ${assistantMessages(toc)}
    ${messageParts(toc, html`An assistant message can hold many kinds of part, in the order the action yields them: <a href="#text">Text</a> and <a href="#reasoning">Reasoning</a>, <a href="#tool-calls">Tool Calls</a>, <a href="#data">Data</a>, <a href="#files">Files</a> and <a href="#sources">Sources</a>. The part type is yours, so it holds exactly what your UI renders.`)}
    ${text(toc)}
    ${reasoning(toc)}
    ${toolCalls(toc)}

    ${heading(toc, 2, 'Human in the Loop')}
    <p>A tool call can pause and hand control to the person. Both flows work the same way: the action yields a tool part and returns, the component renders a control for it, and the person's answer goes back to the action in the next transcript.</p>

    ${heading(toc, 3, 'Pause a Tool Call')}
    <p>Yield a tool part in the <code>input-available</code> state and end the generator. The reply finishes, and the part waits until the component supplies its output.</p>
    ${ts(`yield* words('text', 'text', "Answer these and I'll tailor the prototype.");
yield { id: 'ask', type: 'tool', name: 'askQuestions', state: 'input-available', input: { questions } };`)}

    ${heading(toc, 3, 'Require Approval')}
    <p>Yield the part in the <code>approval-requested</code> state to pause behind the person's decision.</p>
    ${ts(`yield* words('text', 'text', 'That will archive 3 drafts. I need your approval.');
yield { id: 'archive', type: 'tool', name: 'archiveDrafts', state: 'approval-requested', input: { count: 3 } };`)}

    ${heading(toc, 3, 'Continuations')}
    <p>When the transcript the action receives ends with an assistant message holding an answered tool part, the action continues that turn instead of starting the next one. It yields more parts into the same message: the tool's result, then the follow-up.</p>
    ${ts(`export async function* reply(messages: Message[]): AsyncGenerator<Part> {
  const last = messages.at(-1);
  const call = last?.role === 'assistant' ? last.parts.findLast((p) => p.type === 'tool') : undefined;

  if (call?.type === 'tool' && call.name === 'archiveDrafts') {
    if (!call.approved) {
      yield { ...call, state: 'output-denied' };
      return;
    }
    yield { ...call, state: 'output-available', output: { archived: 3 } };
    yield* words('done', 'text', 'Archived 3 drafts.');
    return;
  }
  // ...otherwise, the next scripted turn.
}`, { lineNumbers: true })}
    <p>For a tool the person answers, the answer is the part's <code>output</code>. For an approval, it is <code>approved</code>. Keep the continuation a function of the transcript, so sending the same transcript again takes the same branch.</p>

    ${heading(toc, 3, 'Client Wiring')}
    <p>The component writes the person's answer into the paused part, then streams the next reply into the same assistant message.</p>
    ${ts(`private async decide(part: Extract<Part, { type: 'tool' }>, approved: boolean) {
  const id = this.messages.get().at(-1)!.id; // The paused assistant message.
  this.update(id, { ...part, approved });
  await this.stream(id, this.messages.get());
}`)}
    ${ts(`// In the tool part's renderer.
html\`<button @click=\${() => this.decide(part, true)}>Approve</button>
<button @click=\${() => this.decide(part, false)}>Deny</button>\``)}
    <p>A tool the person answers works the same way, with <code>{ ...part, state: 'output-available', output: { answers } }</code> in place of the approval.</p>

    ${heading(toc, 2, 'Data')}
    <p>Yield a <code>data</code> part for structured output your UI renders as a card.</p>
    ${ts(`yield {
  id: 'weather-sf',
  type: 'data',
  name: 'weather',
  data: { city: 'San Francisco', status: 'loading' },
};`)}
    <p>Yield the same id again to update the part in place. This is useful for states such as loading to success.</p>
    ${ts(`yield {
  id: 'weather-sf',
  type: 'data',
  name: 'weather',
  data: { city: 'San Francisco', status: 'success', temperature: 27, condition: 'Breezy' },
};`)}
    <p>For an update that should reach the component but not stay in the message, such as a status line, give it a chunk type of its own and have the loop write it to a separate signal instead of the message.</p>

    ${files(toc)}

    ${heading(toc, 2, 'Sources')}
    <p>Yield a <code>source</code> part for each source the reply cites.</p>
    ${ts(`yield { id: 'source-1', type: 'source', title: 'Release notes', url: 'https://example.com/releases' };`)}
    <p>Render them with the <a href="/ui/docs/ai-elements/sources">Sources</a> pattern.</p>

    ${heading(toc, 2, 'Step Starts')}
    <p>A step boundary is one more member of your part type. Yield it between steps, and draw it as a divider.</p>
    ${ts(`yield { id: 'step-2', type: 'step-start' };`)}

    ${heading(toc, 2, 'Custom Parts')}
    <p>Any other part is the same: add a member to the <code>Part</code> union and a case to the renderer. Whatever the serializer carries crosses the wire.</p>

    ${readingMessages(toc)}
    ${existingMessages(toc)}
    ${transportLead(toc, realModel)}
    ${options(toc)}
    ${fallback(toc)}
    ${timing(toc)}
    ${errors(toc)}
    ${metadataAndIds(toc)}
    ${apiReference(toc)}
  `;
}
