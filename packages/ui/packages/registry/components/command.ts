/**
 * Command: a searchable list of actions, the menu behind a command palette.
 * Tier-2. It is cmdk's model, built on the platform: typing in the input
 * filters and ranks the items, the arrow keys move a selection while focus
 * stays in the input, and Enter runs the selected item. `<ui-command-dialog>`
 * puts the same command in a native modal `<dialog>`.
 *
 * shadcn parity:
 *   Command (label, shouldFilter, loop)
 *                            → <ui-command label should-filter="false" loop>
 *   CommandInput placeholder → <ui-command-input placeholder>
 *   CommandList              → <ui-command-list>
 *   CommandEmpty             → <ui-command-empty>No results.</ui-command-empty>
 *   CommandGroup heading     → <ui-command-group heading="Suggestions">
 *   CommandItem (value, keywords, disabled, onSelect)
 *                            → <ui-command-item value keywords="a b" disabled>, firing `ui-select`
 *   CommandShortcut          → <ui-command-shortcut>
 *   CommandSeparator         → <ui-command-separator>
 *   CommandDialog (open, title, description, showCloseButton)
 *                            → <ui-command-dialog open title description show-close-button>
 *                              around a <ui-command>
 *   onValueChange (Command)  → `ui-value-change` ({ detail: { value } }) as the selection moves
 *   onValueChange (Input)    → `ui-search-change` ({ detail: { search } })
 *
 * An item's value is its `value` attribute, else its text. A search ranks
 * items by how well the value and `keywords` match (a prefix beats a word
 * start beats a substring beats letters in order), hides the rest, hides a
 * group left empty and every separator, and shows `<ui-command-empty>` when
 * nothing matches. `should-filter="false"` leaves filtering to you (a list a
 * server action returns). Activating an item that holds a link follows it.
 *
 * Keyboard (as cmdk's): ArrowDown / ArrowUp (and Ctrl+N / Ctrl+P, Ctrl+J /
 * Ctrl+K) move the selection, `loop` wraps it, Home / End jump to the ends,
 * Enter runs the selected item. Pointing at an item selects it.
 *
 * A11y (handled by the element, plus your part): the input is a
 * `role="combobox"` controlling a `role="listbox"` and pointing at the
 * selected `role="option"` through `aria-activedescendant`, so focus never
 * leaves it. Groups are named by their heading and a disabled item is
 * announced and skipped. Your part: name the command (`label`, read by a
 * screen reader only), since a placeholder is not a name.
 *
 * @example
 * ```html
 * <ui-command label="Command menu" class="rounded-lg border shadow-md md:min-w-[450px]">
 *   <ui-command-input placeholder="Type a command or search"></ui-command-input>
 *   <ui-command-list>
 *     <ui-command-empty>No results found.</ui-command-empty>
 *     <ui-command-group heading="Suggestions">
 *       <ui-command-item>Calendar</ui-command-item>
 *       <ui-command-item keywords="emoji smiley">Search Emoji</ui-command-item>
 *       <ui-command-item disabled>Calculator</ui-command-item>
 *     </ui-command-group>
 *     <ui-command-separator></ui-command-separator>
 *     <ui-command-group heading="Settings">
 *       <ui-command-item>Profile<ui-command-shortcut>⌘P</ui-command-shortcut></ui-command-item>
 *     </ui-command-group>
 *   </ui-command-list>
 * </ui-command>
 * ```
 */
import { WebComponent, html, prop, signal, nothing } from '@webjsdev/core';
import { cn, takeAuthoredClass } from '../lib/utils.ts';
import { inputGroupClass, inputGroupAddonClass } from './input-group.ts';
import { UiDialog, UiDialogContent } from './dialog.ts';

