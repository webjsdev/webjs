import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Model Selector, ported from shadcn's
 * content/docs/ai-elements/radix/model-selector.mdx (#1666). The menus are
 * the kit's <ui-dropdown-menu>, whose radio items keep one choice checked.
 */
export const title = 'Model Selector';
export const description = 'Two menus. One picks the model the agent runs, the other picks how hard it thinks.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('model-selector-demo', RHEA)}

    ${await installation(toc, {
      prose: html`Model Selector is built with the <a href="/ui/docs/components/dropdown-menu">Dropdown Menu</a> and <a href="/ui/docs/components/input-group">Input Group</a> components.`,
      add: 'dropdown-menu input-group',
      source: 'dropdown-menu',
      dependencies: ['dropdown-menu', 'input-group'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { ArrowUpIcon, ChevronDownIcon } from '#lib/utils/icons.ts';
import {
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupClass,
  inputGroupTextareaClass,
} from '#components/ui/input-group.ts';
import '#components/ui/dropdown-menu.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="input-group" role="group" class=\${inputGroupClass()}>
  <textarea data-slot="input-group-control" placeholder="Ask the agent to change your code..." class=\${inputGroupTextareaClass()}></textarea>
  <div role="group" data-slot="input-group-addon" data-align="block-end" class=\${inputGroupAddonClass({ align: 'block-end' })}>
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" class=\${inputGroupButtonClass({ size: 'sm' })}>
          GPT-5
          \${ChevronDownIcon()}
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content align="start">
        <ui-dropdown-menu-group aria-label="Model">
          <ui-dropdown-menu-label>OpenAI</ui-dropdown-menu-label>
          <ui-dropdown-menu-item type="radio" value="gpt-5" checked>GPT-5</ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="radio" value="gpt-5-mini">GPT-5 mini</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" class=\${inputGroupButtonClass({ size: 'sm' })}>
          Medium
          \${ChevronDownIcon()}
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content align="start">
        <ui-dropdown-menu-group aria-label="Effort">
          <ui-dropdown-menu-item type="radio" value="low">Low</ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="radio" value="medium" checked>Medium</ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="radio" value="high">High</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
    <button type="submit" aria-label="Send" data-slot="button" class=\${cn(inputGroupButtonClass({ variant: 'default' }), 'ml-auto')}>
      \${ArrowUpIcon()}
    </button>
  </div>
</div>`, { lineNumbers: true })}
    <p>A radio set is the nearest <code>&lt;ui-dropdown-menu-group&gt;</code>, so one labelled group around every provider keeps a single model checked. Each pick bubbles a <code>ui-item-select</code> event whose <code>detail.value</code> is the item's value. Listen for it to update the trigger's text.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Send the model and the effort with the message. Map them to a model and provider options in the <code>'use server'</code> action that streams the reply.</p>
    ${codeFigure(`for await (const part of await chat(messages, { model, effort })) {
  // render each part
}`, { lineNumbers: true })}
    ${codeFigure(`'use server';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';

const models = {
  'gpt-5': openai('gpt-5'),
  'gpt-5-mini': openai('gpt-5-mini'),
  'claude-sonnet-4-5': anthropic('claude-sonnet-4-5'),
  'claude-haiku-4-5': anthropic('claude-haiku-4-5'),
};

export async function* chat(
  messages: UIMessage[],
  { model, effort }: { model: keyof typeof models; effort: 'low' | 'medium' | 'high' },
) {
  const result = streamText({
    model: models[model] ?? models['gpt-5'],
    messages: await convertToModelMessages(messages),
    providerOptions: {
      openai: { reasoningEffort: effort },
      anthropic: { effort },
    },
  });
  yield* result.toUIMessageStream();
}`, { title: 'modules/chat/actions/chat.server.ts', lineNumbers: true })}
    <p>Each provider reads its own key in <code>providerOptions</code> and ignores the rest. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts to a component.</p>

    ${migrating(toc, {
      name: 'Model Selector',
      file: 'model-selector.tsx',
      parts: [
        ['ModelSelector', html`A <code>&lt;ui-dropdown-menu&gt;</code>, in place of a Dialog.`],
        ['ModelSelectorTrigger', html`A <code>&lt;ui-dropdown-menu-trigger&gt;</code> holding the button.`],
        ['ModelSelectorContent', html`A <code>&lt;ui-dropdown-menu-content&gt;</code>.`],
        ['ModelSelectorList', html`A labelled <code>&lt;ui-dropdown-menu-group&gt;</code>, the radio set, with the selected model's item <code>checked</code>.`],
        ['ModelSelectorGroup', html`A <code>&lt;ui-dropdown-menu-label&gt;</code> for its heading, followed by its items, inside the radio set.`],
        ['ModelSelectorItem', html`A <code>&lt;ui-dropdown-menu-item type="radio" value&gt;</code>. Picking a model closes the menu.`],
        ['ModelSelectorSeparator, ModelSelectorShortcut', html`A <code>&lt;ui-dropdown-menu-separator&gt;</code> and a <code>&lt;ui-dropdown-menu-shortcut&gt;</code>.`],
        ['ModelSelectorInput, ModelSelectorEmpty, ModelSelectorDialog', html`A menu has no search field. Use the kit's <a href="/ui/docs/components/command">Command</a> if you need search, or drop them.`],
        ['ModelSelectorLogo, ModelSelectorLogoGroup, ModelSelectorName', html`Plain markup inside the item, as they are.`],
      ],
    })}
  `;
}
