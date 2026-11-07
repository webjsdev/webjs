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

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
const PaperclipIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"></path></svg>`;
const MonitorIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>`;
const ImageIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`;
const BrainIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 18V5"></path><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"></path><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"></path><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"></path><path d="M18 18a4 4 0 0 0 2-7.464"></path><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"></path><path d="M6 18a4 4 0 0 1-2-7.464"></path><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"></path></svg>`;
const GlobeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`;
const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
const BotIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`;
const BookOpenIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>`;
const CheckIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
const ArrowUpIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>`;
const SquareIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>`;

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
