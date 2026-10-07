/**
 * Client router: keep what a person typed across a failed submission (#1581).
 *
 * A bound form that fails validation is answered with a 422 re-render, which
 * the router applies in place. The differ keeps a control's live state only
 * when it reuses the old node (a keyed match, or the same tag at the same
 * index), so an error message inserted above the inputs shifts every position
 * and the inputs come back as fresh server markup: empty, unless the page
 * refilled each one from `actionData.values`. Pages forget a field often
 * enough that the framework should not depend on it.
 *
 * So the router snapshots the submitted form's controls at submit time and,
 * after a non-2xx response is applied, writes the typed state back into the
 * re-rendered form. A control is restored only when its server-rendered
 * DEFAULT (the `value` attribute, `checked`, an option's `selected`, a
 * textarea's text) is the same as before the submission. A default that
 * changed means the server rendered that control on purpose (refilled it,
 * normalized it, reset it), and the server wins.
 *
 * Never restored: password inputs (re-entering one after a failure is the
 * convention, and nothing the server renders can say otherwise), file inputs
 * (a script cannot set them), hidden inputs (server-owned), and buttons. A
 * form opts out with `data-preserve-values="false"`.
 *
 * @module
 */

const FORM_ACTION_FIELD = '__webjs_action';
const SKIP_TYPES = new Set(['password', 'file', 'hidden', 'submit', 'button', 'image', 'reset']);

/**
 * @typedef {{
 *   name: string,
 *   kind: 'text' | 'check' | 'select',
 *   n: number,
 *   value?: string,
 *   def: string,
 *   cur: string,
 * }} ControlState
 * @typedef {{ form: HTMLFormElement, key: string, ord: number, controls: ControlState[] }} FormSnapshot
 */

/**
 * How a form is found again after a re-render: its `id`, else its bound
 * action identity, else its `action` attribute, plus its position among the
 * forms sharing that key.
 *
 * @param {Element} form
 * @returns {string}
 */
function formKey(form) {
  if (form.id) return `id:${form.id}`;
  const field = form.querySelector(`input[name="${FORM_ACTION_FIELD}"]`);
  if (field) return `act:${field.getAttribute('value') || ''}`;
  return `url:${form.getAttribute('action') || ''}`;
}

/** @param {Element} form @param {string} key */
function ordinalOf(form, key) {
  let i = 0;
  for (const f of document.querySelectorAll('form')) {
    if (f === form) return i;
    if (formKey(f) === key) i++;
  }
  return -1;
}

/** @param {Element} el */
function kindOf(el) {
  const tag = el.localName;
  if (tag === 'textarea') return 'text';
  if (tag === 'select') return 'select';
  if (tag !== 'input') return null;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (SKIP_TYPES.has(type)) return null;
  return type === 'checkbox' || type === 'radio' ? 'check' : 'text';
}

/**
 * The controls of `form`, in document order, each with its per-name ordinal.
 * Uses `form.elements` so a control associated by `form="id"` outside the
 * form element is included.
 *
 * @param {HTMLFormElement} form
 * @returns {Array<{ el: any, name: string, kind: 'text' | 'check' | 'select', n: number }>}
 */
function controlsOf(form) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const out = [];
  const list = form.elements ? [...form.elements] : [...form.querySelectorAll('input, textarea, select')];
  for (const el of list) {
    const name = el.getAttribute && el.getAttribute('name');
    if (!name || name === FORM_ACTION_FIELD) continue;
    const kind = kindOf(el);
    if (!kind) continue;
    // Radios and checkboxes are told apart by their value, so the ordinal
    // counts within name + value; text controls count within the name.
    const key = kind === 'check' ? `${name}\u0000${el.getAttribute('value') ?? 'on'}` : name;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    out.push({ el, name, kind: /** @type any */ (kind), n });
  }
  return out;
}

/** @param {any} el @param {'text' | 'check' | 'select'} kind */
function readState(el, kind) {
  if (kind === 'check') return { def: String(!!el.defaultChecked), cur: String(!!el.checked) };
  if (kind === 'select') {
    const opts = [...el.options];
    return {
      def: JSON.stringify(opts.map((o) => o.defaultSelected)),
      cur: JSON.stringify(opts.filter((o) => o.selected).map((o) => o.value)),
    };
  }
  return { def: el.defaultValue ?? '', cur: el.value ?? '' };
}

/**
 * Snapshot a form's controls, or null when the form opts out.
 *
 * @param {HTMLFormElement | null | undefined} form
 * @returns {FormSnapshot | null}
 */
export function captureFormState(form) {
  if (!form || form.getAttribute('data-preserve-values') === 'false') return null;
  const key = formKey(form);
  const controls = controlsOf(form).map(({ el, name, kind, n }) => ({
    name, kind, n,
    ...(kind === 'check' ? { value: el.getAttribute('value') ?? 'on' } : {}),
    ...readState(el, kind),
  }));
  if (!controls.length) return null;
  return { form, key, ord: ordinalOf(form, key), controls };
}

/**
 * Find the snapshot's form in the current document.
 *
 * @param {FormSnapshot} snap
 * @returns {HTMLFormElement | null}
 */
function findForm(snap) {
  if (snap.form.isConnected) return snap.form;
  let i = 0;
  for (const f of document.querySelectorAll('form')) {
    if (formKey(f) !== snap.key) continue;
    if (i === snap.ord) return /** @type any */ (f);
    i++;
  }
  return null;
}

/**
 * Write the snapshot's typed state back into the re-rendered form, control by
 * control, wherever the server left the control's default unchanged.
 *
 * @param {FormSnapshot | null} snap
 * @returns {number} how many controls were restored (for tests)
 */
export function restoreFormState(snap) {
  if (!snap) return 0;
  const form = findForm(snap);
  if (!form) return 0;
  const byKey = new Map();
  for (const c of controlsOf(form)) {
    const k = c.kind === 'check'
      ? `${c.name}\u0000${c.el.getAttribute('value') ?? 'on'}\u0000${c.n}`
      : `${c.name}\u0000${c.n}`;
    byKey.set(k, c);
  }
  let restored = 0;
  for (const s of snap.controls) {
    const k = s.kind === 'check' ? `${s.name}\u0000${s.value}\u0000${s.n}` : `${s.name}\u0000${s.n}`;
    const c = byKey.get(k);
    if (!c || c.kind !== s.kind) continue;
    const now = readState(c.el, c.kind);
    // The server rendered this control differently on purpose, so it wins.
    if (now.def !== s.def) continue;
    if (now.cur === s.cur) continue;
    if (s.kind === 'check') c.el.checked = s.cur === 'true';
    else if (s.kind === 'select') {
      const want = new Set(JSON.parse(s.cur));
      for (const o of c.el.options) o.selected = want.has(o.value);
    } else c.el.value = s.cur;
    restored++;
  }
  return restored;
}
