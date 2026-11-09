import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Tool, ported from shadcn's content/docs/ai-elements/radix/tool.mdx (#1666).
 * shadcn's demos stream a scripted chat through useChat; the demos here are
 * the settled conversations, and the approval demo the turn waiting on the
 * person.
 */
export const title = 'Tool';
export const description = 'Displays a tool call the agent makes, from input to output.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('tool-demo', RHEA)}
    <p>Tool is a tool call the agent makes, such as running a command or reading a file. The line follows the call from input to output, including errors and calls that wait for approval.</p>
    <p>Tool is built with a trace, with a trace collapsible for each call that has output.</p>

    ${await installation(toc, {
      prose: html`Tool is built with the <a href="/ui/docs/components/trace">Trace</a> and <a href="/ui/docs/components/code-block">Code Block</a> components.`,
      add: 'trace code-block',
      source: 'trace',
      dependencies: ['code-block'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  codeBlockClass,
  codeBlockCodeClass,
  codeBlockContentClass,
} from '#components/ui/code-block.ts';
import {
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
        <span data-slot="trace-title" class=\${traceTitleClass()}>Ran git status --short</span>
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="code-block" data-size="sm" class=\${codeBlockClass()}>
        <pre data-slot="code-block-content" data-wrap tabindex="0" class=\${cn(codeBlockContentClass(), 'max-h-64')}><code
          data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${output}</code></pre>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'States')}
    <p>A trace does not read tool parts. Map each part's <code>state</code> to a <code>data-status</code> and a title.</p>
    ${await componentPreview('tool-states', RHEA)}
    ${table(['Tool part state', html`<code>data-status</code>`, 'Title'], [
      [html`<code>input-streaming</code>, <code>input-available</code>`, html`<code>"running"</code> while the chat streams`, 'Running …'],
      [html`<code>input-streaming</code>, <code>input-available</code> after the chat stops`, html`<code>"error"</code>`, 'Failed to run …'],
      [html`<code>approval-requested</code>`, 'none', html`Not a line. An item outside the trace with Approve and Deny buttons.`],
      [html`<code>approval-responded</code>`, html`<code>"running"</code> if approved, none if not`, 'Running … if approved, Denied … if not'],
      [html`<code>output-available</code>`, 'none', 'Ran …'],
      [html`<code>output-error</code>`, html`<code>"error"</code>`, 'Failed to run …'],
      [html`<code>output-denied</code>`, 'none', 'Denied …'],
    ])}
    <p>A tool is a plain trace line while it runs, and a trace collapsible once its output arrives.</p>
    ${codeFigure(`function toolLine(part: ToolPart, streaming: boolean) {
  const command = part.input?.command;
  const icon = html\`<span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${TerminalIcon()}</span>\`;

  if (part.state === 'output-denied' || (part.state === 'approval-responded' && !part.approval.approved)) {
    return html\`<span data-slot="trace-line" class=\${traceLineClass()}>
      \${icon}<span data-slot="trace-title" class=\${traceTitleClass()}>Denied \${command}</span>
    </span>\`;
  }

  if (part.state === 'output-available' || part.state === 'output-error') {
    const failed = part.state === 'output-error';
    return html\`<details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" data-status=\${failed ? 'error' : nothing} class=\${traceLineClass()}>
          \${icon}<span data-slot="trace-title" class=\${traceTitleClass()}>\${failed ? 'Failed to run' : 'Ran'} \${command}</span>
        </span>
      </summary>
      <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-size="sm" class=\${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" class=\${cn(codeBlockContentClass(), 'max-h-64')}><code
            data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${failed ? part.errorText : part.output.stdout}</code></pre>
        </div>
      </div>
    </details>\`;
  }

  return html\`<span data-slot="trace-line" data-status=\${streaming ? 'running' : 'error'} class=\${traceLineClass()}>
    \${icon}<span data-slot="trace-title" class=\${traceTitleClass()}>\${streaming ? 'Running' : 'Failed to run'} \${command}</span>
  </span>\`;
}`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  \${repeat(
    message.parts.filter((part) => part.type === 'tool-runCommand'),
    (part) => part.toolCallId,
    (part) => toolLine(part, streaming),
  )}
</div>`, { lineNumbers: true })}
    <p>A tool that runs in the browser stays <code>input-available</code> after the chat stops until you send its output back. Treat it as waiting, not failed.</p>

    ${heading(toc, 2, 'Output in a Sheet')}
    <p>For long output, wrap the trace line in a <code>&lt;ui-sheet-trigger&gt;</code> and show the output in the sheet.</p>
    ${await componentPreview('tool-sheet', RHEA)}
    <p>See <a href="/ui/docs/components/trace#dialog">Trace</a>.</p>

    ${heading(toc, 2, 'Approval')}
    <p>A pending approval is a question for the person, not a step the agent took, so it sits outside the trace as an <a href="/ui/docs/components/item">Item</a>. Once the person answers, the tool goes back to being a line. See <a href="/ui/docs/ai-elements/confirmation">Confirmation</a>.</p>
    ${await componentPreview('tool-approval', RHEA)}
    ${codeFigure(`if (part.state === 'approval-requested') {
  return html\`<div data-slot="item" data-variant="outline" data-size="sm" class=\${itemClass({ variant: 'outline', size: 'sm' })}>
    <div data-slot="item-media" data-variant="icon" class=\${itemMediaClass({ variant: 'icon' })}>\${TerminalIcon()}</div>
    <div data-slot="item-content" class=\${itemContentClass()}>
      <div data-slot="item-title" class=\${itemTitleClass()}>Run \${part.input.command}?</div>
    </div>
    <div data-slot="item-actions" class=\${itemActionsClass()}>
      <button type="button" data-slot="button" class=\${buttonClass({ variant: 'outline', size: 'sm' })}
        @click=\${() => this.answer(part.approval.id, false)}>Deny</button>
      <button type="button" data-slot="button" class=\${buttonClass({ size: 'sm' })}
        @click=\${() => this.answer(part.approval.id, true)}>Approve</button>
    </div>
  </div>\`;
}`, { lineNumbers: true })}
    <p><code>answer</code> is your component's method. It records the response and calls the action again, so the chat continues once every approval has an answer.</p>

    ${migrating(toc, {
      name: 'Tool',
      file: 'tool.tsx',
      parts: [
        ['Tool', 'A trace with a trace collapsible.'],
        ['ToolHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with an icon and a title, in place of the status badge. Map the state to the status and title as the States table does.`],
        ['ToolContent', 'The trace collapsible content.'],
        ['ToolInput, ToolOutput', html`A small code block. The output shows <code>errorText</code> when the tool failed.`],
        ['getStatusBadge, ToolPart', 'Not needed: the state maps to a data-status, and the part type comes from your messages.'],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
