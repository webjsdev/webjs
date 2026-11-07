/**
 * The preview-03 text part: one text part of a chat message, in a bubble. A
 * user's text is shown as written; an assistant's is read as Markdown
 * (paragraphs, `-` and `1.` lists, `**bold**`, `*italic*` and inline code).
 * A fragment helper, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/part-text.ts`. Ported from shadcn/ui's preview-03,
 * where the Markdown is Streamdown. Swap `markdown()` for a full Markdown
 * renderer if your replies carry tables or fenced code.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { bubbleClass, bubbleContentClass } from '../../../components/bubble.ts';

export type PartTextVariant = 'default' | 'bubble';
export type ChatRole = 'user' | 'system' | 'assistant';

/** `**bold**`, `*italic*` and inline code, everything else as text. */
function inline(text: string): unknown[] {
  const out: unknown[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(html`<strong>${m[1]}</strong>`);
    else if (m[2] !== undefined) out.push(html`<em>${m[2]}</em>`);
    else out.push(html`<code class="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">${m[3]}</code>`);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A small Markdown subset, enough for the scripted replies. */
export function markdown(text: string): TemplateResult {
  // Runs of consecutive lines of one kind: a bullet list, a numbered list, or
  // a paragraph (a blank line also ends a paragraph).
  const runs: Array<{ kind: 'ul' | 'ol' | 'p'; lines: string[] }> = [];
  for (const line of text.trim().split('\n')) {
    if (!line.trim()) {
      runs.push({ kind: 'p', lines: [] });
      continue;
    }
    const kind = /^\s*-\s+/.test(line) ? 'ul' : /^\s*\d+\.\s+/.test(line) ? 'ol' : 'p';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.lines.push(line);
    else runs.push({ kind, lines: [line] });
  }
  return html`<div class="space-y-3">${runs.filter((r) => r.lines.length).map((r) => {
    if (r.kind === 'ul') {
      return html`<ul class="list-disc space-y-1 ps-5">${r.lines.map((l) => html`<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`)}</ul>`;
    }
    if (r.kind === 'ol') {
      return html`<ol class="list-decimal space-y-1 ps-5">${r.lines.map((l) => html`<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`)}</ol>`;
    }
    return html`<p>${r.lines.map((l, i) => html`${i ? html`<br>` : ''}${inline(l)}`)}</p>`;
  })}</div>`;
}

export function partText(opts: { text: string; role?: ChatRole; variant?: PartTextVariant; tinted?: boolean; class?: string }) {
  const { text, role, variant, tinted = false } = opts;
  const content = role === 'user' || variant === 'bubble' ? html`<span class="whitespace-pre-wrap">${text}</span>` : markdown(text);
  const bubbleVariant = variant === 'bubble' ? (tinted ? 'tinted' : 'default') : role === 'user' ? 'default' : 'ghost';
  return html`<div data-slot="bubble" data-variant=${bubbleVariant} class=${cn(bubbleClass({ variant: bubbleVariant }), opts.class)}>
    <div data-slot="bubble-content" class=${bubbleContentClass()}>${content}</div>
  </div>`;
}