/** The command's classes (the element applies them). */
export const commandClass = (): string => 'cn-command flex size-full flex-col overflow-hidden';
/** The command dialog's panel classes (the element applies them). */
export const commandDialogClass = (): string => 'cn-command-dialog top-1/3 translate-y-0 overflow-hidden p-0';
/** The input's wrapper (the element applies them). */
export const commandInputWrapperClass = (): string => 'cn-command-input-wrapper';
/** The input group around the input (the element applies them). */
export const commandInputGroupClass = (): string => 'cn-command-input-group';
/** The input's classes (the element applies them). */
export const commandInputClass = (): string =>
  'cn-command-input outline-hidden disabled:cursor-not-allowed disabled:opacity-50';
/** The search icon. */
export const commandInputIconClass = (): string => 'cn-command-input-icon';
/** The list's classes (the element applies them). */
export const commandListClass = (): string => 'cn-command-list flex flex-col overflow-x-hidden overflow-y-auto';
/** The empty state's classes (the element applies them). */
export const commandEmptyClass = (): string => 'cn-command-empty';
/** A group's classes (the element applies them). */
export const commandGroupClass = (): string => 'cn-command-group';
/** A separator's classes (the element applies them). */
export const commandSeparatorClass = (): string => 'cn-command-separator';
/** An item's classes (the element applies them). */
export const commandItemClass = (): string =>
  'cn-command-item group/command-item data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A checked item's check mark. */
export const commandItemIndicatorClass = (): string =>
  'cn-command-item-indicator ms-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100';
/** A keyboard shortcut hint's classes. */
export const commandShortcutClass = (): string => 'cn-command-shortcut';

/**
 * How well `search` matches `text`, 0 for no match: a prefix scores highest,
 * then a match at a word start, then a substring, then the letters in order.
 * Shorter texts win ties, as in cmdk's command-score.
 */
export function commandScore(text: string, search: string): number {
  const t = text.toLowerCase();
  const s = search.trim().toLowerCase();
  if (!s) return 1;
  if (!t) return 0;
  const brevity = 1 / (1 + t.length / 100);
  if (t.startsWith(s)) return 0.9 + 0.09 * brevity;
  const at = t.indexOf(s);
  if (at > 0) {
    const wordStart = /[\s\-_/.:]/.test(t[at - 1]);
    return (wordStart ? 0.7 : 0.5) + 0.09 * brevity;
  }
  let i = 0;
  for (const ch of t) {
    if (ch === s[i]) i++;
    if (i === s.length) return 0.1 + 0.09 * brevity;
  }
  return 0;
}

const ROOT = 'ui-command';
let uid = 0;

// shadcn's className on each Command part lands on the element that part
// renders (the command, its input, list, empty state, groups and items), so a
// class written on the host moves there, read once at first render. The
// hosts stay boxes rather than display: contents, since a group, an item and
// the empty state hide themselves through the hidden attribute, which a
// display utility on the host would override.
function takeAuthored(part: HTMLElement): string | null {
  return takeAuthoredClass(part, null);
}

type ItemState = { visible: boolean; selected: boolean; order: number };

