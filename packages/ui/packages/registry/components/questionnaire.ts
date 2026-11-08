/**
 * Questionnaire: a multi-step flow of questions over real form controls.
 * Tier-2. It is shadcn's Questionnaire (the headless primitive in
 * `@shadcn/react`, styled), built on a native `<form>`: each question is a
 * `<fieldset>`, each answer a real radio, checkbox or text input, and the
 * answers are read with `FormData` like any form.
 *
 * Without JavaScript every question shows at once and Submit posts the form,
 * with the browser's own `required` check. With JavaScript one question shows
 * at a time: Next validates it, Previous goes back, Skip leaves an optional
 * question unanswered, and Submit appears on the last one.
 *
 * shadcn parity:
 *   Questionnaire (shortcuts) → <ui-questionnaire shortcuts="letters" | "numbers" action method>
 *   Questionnaire item / defaultItem
 *                             → the `item` property and attribute (the active question,
 *                               settable from outside) / `default-item`
 *   Questionnaire render={<form action={…} />}
 *                             → <ui-questionnaire as-child> around your own <form>
 *   QuestionnaireProgress     → <ui-questionnaire-progress> ("Question 1 of 3")
 *   QuestionnaireItem (name, required, multiple, disabled)
 *                             → <ui-questionnaire-item name required multiple disabled>
 *   QuestionnaireTitle / Description
 *                             → <ui-questionnaire-title> / <ui-questionnaire-description>
 *   QuestionnaireChoices      → <ui-questionnaire-choices>
 *   QuestionnaireChoice value → <ui-questionnaire-choice value checked>
 *   QuestionnaireChoiceDescription
 *                             → <ui-questionnaire-choice-description>
 *   QuestionnaireInput        → <ui-questionnaire-input placeholder aria-label> (a freeform answer)
 *   QuestionnaireError        → <ui-questionnaire-error> (a default message when empty)
 *   QuestionnaireActions / Previous / Skip / Next / Submit (disabled)
 *                             → <ui-questionnaire-actions> / -previous / -skip / -next / -submit
 *                               (`variant` and `size` as on a button, and `disabled`)
 *   onActiveItemChange        → `ui-active-change` ({ detail: { name } })
 *
 * A question's answers share its `name`, so `FormData.get(name)` reads a
 * single answer and `getAll(name)` a `multiple` one. Typing a freeform answer
 * clears a single question's choices, and picking a choice clears the text.
 * A `disabled` question is left out of the flow (a conditional question).
 *
 * The active question is the `item` property (and attribute): set it from
 * outside to go to that question, and it follows the reader's own steps.
 * `default-item` names the question the flow opens on. A navigation button
 * written `disabled` cannot be pressed, and a disabled Next or Submit also
 * stops Enter from stepping on, as in shadcn.
 *
 * To bind a `'use server'` action, write the form yourself, the way a page
 * binds any action, and mark the questionnaire `as-child`:
 * `<ui-questionnaire as-child><form action=${saveAnswers} data-slot="questionnaire"
 * class=${questionnaireClass()}> ...questions and actions... </form></ui-questionnaire>`.
 * The element then renders no form of its own and drives yours, so the page's
 * binding (its hidden action field, `method="post"`) is served and kept, and
 * the form posts with JavaScript off. Without `as-child` the element renders
 * the form, with your `action` and `method` attributes as plain strings.
 *
 * Keyboard: Enter goes to the next question, and on the last one submits.
 * With `shortcuts`, a letter (A, B, C) or a number (1, 2, 3) picks the
 * matching answer, except while typing in a text field.
 *
 * A11y (handled by the element): each question is a `<fieldset>` named by its
 * title and described by its description, the progress is a
 * `role="progressbar"` with its value, a question left unanswered is marked
 * `aria-invalid` and its error announced with `role="alert"`, and a question
 * not on screen is `hidden` and `inert`.
 *
 * @example
 * ```html
 * <ui-questionnaire shortcuts="letters">
 *   <ui-questionnaire-progress></ui-questionnaire-progress>
 *   <ui-questionnaire-item name="direction" required>
 *     <ui-questionnaire-title>What should we prototype next?</ui-questionnaire-title>
 *     <ui-questionnaire-description>Choose a direction or write your own.</ui-questionnaire-description>
 *     <ui-questionnaire-choices>
 *       <ui-questionnaire-choice value="delegation">Delegation</ui-questionnaire-choice>
 *       <ui-questionnaire-choice value="questions">Question prompts</ui-questionnaire-choice>
 *       <ui-questionnaire-input aria-label="Another answer" placeholder="Type another answer"></ui-questionnaire-input>
 *     </ui-questionnaire-choices>
 *     <ui-questionnaire-error></ui-questionnaire-error>
 *   </ui-questionnaire-item>
 *   <ui-questionnaire-item name="detail">
 *     <ui-questionnaire-title>How much detail?</ui-questionnaire-title>
 *     <ui-questionnaire-choices>
 *       <ui-questionnaire-choice value="focused">Focused</ui-questionnaire-choice>
 *       <ui-questionnaire-choice value="complete">Complete flow</ui-questionnaire-choice>
 *     </ui-questionnaire-choices>
 *   </ui-questionnaire-item>
 *   <ui-questionnaire-actions>
 *     <ui-questionnaire-previous></ui-questionnaire-previous>
 *     <ui-questionnaire-skip></ui-questionnaire-skip>
 *     <ui-questionnaire-next></ui-questionnaire-next>
 *     <ui-questionnaire-submit></ui-questionnaire-submit>
 *   </ui-questionnaire-actions>
 * </ui-questionnaire>
 * ```
 */
