/**
 * The dev component hot swap, BROWSER half (#1689). A browser-safe,
 * import-free module that `reloadClientJs` (`dev/helpers.js`) inlines into
 * `/__webjs/reload.js` after an `export`-keyword strip, like `dev-styles.js`,
 * so the browser test drives the exact code that ships. Production never loads
 * it, so `@webjsdev/core`'s `hot.js` reads find nothing there.
 *
 * `installHotClient(globalThis)` publishes `{ strings, replace, applyModules }`
 * on `globalThis[Symbol.for('webjs.hot')]`, which core reads:
 *
 * - `strings(arr, kind)` interns template strings by their text, so the
 *   re-evaluated module's unchanged templates keep the identity the reconciler
 *   compares (`prev.strings === tr.strings`) and update in place, keeping
 *   their DOM (focus, an input's value, a nested component), while a template
 *   whose text changed rebuilds.
 * - `replace(tag, Old, New)` is what core's `customElements.define` wrapper
 *   calls on a second define of a known tag. The native registry keeps the
 *   class and the lifecycle callbacks it read at define time, so the new
 *   class's members are copied onto the REGISTERED one, level by level up to
 *   the first class both chains share, and every live instance re-renders.
 *   Reactive values live per instance in `__propValues` and instance signals in
 *   fields, so both survive. A change the native registry would ignore throws
 *   before anything is patched, and the reload client reloads with the reason.
 * - `applyModules(urls)` imports the versioned component modules a
 *   `component` verdict lists, in order, and reports the tags it swapped.
 *
 * The reload script runs before the page's boot script (`ssr/head.js`), so the
 * interner sees every template from the first evaluation on.
 */

/** Callbacks the native registry captures at define time. */
const HOT_NATIVE_CALLBACKS = [
  'connectedCallback', 'disconnectedCallback', 'adoptedCallback', 'attributeChangedCallback',
  'connectedMoveCallback', 'formAssociatedCallback', 'formResetCallback', 'formDisabledCallback',
  'formStateRestoreCallback',
];

/** Statics that are part of a class's identity or compared by a guard, never copied. */
const HOT_FIXED_STATICS = ['prototype', 'name', 'length', 'properties', 'elementProperties', 'elementStyles', 'observedAttributes', 'finalized'];

/** @param {any} C */
function hotChain(C) {
  const out = [];
  for (let c = C; c && c !== Function.prototype; c = Object.getPrototypeOf(c)) out.push(c);
  return out;
}

/** @param {unknown} v */
function hotText(v) {
  if (v === undefined) return '';
  if (typeof v === 'function') return String(v);
  if (v && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v);
    return '{' + Object.keys(o).sort().map((k) => k + ':' + hotText(o[k])).join(',') + '}';
  }
  try { return JSON.stringify(v); } catch (_) { return String(v); }
}

/**
 * The declared reactive property shape of a class, as one comparable string,
 * plus the names (for the patch to skip their prototype accessors).
 * @param {any} C
 */
function hotShape(C) {
  /** @type {Record<string, unknown>} */
  const all = {};
  for (const c of hotChain(C).reverse()) {
    if (Object.prototype.hasOwnProperty.call(c, 'properties') && c.properties && typeof c.properties === 'object') Object.assign(all, c.properties);
  }
  if (C.elementProperties instanceof Map) for (const [k, v] of C.elementProperties) all[k] = v;
  const names = Object.keys(all).sort();
  const text = names.map((name) => {
    const raw = all[name];
    const d = /** @type {any} */ (raw && typeof raw === 'object' ? raw : { type: raw });
    return [name, d.type && d.type.name, hotText(d.attribute), !!d.reflect, !!d.state, !!d.noAccessor,
      hotText(d.converter), hotText(d.hasChanged), hotText(d.default)].join('|');
  }).join('\n');
  return { names, text };
}

/** @param {any} C */
function hotObserved(C) {
  try { return [...(C.observedAttributes || [])].map(String).sort().join(','); } catch (_) { return '?'; }
}

/** @param {unknown} s @returns {CSSStyleSheet | null} */
function hotSheet(s) {
  if (typeof CSSStyleSheet !== 'undefined' && s instanceof CSSStyleSheet) return s;
  const o = /** @type {any} */ (s);
  if (o && typeof CSSStyleSheet !== 'undefined' && o.styleSheet instanceof CSSStyleSheet) return o.styleSheet;
  if (o && typeof o.text === 'string' && typeof CSSStyleSheet !== 'undefined') {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(o.text);
    return sheet;
  }
  return null;
}

/**
 * Every element in `root` (and in each open shadow root below it) that is an
 * instance of `C`, including instances of a subclass.
 * @param {Document | ShadowRoot | Element} root
 * @param {Function} C
 * @param {Element[]} [out]
 */
function hotInstances(root, C, out = []) {
  for (const el of root.querySelectorAll('*')) {
    if (el instanceof C) out.push(el);
    if (el.shadowRoot) hotInstances(el.shadowRoot, C, out);
  }
  return out;
}

/**
 * The reason `New` cannot be patched onto the registered `Old`, or null.
 * @param {any} Old
 * @param {any} New
 * @returns {{ why: string, depth: number }}
 */