export class UiCommand extends WebComponent({
  label: String,
  shouldFilter: prop(String, { attribute: 'should-filter' }),
  loop: Boolean,
  // The selected item's value.
  value: prop(String, { reflect: true }),
}) {
  readonly #search = signal('');
  _id = '';

  constructor() {
    super();
    this.label = '';
    this.shouldFilter = 'true';
    this.loop = false;
    this.value = '';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-command-${++uid}`;
  }

  // The ids exist once the root has connected. The server never connects an
  // element, so it serves none rather than a `-list` every box would share;
  // hydration renders them in.
  get listId(): string | null {
    return this._id ? `${this._id}-list` : null;
  }

  get labelId(): string | null {
    return this._id ? `${this._id}-label` : null;
  }

  // The root never hides itself, so its host can be display: contents: the
  // command box is then the flex item of whatever holds it, and a `max-w-sm`
  // with the box's `size-full` sizes against that parent, as shadcn's does.
  // The host's box is turned off through its style, which the server serves.
  render() {
    const authored = takeAuthored(this);
    if (typeof this.getAttribute === 'function' && !this.getAttribute('style')) this.setAttribute('style', 'display: contents');
    return html`<div data-slot="command" cmdk-root="" class=${cn(commandClass(), authored)} @keydown=${this._onKeyDown}>${this.label
      ? html`<label id=${this.labelId || nothing} cmdk-label="" class="sr-only">${this.label}</label>`
      : ''}<slot></slot></div>`;
  }

  // The parts that belong to this command, not to a command nested in it.
  _own<T extends Element>(selector: string): T[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<T>(selector)).filter((el) => el.closest(ROOT) === this);
  }

  /** The items currently shown, in the order they are shown. */
  visibleItems(): UiCommandItem[] {
    return this._own<UiCommandItem>(`${ROOT}-item`)
      .filter((i) => i.state?.get().visible)
      .sort((a, b) => a.state?.get().order - b.state?.get().order);
  }

  /** Set the search text, as typing does. */
  setSearch(search: string): void {
    if (search === this.#search.get()) return;
    this.#search.set(search);
    this.dispatchEvent(new CustomEvent('ui-search-change', { bubbles: true, detail: { search } }));
    this.refresh(true);
  }

  /**
   * Re-rank and redraw the items. A new search selects the best match; a
   * redraw otherwise keeps the selection where it is when it is still shown.
   */
  refresh(reselect = false): void {
    const filter = this.shouldFilter !== 'false';
    const search = this.#search.get();
    const items = this._own<UiCommandItem>(`${ROOT}-item`);
    const scored = items.map((item, dom) => ({
      item,
      dom,
      score: filter ? commandScore(`${item.itemValue} ${item.keywords ?? ''}`, search) : 1,
    }));
    const ranked = search && filter
      ? scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.dom - b.dom)
      : scored;
    const rank = new Map(ranked.map((s, i) => [s.item, i]));
    // A group sits where its best item ranks.
    const groups = this._own<UiCommandGroup>(`${ROOT}-group`);
    const groupRank = new Map<UiCommandGroup, number>();
    for (const g of groups) {
      const ranks = items.filter((i) => i.closest(`${ROOT}-group`) === g && rank.has(i)).map((i) => rank.get(i) as number);
      groupRank.set(g, ranks.length ? Math.min(...ranks) : Infinity);
    }
    const sorting = !!search && filter;
    const visible = ranked.map((s) => s.item);
    const enabled = visible.filter((i) => !i.disabled);
    let selected = items.find((i) => i.itemValue === this.value && rank.has(i) && !i.disabled) ?? null;
    if (reselect || !selected) {
      selected = sorting
        ? enabled[0] ?? null
        : enabled.slice().sort((a, b) => items.indexOf(a) - items.indexOf(b))[0] ?? null;
    }
    for (const item of items) {
      const r = rank.get(item);
      item.state?.set({ visible: r !== undefined, selected: item === selected, order: sorting && r !== undefined ? r : items.indexOf(item) });
    }
    for (const g of groups) {
      const r = groupRank.get(g) ?? Infinity;
      g.shown?.set(r !== Infinity);
      g.order?.set(sorting && r !== Infinity ? r : 0);
    }
    for (const sep of this._own<UiCommandSeparator>(`${ROOT}-separator`)) sep.shown?.set(!search);
    for (const empty of this._own<UiCommandEmpty>(`${ROOT}-empty`)) empty.shown?.set(visible.length === 0);
    this._select(selected);
  }

  _select(item: UiCommandItem | null): void {
    const value = item?.itemValue ?? '';
    for (const i of this._own<UiCommandItem>(`${ROOT}-item`)) {
      if (i.state?.get().selected !== (i === item)) i.state?.set({ ...i.state?.get(), selected: i === item });
    }
    const input = this._own<UiCommandInput>(`${ROOT}-input`)[0];
    if (input) input.activeId?.set(item?.optionId ?? '');
    item?.scrollIntoViewIfShown?.();
    if (value !== this.value) {
      this.value = value;
      this.dispatchEvent(new CustomEvent('ui-value-change', { bubbles: true, detail: { value } }));
    }
  }

  /** Move the selection to an item (used by pointing). */
  selectItem(item: UiCommandItem): void {
    if (item.disabled || !item.state?.get().visible) return;
    this._select(item);
  }

  /** Run an item: fire its ui-select, and follow a link it holds. */
  run(item: UiCommandItem | null): void {
    if (!item || item.disabled) return;
    const ok = item.dispatchEvent(new CustomEvent('ui-select', { bubbles: true, cancelable: true, detail: { value: item.itemValue } }));
    if (!ok) return;
    item.querySelector<HTMLAnchorElement>('a[href]')?.click();
  }

  _move(by: number | 'first' | 'last'): void {
    const enabled = this.visibleItems().filter((i) => !i.disabled);
    if (!enabled.length) return;
    const at = enabled.findIndex((i) => i.state?.get().selected);
    let next: number;
    if (by === 'first') next = 0;
    else if (by === 'last') next = enabled.length - 1;
    else {
      next = at + by;
      if (this.loop) next = (next + enabled.length) % enabled.length;
      else next = Math.max(0, Math.min(enabled.length - 1, next));
    }
    this._select(enabled[next]);
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.isComposing) return;
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === 'ArrowDown' || (ctrl && (e.key === 'n' || e.key === 'j'))) { e.preventDefault(); this._move(1); }
    else if (e.key === 'ArrowUp' || (ctrl && (e.key === 'p' || e.key === 'k'))) { e.preventDefault(); this._move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); this._move('first'); }
    else if (e.key === 'End') { e.preventDefault(); this._move('last'); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      this.run(this.visibleItems().find((i) => i.state?.get().selected) ?? null);
    }
  };

  // Parts connected after the first render (a client render appends children
  // in order) are ranked once they are all in place.
  _partConnected(): void {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => { this._queued = false; this.refresh(); });
  }

  _queued = false;
}
UiCommand.register('ui-command');

// --------------------------------------------------------------------------
// <ui-command-input>
// --------------------------------------------------------------------------

export class UiCommandInput extends WebComponent({
  placeholder: String,
}) {
  readonly activeId = signal('');
  constructor() {
    super();
    this.placeholder = '';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._root()?._partConnected();
  }

  _root(): UiCommand | null {
    return this.closest(ROOT) as UiCommand | null;
  }

  render() {
    const root = this._root();
    const named = root?.label ? root.labelId || nothing : nothing;
    return html`<div data-slot="command-input-wrapper" cmdk-input-wrapper="" class=${commandInputWrapperClass()}><div
      data-slot="input-group" class=${cn(inputGroupClass(), commandInputGroupClass())}
    ><input
      data-slot="command-input"
      cmdk-input=""
      type="text"
      role="combobox"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      aria-autocomplete="list"
      aria-expanded="true"
      aria-controls=${root?.listId || nothing}
      aria-labelledby=${named}
      aria-label=${named ? nothing : this.getAttribute?.('aria-label') || this.placeholder || nothing}
      aria-activedescendant=${this.activeId.get() || nothing}
      placeholder=${this.placeholder || nothing}
      class=${cn(commandInputClass(), takeAuthored(this))}
      @input=${this._onInput}
    ><div data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass()}><svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      class=${commandInputIconClass()}
    ><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg></div></div></div>`;
  }

  _onInput = (e: Event): void => {
    this._root()?.setSearch((e.target as HTMLInputElement).value);
  };
}
UiCommandInput.register('ui-command-input');

// --------------------------------------------------------------------------
// <ui-command-list>
// --------------------------------------------------------------------------

export class UiCommandList extends WebComponent {
  render() {
    const root = this.closest?.(ROOT) as UiCommand | null;
    return html`<div
      data-slot="command-list"
      cmdk-list=""
      role="listbox"
      id=${root?.listId || nothing}
      aria-label=${this.getAttribute?.('aria-label') || 'Suggestions'}
      class=${cn(commandListClass(), takeAuthored(this))}
    ><slot></slot></div>`;
  }
}
UiCommandList.register('ui-command-list');

// --------------------------------------------------------------------------
// <ui-command-empty>
// --------------------------------------------------------------------------

export class UiCommandEmpty extends WebComponent {
  readonly shown = signal(false);
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    (this.closest(ROOT) as UiCommand | null)?._partConnected();
  }

  render() {
    return html`<div data-slot="command-empty" cmdk-empty="" role="presentation" ?hidden=${!this.shown.get()} class=${cn(commandEmptyClass(), takeAuthored(this))}><slot></slot></div>`;
  }
}
UiCommandEmpty.register('ui-command-empty');

// --------------------------------------------------------------------------
// <ui-command-group>
// --------------------------------------------------------------------------

export class UiCommandGroup extends WebComponent({
  heading: String,
}) {
  readonly shown = signal(true);
  readonly order = signal(0);
  _id = '';

  constructor() {
    super();
    this.heading = '';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-command-group-${++uid}`;
    (this.closest(ROOT) as UiCommand | null)?._partConnected();
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    this.style.order = this.order.get() ? String(this.order.get()) : '';
    this.hidden = !this.shown.get();
  }

  render() {
    // No id before connect (the server never connects an element), so the
    // served group is named by aria-label instead of a shared `-heading` id.
    const headingId = this.heading && this._id ? `${this._id}-heading` : nothing;
    return html`<div data-slot="command-group" cmdk-group="" role="presentation" class=${cn(commandGroupClass(), takeAuthored(this))}>${this.heading
      ? html`<div cmdk-group-heading="" aria-hidden="true" id=${headingId}>${this.heading}</div>`
      : ''}<div cmdk-group-items="" role="group" aria-labelledby=${headingId} aria-label=${this.heading && !headingId ? this.heading : nothing} class="flex flex-col"><slot></slot></div></div>`;
  }
}
UiCommandGroup.register('ui-command-group');