import { WebComponent, html, prop, signal, nothing } from '@webjsdev/core';
import { cn, takeAuthoredClass } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

/** The form's classes (the element applies them). */
export const questionnaireClass = (): string => 'cn-questionnaire flex w-full min-w-0 flex-col';
/** The progress line (the element applies them). */
export const questionnaireProgressClass = (): string =>
  'cn-questionnaire-progress min-h-[1lh] w-fit min-w-[14ch] font-medium text-muted-foreground tabular-nums';
/** A question's fieldset (the element applies them). */
export const questionnaireItemClass = (): string => 'cn-questionnaire-item min-w-0 border-0 p-0 outline-none';
/** A question's title (the element applies them). */
// The styles space the title from what follows only when no description is its
// following sibling. Here the title and the description sit in their own part
// hosts, so they are never siblings, and the question is asked of the item
// instead: an item holding a description takes the margin back.
export const questionnaireTitleClass = (): string =>
  'cn-questionnaire-title cn-font-heading text-pretty [[data-slot=questionnaire-item]:has([data-slot=questionnaire-description])_&]:mb-0';
/** A question's description (the element applies them). */
export const questionnaireDescriptionClass = (): string =>
  'cn-questionnaire-description text-pretty text-muted-foreground';
/** The answers' box (the element applies them). */
export const questionnaireChoicesClass = (): string =>
  'cn-questionnaire-choices group/questionnaire-choices grid min-w-0';
/** One answer (the element applies them). */
export const questionnaireChoiceClass = (): string =>
  'cn-questionnaire-choice group/questionnaire-choice relative flex min-h-11 cursor-pointer items-start text-start transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';
/** An answer's description line. */
export const questionnaireChoiceDescriptionClass = (): string => 'cn-questionnaire-choice-description';
/** The freeform answer (the element applies them). */
export const questionnaireInputClass = (): string =>
  'cn-questionnaire-input min-h-11 w-full min-w-0 transition-[color,box-shadow,background-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground';
/** The error line (the element applies them). */
export const questionnaireErrorClass = (): string => 'cn-questionnaire-error text-destructive';
/** The actions row (the element applies them). */
export const questionnaireActionsClass = (): string =>
  'cn-questionnaire-actions grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center';

const ROOT = 'ui-questionnaire';
const ITEM = 'ui-questionnaire-item';
let uid = 0;

function rootOf(el: Element): UiQuestionnaire | null {
  return (typeof el.closest === 'function' ? el.closest(ROOT) : null) as UiQuestionnaire | null;
}