function hotCheck(Old, New) {
  const oldChain = hotChain(Old);
  const newChain = hotChain(New);
  const depth = newChain.findIndex((c) => oldChain.includes(c));
  if (depth === -1 || oldChain.indexOf(newChain[depth]) !== depth) return { why: 'class-chain-changed', depth };
  if (hotShape(Old).text !== hotShape(New).text) return { why: 'reactive-properties-changed', depth };
  if (hotObserved(Old) !== hotObserved(New)) return { why: 'observed-attributes-changed', depth };
  if (Old.shadow !== New.shadow) return { why: 'static-shadow-changed', depth };
  if (Old.formAssociated !== New.formAssociated) return { why: 'form-associated-changed', depth };
  for (let i = 0; i < depth; i++) {
    for (const cb of HOT_NATIVE_CALLBACKS) {
      const o = Object.getOwnPropertyDescriptor(oldChain[i].prototype, cb);
      const n = Object.getOwnPropertyDescriptor(newChain[i].prototype, cb);
      if (!!o !== !!n || (o && n && String(o.value) !== String(n.value))) return { why: cb + '-changed', depth };
    }
  }
  return { why: '', depth };
}

/**
 * Copy `from`'s own members onto `to`, then drop the ones `from` no longer
 * has. `skip` names members that stay as they are.
 * @param {any} to
 * @param {any} from
 * @param {(key: string | symbol) => boolean} skip
 * @param {(key: string | symbol) => boolean} keep members never deleted
 */
function hotCopy(to, from, skip, keep) {
  for (const key of Reflect.ownKeys(from)) {
    if (skip(key)) continue;
    const d = Object.getOwnPropertyDescriptor(from, key);
    if (d) Object.defineProperty(to, key, d);
  }
  for (const key of Reflect.ownKeys(to)) {
    if (skip(key) || keep(key) || Object.prototype.hasOwnProperty.call(from, key)) continue;
    delete to[key];
  }
}

/**
 * Install the dev hot client on `g` (normally `globalThis`). Idempotent.
 * @param {any} g
 */
export function installHotClient(g) {
  const KEY = Symbol.for('webjs.hot');
  if (g[KEY]) return g[KEY];
  /** @type {WeakMap<object, any>} */
  const canonical = new WeakMap();
  /** @type {Map<string, any>} */
  const byText = new Map();
  /** @type {string[] | null} */
  let swapped = null;

  /** @param {any} arr @param {number} kind */
  function strings(arr, kind) {
    const hit = canonical.get(arr);
    if (hit) return hit;
    const key = kind + '\u0000' + Array.prototype.join.call(arr, '\u0001');
    let c = byText.get(key);
    if (!c) byText.set(key, (c = arr));
    canonical.set(arr, c);
    return c;
  }

  /** @param {string} tag @param {any} Old @param {any} New */
  function replace(tag, Old, New) {
    const { why, depth } = hotCheck(Old, New);
    if (why) throw new Error('[webjs] hot swap of <' + tag + '> needs a reload: ' + why);
    const props = new Set(hotShape(Old).names);
    const oldChain = hotChain(Old);
    const newChain = hotChain(New);
    for (let i = 0; i < depth; i++) {
      hotCopy(oldChain[i].prototype, newChain[i].prototype,
        (k) => k === 'constructor' || props.has(/** @type {string} */ (k)) || HOT_NATIVE_CALLBACKS.includes(/** @type {string} */ (k)),
        () => false);
      hotCopy(oldChain[i], newChain[i],
        (k) => HOT_FIXED_STATICS.includes(/** @type {string} */ (k)),
        // Framework state cached on a class (a symbol, a `_`-prefixed name)
        // is not the author's, so it is never deleted.
        (k) => typeof k === 'symbol' || k.startsWith('_'));
    }
    // A class that memoizes its finalized styles (Lit's `elementStyles`) keeps
    // the old ones in a cache; an own value shadows it with the new styles.
    if (typeof Old.finalizeStyles === 'function') {
      Object.defineProperty(Old, 'elementStyles', { value: Old.finalizeStyles(Old.styles), configurable: true, writable: true });
    }
    const doc = g.document;
    if (doc) {
      for (const el of hotInstances(doc, Old)) {
        const C = /** @type {any} */ (el).constructor;
        if (el.shadowRoot && C.shadow === true && 'adoptedStyleSheets' in el.shadowRoot) {
          const styles = typeof C.finalizeStyles === 'function' ? C.elementStyles : C.styles;
          const list = Array.isArray(styles) ? styles.flat(Infinity) : styles ? [styles] : [];
          el.shadowRoot.adoptedStyleSheets = list.map(hotSheet).filter(Boolean);
        }
        const inst = /** @type {any} */ (el);
        if (typeof inst.requestUpdate === 'function') inst.requestUpdate();
      }
    }
    if (swapped) swapped.push(tag);
    return Old;
  }

  /**
   * Import the versioned component modules a `component` verdict lists, in
   * order. A module whose define throws (a guard refused the swap) rejects its
   * import, which ends the apply with that reason.
   * @param {string[]} urls
   * @returns {Promise<{ ok: true, tags: string[] } | { ok: false, why: string }>}
   */
  function applyModules(urls) {
    /** @type {string[]} */
    const tags = [];
    swapped = tags;
    let p = Promise.resolve();
    for (const u of urls) p = p.then(() => import(u));
    return p.then(
      () => { swapped = null; return { ok: /** @type {true} */ (true), tags }; },
      (e) => { swapped = null; return { ok: /** @type {false} */ (false), why: String((e && e.message) || e) }; },
    );
  }

  const api = { strings, replace, applyModules };
  g[KEY] = api;
  return api;
}
