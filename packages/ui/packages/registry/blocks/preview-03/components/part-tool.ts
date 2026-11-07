/**
 * The preview-03 tool part: one tool call in an assistant turn, with its
 * title, name and state, and its input, output or error underneath. A
 * fragment helper, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/part-tool.ts`. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { separatorClass } from '../../../components/separator.ts';
import { SettingsIcon } from '../../../lib/icons.ts';

export interface ToolPart {
  /** `tool-<name>`, or `dynamic-tool` with a `toolName`. */
  type: string;
  toolName?: string;
  toolCallId: string;
  title?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function toolName(part: ToolPart): string {
  return part.type === 'dynamic-tool' ? (part.toolName ?? 'dynamicTool') : part.type.replace('tool-', '');
}

function toolTitle(part: ToolPart): string {
  if (typeof part.title === 'string') return part.title;
  return toolName(part)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function partTool(opts: { part: ToolPart; class?: string }) {
  const { part } = opts;
  if (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')) return '';
  const hasBody = part.input !== undefined || part.output !== undefined || !!part.errorText;
  const pre = 'overflow-auto rounded-md bg-background p-2 text-xs leading-relaxed';
  return html`<div data-slot="part-tool" data-state=${part.state} class=${cn('w-full max-w-full min-w-0 rounded-lg border bg-muted/40 text-sm', opts.class)}>
    <div class="flex min-w-0 items-center gap-2 px-3 py-2">
      <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">${SettingsIcon('size-4')}</span>
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium">${toolTitle(part)}</div>
        <div class="truncate text-xs text-muted-foreground">${toolName(part)}</div>
      </div>
      <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'capitalize')}>${part.state.replace(/-/g, ' ')}</span>
    </div>
    ${hasBody ? html`
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
      <div class="grid gap-3 p-3">
        ${part.input !== undefined ? html`<div class="grid gap-1">
          <div class="text-xs font-medium text-muted-foreground">Input</div>
          <pre class=${cn('max-h-32', pre)}>${formatValue(part.input)}</pre>
        </div>` : ''}
        ${part.output !== undefined ? html`<div class="grid gap-1">
          <div class="text-xs font-medium text-muted-foreground">Output</div>
          <pre class=${cn('max-h-40', pre)}>${formatValue(part.output)}</pre>
        </div>` : ''}
        ${part.errorText ? html`<div class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">${part.errorText}</div>` : ''}
      </div>` : ''}
  </div>`;
}
