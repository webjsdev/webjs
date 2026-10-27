import { stylesToString, isCSS } from '../css.js';
import { unsafeHTML } from '../directives.js';
import { escapeAttr } from '../escape.js';
import { defaultSSRErrorTemplate, browserMemberHint } from './errors.js';
import {
  appendReflectedAttrs, applyAttrsToInstance, consumePropAttrs, parseAttrs, seedServerAttrs,
  withHostMarker,
} from './attrs.js';

/**
 * Custom-element expansion inside the op walk (#1646): what `injectDSD`
 * used to do by rescanning the rendered string, moved here and driven by the
 * walker's frames instead. `beginComponent` runs at a registered element's
 * `>` (instantiate, seed and apply the source attributes, run the pre-render
 * lifecycle, call `render()`, surface reflected attributes, mark a light
 * host), and `finishComponent` runs at its end tag with the captured
 * authored children, walking the instance's template with the light-DOM slot
 * projection in scope or wrapping it in a Declarative Shadow DOM template.
 * Every instance renders exactly once.
 *
 * The attribute plumbing stays in `attrs.js`, the light-DOM slot emission is
 * `finishSlot` below (what `substituteSlotsInRender` emitted per slot), and
 * `finishSuspense` is the `<webjs-suspense>` boundary (#471).
 */

/**
 * Instantiate and pre-render a registered custom element at its start tag.
 * A throw anywhere here is caught into the frame (#469): the walker still
 * consumes the authored children, and `finishComponent` emits the error state
 * in the element's place while siblings render normally.
 *
 * @param {import('./walk.js').Walker} w
 * @param {string} tag
 * @param {any} Cls
 * @param {string} opening   the opening tag as written, `<tag attrs>`
 * @param {string} attrs     the attribute text between the tag name and `>`
 * @returns {Promise<any>} the frame
 */
export async function beginComponent(w, tag, Cls, opening, attrs) {
  if (w.ctx && w.ctx.usedComponents) w.ctx.usedComponents.add(tag);
  const isShadow = Cls.shadow === true;
  const frame = {
    kind: 'component', tag, Cls, isShadow, instance: null, opening, tpl: undefined,
    error: /** @type {unknown} */ (null), outer: '',
    // Light-DOM children partition: element depth, the open top-level
    // segment, and the named-slot segments seen so far.
    partition: !isShadow, depth: 0, seg: null, pendingSeg: null,
    /** @type {{ start: number, end: number, slot: string }[]} */ segments: [],
    closeText: '',
  };
  try {
    const instance = new Cls();
    frame.instance = instance;
    // Thread the ancestor chain (the enclosing custom-element instances) so
    // the server element shim's closest() can resolve a parent at SSR. Set
    // before performServerUpdate so a willUpdate() that reads a parent via
    // closest() sees the chain.
    instance.__ssrTag = tag;
    instance.__ssrAncestors = w.ancestors.slice();
    const attrMap = parseAttrs(attrs);
    // Decode `data-webjs-prop-*` first (rich-typed values emitted for
    // `.prop=${val}` bindings in the parent template), then coerce the
    // ordinary string attributes by declared type. Property bindings take
    // priority on a name collision because they preserve the JS reference.
    const propValues = consumePropAttrs(attrMap);
    // Names already in the source opening tag (the data-webjs-prop-* bindings
    // included, stripped from attrMap above but still in the emitted text).
    // Reflected/added attributes are appended only when their name is NOT
    // already here, so output stays byte-identical when nothing reflects.
    const presentAttrNames = new Set(Object.keys(parseAttrs(attrs)).map((n) => n.toLowerCase()));
    seedServerAttrs(instance, attrMap);
    applyAttrsToInstance(instance, attrMap, Cls);
    for (const [k, v] of Object.entries(propValues)) instance[k] = v;
    // The pre-render lifecycle (willUpdate, controllers' hostUpdate, then
    // reflect:true reflection), matching lit's update cycle at SSR. Bare
    // Base-extending kit components have no lifecycle, so it is guarded.
    if (typeof instance.performServerUpdate === 'function') instance.performServerUpdate();
    let tpl = instance.render ? instance.render() : '';
    if (tpl && typeof tpl.then === 'function') tpl = await tpl;
    frame.tpl = tpl;
    // Surface attributes the component set up to and including render() that
    // were not in the source tag (reflected props, an explicit setAttribute,
    // a host mutation inside render()). Reading after render() captures all.
    frame.opening = appendReflectedAttrs(opening, instance, presentAttrNames);
    // Mark LIGHT-DOM hosts for the `@layer webjs-host` display:block default.
    // Shadow hosts are NOT marked: a document-level rule on the host beats the
    // shadow tree's own `:host { display }`.
    if (!isShadow) frame.opening = withHostMarker(frame.opening);
  } catch (e) {
    frame.error = e;
  }
  return frame;
}

