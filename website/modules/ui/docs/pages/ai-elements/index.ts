import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { table } from './shared.ts';

/**
 * AI Elements, ported from shadcn's content/docs/ai-elements/index.mdx
 * (#1666). shadcn's chatbot template is a Next.js app, so its pointer is
 * left out. AI SDK Elements are React components, which a WebJs app does not
 * run, so the migration section maps each one onto the WebJs UI pattern that
 * replaces it rather than promising the copied code keeps working.
 */
export const title = 'AI Elements';
export const description = 'Patterns for agentic interfaces, built from WebJs UI components.';

const ISSUES = 'https://github.com/webjsdev/webjs/issues/new';

const patterns: [string, string, string][] = [
  ['Chain of Thought', 'chain-of-thought', 'A summary that expands into the steps an agent took.'],
  ['Chat', 'chat', 'The thread. Message Scroller keeps your place while the reply streams.'],
  ['Checkpoint', 'checkpoint', 'A point in the conversation you can return to.'],
  ['Confirmation', 'confirmation', 'A prompt to approve or deny a tool before it runs.'],
  ['Context', 'context', 'How much of the context window the conversation has used.'],
  ['File Tree', 'file-tree', 'The files the agent changed, as a folder tree.'],
  ['Inline Citation', 'inline-citation', 'A source in the sentence that opens on hover.'],
  ['Message', 'message', "One turn. The person's message, and the agent's reply with its actions."],
  ['Model Selector', 'model-selector', 'Two menus. One picks the model the agent runs, the other picks how hard it thinks.'],
  ['Plan', 'plan', 'The steps the agent plans to take, and how far it has got.'],
  ['Prompt Input', 'prompt-input', 'A message field with attachments and a send button.'],
  ['Queue', 'queue', "The agent's todo list, split into what is left and what is done."],
  ['Reasoning', 'reasoning', "The agent's thinking as it streams."],
  ['Sources', 'sources', 'The links the agent used for a reply.'],
  ['Stack Trace', 'stack-trace', 'A failed tool call and its stack frames.'],
  ['Subagent', 'subagent', 'A subagent run, with its tool calls and result.'],
  ['Suggestion', 'suggestion', 'A short prompt you can send to the agent in one click.'],
  ['Task', 'task', 'The steps the agent takes, as it takes them.'],
  ['Terminal', 'terminal', 'A command the agent runs, with its output as it streams.'],
  ['Test Results', 'test-results', 'A test run by the agent, with its suites and failures.'],
  ['Tool', 'tool', 'A tool call the agent makes, from input to output.'],
];

const link = (label: string, href: string) => html`<a href=${href}>${label}</a>`;
const pattern = (label: string, slug: string) => link(label, `/ui/docs/ai-elements/${slug}`);
const component = (label: string, slug: string) => link(label, `/ui/docs/components/${slug}`);

const replacements: [string, unknown][] = [
  ['agent.tsx', pattern('Subagent', 'subagent')],
  ['attachments.tsx', component('Attachment', 'attachment')],
  ['chain-of-thought.tsx', pattern('Chain of Thought', 'chain-of-thought')],
  ['checkpoint.tsx', pattern('Checkpoint', 'checkpoint')],
  ['code-block.tsx', component('Code Block', 'code-block')],
  ['commit.tsx', link('Trace', '/ui/docs/components/trace#commit')],
  ['confirmation.tsx', pattern('Confirmation', 'confirmation')],
  ['context.tsx', pattern('Context', 'context')],
  ['conversation.tsx', pattern('Chat', 'chat')],
  ['file-tree.tsx', pattern('File Tree', 'file-tree')],
  ['inline-citation.tsx', pattern('Inline Citation', 'inline-citation')],
  ['message.tsx', pattern('Message', 'message')],
  ['model-selector.tsx', pattern('Model Selector', 'model-selector')],
  ['plan.tsx', pattern('Plan', 'plan')],
  ['prompt-input.tsx', pattern('Prompt Input', 'prompt-input')],
  ['question.tsx', component('Questionnaire', 'questionnaire')],
  ['queue.tsx', pattern('Queue', 'queue')],
  ['reasoning.tsx', pattern('Reasoning', 'reasoning')],
  ['shimmer.tsx', link('shimmer', '/ui/docs/utils/shimmer')],
  ['sources.tsx', pattern('Sources', 'sources')],
  ['stack-trace.tsx', pattern('Stack Trace', 'stack-trace')],
  ['suggestion.tsx', pattern('Suggestion', 'suggestion')],
  ['task.tsx', pattern('Task', 'task')],
  ['terminal.tsx', pattern('Terminal', 'terminal')],
  ['test-results.tsx', pattern('Test Results', 'test-results')],
  ['tool.tsx', pattern('Tool', 'tool')],
];

const and = (...parts: unknown[]) => html`${parts.map((p, i) => html`${i === 0 ? '' : i === parts.length - 1 ? ' and ' : ', '}${p}`)}`;

