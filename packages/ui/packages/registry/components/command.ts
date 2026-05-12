import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import Fuse from 'fuse.js';
import { cn } from '../lib/utils.ts';

/**
 * Command palette primitives (cmdk-style) with fuzzy ranking via fuse.js.
 *
 *   <ui-command>
 *     <ui-command-input placeholder="Search..."></ui-command-input>
 *     <ui-command-list>
 *       <ui-command-empty>No results.</ui-command-empty>
 *       <ui-command-group heading="Suggestions">
 *         <ui-command-item data-value="profile">Profile</ui-command-item>
 *         <ui-command-item data-value="settings">Settings</ui-command-item>
 *       </ui-command-group>
 *       <ui-command-separator></ui-command-separator>
 *     </ui-command-list>
 *   </ui-command>
 *
 * Or inside a dialog: <ui-command-dialog>...</ui-command-dialog>.
 *
 * State (query + selected index) lives on the root <ui-command>. Children
 * watch the root's `data-query` / `data-selected` attributes and update
 * their own visibility / styling reactively.
 *
 * Filter: fuzzy ranking via fuse.js (the same approach cmdk uses internally).
 * Items are reordered by match score using CSS `order:` on flexbox parents
 * so DOM stays stable while visual order reflects relevance.
 *
 * Keyboard: ArrowDown/Up moves selection; Enter triggers selected item's
 * click; Escape closes the wrapping dialog if present.
 */

/**
 * Fuzzy match a query against a list of strings. Returns `{ index, score }`
 * pairs sorted best-first. Lower score = better match (fuse.js convention).
 */
function fuzzyMatch(query: string, items: string[]): Array<{ index: number; score: number }> {
  if (!query) return items.map((_, index) => ({ index, score: 0 }));
  const fuse = new Fuse(items, {
    includeScore: true,
    threshold: 0.4,        // 0 = perfect match only, 1 = match anything
    ignoreLocation: true,  // match anywhere in the string
    minMatchCharLength: 1,
  });
  return fuse.search(query).map((r) => ({ index: r.refIndex, score: r.score ?? 0 }));
}

export class UiCommand extends WebComponent {
  static properties = {
    query: { type: String, reflect: true, attribute: 'data-query' },
    selected: { type: Number, reflect: true, attribute: 'data-selected' },
  };
  declare query: string;
  declare selected: number;

  private _slot = '';

