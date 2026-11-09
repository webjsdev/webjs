import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Trace docs page, ported from shadcn's
 * content/docs/components/radix/trace.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React. Every demo
 * renders in the rhea style, as shadcn's do.
 */
/** The demo shown above the Installation section. */
export const demo = 'trace-demo';

const RHEA = { style: 'rhea', previewClass: 'h-auto' };

const patterns: [string, string, string][] = [
  ['Chain of Thought', 'chain-of-thought', 'A summary that expands into the steps behind it.'],
  ['Plan', 'plan', 'The steps the agent plans to take, and how far it has got.'],
  ['Queue', 'queue', "The agent's todo list, split into what is left and what is done."],
  ['Reasoning', 'reasoning', "The agent's thinking as it streams."],
  ['Sources', 'sources', 'The links the agent used for a reply.'],
  ['Stack Trace', 'stack-trace', 'A failed tool call and its stack frames.'],
  ['Subagent', 'subagent', 'A subagent run, with its tool calls and result.'],
  ['Task', 'task', 'The steps the agent takes, as it takes them.'],
  ['Terminal', 'terminal', 'A command the agent runs, with its output as it streams.'],
  ['Test Results', 'test-results', 'A test run by the agent, with its suites and failures.'],
  ['Tool', 'tool', 'A tool call the agent makes, from input to output.'],
];

function table(head: string[], rows: unknown[][]) {
  return html`
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
        <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
      </table>
    </div>
  `;
}