// --------------------------------------------------------------------------
// <ui-command-separator>
// --------------------------------------------------------------------------

export class UiCommandSeparator extends WebComponent {
  readonly shown = signal(true);
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    (this.closest(ROOT) as UiCommand | null)?._partConnected();
  }

  render() {
    return html`<div data-slot="command-separator" cmdk-separator="" role="separator" ?hidden=${!this.shown.get()} class=${commandSeparatorClass()}></div>`;
  }
}
UiCommandSeparator.register('ui-command-separator');

// --------------------------------------------------------------------------
// <ui-command-item>
// --------------------------------------------------------------------------

export class UiCommandItem extends WebComponent({
  value: String,
  keywords: String,
  disabled: Boolean,
  checked: Boolean,
}) {
  readonly state = signal<ItemState>({ visible: true, selected: false, order: 0 });
  _id = '';

  constructor() {
    super();
    this.value = '';
    this.keywords = '';
    this.disabled = false;
    this.checked = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-command-item-${++uid}`;
    (this.closest(ROOT) as UiCommand | null)?._partConnected();
  }

  get optionId(): string {
    return `${this._id}-option`;
  }

  /** The item's value: its `value` attribute, else its text. */
  get itemValue(): string {
    if (this.value) return this.value;
    const text = this.querySelector?.('[data-slot="command-item"]')?.textContent ?? this.textContent ?? '';
    return text.trim();
  }

  scrollIntoViewIfShown(): void {
    const option = this.querySelector?.<HTMLElement>('[data-slot="command-item"]');
    if (option && typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    const { order, visible } = this.state.get();
    this.style.order = order ? String(order) : '';
    this.hidden = !visible;
  }

  render() {
    const s = this.state.get();
    return html`<div
      data-slot="command-item"
      cmdk-item=""
      role="option"
      id=${this._id ? this.optionId : nothing}
      aria-selected=${s.selected ? 'true' : 'false'}
      data-selected=${s.selected ? 'true' : 'false'}
      aria-disabled=${this.disabled ? 'true' : nothing}
      data-disabled=${this.disabled ? 'true' : 'false'}
      data-checked=${this.checked ? 'true' : nothing}
      data-value=${this.value || nothing}
      class=${cn(commandItemClass(), takeAuthored(this))}
      @pointermove=${this._onPointerMove}
      @click=${this._onClick}
    ><slot></slot><svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      class=${commandItemIndicatorClass()}
    ><path d="M20 6 9 17l-5-5"></path></svg></div>`;
  }

  _onPointerMove = (): void => {
    if (this.state.get().selected) return;
    (this.closest(ROOT) as UiCommand | null)?.selectItem(this);
  };

  _onClick = (e: Event): void => {
    // A click on a link inside follows it natively; run the item's event too.
    const root = this.closest(ROOT) as UiCommand | null;
    if (!root || this.disabled) return;
    const onLink = (e.target as Element).closest('a[href]');
    const ok = this.dispatchEvent(new CustomEvent('ui-select', { bubbles: true, cancelable: true, detail: { value: this.itemValue } }));
    if (!ok && onLink) e.preventDefault();
  };
}
UiCommandItem.register('ui-command-item');

// --------------------------------------------------------------------------
// <ui-command-shortcut>
// --------------------------------------------------------------------------

export class UiCommandShortcut extends WebComponent {
  // The span is the item's flex item, as shadcn's CommandShortcut is, so the
  // styles' `ml-auto` pushes it to the end of the row. A shortcut never hides
  // itself, so unlike the other parts its host can be display: contents,
  // turned off through its style, which the server serves.
  render() {
    const authored = takeAuthored(this);
    if (typeof this.getAttribute === 'function' && !this.getAttribute('style')) this.setAttribute('style', 'display: contents');
    return html`<span data-slot="command-shortcut" class=${cn(commandShortcutClass(), authored)}><slot></slot></span>`;
  }
}
UiCommandShortcut.register('ui-command-shortcut');

// --------------------------------------------------------------------------
// <ui-command-dialog>
// --------------------------------------------------------------------------

/**
 * A command in a native modal dialog: a `<ui-dialog>` whose content the
 * element renders itself, with a screen-reader title and description, around
 * the `<ui-command>` you put inside, as in shadcn's CommandDialog.
 */
export class UiCommandDialog extends UiDialog {
  static rootTag = 'ui-command-dialog';
  static contentTag = 'ui-command-dialog-content';
  static slotPrefix = 'dialog';

  // shadcn's CommandDialog passes its className to the DialogContent, so the
  // class written on this host goes to the content, which puts it on the panel.
  _authored: string | null = null;

  render() {
    this._authored = takeAuthoredClass(this, null);
    const title = this.getAttribute?.('title') || 'Command Palette';
    const description = this.getAttribute?.('description') || 'Search for a command to run...';
    const close = this.getAttribute?.('show-close-button') ?? 'false';
    return html`<div data-slot="dialog" data-state=${this.open ? 'open' : 'closed'}><ui-command-dialog-content
      show-close-button=${close} class=${this._authored}><h2 data-slot="dialog-title" class="sr-only">${title}</h2><p
      data-slot="dialog-description" class="sr-only">${description}</p><slot></slot></ui-command-dialog-content></div>`;
  }
}
UiCommandDialog.register('ui-command-dialog');

export class UiCommandDialogContent extends UiDialogContent {
  static rootTag = 'ui-command-dialog';
  static slotPrefix = 'dialog';

  _panelClass(): string {
    return cn(super._panelClass(), commandDialogClass());
  }
}
UiCommandDialogContent.register('ui-command-dialog-content');
