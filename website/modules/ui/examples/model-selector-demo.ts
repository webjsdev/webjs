import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { ArrowUpIcon, ChevronDownIcon, PlusIcon } from '#lib/ui/lucide.ts';

const providers = [
  {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini' },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
];

const efforts = [
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
];

const model = providers[0].models[0];
const effort = efforts[1];

// A radio set is the nearest <ui-dropdown-menu-group>, so the model menu
// wraps both providers in ONE labelled group, which keeps a single model
// checked across them. Reflecting the pick in the trigger's text is the
// reader's to wire, from the menu's ui-item-select event.
export default function ModelSelectorDemo() {
  return html`
    <div class="mx-auto w-full max-w-lg py-6">
      <form>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <textarea data-slot="input-group-control" name="text" placeholder="Ask the agent to change your code..." aria-label="Message" class=${cn(inputGroupTextareaClass(), 'p-3')}></textarea>
          <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
            <button type="button" aria-label="Attach" data-slot="button" data-variant="outline" data-size="icon-sm" class=${cn(inputGroupButtonClass({ variant: 'outline', size: 'icon-sm' }), 'rounded-full')}>
              ${PlusIcon()}
            </button>
            <ui-dropdown-menu class="ml-auto">
              <ui-dropdown-menu-trigger>
                <button type="button" aria-label=${`Model: ${model.name}`} data-slot="button" data-variant="outline" data-size="sm" class=${inputGroupButtonClass({ variant: 'outline', size: 'sm' })}>
                  ${model.name}
                  ${ChevronDownIcon()}
                </button>
              </ui-dropdown-menu-trigger>
              <ui-dropdown-menu-content align="start" class="w-48">
                <ui-dropdown-menu-group aria-label="Model">
                  ${providers.map((provider, index) => html`
                    ${index > 0 ? html`<ui-dropdown-menu-separator></ui-dropdown-menu-separator>` : ''}
                    <ui-dropdown-menu-label>${provider.name}</ui-dropdown-menu-label>
                    ${provider.models.map((item) => html`
                      <ui-dropdown-menu-item type="radio" value=${item.id} ?checked=${item.id === model.id}>${item.name}</ui-dropdown-menu-item>
                    `)}
                  `)}
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
            <ui-dropdown-menu>
              <ui-dropdown-menu-trigger>
                <button type="button" aria-label=${`Effort: ${effort.name}`} data-slot="button" data-variant="outline" data-size="sm" class=${inputGroupButtonClass({ variant: 'outline', size: 'sm' })}>
                  <span class="text-muted-foreground">Effort</span>
                  ${effort.name}
                  ${ChevronDownIcon()}
                </button>
              </ui-dropdown-menu-trigger>
              <ui-dropdown-menu-content align="start" class="w-36">
                <ui-dropdown-menu-group>
                  <ui-dropdown-menu-label>Effort</ui-dropdown-menu-label>
                  <ui-dropdown-menu-group aria-label="Effort">
                    ${efforts.map((item) => html`
                      <ui-dropdown-menu-item type="radio" value=${item.id} ?checked=${item.id === effort.id}>${item.name}</ui-dropdown-menu-item>
                    `)}
                  </ui-dropdown-menu-group>
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
            <button type="submit" disabled aria-label="Send" data-slot="button" data-variant="default" data-size="icon-sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-sm' }), 'rounded-full')}>
              ${ArrowUpIcon()}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}