function itemOf(el: Element): UiQuestionnaireItem | null {
  return (typeof el.closest === 'function' ? el.closest(ITEM) : null) as UiQuestionnaireItem | null;
}

// shadcn's className on each questionnaire part lands on the element that part
// renders, and no host draws a box of its own: the rendered elements are the
// flex and grid items the styles space (a hidden question's fieldset drops out
// of the form's gap, a button's column placement reaches the actions grid).
// No host hides itself, since every part hides its rendered element. The
// host's box is turned off through its style, which the server serves, unlike
// a class the element changes.
function takeAuthored(part: HTMLElement): string | null {
  if (!part.getAttribute?.('style')) part.setAttribute?.('style', 'display: contents');
  return takeAuthoredClass(part, null);
}

// A part connected after the root's first update asks it to push its state.
function announce(el: Element): void {
  const root = rootOf(el);
  if (root) root._partConnected();
}

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.matches !== 'function') return false;
  return el.matches('textarea, input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit])');
}

// --------------------------------------------------------------------------
// <ui-questionnaire>
// --------------------------------------------------------------------------

export class UiQuestionnaire extends WebComponent({
  action: String,
  method: String,
  shortcuts: prop<'' | 'letters' | 'numbers'>(String),
  // The active question, by name: set it to go there.
  item: String,
  // The question the flow opens on.
  defaultItem: prop(String, { attribute: 'default-item' }),
  // Drive the author's own <form> instead of rendering one.
  asChild: prop(Boolean, { attribute: 'as-child' }),
}) {
  readonly #enhanced = signal(false);
  readonly #active = signal('');
  _queued = false;

  constructor() {
    super();
    this.action = '';
    this.method = '';
    this.shortcuts = '';
    this.item = '';
    this.defaultItem = '';
    this.asChild = false;
  }

  // The listeners sit on the host, which every event from the form reaches,
  // so they serve the element's own form and an author's `as-child` one alike.
  connectedCallback(): void {
    super.connectedCallback?.();
    this.addEventListener('submit', this._onSubmit);
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('change', this._onChange);
    this.addEventListener('input', this._onChange);
    this._partConnected();
  }

  disconnectedCallback(): void {
    this.removeEventListener('submit', this._onSubmit);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('input', this._onChange);
    super.disconnectedCallback?.();
  }

  render() {
    if (this.asChild) {
      // The author's form is the questionnaire; this host only drives it.
      if (typeof this.getAttribute === 'function' && !this.getAttribute('style')) this.setAttribute('style', 'display: contents');
      return html`<slot></slot>`;
    }
    return html`<form
      data-slot="questionnaire"
      action=${this.action || nothing}
      method=${this.method || nothing}
      ?novalidate=${this.#enhanced.get()}
      data-shortcuts=${this.shortcuts || nothing}
      class=${cn(questionnaireClass(), takeAuthored(this))}
    ><slot></slot></form>`;
  }

  /** The form the questionnaire runs on: its own, or the author's under `as-child`. */
  form(): HTMLFormElement | null {
    if (typeof this.querySelector !== 'function') return null;
    return this.querySelector('form');
  }

  willUpdate(changedProperties: Map<string, unknown>): void {
    super.willUpdate?.(changedProperties);
    // The active question set from outside: go there, with no validation, as
    // a controlled shadcn Questionnaire does.
    if (changedProperties.has('item') && this.#enhanced.get() && this.item && this.item !== this.#active.get()) {
      const target = this.items().find((i) => i.name === this.item);
      if (target) queueMicrotask(() => this._go(target, { focus: false }));
    }
  }

  _partConnected(): void {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      this._enhance();
      this.sync();
    });
  }

  _enhance(): void {
    if (this.#enhanced.get()) return;
    const items = this.items();
    const wanted = this.item || this.defaultItem;
    const first = items.find((i) => i.name === wanted) ?? items[0];
    if (!first) return;
    this.#active.set(first.name);
    this.item = first.name;
    this.#enhanced.set(true);
    // An author's form validates per question from here, as the element's own does.
    if (this.asChild) {
      const form = this.form();
      if (form) {
        form.noValidate = true;
        if (this.shortcuts) form.setAttribute('data-shortcuts', this.shortcuts);
      }
    }
  }

  /** The questions in the flow, in order: every one not `disabled`. */
  items(): UiQuestionnaireItem[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<UiQuestionnaireItem>(ITEM)).filter((i) => rootOf(i) === this && !i.disabled);
  }

  _activeItem(): UiQuestionnaireItem | null {
    const items = this.items();
    return items.find((i) => i.name === this.#active.get()) ?? items[0] ?? null;
  }

  /** Whether a question has an answer: a checked choice or a filled text field. */
  answered(item: UiQuestionnaireItem): boolean {
    return item.inputs().some((i) => (i.type === 'radio' || i.type === 'checkbox' ? i.checked : i.value.trim() !== ''));
  }

  /** Push the active question, its neighbours and every answer into the parts. */
  sync(): void {
    const items = this.items();
    const item = this._activeItem();
    const at = item ? items.indexOf(item) : -1;
    const last = at === items.length - 1;
    for (const i of this._all(ITEM) as UiQuestionnaireItem[]) {
      i.flow?.set({ enhanced: this.#enhanced.get(), active: i === item });
    }
    for (const c of this._all('ui-questionnaire-choice') as UiQuestionnaireChoice[]) c._syncChecked();
    for (const p of this._all('ui-questionnaire-progress') as UiQuestionnaireProgress[]) {
      p.progress?.set({ current: at + 1, total: items.length });
    }
    const show = (tag: string, visible: boolean) => {
      for (const b of this._all(tag) as UiQuestionnaireButton[]) b.visible?.set(visible);
    };
    if (!this.#enhanced.get()) {
      show('ui-questionnaire-previous', false);
      show('ui-questionnaire-skip', false);
      show('ui-questionnaire-next', false);
      show('ui-questionnaire-submit', true);
      return;
    }
    show('ui-questionnaire-previous', at > 0);
    show('ui-questionnaire-skip', !!item && !item.required);
    show('ui-questionnaire-next', items.length > 1 && !last);
    show('ui-questionnaire-submit', items.length > 0 && last);
  }

  _all(tag: string): Element[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll(tag)).filter((el) => rootOf(el) === this);
  }

  _go(item: UiQuestionnaireItem | undefined, opts: { focus?: boolean } = {}): void {
    if (!item) return;
    if (item.name !== this.#active.get()) {
      this.#active.set(item.name);
      this.item = item.name;
      this.dispatchEvent(new CustomEvent('ui-active-change', { bubbles: true, detail: { name: item.name } }));
    }
    this.sync();
    // Focus the new question's first answer once it is shown.
    if (opts.focus === false) return;
    this.updateComplete.then(() => requestAnimationFrame(() => item.inputs().find((i) => !i.disabled)?.focus()));
  }

  // Whether every button of a kind is written `disabled` (and there is one).
  _allDisabled(tag: string): boolean {
    const buttons = this._all(tag) as UiQuestionnaireButton[];
    return buttons.length > 0 && buttons.every((b) => b.disabled);
  }

  /** Check the active question; mark it and return false when it needs an answer. */
  validate(item = this._activeItem()): boolean {
    if (!item) return true;
    const ok = !item.required || this.answered(item);
    item.invalid?.set(!ok);
    if (!ok) item.inputs().find((i) => !i.disabled)?.focus();
    return ok;
  }

  /** Go to the next question, if the active one is answered or optional. */
  next(): void {
    const items = this.items();
    const item = this._activeItem();
    if (!item || !this.validate(item)) return;
    this._go(items[items.indexOf(item) + 1]);
  }

  /** Go back one question. */
  previous(): void {
    const items = this.items();
    const item = this._activeItem();
    if (!item) return;
    this._go(items[items.indexOf(item) - 1]);
  }

  /** Leave an optional question unanswered and go on. */
  skip(): void {
    const item = this._activeItem();
    if (!item || item.required) return;
    for (const i of item.inputs()) {
      if (i.type === 'radio' || i.type === 'checkbox') i.checked = false;
      else i.value = '';
    }
    item.invalid?.set(false);
    const items = this.items();
    const after = items[items.indexOf(item) + 1];
    if (after) this._go(after);
    else this.sync();
  }

  // Enter in the form, and the Submit button, both arrive here.
  _onSubmit = (e: Event): void => {
    if (!this.#enhanced.get() || (e.target as Element | null)?.closest?.(ROOT) !== this) return;
    const items = this.items();
    const item = this._activeItem();
    if (item && items.indexOf(item) < items.length - 1) {
      e.preventDefault();
      // Enter steps on only while Next can be pressed.
      if (!this._allDisabled('ui-questionnaire-next')) this.next();
      return;
    }
    // On the last question every required one must be answered.
    const missing = items.find((i) => i.required && !this.answered(i));
    if (missing) {
      e.preventDefault();
      if (missing !== item) this._go(missing);
      this.validate(missing);
    }
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    if (!this.#enhanced.get() || !this.shortcuts || rootOf(e.target as Element) !== this || e.metaKey || e.ctrlKey || e.altKey || isTextEntry(e.target)) return;
    const item = this._activeItem();
    if (!item) return;
    const choices = item.choices();
    const k = e.key.toLowerCase();
    const index = this.shortcuts === 'numbers' ? Number(k) - 1 : k.length === 1 ? k.charCodeAt(0) - 97 : -1;
    const choice = Number.isInteger(index) && index >= 0 ? choices[index] : undefined;
    const input = choice?.input();
    if (!input || input.disabled) return;
    e.preventDefault();
    input.checked = input.type === 'checkbox' ? !input.checked : true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // A pick or a keystroke: keep a single question's choices and text apart,
  // clear its error once it is answered, and redraw.
  _onChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    const item = itemOf(target);
    if (!item || rootOf(item) !== this) return;
    if (!item.multiple) {
      if (target.matches?.('[data-slot="questionnaire-input"]') && target.value.trim()) {
        for (const i of item.inputs()) if (i.type === 'radio') i.checked = false;
      } else if (target.type === 'radio' && target.checked) {
        for (const i of item.inputs()) if (i.matches('[data-slot="questionnaire-input"]')) i.value = '';
      }
    }
    if (item.invalid?.get() && this.answered(item)) item.invalid?.set(false);
    this.sync();
  };
}
UiQuestionnaire.register('ui-questionnaire');

// --------------------------------------------------------------------------
// <ui-questionnaire-progress>
// --------------------------------------------------------------------------

export class UiQuestionnaireProgress extends WebComponent {
  readonly progress = signal<{ current: number; total: number }>({ current: 0, total: 0 });
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const { current, total } = this.progress.get();
    const label = total ? `Question ${current} of ${total}` : '';
    return html`<div
      data-slot="questionnaire-progress"
      role="progressbar"
      aria-label="Questionnaire progress"
      aria-live="polite"
      aria-valuemin=${total ? '1' : nothing}
      aria-valuemax=${total ? String(total) : nothing}
      aria-valuenow=${total ? String(current) : nothing}
      aria-valuetext=${label || nothing}
      class=${cn(questionnaireProgressClass(), takeAuthored(this))}
    >${label}</div>`;
  }
}
UiQuestionnaireProgress.register('ui-questionnaire-progress');

// --------------------------------------------------------------------------
// <ui-questionnaire-item>
// --------------------------------------------------------------------------

export class UiQuestionnaireItem extends WebComponent({
  name: String,
  required: Boolean,
  multiple: Boolean,
  disabled: Boolean,
}) {
  readonly flow = signal<{ enhanced: boolean; active: boolean }>({ enhanced: false, active: false });
  // The item's error line reads this signal, so it redraws when it changes.
  readonly invalid = signal(false);
  _id = '';

  constructor() {
    super();
    this.name = '';
    this.required = false;
    this.multiple = false;
    this.disabled = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-questionnaire-item-${++uid}`;
    announce(this);
  }

  get titleId(): string {
    return `${this._id}-title`;
  }

  get descriptionId(): string {
    return `${this._id}-description`;
  }

  get errorId(): string {
    return `${this._id}-error`;
  }

  /** The question's answer controls: its choices' inputs and its text field. */
  inputs(): HTMLInputElement[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<HTMLInputElement>('input[data-slot="questionnaire-choice-input"], input[data-slot="questionnaire-input"]'))
      .filter((i) => itemOf(i) === this);
  }

  /** The question's choices, in order. */
  choices(): UiQuestionnaireChoice[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<UiQuestionnaireChoice>('ui-questionnaire-choice')).filter((c) => itemOf(c) === this);
  }

  /** Whether the item holds a `tag` part, or false on the server, where there is no DOM to query. */
  _has(tag: string): boolean {
    return typeof this.querySelector === 'function' && !!this.querySelector(tag);
  }

  render() {
    const flow = this.flow.get();
    const hide = flow.enhanced && !flow.active;
    const hasTitle = this._has('ui-questionnaire-title');
    const hasDescription = this._has('ui-questionnaire-description');
    const described = [hasDescription ? this.descriptionId : '', this.invalid.get() ? this.errorId : ''].filter(Boolean).join(' ');
    return html`<fieldset
      data-slot="questionnaire-item"
      ?disabled=${this.disabled}
      ?data-active=${flow.active}
      ?hidden=${hide}
      ?inert=${hide}
      aria-labelledby=${hasTitle && this._id ? this.titleId : nothing}
      aria-describedby=${described || nothing}
      aria-invalid=${this.invalid.get() ? 'true' : nothing}
      class=${cn(questionnaireItemClass(), takeAuthored(this))}
    ><slot></slot></fieldset>`;
  }
}
UiQuestionnaireItem.register('ui-questionnaire-item');

// --------------------------------------------------------------------------
// <ui-questionnaire-title> and <ui-questionnaire-description>
// --------------------------------------------------------------------------

export class UiQuestionnaireTitle extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const item = itemOf(this);
    return html`<legend data-slot="questionnaire-title" id=${item?._id ? item.titleId : nothing} class=${cn(questionnaireTitleClass(), takeAuthored(this))}><slot></slot></legend>`;
  }
}
UiQuestionnaireTitle.register('ui-questionnaire-title');

export class UiQuestionnaireDescription extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const item = itemOf(this);
    return html`<p data-slot="questionnaire-description" id=${item?._id ? item.descriptionId : nothing} class=${cn(questionnaireDescriptionClass(), takeAuthored(this))}><slot></slot></p>`;
  }
}
UiQuestionnaireDescription.register('ui-questionnaire-description');

// --------------------------------------------------------------------------
// <ui-questionnaire-choices>, <ui-questionnaire-choice>, -choice-description
// --------------------------------------------------------------------------

export class UiQuestionnaireChoices extends WebComponent {
  render() {
    return html`<div data-slot="questionnaire-choices" class=${cn(questionnaireChoicesClass(), takeAuthored(this))}><slot></slot></div>`;
  }
}
UiQuestionnaireChoices.register('ui-questionnaire-choices');

export class UiQuestionnaireChoice extends WebComponent({
  value: String,
  checked: Boolean,
  disabled: Boolean,
}) {
  readonly #live = signal(false);
  #seeded = false;
  constructor() {
    super();
    this.value = '';
    this.checked = false;
    this.disabled = false;
  }

  // Seed the drawn state from `checked` here, not in connectedCallback: SSR
  // runs willUpdate but never connects, and a pre-checked choice has to be
  // drawn checked in the first paint and with JavaScript off.
  willUpdate(changedProperties: Map<string, unknown>): void {
    super.willUpdate?.(changedProperties);
    if (!this.#seeded || changedProperties.has('checked')) {
      this.#seeded = true;
      this.#live.set(this.checked);
    }
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  input(): HTMLInputElement | null {
    return this.querySelector?.('input[data-slot="questionnaire-choice-input"]') ?? null;
  }

  _syncChecked(): void {
    const on = !!this.input()?.checked;
    if (on !== this.#live.get()) this.#live.set(on);
    this.requestUpdate?.();
  }

  // This choice's shortcut key, from its place in the question.
  _shortcut(): string {
    const mode = rootOf(this)?.shortcuts;
    const item = itemOf(this);
    if (!mode || !item) return '';
    const i = item.choices().indexOf(this);
    if (i < 0) return '';
    if (mode === 'numbers') return i < 9 ? String(i + 1) : '';
    return i < 26 ? String.fromCharCode(97 + i) : '';
  }

  render() {
    const item = itemOf(this);
    const type = item?.multiple ? 'checkbox' : 'radio';
    const shortcut = this._shortcut();
    const disabled = this.disabled || !!item?.disabled;
    return html`<label
      data-slot="questionnaire-choice"
      data-type=${type}
      ?data-checked=${this.#live.get()}
      ?data-unchecked=${!this.#live.get()}
      ?data-disabled=${disabled}
      data-shortcut=${shortcut || nothing}
      class=${cn(questionnaireChoiceClass(), takeAuthored(this))}
    ><input
      data-slot="questionnaire-choice-input"
      type=${type}
      name=${item?.name || nothing}
      value=${this.value}
      ?checked=${this.checked}
      ?disabled=${disabled}
      ?required=${!!item?.required && type === 'radio'}
      aria-keyshortcuts=${shortcut ? shortcut.toUpperCase() : nothing}
      class="cn-questionnaire-choice-input absolute inset-0 z-10 size-full cursor-pointer opacity-0"
    ><span aria-hidden="true" data-slot="questionnaire-choice-indicator"
      class="cn-questionnaire-choice-indicator pointer-events-none relative flex shrink-0 items-center justify-center border group-data-[type=radio]/questionnaire-choice:rounded-full"
    ><span data-slot="questionnaire-choice-indicator-dot"
      class="cn-questionnaire-choice-indicator-dot hidden rounded-full group-data-[type=checkbox]/questionnaire-choice:hidden group-data-[checked]/questionnaire-choice:block"
    ></span><svg data-slot="questionnaire-choice-indicator-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class="cn-questionnaire-choice-indicator-check hidden group-data-[type=radio]/questionnaire-choice:hidden group-data-[checked]/questionnaire-choice:block"
    ><path d="M20 6 9 17l-5-5"></path></svg></span><span data-slot="questionnaire-choice-label"
      class="cn-questionnaire-choice-label cn-questionnaire-choice-content flex min-w-0 flex-1 flex-col leading-snug"
    ><slot></slot></span><span data-slot="questionnaire-choice-shortcut" aria-hidden="true" ?hidden=${!shortcut}
      class="cn-questionnaire-choice-shortcut cn-questionnaire-shortcut pointer-events-none ms-auto hidden shrink-0 group-data-[shortcut]/questionnaire-choice:inline-flex"
    >${shortcut.toUpperCase()}</span></label>`;
  }
}
UiQuestionnaireChoice.register('ui-questionnaire-choice');

export class UiQuestionnaireChoiceDescription extends WebComponent {
  render() {
    return html`<span data-slot="questionnaire-choice-description" class=${cn(questionnaireChoiceDescriptionClass(), takeAuthored(this))}><slot></slot></span>`;
  }
}
UiQuestionnaireChoiceDescription.register('ui-questionnaire-choice-description');

// --------------------------------------------------------------------------
// <ui-questionnaire-input>
// --------------------------------------------------------------------------

export class UiQuestionnaireInput extends WebComponent({
  placeholder: String,
}) {
  constructor() {
    super();
    this.placeholder = '';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const item = itemOf(this);
    return html`<div data-slot="questionnaire-input-wrapper" class=${cn('cn-questionnaire-input-wrapper group/questionnaire-input relative min-w-0', takeAuthored(this))}><input
      data-slot="questionnaire-input"
      type="text"
      name=${item?.name || nothing}
      placeholder=${this.placeholder || nothing}
      aria-label=${this.getAttribute?.('aria-label') || nothing}
      ?disabled=${!!item?.disabled}
      class=${questionnaireInputClass()}
    ></div>`;
  }
}
UiQuestionnaireInput.register('ui-questionnaire-input');

// --------------------------------------------------------------------------
// <ui-questionnaire-error>
// --------------------------------------------------------------------------

export class UiQuestionnaireError extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const item = itemOf(this);
    const invalid = !!item?.invalid?.get();
    const fallback = item?.required ? 'Choose an answer to continue.' : 'Choose an answer or skip this question.';
    return html`<p
      data-slot="questionnaire-error"
      id=${item?._id ? item.errorId : nothing}
      ?hidden=${!invalid}
      role=${invalid ? 'alert' : nothing}
      class=${cn(questionnaireErrorClass(), takeAuthored(this))}
    ><slot>${fallback}</slot></p>`;
  }
}
UiQuestionnaireError.register('ui-questionnaire-error');

// --------------------------------------------------------------------------
// <ui-questionnaire-actions> and the four buttons
// --------------------------------------------------------------------------

export class UiQuestionnaireActions extends WebComponent {
  render() {
    return html`<div data-slot="questionnaire-actions" class=${cn(questionnaireActionsClass(), takeAuthored(this))}><slot></slot></div>`;
  }
}
UiQuestionnaireActions.register('ui-questionnaire-actions');

/** What the four navigation buttons share. */
export class UiQuestionnaireButton extends WebComponent({
  variant: String,
  size: String,
  // Written by the author, as shadcn's `disabled` on a navigation button.
  disabled: Boolean,
}) {
  static part = '';
  static label = '';
  static place = '';
  static submits = false;
  static defaultVariant = 'outline';

  // Submit shows from the first paint; the others wait for the flow.
  readonly visible = signal((this.constructor as typeof UiQuestionnaireButton).submits);

  constructor() {
    super();
    const ctor = this.constructor as typeof UiQuestionnaireButton;
    this.variant = ctor.defaultVariant;
    this.size = 'default';
    this.disabled = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    const ctor = this.constructor as typeof UiQuestionnaireButton;
    return html`<button
      type=${ctor.submits ? 'submit' : 'button'}
      data-slot=${`questionnaire-${ctor.part}`}
      data-size=${this.size}
      data-variant=${this.variant}
      ?hidden=${!this.visible.get()}
      ?disabled=${this.disabled}
      aria-hidden=${this.visible.get() ? nothing : 'true'}
      aria-keyshortcuts=${this.visible.get() && !this.disabled && (ctor.part === 'next' || ctor.part === 'submit') ? 'Enter' : nothing}
      class=${cn(buttonClass({ variant: this.variant as ButtonVariant, size: this.size as ButtonSize }), ctor.place, takeAuthored(this))}
      @click=${this._onClick}
    ><slot>${ctor.label}</slot></button>`;
  }

  _onClick = (): void => {};
}

export class UiQuestionnairePrevious extends UiQuestionnaireButton {
  static part = 'previous';
  static label = 'Previous';
  static place = 'cn-questionnaire-previous col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0';
  _onClick = (): void => rootOf(this)?.previous();
}
UiQuestionnairePrevious.register('ui-questionnaire-previous');

export class UiQuestionnaireSkip extends UiQuestionnaireButton {
  static part = 'skip';
  static label = 'Skip';
  static place = 'cn-questionnaire-skip col-start-2 row-start-1 min-h-11 justify-self-end sm:min-h-0';
  _onClick = (): void => rootOf(this)?.skip();
}
UiQuestionnaireSkip.register('ui-questionnaire-skip');

export class UiQuestionnaireNext extends UiQuestionnaireButton {
  static part = 'next';
  static label = 'Next';
  static place = 'cn-questionnaire-next col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0';
  static defaultVariant = 'default';
  _onClick = (): void => rootOf(this)?.next();
}
UiQuestionnaireNext.register('ui-questionnaire-next');

export class UiQuestionnaireSubmit extends UiQuestionnaireButton {
  static part = 'submit';
  static label = 'Submit';
  static place = 'cn-questionnaire-submit col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0';
  static submits = true;
  static defaultVariant = 'default';
}
UiQuestionnaireSubmit.register('ui-questionnaire-submit');