/**
 * Emit a finished component frame.
 *
 * @param {import('./walk.js').Walker} w
 * @param {any} frame
 * @param {string} children  the captured authored children, expanded
 * @param {boolean} closed   whether a matching end tag was found
 * @returns {Promise<string>}
 */
export async function finishComponent(w, frame, children, closed) {
  const { tag, Cls, isShadow } = frame;
  if (frame.error === null) {
    try {
      const inner = await renderOwnTemplate(w, frame, children);
      if (isShadow) {
        // Native <slot> stays as-is in the DSD template: the browser projects
        // the host's light children natively. The authored children stay in
        // place after the template, and the source end tag is kept.
        return `${frame.opening}<template shadowrootmode="open">${styleString(Cls)}${inner}</template>${children}${frame.closeText}`;
      }
      if (inner.trim() === '') {
        // An empty rendered template (a decorator component with no render(),
        // or a render() returning an empty template): the host is a
        // transparent wrapper and the authored children stay in place next to
        // the hydration marker.
        return `${frame.opening}<!--webjs-hydrate-->${children}${frame.closeText}`;
      }
      return `${frame.opening}<!--webjs-hydrate-->${inner}</${tag}>`;
    } catch (e) {
      frame.error = e;
    }
  }
  return errorState(w, frame, closed);
}

/**
 * Walk the instance's own template. For a light-DOM component the slot
 * projection is in scope: the authored children partitioned by their
 * top-level `slot=""` attribute (from the segments the walk recorded, no
 * rescan), first-wins per name, owner stamped as this tag so a FORWARDED slot
 * routes to the host that rendered it (#1023).
 */
async function renderOwnTemplate(w, frame, children) {
  const owner = w.owner;
  w.owner = frame.isShadow ? null : { tag: frame.tag, partition: partitionChildren(children, frame.segments), consumed: new Set() };
  try {
    return await w.capture(() => w.value(frame.tpl));
  } finally {
    w.owner = owner;
  }
}

/**
 * The partition `partitionAuthoredBySlot` built by rescanning, built here from
 * the recorded segments: text, comments and unslotted elements route to the
 * default slot (null) in source order, each named segment to its name.
 * @param {string} children
 * @param {{ start: number, end: number, slot: string }[]} segments
 * @returns {Map<string|null, string>}
 */
function partitionChildren(children, segments) {
  /** @type {Map<string|null, string>} */
  const groups = new Map();
  let def = '';
  let cursor = 0;
  for (const seg of segments) {
    def += children.slice(cursor, seg.start);
    const existing = groups.get(seg.slot);
    groups.set(seg.slot, existing === undefined ? children.slice(seg.start, seg.end) : existing + children.slice(seg.start, seg.end));
    cursor = seg.end;
  }
  def += children.slice(cursor);
  if (def.length > 0) groups.set(null, def);
  return groups;
}

function styleString(Cls) {
  const rawStyles = Cls.styles;
  const styleList = Array.isArray(rawStyles) ? rawStyles : rawStyles && isCSS(rawStyles) ? [rawStyles] : [];
  return stylesToString(styleList);
}

/**
 * Per-component error isolation (#469). The element renders a
 * component-scoped error state in its place (renderError() customises it;
 * the default surfaces the message in dev and renders empty in prod, #483)
 * plus a hydration marker so the client boundary can take over. A shadow
 * component's error state rides a DSD template too, matching its success
 * path.
 */
