import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Form primitives + a `FormController` ReactiveController that replaces
 * `react-hook-form` for shadcn-parity state management.
 *
 * Layout components (`<ui-form>` and friends) are framework-agnostic web
 * components — they work in any project that has `@webjskit/core` on the
 * page. The only dependency is the ReactiveController protocol exposed by
 * `WebComponent` (see `@webjskit/core/src/component.js`).
 *
 *   <ui-form>
 *     <script type="module">
 *       import { FormController } from '/components/ui/form.ts';
 *       import { z } from 'zod';
 *       const form = document.querySelector('ui-form');
 *       form.formController = new FormController(form, {
 *         defaultValues: { email: '', password: '' },
 *         validate: (v) => z.object({
 *           email: z.string().email(),
 *           password: z.string().min(8),
 *         }).safeParse(v).error?.flatten().fieldErrors as any,
 *         onSubmit: async (v) => {
 *           await fetch('/api/login', { method: 'POST', body: JSON.stringify(v) });
 *         },
 *       });
 *     </script>
 *     <ui-form-field name="email">
 *       <ui-form-label>Email</ui-form-label>
 *       <ui-form-control><ui-input type="email" name="email"></ui-input></ui-form-control>
 *       <ui-form-message></ui-form-message>
 *     </ui-form-field>
 *     <ui-form-field name="password">
 *       <ui-form-label>Password</ui-form-label>
 *       <ui-form-control><ui-input type="password" name="password"></ui-input></ui-form-control>
 *       <ui-form-message></ui-form-message>
 *     </ui-form-field>
 *     <ui-button type="submit">Sign in</ui-button>
 *   </ui-form>
 *
 * Field components find the closest `<ui-form>` ancestor and pull its
 * `.formController`. The controller registers each field by name (read
 * from the field's `name` attribute) and wires `input` / `blur`
 * listeners on the inner native control. Re-renders are driven by the
 * controller calling `host.requestUpdate()` and broadcasting a
 * `ui-form-state-change` event so message components refresh.
 *
 * v2 features (implemented):
 *   - Nested / array keys (`addresses.0.street`, `tags.1`) via small
 *     lodash-free getPath / setPath helpers.
 *   - Per-field async validators (`register(name, { asyncValidate })`),
 *     debounced 200ms, run on blur, surface a `pending` state while
 *     resolving.
 *   - `submitCount` counter — incremented by `handleSubmit()` so call
 *     sites can show errors only after the first submit attempt.
 */

// ---------------------------------------------------------------------------
// Path helpers — minimal lodash get/set replacements
// ---------------------------------------------------------------------------

/** Split `"addresses.0.street"` → `['addresses', '0', 'street']`. */
function pathParts(path: string): string[] {
  return String(path).split('.').filter((p) => p.length > 0);
}

/** Read a nested value by dotted path; returns `undefined` when missing. */
function getPath(obj: any, path: string): any {
  if (obj == null) return undefined;
  const parts = pathParts(path);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Immutably set a nested value by dotted path; numeric keys mint arrays. */
function setPath(obj: any, path: string, value: any): any {
  const parts = pathParts(path);
  if (!parts.length) return value;
  const root = Array.isArray(obj) ? obj.slice() : { ...(obj || {}) };
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    const existing = cur[key];
    let next: any;
    if (Array.isArray(existing)) next = existing.slice();
    else if (existing && typeof existing === 'object') next = { ...existing };
    else next = nextIsIndex ? [] : {};
    cur[key] = next;
    cur = next;
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

// ---------------------------------------------------------------------------
// FormController — react-hook-form-equivalent ReactiveController
// ---------------------------------------------------------------------------

type AnyValues = Record<string, any>;
type ErrorMap<T extends AnyValues> = Record<string, string>;
type FlagMap<T extends AnyValues> = Record<string, boolean>;

export interface RegisterOptions {
  /**
   * Optional per-field async validator. Receives the current value of
   * the field, returns a string error (or null/undefined for valid).
   * Calls are debounced 200ms and triggered on blur. While resolving,
   * the field's data-state is `pending`.
   */
  asyncValidate?: (value: any) => Promise<string | null | undefined>;
}

export interface FormControllerOptions<T extends AnyValues> {
  defaultValues?: T;
  /** Plain function: receives values, returns error-map (sync or async). */
  validate?: (values: T) => ErrorMap<T> | Promise<ErrorMap<T>> | undefined | null;
  /**
   * Schema-style validator (zod / valibot). Receives values, expected to
   * throw on failure. Zod's `ZodError` carries `.errors` / `.issues` with
   * `path` + `message`; we unpack those into the error map.
   */
  validator?: (values: T) => unknown;
  onSubmit?: (values: T) => void | Promise<void>;
}

interface FieldBinding {
  el: HTMLElement;
  unbind: () => void;
}

interface AsyncFieldState {
  validator: (value: any) => Promise<string | null | undefined>;
  timer: ReturnType<typeof setTimeout> | null;
  /** Monotonic token — only the latest resolution updates the error. */
  token: number;
}

/**
 * Reactive controller that tracks values, errors, touched/dirty flags,
 * and submission state for a `<ui-form>` host. Mirrors the surface of
 * `react-hook-form`'s `useForm()` return value.
 */
export class FormController<T extends AnyValues = AnyValues> {
  host: WebComponent;
  values: T;
  errors: ErrorMap<T> = {};
  touched: FlagMap<T> = {};
  dirty: FlagMap<T> = {};
  /** Field-level pending flags — true while an async validator is in flight. */
  pending: FlagMap<T> = {};
  submitting = false;

  private _defaults: T;
  private _opts: FormControllerOptions<T>;
  private _fields: Map<string, FieldBinding> = new Map();
  private _async: Map<string, AsyncFieldState> = new Map();
  private _submitCount = 0;

  constructor(host: WebComponent, options: FormControllerOptions<T> = {}) {
    this.host = host;
    this._opts = options;
    this._defaults = { ...(options.defaultValues || ({} as T)) };
    this.values = { ...this._defaults };
    host.addController(this);
    // Expose a backref so field components can find us via the host.
    (host as any).form = this;
  }

  get isValid(): boolean {
    return Object.values(this.errors).every((v) => !v);
  }
  get isDirty(): boolean {
    return Object.values(this.dirty).some(Boolean);
  }
  /** How many times `handleSubmit()` has been called. */
  get submitCount(): number {
    return this._submitCount;
  }

  onMount(): void {}
  onUnmount(): void {
    for (const { unbind } of this._fields.values()) unbind();
    this._fields.clear();
    for (const a of this._async.values()) {
      if (a.timer) clearTimeout(a.timer);
    }
    this._async.clear();
  }

  /**
   * Register a field. Returns the binding descriptor shadcn callers expect.
   * Most components don't call this directly — `<ui-form-field>` does it
   * for them via the bubbling registration event.
   *
   * `name` accepts dotted paths (`addresses.0.street`, `tags.1`) — the
   * controller reads/writes via `getPath` / `setPath` so the field works
   * on the nested location.
   */
  register(
    name: string,
    opts?: RegisterOptions,
  ): { name: string; value: any; onInput: (e: Event) => void; onBlur: (e: Event) => void } {
    const key = String(name);
    if (opts?.asyncValidate) {
      const prev = this._async.get(key);
      if (prev?.timer) clearTimeout(prev.timer);
      this._async.set(key, { validator: opts.asyncValidate, timer: null, token: 0 });
    }
    return {
      name: key,
      value: getPath(this.values, key),
      onInput: (e: Event) => {
        const target = e.target as HTMLInputElement;
        const raw = target.type === 'checkbox' ? target.checked : target.value;
        this.setValue(key, raw);
      },
      onBlur: () => {
        this.touched[key] = true;
        this._scheduleAsync(key);
        this._validateAndNotify();
      },
    };
  }

  /** Bind an inner native input to a named field. Idempotent per element. */
  _bindElement(name: string, el: HTMLElement, opts?: RegisterOptions): void {
    const key = String(name);
    if (opts?.asyncValidate) {
      const prev = this._async.get(key);
      if (prev?.timer) clearTimeout(prev.timer);
      this._async.set(key, { validator: opts.asyncValidate, timer: null, token: 0 });
    }
    const prev = this._fields.get(key);
    if (prev && prev.el === el) return;
    if (prev) prev.unbind();

    const handler = (e: Event) => {
      const t = e.target as HTMLInputElement;
      const raw =
        t.type === 'checkbox'
          ? t.checked
          : t.type === 'number'
            ? t.valueAsNumber
            : t.value;
      this.setValue(key, raw);
    };
    const blurHandler = () => {
      this.touched[key] = true;
      this._scheduleAsync(key);
      this._validateAndNotify();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    el.addEventListener('blur', blurHandler, true);

    // Seed the element with the current value.
    const initial = getPath(this.values, key);
    if (initial !== undefined && 'value' in el) {
      const input = el as HTMLInputElement;
      if (input.type === 'checkbox') input.checked = !!initial;
      else input.value = initial == null ? '' : String(initial);
    }

    this._fields.set(key, {
      el,
      unbind: () => {
        el.removeEventListener('input', handler);
        el.removeEventListener('change', handler);
        el.removeEventListener('blur', blurHandler, true);
      },
    });
  }

  setValue(name: string, value: any): void {
    const key = String(name);
    this.values = setPath(this.values, key, value) as T;
    this.dirty[key] = value !== getPath(this._defaults, key);
    this._validateAndNotify();
  }

  setError(name: string, error: string | undefined): void {
    const key = String(name);
    if (error) this.errors = { ...this.errors, [key]: error };
    else {
      const next = { ...this.errors };
      delete next[key];
      this.errors = next;
    }
    this._notify();
  }

  reset(values?: Partial<T>): void {
    this._defaults = { ...this._defaults, ...(values || {}) };
    this.values = { ...this._defaults };
    this.errors = {};
    this.touched = {};
    this.dirty = {};
    this.pending = {};
    this._submitCount = 0;
    // Reset DOM values in registered fields.
    for (const [name, { el }] of this._fields) {
      const v = getPath(this.values, name);
      if ('value' in el) {
        const input = el as HTMLInputElement;
        if (input.type === 'checkbox') input.checked = !!v;
        else input.value = v == null ? '' : String(v);
      }
    }
    this._notify();
  }

  watch(name?: string): any {
    return name == null ? { ...this.values } : getPath(this.values, name);
  }

  async handleSubmit(): Promise<void> {
    this._submitCount += 1;
    // Mark every registered field as touched so all errors become visible.
    for (const name of this._fields.keys()) this.touched[name] = true;
    await this._runValidators();
    // Run all async validators synchronously on submit (no debounce wait).
    await this._runAllAsync();
    this._notify();
    if (!this.isValid) return;
    if (!this._opts.onSubmit) return;
    this.submitting = true;
    this._notify();
    try {
      await this._opts.onSubmit(this.values);
    } finally {
      this.submitting = false;
      this._notify();
    }
  }

  /** Schedule an async validator for `name` — debounced 200ms. */
  private _scheduleAsync(name: string): void {
    const a = this._async.get(name);
    if (!a) return;
    if (a.timer) clearTimeout(a.timer);
    this.pending[name] = true;
    this._notify();
    a.timer = setTimeout(() => {
      a.timer = null;
      this._runFieldAsync(name);
    }, 200);
  }

  /** Run one field's async validator immediately; respects latest-token. */
  private async _runFieldAsync(name: string): Promise<void> {
    const a = this._async.get(name);
    if (!a) return;
    const token = ++a.token;
    const value = getPath(this.values, name);
    let result: string | null | undefined;
    try {
      result = await a.validator(value);
    } catch (err: any) {
      result = err?.message || 'Invalid';
    }
    // Stale result — a newer call superseded us. Drop it.
    if (a.token !== token) return;
    this.pending[name] = false;
    if (result) this.errors = { ...this.errors, [name]: result };
    else {
      const next = { ...this.errors };
      delete next[name];
      this.errors = next;
    }
    this._notify();
  }

  /** Run every registered async validator at once (used by handleSubmit). */
  private async _runAllAsync(): Promise<void> {
    const names = Array.from(this._async.keys());
    if (!names.length) return;
    // Cancel any pending debounced runs — submit takes precedence.
    for (const n of names) {
      const a = this._async.get(n)!;
      if (a.timer) {
        clearTimeout(a.timer);
        a.timer = null;
      }
      this.pending[n] = true;
    }
    await Promise.all(names.map((n) => this._runFieldAsync(n)));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async _validateAndNotify(): Promise<void> {
    await this._runValidators();
    this._notify();
  }

  private async _runValidators(): Promise<void> {
    let next: ErrorMap<T> = {};
    // Plain validator first.
    if (this._opts.validate) {
      const out = await this._opts.validate(this.values);
      if (out && typeof out === 'object') next = { ...next, ...(out as ErrorMap<T>) };
    }
    // Schema-style validator second.
    if (this._opts.validator) {
      try {
        this._opts.validator(this.values);
      } catch (err: any) {
        const issues = err?.issues || err?.errors;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            // Zod issue.path is an array of segments — join into a dotted key
            // so nested fields (`addresses.0.street`) resolve correctly.
            const path = Array.isArray(issue.path) ? issue.path.join('.') : issue.path;
            if (path != null && !next[path as string]) {
              next[path as string] = issue.message || 'Invalid';
            }
          }
        } else if (err?.message) {
          // Single message — attach to '_root' by convention.
          next['_root'] = err.message;
        }
      }
    }
    // Preserve any per-field async errors that aren't covered by sync rules.
    for (const [k, v] of Object.entries(this.errors)) {
      if (this._async.has(k) && v && !next[k]) next[k] = v;
    }
    this.errors = next;
  }

  private _notify(): void {
    this.host.requestUpdate();
    if (typeof window !== 'undefined') {
      this.host.dispatchEvent(
        new CustomEvent('ui-form-state-change', {
          detail: {
            values: this.values,
            errors: this.errors,
            touched: this.touched,
            pending: this.pending,
            submitCount: this._submitCount,
          },
          bubbles: false,
        }),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers shared by field components
// ---------------------------------------------------------------------------

function findForm(node: HTMLElement): UiForm | null {
  let cur: HTMLElement | null = node.parentElement;
  while (cur) {
    if (cur.tagName && cur.tagName.toLowerCase() === 'ui-form') return cur as UiForm;
    cur = cur.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// <ui-form>
// ---------------------------------------------------------------------------

export class UiForm extends WebComponent {
  static properties = { name: { type: String } };
  declare name: string;

  /** Public — caller assigns a FormController instance here. */
  form: FormController | null = null;
  /** Mirror used by template (write-through from `form` setter). */
  formController: FormController | null = null;

  private _slot = '';

  constructor() {
    super();
    this.name = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    // Listen for field registrations bubbling up from descendants.
    this.addEventListener('ui-form-field-register', this._onFieldRegister as EventListener);
  }

  disconnectedCallback() {
    this.removeEventListener('ui-form-field-register', this._onFieldRegister as EventListener);
    super.disconnectedCallback();
  }

  private _onFieldRegister = (e: CustomEvent) => {
    const ctrl = this.form || this.formController;
    if (!ctrl) return;
    const { name, el } = e.detail || {};
    if (!name || !el) return;
    ctrl._bindElement(name, el);
    e.stopPropagation();
  };

  _onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const ctrl = this.form || this.formController;
    if (ctrl) {
      await ctrl.handleSubmit();
    } else {
      // No controller — fall back to v1 behaviour: serialise + dispatch.
      const data: Record<string, FormDataEntryValue> = {};
      new FormData(form).forEach((v, k) => {
        data[k] = v;
      });
      this.dispatchEvent(
        new CustomEvent('form-submit', { detail: { data, form }, bubbles: true, composed: true }),
      );
    }
  };

  render() {
    return html`
      <form
        data-slot="form"
        name=${this.name || null}
        @submit=${this._onSubmit}
      >${unsafeHTML(this._slot)}</form>
    `;
  }
}
UiForm.register('ui-form');

// ---------------------------------------------------------------------------
// <ui-form-field>
// ---------------------------------------------------------------------------

export class UiFormField extends WebComponent {
  static properties = {
    name: { type: String },
    error: { type: String },
  };
  declare name: string;
  declare error: string;

  private _slot = '';
  private _form: UiForm | null = null;
  private _unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.name = '';
    this.error = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
    super.disconnectedCallback();
  }

  firstUpdated() {
    if (typeof window === 'undefined') return;
    this._form = findForm(this);
    if (!this._form || !this.name) return;

    // Find the first native control inside this field (works whether the
    // user wrapped it in <ui-input>, <ui-textarea>, or wrote a plain
    // <input>). ui-* components re-emit their slot via unsafeHTML, so the
    // real <input> ends up as a descendant either way.
    const control = this.querySelector(
      'input, select, textarea',
    ) as HTMLElement | null;

    if (control) {
      this.dispatchEvent(
        new CustomEvent('ui-form-field-register', {
          detail: { name: this.name, el: control },
          bubbles: true,
          composed: true,
        }),
      );
    }

    // Subscribe to form state changes to keep this field's data-state
    // attribute (and child <ui-form-message>) in sync.
    const onChange = () => this.requestUpdate();
    this._form.addEventListener('ui-form-state-change', onChange);
    this._unsubscribe = () => {
      this._form?.removeEventListener('ui-form-state-change', onChange);
    };
  }

  private _resolveError(): string {
    if (this.error) return this.error;
    const ctrl = this._form?.form || this._form?.formController;
    if (ctrl && this.name) {
      const touched = ctrl.touched[this.name];
      const err = ctrl.errors[this.name];
      if (touched && err) return err;
    }
    return '';
  }

  render() {
    const err = this._resolveError();
    const ctrl = this._form?.form || this._form?.formController;
    // Per-field pending takes precedence over form-wide submitting — the
    // field is "pending" iff its own async validator is in flight.
    const fieldPending = !!(ctrl && this.name && ctrl.pending[this.name]);
    const state = err
      ? 'error'
      : fieldPending
        ? 'pending'
        : ctrl?.submitting
          ? 'submitting'
          : 'valid';
    return html`
      <div
        data-slot="form-field"
        data-name=${this.name || null}
        data-state=${state}
        data-invalid=${err ? 'true' : 'false'}
        class=${cn('grid gap-2')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiFormField.register('ui-form-field');

// ---------------------------------------------------------------------------
// <ui-form-label>
// ---------------------------------------------------------------------------

export class UiFormLabel extends WebComponent {
  static properties = { for: { type: String } };
  declare for: string;

  private _slot = '';

  constructor() {
    super();
    this.for = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <label
        data-slot="form-label"
        for=${this.for || null}
        class=${cn(
          'text-sm font-medium leading-none select-none',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          '[[data-invalid=true]_&]:text-destructive',
        )}
      >${unsafeHTML(this._slot)}</label>
    `;
  }
}
UiFormLabel.register('ui-form-label');

// ---------------------------------------------------------------------------
// <ui-form-control>
// ---------------------------------------------------------------------------

export class UiFormControl extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div data-slot="form-control">${unsafeHTML(this._slot)}</div>`;
  }
}
UiFormControl.register('ui-form-control');

// ---------------------------------------------------------------------------
// <ui-form-description>
// ---------------------------------------------------------------------------

export class UiFormDescription extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <p data-slot="form-description" class=${cn('text-sm text-muted-foreground')}>
        ${unsafeHTML(this._slot)}
      </p>
    `;
  }
}
UiFormDescription.register('ui-form-description');

// ---------------------------------------------------------------------------
// <ui-form-message>
// ---------------------------------------------------------------------------

export class UiFormMessage extends WebComponent {
  static properties = { message: { type: String } };
  declare message: string;

  private _slot = '';
  private _field: UiFormField | null = null;
  private _form: UiForm | null = null;
  private _unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.message = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
    super.disconnectedCallback();
  }

  firstUpdated() {
    if (typeof window === 'undefined') return;
    // Find the enclosing <ui-form-field> and <ui-form> (if any).
    let cur: HTMLElement | null = this.parentElement;
    while (cur) {
      const tag = cur.tagName?.toLowerCase();
      if (tag === 'ui-form-field' && !this._field) this._field = cur as UiFormField;
      if (tag === 'ui-form') {
        this._form = cur as UiForm;
        break;
      }
      cur = cur.parentElement;
    }
    if (this._form) {
      const onChange = () => this.requestUpdate();
      this._form.addEventListener('ui-form-state-change', onChange);
      this._unsubscribe = () => {
        this._form?.removeEventListener('ui-form-state-change', onChange);
      };
    }
  }

  private _resolveMessage(): { text: string; isError: boolean } {
    if (this.message) return { text: this.message, isError: true };
    const fieldName = this._field?.name;
    const ctrl = this._form?.form || this._form?.formController;
    if (ctrl && fieldName) {
      const touched = ctrl.touched[fieldName];
      const err = ctrl.errors[fieldName];
      if (touched && err) return { text: err, isError: true };
    }
    // Fall back to slot content (treated as a description).
    return { text: this._slot, isError: false };
  }

  render() {
    const { text, isError } = this._resolveMessage();
    if (!text) return html``;
    return html`
      <p
        role=${isError ? 'alert' : null}
        data-slot="form-message"
        class=${cn(
          'text-sm font-medium',
          isError ? 'text-destructive' : 'text-muted-foreground',
        )}
      >${unsafeHTML(text)}</p>
    `;
  }
}
UiFormMessage.register('ui-form-message');
