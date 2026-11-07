import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Checkpoint, ported from shadcn's
 * content/docs/ai-elements/radix/checkpoint.mdx (#1666). The demo is the
 * whole scripted conversation with its checkpoint, and Restore is an inert
 * button the reader wires.
 */
export const title = 'Checkpoint';
export const description = 'Marks a point in the conversation you can return to.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('checkpoint-demo', RHEA)}
    <p>Checkpoint is a point in the conversation you can return to. It is a <a href="/ui/docs/components/marker">Marker</a> after a turn, with a Restore button. Restore keeps that turn and drops every message after it.</p>

    ${await installation(toc, {
      prose: html`Checkpoint is built with the <a href="/ui/docs/components/marker">Marker</a> and <a href="/ui/docs/components/button">Button</a> components.`,
      add: 'marker button',
      source: 'marker',
      dependencies: ['marker', 'button'],
    })}

    ${heading(toc, 2, 'Usage')}
    <p>Render a marker after the turn, with a button that restores it.</p>
    ${codeFigure(`<div data-slot="marker" data-variant="separator" class=\${markerClass({ variant: 'separator' })}>
  <span data-slot="marker-content" class=\${cn(markerContentClass(), 'inline-flex items-center gap-2')}>
    \${label}
    <button type="button" data-slot="button" data-variant="outline" data-size="xs" class=\${buttonClass({ variant: 'outline', size: 'xs' })} @click=\${() => this.restore(messageId)}>
      Restore
    </button>
  </span>
</div>`, { lineNumbers: true })}
    <p>See <a href="/ui/docs/components/marker#separator">Marker</a>.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Restore replaces the thread with the messages up to and including that turn. Every later turn is removed. Send a new message to continue from there.</p>
    ${codeFigure(`restore(messageId: string) {
  const index = this.messages.findIndex((message) => message.id === messageId);
  this.messages = this.messages.slice(0, index + 1);
}`, { lineNumbers: true })}
    <p><code>messages</code> is your component's own state, a reactive property or a signal. Restoring is a change in the browser only. If the server keeps the thread, call a <code>'use server'</code> action to drop the later turns there too.</p>

    ${heading(toc, 2, 'AI SDK Helper')}
    <p>Write the checkpoint as a data part on the agent's turn, from the <code>'use server'</code> action that streams the reply. Send the same <code>id</code> again only when you mean to update that checkpoint. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts to a component.</p>
    ${codeFigure(`'use server';

export async function* renameButton() {
  yield { type: 'text', text: 'Renamed Button to Action in components/ui/button.tsx.' };
  yield {
    type: 'data-checkpoint',
    id: 'rename',
    data: { label: 'Button renamed' },
  };
}`, { lineNumbers: true })}
    <p>Render the marker after the turn whose parts hold one:</p>
    ${codeFigure(`const checkpoint = message.parts.find((part) => part.type === 'data-checkpoint');`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Checkpoint',
      file: 'checkpoint.tsx',
      parts: [
        ['Checkpoint', html`A marker with <code>markerClass({ variant: 'separator' })</code> and a marker content, in place of a Separator.`],
        ['CheckpointIcon', html`A marker icon, <code>markerIconClass()</code>.`],
        ['CheckpointTrigger', html`A button with <code>buttonClass({ variant: 'outline', size: 'xs' })</code>, like "Restore". For its tooltip, wrap it in a <a href="/ui/docs/components/tooltip"><code>&lt;ui-tooltip&gt;</code></a>.`],
      ],
    })}
  `;
}