async function errorState(w, frame, closed) {
  const { tag, Cls, instance, isShadow } = frame;
  const e = frame.error;
  const hint = browserMemberHint(e);
  if (hint) {
    console.error(
      `[webjs] SSR failed for <${tag}>: ${hint} It was touched in the component's constructor or render(), which run during SSR. Move browser-only work to connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor only from server-known inputs (attributes / props).`,
      e,
    );
  } else {
    console.error(`[webjs] SSR failed for <${tag}>:`, e);
  }
  const err = e instanceof Error ? e : new Error(String(e));
  let errorInner = '';
  try {
    let errTpl;
    if (instance && typeof instance.renderError === 'function') errTpl = instance.renderError(err);
    if (errTpl === undefined) errTpl = defaultSSRErrorTemplate(tag, err, w.dev);
    errorInner = await w.capture(() => w.value(errTpl));
  } catch (renderErrorThrew) {
    console.error(`[webjs] renderError() for <${tag}> also threw:`, renderErrorThrew);
    errorInner = '';
  }
  void closed;
  let opening = frame.opening;
  if (!isShadow) opening = withHostMarker(opening);
  if (isShadow) return `${opening}<template shadowrootmode="open">${styleString(Cls)}${errorInner}</template>`;
  return `${opening}<!--webjs-hydrate-->${errorInner}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/**
 * The `slot` attribute value of an element's attribute text, or null when
 * absent. `slot=""` and the reserved alias `default` both mean the default
 * slot (#1015), matching the client record.
 * @param {string} attrsRaw
 * @returns {string | null}
 */
export function extractSlotAttr(attrsRaw) {
  const m = /\bslot\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrsRaw);
  if (!m) return null;
  const value = m[1] ?? m[2] ?? m[3] ?? '';
  return value === '' || value === 'default' ? null : value;
}

/**
 * Emit one `<slot>` of a light-DOM component's template as the framework
 * slot: `data-webjs-light`, `data-projection="actual|fallback"`, the owner
 * stamp, the name, and the projected children or the authored fallback.
 * First-wins per name; a later same-named slot falls back regardless.
 * @param {any} frame
 * @param {string} fallback  the slot's own captured children
 * @returns {string}
 */
export function finishSlot(frame, fallback) {
  const { attrsRaw, owner } = frame;
  const ownerAttr = owner.tag ? ` data-wj-slot-owner="${escapeAttr(owner.tag)}"` : '';
  const nameMatch = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrsRaw);
  const name = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]) : null;
  const otherAttrs = attrsRaw.replace(/\bname\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '').trim();
  const slotKey = name === 'default' || name === '' ? null : name;
  const projected = owner.partition.get(slotKey);
  const nameAttr = name !== null ? ` name="${escapeAttr(name)}"` : '';
  const extraAttrs = otherAttrs ? ` ${otherAttrs}` : '';
  if (projected !== undefined && !owner.consumed.has(slotKey)) {
    owner.consumed.add(slotKey);
    return `<slot data-webjs-light data-projection="actual"${ownerAttr}${nameAttr}${extraAttrs}>${projected}</slot>`;
  }
  return `<slot data-webjs-light data-projection="fallback"${ownerAttr}${nameAttr}${extraAttrs}>${fallback}</slot>`;
}

// ---------------------------------------------------------------------------
// <webjs-suspense>
// ---------------------------------------------------------------------------

/**
 * A `<webjs-suspense>` boundary (#471). Streaming (a ctx is present): the
 * placeholder carries the rendered `.fallback` and the boundary id, and the
 * children, captured with their components unexpanded, are pushed to
 * `ctx.pending` as raw markup for `streamSuspenseBoundaries` to resolve
 * after the main flush (so every boundary's data fetches run concurrently).
 * Blocking: the children rendered inline, the fallback dropped, the wrapper
 * kept as an inert element.
 * @param {import('./walk.js').Walker} w
 * @param {any} frame
 * @param {string} children
 * @returns {Promise<string>}
 */
export async function finishSuspense(w, frame, children) {
  if (w.ctx && frame.id) {
    w.ctx.pending.push({ id: frame.id, promise: Promise.resolve(unsafeHTML(children)) });
    return `<webjs-suspense id="${frame.id}">${frame.fallback}</webjs-suspense>`;
  }
  return `<webjs-suspense>${children}</webjs-suspense>`;
}
