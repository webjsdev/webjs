import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Confirmation, ported from shadcn's
 * content/docs/ai-elements/radix/confirmation.mdx (#1666). shadcn's demo
 * starts empty and plays the turn on a click. The demo here is the turn
 * waiting on the person, with Deny and Approve as inert buttons.
 */
export const title = 'Confirmation';
export const description = 'Asks for approval before a tool runs.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('confirmation-demo', RHEA)}
    <p>Confirmation asks the person for a yes or no before a tool runs. The question is an <a href="/ui/docs/components/item">Item</a> with Deny and Approve buttons. Once the person answers, the call becomes a <a href="/ui/docs/ai-elements/tool">Tool</a> line.</p>

    ${await installation(toc, {
      prose: html`Confirmation is built with the <a href="/ui/docs/components/item">Item</a> and <a href="/ui/docs/components/button">Button</a> components.`,
      add: 'item button',
      source: 'item',
      dependencies: ['item', 'button'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`<div data-slot="item" data-variant="outline" data-size="sm" class=\${itemClass({ variant: 'outline', size: 'sm' })}>
  <div data-slot="item-media" data-variant="icon" class=\${itemMediaClass({ variant: 'icon' })}>
    \${TerminalIcon()}
  </div>
  <div data-slot="item-content" class=\${itemContentClass()}>
    <div data-slot="item-title" class=\${itemTitleClass()}>Run \${part.input.command}?</div>
    <p data-slot="item-description" class=\${itemDescriptionClass()}>The command runs in this project.</p>
  </div>
  <div data-slot="item-actions" class=\${itemActionsClass()}>
    <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=\${buttonClass({ variant: 'outline', size: 'sm' })} @click=\${() => this.deny()}>
      Deny
    </button>
    <button type="button" data-slot="button" data-variant="default" data-size="sm" class=\${buttonClass({ size: 'sm' })} @click=\${() => this.approve()}>
      Approve
    </button>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>While the part is <code>approval-requested</code>, answer with the approval id. Your component sends the answer back to the <code>'use server'</code> action that streams the turn (<code>send</code> below is your component's own method that calls it), and the action streams the rest of the turn once every approval has an answer.</p>
    ${codeFigure(`async approve(part: ToolPart) {
  await this.send({ approvalId: part.approval.id, approved: true });
}`, { lineNumbers: true })}
    <p>Approve streams the tool output. Deny streams <code>output-denied</code>. Either way, the part becomes a Tool line. See <a href="/ui/docs/ai-elements/tool#approval">Tool</a>, and <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a server action.</p>

    ${heading(toc, 2, 'AI SDK Helper')}
    <p>To script an approval, yield the tool part in the <code>approval-requested</code> state from the action and stop. The next call carries the answer, and the action reads it to stream the rest of the turn.</p>
    ${codeFigure(`'use server';

export async function* cleanUp(answer?: { approved: boolean }) {
  if (!answer) {
    yield {
      type: 'tool-runCommand',
      toolCallId: 'clean',
      state: 'approval-requested',
      input: { command: 'rm -rf dist' },
      approval: { id: 'clean' },
    };
    return;
  }
  yield {
    type: 'text',
    text: answer.approved ? 'Removed the dist folder.' : 'Okay, I left the dist folder in place.',
  };
}`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Confirmation',
      file: 'confirmation.tsx',
      parts: [
        ['Confirmation', html`An item with <code>itemClass({ variant: 'outline', size: 'sm' })</code>, in place of an Alert. Keep the approval and its state in your component.`],
        ['ConfirmationTitle', html`An item content holding an item title.`],
        ['ConfirmationActions', html`An item actions container, <code>itemActionsClass()</code>.`],
        ['ConfirmationAction', html`A button with <code>buttonClass({ size: 'sm' })</code>.`],
        ['ConfirmationRequest, ConfirmationAccepted, ConfirmationRejected', html`A branch on the part's state in your render: the item while it is <code>approval-requested</code>, a trace line once it is answered.`],
      ],
    })}
  `;
}
