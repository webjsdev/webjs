import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Stack Trace, ported from shadcn's content/docs/ai-elements/radix/stack-trace.mdx
 * (#1666). shadcn's demo streams a scripted chat through useChat; the demo
 * here is the settled conversation.
 */
export const title = 'Stack Trace';
export const description = 'Displays a failed tool call and its stack frames.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('stack-trace-demo', RHEA)}
    <p>Stack Trace is a line for a tool call that failed. The error is the title, like "Failed: TypeError". Open it for the stack frames, which can link to the file and line.</p>
    <p>Stack Trace is built with a trace, with a trace collapsible for the frames.</p>

    ${await installation(toc, {
      prose: html`Stack Trace is built with the <a href="/ui/docs/components/trace">Trace</a> and <a href="/ui/docs/components/code-block">Code Block</a> components.`,
      add: 'trace code-block',
      source: 'trace',
      dependencies: ['code-block'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  traceClass,
  traceCollapsibleClass,
  traceCollapsibleContentClass,
  traceCollapsibleTriggerClass,
  traceIconClass,
  traceLineClass,
  traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`const [error, ...frames] = stack.split('\\n').map((line) => line.trim());

html\`<div data-slot="trace" class=\${traceClass()}>
  <details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" data-status="error" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${CircleXIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Failed: \${error}</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div class="flex flex-col gap-2 rounded-md bg-muted p-3 font-mono text-xs">
        <p class="text-destructive">\${error}</p>
        <ol>
          \${frames.map((frame) => html\`
            <li class=\${frame.includes('node_modules') ? '' : 'text-foreground'}>\${frame}</li>
          \`)}
        </ol>
      </div>
    </div>
  </details>
</div>\``, { lineNumbers: true })}
    <p>The title truncates, so repeat the full error at the top of the content. Frames from <code>node_modules</code> stay muted, so your own frames stand out.</p>

    ${heading(toc, 2, 'Frame Links')}
    <p>Turn your own frames into links that open the file at the line. Fold the framework frames into a collapsible line of their own, so the frames you can fix come first.</p>
    ${await componentPreview('stack-trace-frames', RHEA)}

    ${heading(toc, 2, 'AI SDK')}
    <p>When a tool throws, its part is <code>output-error</code>, and by default <code>errorText</code> is only the error message, with no frames. Where your <code>'use server'</code> action streams the parts (see <a href="/ui/docs/helpers/ai-sdk">AI SDK</a>), catch the tool's error and put <code>error.stack</code> in the part yourself.</p>
    ${codeFigure(`function errorText(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  return process.env.NODE_ENV === 'production' ? error.message : (error.stack ?? error.message);
}`, { lineNumbers: true, title: 'modules/chat/utils/error-text.server.ts' })}
    <p>A stack shows file paths from your server, so only send it in development, as above. A WebJs action that throws in production already sends the client a generic message and a digest, never the stack.</p>
    ${codeFigure(`function toolRow(part: ToolPart) {
  if (part.state === 'output-error') {
    const [error, ...frames] = part.errorText.split('\\n').map((line) => line.trim());
    return html\`<details data-slot="trace-collapsible" class=\${traceCollapsibleClass()}>…</details>\`;
  }
  // …
}`, { lineNumbers: true })}
    <p>Map the other tool states as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>.</p>

    ${migrating(toc, {
      name: 'Stack Trace',
      file: 'stack-trace.tsx',
      parts: [
        ['StackTrace', html`A trace with a trace collapsible. Its open state is the <code>&lt;details&gt;</code> element's own <code>open</code>, and the parsing stays yours.`],
        ['StackTraceHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with <code>data-status="error"</code> and a trace icon.`],
        ['StackTraceError', html`A trace title, like "Failed: TypeError: …". Keep the error type and message as spans inside it.`],
        ['StackTraceContent', html`The trace collapsible content.`],
        ['StackTraceFrames', html`The frames as a list in a muted, monospace block, with the frames from <code>node_modules</code> dimmed and your own frames as links.`],
        ['StackTraceExpandButton', html`Nothing, since the whole line opens the frames.`],
        ['StackTraceActions, StackTraceCopyButton', html`Buttons next to the <code>&lt;summary&gt;</code>, not inside it, since a button cannot sit inside a trigger.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