  constructor() {
    super();
    this.query = '';
    this.selected = 0;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('keydown', this._onKey);
    queueMicrotask(() => this._refresh());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._onKey);
  }

  _items(): HTMLElement[] {
    return Array.from(this.querySelectorAll('ui-command-item')) as HTMLElement[];
  }

  _visibleItems(): HTMLElement[] {
    return this._items().filter((el) => el.getAttribute('data-hidden') !== 'true');
  }

  _onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const visible = this._visibleItems();
      if (!visible.length) return;
      this.selected = Math.min(this.selected + 1, visible.length - 1);
      this._refresh();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const visible = this._visibleItems();
      if (!visible.length) return;
      this.selected = Math.max(0, this.selected - 1);
      this._refresh();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const visible = this._visibleItems();
      const target = visible[this.selected];
      target?.click();
    }
  };

  setQuery(q: string) {
    this.query = q;
    this.selected = 0;
    this._refresh();
  }

  _refresh() {
    const q = (this.query || '').trim();
    const items = this._items();
    let visibleCount = 0;

    if (q === '') {
      // No query — show all in source order.
      items.forEach((it) => {
        it.setAttribute('data-hidden', 'false');
        (it as HTMLElement).style.display = '';
        (it as HTMLElement).style.order = '';
        visibleCount++;
      });
    } else {
      // Fuzzy match + score-based reordering.
      const matches = fuzzyMatch(
        q,
        items.map((it) => (it.getAttribute('data-value') || it.textContent || '').trim()),
      );
      // matches: Array<{ index, score }> sorted by score (best first)
      const matchedIdx = new Map<number, number>();
      matches.forEach((m, rank) => matchedIdx.set(m.index, rank));

      items.forEach((it, i) => {
        const rank = matchedIdx.get(i);
        const visible = rank !== undefined;
        it.setAttribute('data-hidden', visible ? 'false' : 'true');
        (it as HTMLElement).style.display = visible ? '' : 'none';
        (it as HTMLElement).style.order = visible ? String(rank) : '';
        if (visible) visibleCount++;
      });
    }
    // Hide groups whose children are all filtered out
    this.querySelectorAll('ui-command-group').forEach((g) => {
      const gItems = Array.from(g.querySelectorAll('ui-command-item'));
      const anyVisible = gItems.some((it) => (it as HTMLElement).getAttribute('data-hidden') !== 'true');
      (g as HTMLElement).style.display = anyVisible ? '' : 'none';
    });
    // Selected highlight
    const visible = this._visibleItems();
    visible.forEach((it, i) => {
      it.setAttribute('data-selected', i === this.selected ? 'true' : 'false');
    });
    // Toggle empty state
    const empty = this.querySelector('ui-command-empty') as HTMLElement | null;
    if (empty) empty.style.display = visibleCount === 0 && q !== '' ? '' : 'none';
  }

  render() {
    return html`
      <div
        data-slot="command"
        class=${cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiCommand.register('ui-command');

export class UiCommandInput extends WebComponent {
  static properties = {
    placeholder: { type: String },
    value: { type: String },
  };
  declare placeholder: string;
  declare value: string;

  constructor() {
    super();
    this.placeholder = 'Type a command or search...';
    this.value = '';
  }

  connectedCallback() {
    super.connectedCallback();
    // Autofocus the input on mount
    queueMicrotask(() => {
      this.querySelector('input')?.focus();
    });
  }

  _onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    this.value = v;
    const root = this.closest('ui-command') as UiCommand | null;
    root?.setQuery(v);
  };

  render() {
    return html`
      <div data-slot="command-input-wrapper" class="flex h-12 items-center gap-2 border-b px-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-50"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          data-slot="command-input"
          type="text"
          .value=${this.value}
          placeholder=${this.placeholder}
          @input=${this._onInput}
          class=${cn(
            'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      </div>
    `;
  }
}
UiCommandInput.register('ui-command-input');

export class UiCommandList extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="command-list"
        class=${cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiCommandList.register('ui-command-list');

export class UiCommandEmpty extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    // Hidden by default; UiCommand toggles based on filter results.
    this.style.display = 'none';
  }
  render() {
    return html`<div data-slot="command-empty" class="py-6 text-center text-sm">${unsafeHTML(this._slot)}</div>`;
  }
}
UiCommandEmpty.register('ui-command-empty');

export class UiCommandGroup extends WebComponent {
  static properties = { heading: { type: String } };
  declare heading: string;

  private _slot = '';

  constructor() {
    super();
    this.heading = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <div
        data-slot="command-group"
        class=${cn('overflow-hidden p-1 text-foreground')}
      >
        ${this.heading
          ? html`<div data-slot="command-group-heading" class="px-2 py-1.5 text-xs font-medium text-muted-foreground">${this.heading}</div>`
          : html``}
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiCommandGroup.register('ui-command-group');

export class UiCommandItem extends WebComponent {
  static properties = {
    value: { type: String, attribute: 'data-value', reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
    this.addEventListener('mouseenter', this._onHover);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('mouseenter', this._onHover);
  }

  _onClick = () => {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('select', { detail: { value: this.value }, bubbles: true, composed: true }));
  };

  _onHover = () => {
    if (this.disabled) return;
    const root = this.closest('ui-command') as UiCommand | null;
    if (!root) return;
    const visible = Array.from(root.querySelectorAll('ui-command-item')).filter(
      (el) => (el as HTMLElement).getAttribute('data-hidden') !== 'true',
    );
    const idx = visible.indexOf(this);
    if (idx >= 0) {
      root.selected = idx;
      visible.forEach((it, i) => {
        (it as HTMLElement).setAttribute('data-selected', i === idx ? 'true' : 'false');
      });
    }
  };

  render() {
    const selected = this.getAttribute('data-selected') === 'true';
    return html`
      <div
        data-slot="command-item"
        data-selected=${selected ? 'true' : 'false'}
        data-disabled=${this.disabled ? 'true' : 'false'}
        class=${cn(
          'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
          'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
          'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }

  static get observedAttributes() { return ['data-selected', 'data-hidden']; }
  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    if (oldV !== newV) this.requestUpdate();
  }
}
UiCommandItem.register('ui-command-item');

export class UiCommandSeparator extends WebComponent {
  render() {
    return html`<div data-slot="command-separator" class=${cn('-mx-1 h-px bg-border')}></div>`;
  }
}
UiCommandSeparator.register('ui-command-separator');

export class UiCommandShortcut extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <span
        data-slot="command-shortcut"
        class=${cn('ml-auto text-xs tracking-widest text-muted-foreground')}
      >${unsafeHTML(this._slot)}</span>
    `;
  }
}
UiCommandShortcut.register('ui-command-shortcut');

/**
 * Convenience wrapper: command palette inside a dialog. Uses <ui-dialog>
 * from `./dialog.ts` (must be registered already).
 *
 *   <ui-command-dialog>
 *     <ui-command>...</ui-command>
 *   </ui-command-dialog>
 */
export class UiCommandDialog extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
    title: { type: String },
    description: { type: String },
  };
  declare open: boolean;
  declare title: string;
  declare description: string;

  private _slot = '';

  constructor() {
    super();
    this.open = false;
    this.title = 'Command Palette';
    this.description = 'Search for a command to run...';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <ui-dialog ?open=${this.open}>
        <ui-dialog-content class="p-0 overflow-hidden">
          <div class="sr-only">
            <ui-dialog-title>${this.title}</ui-dialog-title>
            <ui-dialog-description>${this.description}</ui-dialog-description>
          </div>
          ${unsafeHTML(this._slot)}
        </ui-dialog-content>
      </ui-dialog>
    `;
  }
}
UiCommandDialog.register('ui-command-dialog');
