import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Terminal, ported from shadcn's content/docs/ai-elements/radix/terminal.mdx
 * (#1666). shadcn's demo streams a scripted chat through useChat; the demo
 * here is the settled conversation, with the last command left open.
 */
export const title = 'Terminal';
export const description = 'Displays a command the agent runs, with its output as it streams.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('terminal-demo', RHEA)}
    <p>Terminal is a shell command the agent runs, such as a lint, a test run or a build. The line shows the command, and its output streams in underneath while it runs.</p>
    <p>Terminal is built with a trace, with a trace collapsible for each command.</p>

    ${await installation(toc, {
      prose: html`Terminal is built with the <a href="/ui/docs/components/trace">Trace</a> and <a href="/ui/docs/components/code-block">Code Block</a> components.`,
      add: 'trace code-block',
      source: 'trace',
      dependencies: ['code-block'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { codeBlockClass, codeBlockCodeClass, codeBlockContentClass } from '#components/ui/code-block.ts';
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
        <span data-slot="trace-title" class=\${traceTitleClass()}>Ran pnpm build</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="code-block" data-variant="default" data-size="sm" class=\${codeBlockClass()}>
        <pre data-slot="code-block-content" data-wrap tabindex="0" class=\${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=\${codeBlockCodeClass()}>\${output}</code></pre>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Exit Code')}
    <p>A command that exits with any code other than <code>0</code> failed. Set <code>data-status="error"</code>.</p>
    ${await componentPreview('terminal-error', RHEA)}
    ${table(['Command', 'data-status', 'Title'], [
      ['Running', html`<code>"running"</code>`, 'Running pnpm build'],
      [html`Exited with <code>0</code>`, 'none', 'Ran pnpm build'],
      ['Exited with another code', html`<code>"error"</code>`, 'pnpm lint exited with code 1'],
    ])}
    <p>The command is a tool call, so its states map the same way as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>.</p>

    ${heading(toc, 2, 'Open While Running')}
    <p>Open the line once the first output arrives, with <code>?open=\${running &amp;&amp; output.length &gt; 0}</code>, so the output is visible while the command runs. After that the open state is the <code>&lt;details&gt;</code> element's own, as in <a href="/ui/docs/components/trace#open-state">Trace</a>.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>A tool result arrives only once the command exits. To stream the output while it runs, write it from the tool as a data part with the tool call's id, each time with the output so far. Where your component collects the parts, keep the latest data part for each id, so the output grows in place. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a <code>'use server'</code> action.</p>
    ${codeFigure(`yield {
  type: 'data-terminal',
  id: toolCallId,
  data: { output },
};`, { lineNumbers: true })}
    <p>On the client, find the data part that matches each tool part.</p>
    ${codeFigure(`function getOutput(message: ChatMessage, toolCallId: string) {
  for (const part of message.parts) {
    if (part.type === 'data-terminal' && part.id === toolCallId) {
      return part.data.output;
    }
  }

  return '';
}`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Terminal',
      file: 'terminal.tsx',
      parts: [
        ['Terminal', html`A trace with a trace collapsible, opened once output arrives while the command runs.`],
        ['TerminalHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with <code>data-status="running"</code> while the command streams.`],
        ['TerminalTitle', html`A trace icon with the terminal icon and a trace title, like "Ran pnpm build".`],
        ['TerminalContent', html`The trace collapsible content, holding a Code Block with <code>data-size="sm"</code> and a <code>data-wrap</code> content with <code>max-h-64</code> for the output.`],
        ['TerminalStatus, TerminalActions, TerminalCopyButton, TerminalClearButton', html`Markup next to the <code>&lt;summary&gt;</code>, not inside it, since a button cannot sit inside a trigger.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