const noReplacement: [unknown, unknown][] = [
  [html`<code>artifact.tsx</code>`, and(component('Card', 'card'), component('Button', 'button'), component('Tooltip', 'tooltip'))],
  [html`<code>audio-player.tsx</code>`, html`An <code>audio</code> element, with ${component('Button Group', 'button-group')} and ${component('Slider', 'slider')}`],
  [html`<code>canvas.tsx</code>, <code>connection.tsx</code>, <code>controls.tsx</code>, <code>edge.tsx</code>, <code>node.tsx</code>, <code>panel.tsx</code> and <code>toolbar.tsx</code>`, html`A graph library that renders to the DOM, with ${component('Card', 'card')} and ${component('Button Group', 'button-group')}`],
  [html`<code>environment-variables.tsx</code>`, and(component('Item', 'item'), component('Badge', 'badge'), component('Switch', 'switch'))],
  [html`<code>image.tsx</code>`, html`An <code>img</code> element`],
  [html`<code>jsx-preview.tsx</code>`, html`Not needed: WebJs templates are <code>html</code> tagged templates, not JSX`],
  [html`<code>mic-selector.tsx</code> and <code>voice-selector.tsx</code>`, component('Combobox', 'combobox')],
  [html`<code>open-in-chat.tsx</code>`, component('Dropdown Menu', 'dropdown-menu')],
  [html`<code>package-info.tsx</code>`, and(component('Item', 'item'), component('Badge', 'badge'))],
  [html`<code>persona.tsx</code>`, html`A <a href="https://rive.app">Rive</a> animation`],
  [html`<code>sandbox.tsx</code>`, and(component('Trace', 'trace'), component('Tabs', 'tabs'), component('Code Block', 'code-block'))],
  [html`<code>schema-display.tsx</code>`, and(component('Collapsible', 'collapsible'), component('Badge', 'badge'), component('Code Block', 'code-block'))],
  [html`<code>snippet.tsx</code>`, component('Input Group', 'input-group')],
  [html`<code>speech-input.tsx</code>`, html`${component('Button', 'button')} and ${component('Spinner', 'spinner')}, with the Web Speech API`],
  [html`<code>transcription.tsx</code>`, html`A ${component('Button', 'button')} for each segment, to seek to it`],
  [html`<code>web-preview.tsx</code>`, html`An <code>iframe</code>, with ${component('Input Group', 'input-group')} for the address bar`],
];

export default async function body(toc: TocEntry[]) {
  return html`
    <p>AI Elements are patterns for building agentic interfaces. Each one is a composition of WebJs UI components that you copy into your project. There is no package to install. The code is yours.</p>
    <p>A <a href="/ui/docs/ai-elements/chat">Chat</a> is a list of <a href="/ui/docs/ai-elements/message">Message</a> turns inside a <a href="/ui/docs/components/message-scroller">Message Scroller</a>. The steps an agent takes inside a turn, like <a href="/ui/docs/ai-elements/reasoning">Reasoning</a>, <a href="/ui/docs/ai-elements/tool">Tool</a> and <a href="/ui/docs/ai-elements/plan">Plan</a>, are built on <a href="/ui/docs/components/trace">Trace</a>, so every step has the same shape.</p>
    <p><strong>Coming from <a href="https://elements.ai-sdk.dev">elements.ai-sdk.dev</a>?</strong> See <a href="#migrating-from-ai-sdk-elements">Migrating from AI SDK Elements</a>.</p>

    ${heading(toc, 2, 'Patterns')}
    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      ${patterns.map(([name, slug, text]) => html`
        <a href=${`/ui/docs/ai-elements/${slug}`} data-not-typeset class="flex w-full flex-col items-start gap-1 rounded-2xl bg-surface p-6 text-sm text-surface-foreground no-underline transition-colors hover:bg-surface/80 md:p-6">
          <div class="font-medium">${name}</div>
          <div class="leading-relaxed text-muted-foreground">${text}</div>
        </a>`)}
    </div>

    ${heading(toc, 2, 'Migrating from AI SDK Elements')}
    <p>If you used AI SDK Elements from <a href="https://elements.ai-sdk.dev">elements.ai-sdk.dev</a>, here is what changes.</p>

    ${heading(toc, 3, 'Existing projects')}
    <p>When you installed components from elements.ai-sdk.dev, the code was copied into your project as React components. They keep working in a React app, but a WebJs app does not run React, so moving to WebJs means rebuilding each one on WebJs UI components.</p>
    <p>Each pattern page has a <strong>Migrating from AI SDK Elements</strong> section that maps every export of the wrapper in <code>components/ai-elements</code> onto the parts of the pattern, so you can rebuild it on Trace, Code Block and the other WebJs UI components one export at a time.</p>
    <p>For example, the <a href="/ui/docs/ai-elements/queue#migrating-from-ai-sdk-elements">Queue</a> section rebuilds <code>queue.tsx</code> on Trace, and the <a href="/ui/docs/ai-elements/inline-citation#migrating-from-ai-sdk-elements">Inline Citation</a> section rebuilds <code>inline-citation.tsx</code> on Hover Card.</p>

    ${heading(toc, 3, 'What replaces each element')}
    <p>Each file from AI SDK Elements, and the WebJs UI pattern or component that replaces it.</p>
    ${table(['AI SDK Elements', 'WebJs UI'], replacements.map(([file, to]) => [html`<code>${file}</code>`, to]))}

    ${heading(toc, 3, 'Elements without a replacement')}
    <p>These elements have no pattern of their own. Each one is a small composition you can build from components WebJs UI already has, listed below.</p>
    <p>If you need one of these, <a href=${ISSUES}>open an issue</a> and we will help you build it.</p>
    ${table(['AI SDK Elements', 'Build it with'], noReplacement)}

    ${heading(toc, 3, 'New projects')}
    <p>Build from WebJs UI components instead.</p>
    <div class="steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step">
      <h3>Add the components</h3>
      ${commandBlock(packageCommands('add trace code-block'))}
      <h3>Copy a pattern</h3>
      <p>Open a pattern above and copy its code into your project. Each page lists any other components it needs.</p>
      <p>Or ask your coding agent to do it:</p>
      ${codeFigure('Add the Reasoning pattern from https://webjs.dev/ui/llm/docs/ai-elements/reasoning to my chat.', { title: 'Prompt', lang: 'text' })}
    </div>

    ${callout(html`<strong>Missing an element?</strong> <a href=${ISSUES}>Open an issue</a> and tell us what you need.`, { className: 'mt-6' })}
  `;
}