/** The sections shadcn's page puts between the lead demo and Installation. */
export function intro(toc: TocEntry[]) {
  return html`
    <p>A trace is a list of lines. Each line has an icon, a title, and an optional description and status. A line can expand to show more detail, link to a page, or open a dialog or sheet.</p>
    <p>Every line has the same shape, so reasoning, tool calls, sources and plans built from a trace look and behave the same.</p>
    <p>Use a trace for the steps an agent takes, like calling a tool, running a subagent or editing a file. Use <a href="/ui/docs/components/message">Message</a> for its reply, and <a href="/ui/docs/components/marker">Marker</a> for notes and dividers between turns.</p>

    ${heading(toc, 2, 'Built with Trace')}
    <p>Every pattern below is a composition of trace parts. See <a href="/ui/docs/ai-elements">AI Elements</a> for examples and code.</p>
    ${table(['Pattern', 'Shows'], patterns.map(([name, slug, shows]) => [html`<a href=${`/ui/docs/ai-elements/${slug}`}>${name}</a>`, shows]))}
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>Use a trace line for a single step:</p>
    ${codeFigure(`import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  <span data-slot="trace-line" class=\${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
      \${SearchIcon()}
    </span>
    <span data-slot="trace-title" class=\${traceTitleClass()}>Searched for minimumReleaseAge</span>
  </span>
</div>`, { lineNumbers: true })}
    <p>Wrap the line in a collapsible row to show more detail when it expands. The row is a native <code>&lt;details&gt;</code>, its trigger the <code>&lt;summary&gt;</code>:</p>
    ${codeFigure(`import {
  traceClass,
  traceCollapsibleClass,
  traceCollapsibleContentClass,
  traceCollapsibleTriggerClass,
  traceIconClass,
  traceLineClass,
  traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  <details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${TerminalIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Ran node --version</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>v24.18.0</div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a trace line:</p>
    ${codeFigure(`trace
└── trace-line
    ├── trace-icon
    ├── trace-title
    ├── trace-description
    └── trace-icon`, { lang: 'text' })}
    <p>Wrap the line in a collapsible row to show more detail when it expands:</p>
    ${codeFigure(`trace
└── trace-collapsible            <details>
    ├── trace-collapsible-trigger <summary>
    │   └── trace-line
    └── trace-collapsible-content`, { lang: 'text' })}
    <p>The trace line is always the line. To make a line do something, wrap it in that thing's trigger.</p>

    ${heading(toc, 2, 'Features')}
    <ul>
      <li>One row for reasoning, tool calls, sources, plans and tasks</li>
      <li>Rows that expand, link out, or open a dialog, sheet, drawer or popover</li>
      <li><code>running</code>, <code>error</code> and <code>pending</code> states on <code>data-status</code>, with a shimmer while running</li>
      <li>Nested rows, so a summary expands into steps and a step into its output</li>
      <li>Maps one to one onto the reasoning, tool and source parts of the AI SDK</li>
      <li>Keyboard and screen reader support from the native element that wraps each row</li>
      <li>Customizable styling by merging your classes with each helper through <code>cn()</code></li>
    </ul>

    ${heading(toc, 2, 'Trace Line')}
    <p>Use a trace line on its own for a step with no detail to show. It reads as plain text.</p>
    ${await componentPreview('trace-static', RHEA)}

    ${heading(toc, 2, 'Status')}
    <p>Set <code>data-status</code> on the trace line when a step is running, has failed or hasn't started yet.</p>
    ${await componentPreview('trace-status', RHEA)}
    ${table(['Status', 'Use for'], [
      ['none', 'Work that is done: "Ran pnpm install".'],
      [html`<code>"error"</code>`, 'Work that failed. Say so in the title: "Failed to run pnpm lint".'],
      [html`<code>"running"</code>`, 'Work in progress. Write the title in the present tense: "Running pnpm build".'],
      [html`<code>"pending"</code>`, 'Work that has not started, such as a plan step: "Run pnpm test".'],
    ])}

    ${heading(toc, 2, 'Description')}
    <p>Put secondary text such as a diff stat, a duration or a count in a trace description after the title. It does not truncate.</p>
    ${await componentPreview('trace-description', RHEA)}

    ${heading(toc, 2, 'Collapsible')}
    <p>Wrap the line in a collapsible row to show more detail when it expands. Put the trace line inside the <code>&lt;summary&gt;</code> and the detail in the content after it.</p>
    ${await componentPreview('trace-collapsible', RHEA)}

    ${heading(toc, 2, 'Open State')}
    <p>Rows start closed. Add the <code>open</code> attribute to the <code>&lt;details&gt;</code> to start open, or set its <code>open</code> property from script to control a row. The element fires <code>toggle</code> whenever it opens or closes.</p>
    ${await componentPreview('trace-open', RHEA)}
    <p>To open a row while it streams and let the reader's click win, keep the reader's choice apart from the streaming state, and take over the summary's click so the row shows exactly what the component renders:</p>
    ${codeFigure(`class ThinkingRow extends WebComponent({ running: Boolean, text: String }) {
  // undefined until the reader clicks the row.
  chosen = signal<boolean | undefined>(undefined);

  render() {
    const open = this.chosen.get() ?? this.running;
    return html\`<details data-slot="trace-collapsible" ?open=\${open} class=\${traceCollapsibleClass()}>
      <summary
        data-slot="trace-collapsible-trigger"
        class=\${traceCollapsibleTriggerClass()}
        @click=\${(e: Event) => { e.preventDefault(); this.chosen.set(!open); }}
      >
        <span data-slot="trace-line" data-status=\${this.running ? 'running' : nothing} class=\${traceLineClass()}>…</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>\${this.text}</div>
    </details>\`;
  }
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Link')}
    <p>Wrap the trace line in an anchor. For a new tab, use an arrow-up-right icon and sr-only "(opens in a new tab)".</p>
    ${await componentPreview('trace-link', RHEA)}
    ${codeFigure(`<a href="https://docs.astro.build" target="_blank" rel="noreferrer">
  <span data-slot="trace-line" class=\${traceLineClass()}>
    <span data-slot="trace-title" class=\${traceTitleClass()}>
      Install Astro
      <span class="sr-only"> (opens in a new tab)</span>
    </span>
    <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
      \${ArrowUpRightIcon()}
    </span>
  </span>
</a>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Dialog')}
    <p>Wrap the trace line in a button inside <code>&lt;ui-dialog-trigger&gt;</code>. The dialog owns its open state, Escape and focus return.</p>
    ${await componentPreview('trace-dialog', RHEA)}
    ${codeFigure(`<ui-dialog>
  <ui-dialog-trigger>
    <button type="button">
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Searched the web for cache keys</span>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${ChevronRightIcon()}
        </span>
      </span>
    </button>
  </ui-dialog-trigger>
  <ui-dialog-content>…</ui-dialog-content>
</ui-dialog>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Sheet')}
    <p>The same shape as the dialog, with <code>&lt;ui-sheet&gt;</code>. Drawer and Popover work the same way.</p>
    ${await componentPreview('trace-sheet', RHEA)}

    ${heading(toc, 2, 'Group')}
    <p>Put rows that sit next to each other in a trace. It also styles any trigger or link that wraps a trace line.</p>
    ${await componentPreview('trace-group', RHEA)}

    ${heading(toc, 2, 'Sources')}
    <p>A collapsible row whose detail is a trace of link rows.</p>
    ${await componentPreview('trace-sources', RHEA)}
    <p>See <a href="/ui/docs/ai-elements/sources">Sources</a> for more examples.</p>

    ${heading(toc, 2, 'Chain of Thought')}
    <p>A chain of thought is a collapsible row with step rows inside. Set the parent's status and title from its children.</p>
    ${await componentPreview('trace-steps', RHEA)}
    <p>See <a href="/ui/docs/ai-elements/chain-of-thought">Chain of Thought</a> and <a href="/ui/docs/ai-elements/task">Task</a> for more examples.</p>

    ${heading(toc, 2, 'Commit')}
    <p>A commit is a collapsible row with a line for each changed file. Say what changed in the title, Added, Edited or Deleted, and put the line counts in the description. Each file opens its diff in a <a href="#sheet">Sheet</a>.</p>
    ${await componentPreview('trace-commit', RHEA)}

    ${heading(toc, 2, 'Whole Turn')}
    <p>Three levels: the turn, a summary, and the rows. Text between steps sits between two traces.</p>
    ${await componentPreview('trace-turn', RHEA)}

    ${heading(toc, 2, 'Reasoning')}
    <p>Render a <code>reasoning</code> part from the AI SDK. The row is a plain trace line until the first text arrives. See <a href="#open-state">Open State</a>.</p>
    ${await componentPreview('trace-thinking', RHEA)}
    <p>See <a href="/ui/docs/ai-elements/reasoning">Reasoning</a> for more examples.</p>

    ${heading(toc, 2, 'Tool')}
    <p>Render tool parts from the AI SDK. Map the tool part as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>.</p>
    ${await componentPreview('trace-tool-calls', RHEA)}
    <p>See <a href="/ui/docs/ai-elements/tool">Tool</a> for more examples.</p>

    ${heading(toc, 2, 'Accessibility')}
    <p>A trace adds no roles of its own. Each line gets its semantics from the element that wraps it.</p>
    <ul>
      <li>A trace line on its own is a <code>span</code>. It is read as text and is not a tab stop.</li>
      <li>Put it in the <code>&lt;summary&gt;</code> of a <code>&lt;details&gt;</code> and the browser exposes it as a disclosure that reports whether it is expanded. Wrap it in a link, or in the button inside a dialog or sheet trigger, and it takes the keyboard and focus behavior of that element.</li>
      <li>Mark each trace icon <code>aria-hidden="true"</code>, so the title is the accessible name. Write it as a sentence that says what happened, like "Edited trace.tsx", not just "trace.tsx".</li>
      <li>When a link opens a new tab, add "(opens in a new tab)" to the title with <code>sr-only</code>.</li>
      <li>Status is shown with color and motion, so put it in the title too. Write "Running pnpm build" while it runs and "Failed to run pnpm build" when it errors.</li>
      <li>The shimmer on a running title stops when the reader prefers reduced motion. The title still says what is happening.</li>
      <li>Inside a <a href="/ui/docs/components/message-scroller">Message Scroller</a>, each line is announced once when it is added.</li>
      <li>The collapsible content mutes its text. If you put a block with a muted background inside it, give the block <code>text-foreground</code> so it keeps its contrast. A code block sets its own text color.</li>
    </ul>

    ${heading(toc, 2, 'API Reference')}
    <p>Trace is a set of class helpers. Each part is a plain element carrying the helper's classes and its <code>data-slot</code>, and every helper's classes merge with yours through <code>cn()</code>.</p>

    ${heading(toc, 3, 'traceClass')}
    <p>A list of rows, on a <code>div</code> with <code>data-slot="trace"</code>. It also styles any trigger or link that wraps a trace line.</p>

    ${heading(toc, 3, 'traceLineClass')}
    <p>One line: an icon and a title, on a <code>span</code> with <code>data-slot="trace-line"</code>. It is not a button or a tab stop. Wrap it in a trigger or a link to make it do something.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>data-status</code>`, html`<code>"running" | "error" | "pending"</code>`, 'none'],
    ])}

    ${heading(toc, 3, 'traceIconClass')}
    <p>An icon slot, on a <code>span</code> with <code>data-slot="trace-icon"</code> and <code>aria-hidden="true"</code>. Before the title it names the action; after it, it is the indicator.</p>

    ${heading(toc, 3, 'traceTitleClass')}
    <p>One sentence on one line, on a <code>span</code> with <code>data-slot="trace-title"</code>. It truncates and shimmers while the line is running.</p>

    ${heading(toc, 3, 'traceDescriptionClass')}
    <p>Secondary text after the title, such as a count or a duration, on a <code>span</code> with <code>data-slot="trace-description"</code>. It does not truncate.</p>

    ${heading(toc, 3, 'traceCollapsibleClass')}
    <p>A row that expands, on a <code>&lt;details&gt;</code> with <code>data-slot="trace-collapsible"</code>. Add <code>group/trace-collapsible</code> to turn the chevron while it is open.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>open</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
    ])}

    ${heading(toc, 3, 'traceCollapsibleTriggerClass')}
    <p>The trigger that opens and closes the row, on its <code>&lt;summary&gt;</code> with <code>data-slot="trace-collapsible-trigger"</code>. Put a trace line inside it, then a chevron icon after the line.</p>

    ${heading(toc, 3, 'traceCollapsibleContentClass')}
    <p>The detail of a row that expands, on a <code>div</code> with <code>data-slot="trace-collapsible-content"</code> after the summary.</p>
  `;
}
