/**
 * The preview-03 prompt input: a chat composer, a textarea with an add menu
 * and a send button in one input group. A fragment helper, rendered by the
 * server; the menu is the kit's `<ui-dropdown-menu>`.
 *
 * The `<form>` has no `action` yet. Bind a server action from a `'use server'`
 * file (`<form action=${sendMessage}>`) and read the `prompt` field, or
 * handle the submit in the element that owns the conversation, as
 * `<preview-03-chat>` (chat-player.ts) does for the scripted demo.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/prompt-input.ts`. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { fieldGroupClass } from '../../../components/field.ts';
import {
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupClass,
  inputGroupTextareaClass,
} from '../../../components/input-group.ts';
import '../../../components/dropdown-menu.ts';
import { ArrowUpIcon, BookOpenIcon, BotIcon, BrainIcon, CheckIcon, GlobeIcon, ImageIcon, MonitorIcon, MoreHorizontalIcon, PaperclipIcon, PlusIcon, SquareIcon } from '../../../lib/icons.ts';

/**
 * `id` names the textarea and the add menu's button, so it must be unique on
 * the page. `value` is the text the box opens with.
 */
export function promptInput(opts: { id: string; value?: string; class?: string }) {
  const value = opts.value ?? '';
  const addId = `${opts.id}-add`;
  // `flex-col` stacks the box over the toolbar. Most styles do it for any
  // group with a block-end addon; new-york does not, so it is written here.
  return html`<form data-slot="prompt-input" class=${cn('w-full', opts.class)}>
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'gap-1')}>
      <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'h-auto flex-col')}>
        <textarea
          data-slot="input-group-control"
          data-chat-input
          id=${opts.id}
          name="prompt"
          aria-label="Message"
          placeholder="Ask me anything..."
          class=${cn(inputGroupTextareaClass(), 'h-10 min-h-10 overflow-y-auto transition-all')}
        >${value}</textarea>
        <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'p-2')}>
          <button type="button" id=${addId} data-slot="input-group-button" data-variant="ghost" data-size="icon-sm" class=${inputGroupButtonClass({ size: 'icon-sm', variant: 'ghost' })}>
            ${PlusIcon()}<span class="sr-only">Add</span>
          </button>
          <button type="submit" data-chat-send data-slot="input-group-button" data-variant="default" data-size="icon-sm" data-visible="true" ?disabled=${!value.trim()} class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'default' }), 'ml-auto data-[visible=false]:hidden')}>
            ${ArrowUpIcon()}<span class="sr-only">Send</span>
          </button>
          <button type="button" data-chat-stop data-slot="input-group-button" data-variant="default" data-size="icon-sm" data-visible="false" class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'default' }), 'ml-auto data-[visible=false]:hidden')}>
            ${SquareIcon('fill-foreground')}<span class="sr-only">Stop</span>
          </button>
        </div>
      </div>
    </div>
    <ui-dropdown-menu trigger=${addId}>
      <ui-dropdown-menu-content class="w-fit">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>${PaperclipIcon()}Add Photos and Files</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${MonitorIcon()}Take a Screenshot</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>${ImageIcon()}Create Image</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${BrainIcon()}Deep Research</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${GlobeIcon()}Web Search</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>${MoreHorizontalIcon()}More</ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-item>${BotIcon()}Agent Mode</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>${BookOpenIcon()}Add Sources</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>${CheckIcon()}Create Tasks</ui-dropdown-menu-item>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  </form>`;
}
