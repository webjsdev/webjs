/**
 * The preview block's shortcuts card: a list of commands and their keys. A
 * fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/shortcuts.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import {
  itemActionsClass,
  itemClass,
  itemGroupClass,
  itemHeaderClass,
  itemSeparatorClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { kbdClass } from '../../../components/kbd.ts';

const SHORTCUTS = [
  { label: 'Search', keys: ['⌘', 'K'], spoken: 'Command K' },
  { label: 'Quick Actions', keys: ['⌘', 'J'], spoken: 'Command J' },
  { label: 'New File', keys: ['⌘', 'N'], spoken: 'Command N' },
  { label: 'Save', keys: ['⌘', 'S'], spoken: 'Command S' },
  { label: 'Toggle Sidebar', keys: ['⌘', 'B'], spoken: 'Command B' },
];

export function shortcuts() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium">Shortcuts</div>
          <div role="list" data-slot="item-group" data-size="xs" class=${cn(itemGroupClass(), 'gap-2 text-muted-foreground')}>
            ${shortcutRows()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function shortcutRows() {
  return SHORTCUTS.map(({ label, keys, spoken }, i) => html`
    ${i > 0 ? html`<div role="separator" aria-orientation="horizontal" data-slot="item-separator" data-orientation="horizontal" class=${itemSeparatorClass()}></div>` : ''}
    <div role="listitem" data-slot="item" data-variant="default" data-size="xs" class=${cn(itemClass({ variant: 'default', size: 'xs' }), 'border-0 px-0 py-0')}>
      <div data-slot="item-header" class=${itemHeaderClass()}>
        <div data-slot="item-title" class=${cn(itemTitleClass(), 'font-normal')}>${label}</div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <div class="flex gap-1" role="img" aria-label=${spoken}>
            ${keys.map((key) => html`<kbd data-slot="kbd" class=${kbdClass()}>${key}</kbd>`)}
          </div>
        </div>
      </div>
    </div>
  `);
}
