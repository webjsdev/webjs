import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Prompt Input, ported from shadcn's
 * content/docs/ai-elements/radix/prompt-input.mdx (#1666). The field is a
 * plain form, so it submits with JavaScript off; the attach button is a
 * label for the hidden file input, and Enter-to-send is a keydown handler
 * the reader adds in their component.
 */
export const title = 'Prompt Input';
export const description = 'A message field with attachments and a send button.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('prompt-input-demo', RHEA)}
    <p>Prompt Input is the field the person types into to message the agent. It is an <a href="/ui/docs/components/input-group">Input Group</a> with a textarea, an attach button, the <a href="/ui/docs/ai-elements/model-selector">Model Selector</a> menus and a send button. Attached files show as <a href="/ui/docs/components/attachment">Attachment</a> chips above the text.</p>

    ${await installation(toc, {
      prose: html`Prompt Input is built with the <a href="/ui/docs/components/input-group">Input Group</a>, <a href="/ui/docs/components/attachment">Attachment</a> and <a href="/ui/docs/components/dropdown-menu">Dropdown Menu</a> components.`,
      add: 'input-group attachment dropdown-menu',
      source: 'input-group',
      dependencies: ['button', 'input', 'textarea'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupClass,
  inputGroupTextareaClass,
} from '#components/ui/input-group.ts';`, { lineNumbers: true })}
    ${codeFigure(`<form action=\${sendMessage}>
  <input id="files" type="file" name="files" multiple tabindex="-1" class="sr-only">
  <div data-slot="input-group" role="group" class=\${inputGroupClass()}>
    <textarea data-slot="input-group-control" name="text" aria-label="Message"
      placeholder="Ask the agent to change your code..."
      class=\${cn(inputGroupTextareaClass(), 'p-3')}></textarea>
    <div data-slot="input-group-addon" data-align="block-end" role="group" class=\${inputGroupAddonClass({ align: 'block-end' })}>
      <label for="files" aria-label="Attach files" data-slot="button"
        class=\${cn(inputGroupButtonClass({ variant: 'outline', size: 'icon-sm' }), 'rounded-full')}>
        \${PlusIcon()}
      </label>
      <button type="submit" aria-label="Send" data-slot="button"
        class=\${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-sm' }), 'ml-auto rounded-full')}>
        \${ArrowUpIcon()}
      </button>
    </div>
  </div>
</form>`, { lineNumbers: true })}
    <p>The form binds a <code>'use server'</code> action, so it sends with JavaScript off too. WebJs gives a bound form <code>method="post"</code> and <code>enctype="multipart/form-data"</code>, so the picked files reach the action with the text.</p>

    ${heading(toc, 2, 'Attachments')}
    <p>The attach button is a <code>&lt;label&gt;</code> for a hidden file input, so it opens the file picker with no script. Show each file as an <a href="/ui/docs/components/attachment">Attachment</a> in an addon with <code>data-align="block-start"</code>, with a button to remove it. Reading the input's <code>change</code> event and rendering the chips is the component's job:</p>
    ${codeFigure(`<div data-slot="input-group-addon" data-align="block-start" role="group" class=\${cn(inputGroupAddonClass({ align: 'block-start' }), 'flex-wrap')}>
  \${files.map((file) => html\`
    <div data-slot="attachment" data-size="sm" class=\${attachmentClass({ size: 'sm' })}>
      <div data-slot="attachment-media" class=\${attachmentMediaClass()}>\${FileTextIcon()}</div>
      <div data-slot="attachment-content" class=\${attachmentContentClass()}>
        <span data-slot="attachment-title" class=\${attachmentTitleClass()}>\${file.name}</span>
      </div>
      <div data-slot="attachment-actions" class=\${attachmentActionsClass()}>
        <button type="button" aria-label=\${\`Remove \${file.name}\`} data-slot="attachment-action"
          class=\${attachmentActionClass()} @click=\${() => this.remove(file)}>
          \${XIcon()}
        </button>
      </div>
    </div>\`)}
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Model and Effort')}
    <p>Put the two <a href="/ui/docs/ai-elements/model-selector">Model Selector</a> menus in the <code>block-end</code> addon, between the attach and send buttons. Move <code>ml-auto</code> from the send button to the first menu, so both menus sit next to the send button.</p>

    ${heading(toc, 2, 'Keyboard')}
    <p>Enter sends the message. Shift+Enter adds a new line.</p>
    ${codeFigure(`<textarea @keydown=\${(event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    (event.target as HTMLTextAreaElement).form?.requestSubmit();
  }
}}></textarea>`, { lineNumbers: true })}
    <p>An <code>@keydown</code> handler runs only in a component's template, since a page does not hydrate. Render the field from your chat component, or add the listener there.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Send the text and the files from the form to a <code>'use server'</code> action. A bound action receives the <code>FormData</code>, files included:</p>
    ${codeFigure(`'use server';

export async function sendMessage(formData: FormData) {
  const text = String(formData.get('text') ?? '');
  const files = formData.getAll('files') as File[];
  // ...
}`, { lineNumbers: true })}
    <p>The action can stream the reply back as an async generator. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a>.</p>

    ${migrating(toc, {
      name: 'Prompt Input',
      file: 'prompt-input.tsx',
      parts: [
        ['PromptInput', html`A <code>&lt;form&gt;</code> around an input group. Keep the attachment state in your component.`],
        ['PromptInputTextarea', html`A textarea with <code>inputGroupTextareaClass()</code> and <code>p-3</code>.`],
        ['PromptInputActionMenuTrigger', html`<code>inputGroupButtonClass({ variant: 'outline', size: 'icon-sm' })</code> with <code>rounded-full</code>, holding a plus icon.`],
        ['PromptInputSubmit', html`A submit button with <code>inputGroupButtonClass({ variant: 'default', size: 'icon-sm' })</code> and <code>rounded-full</code>, holding an arrow up icon while idle.`],
        ['PromptInputHeader', html`A <code>block-start</code> addon with one small attachment per file and a button to remove it.`],
        ['PromptInputSelect, PromptInputHoverCard, tabs', html`The kit's <a href="/ui/docs/components/select">Select</a>, <a href="/ui/docs/components/hover-card">Hover Card</a> and <a href="/ui/docs/components/tabs">Tabs</a>.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/input-group#api-reference">Input Group</a> and <a href="/ui/docs/components/attachment#api-reference">Attachment</a>.</p>
  `;
}
