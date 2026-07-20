/**
 * Light-DOM <slot> runtime for @webjsdev/core: CHILDREN AS VALUES (#1015).
 *
 * Provides functional parity with shadow-DOM <slot> projection inside
 * light-DOM WebComponents (those with static shadow = false), on the React
 * children model: authored children are captured ONCE per host lifetime into
 * a per-host slot record (name -> Node[]), and the component's own renderer
 * places that content into its `<slot data-webjs-light>` containers as an
 * ordinary render-owned value. ONE renderer owns all nodes.
 *
 * What this deliberately is NOT (the pre-#1015 model, deleted): an
 * observer-driven projection runtime. There are no MutationObservers, no
 * microtask projection scheduler, no framework-marker record sniffing, and no
 * pending-children shuffling. Those made light-DOM slots a third DOM-mutating
 * actor beside the renderer and the client router, which is exactly the
 * ownership overlap behind the #906/#908/#912/#914 cascade and the #1006
 * non-idempotent projection class. Capture-once closes #1006 by construction:
 * there is no second capture that could misclassify rendered nodes as
 * authored children.
 *
 * SEMANTICS CHANGE (deliberate, breaking): an external `appendChild` on a
 * mounted host, or a `slot=""`/`name=""` attribute flip, no longer live
 * re-projects. The dynamic path is the public API:
 *
 *   host.slots            read view of the record ({ default, [name] })
 *   host.hasSlot(name)    does the record carry content for `name`
 *   host.setSlotContent(name, value)   replace a slot's content (Node,
 *                         Node[], string, or null/[] to reset to fallback)
 *
 * The READS survive as derived shims: `assignedNodes()`,
 * `assignedElements()`, `assignedSlot`, and `slotchange` all keep working
 * against light-DOM slots exactly as before.
 *
 * Polyfill safety. Every prototype patch checks for the `data-webjs-light`
 * attribute on the slot element and falls through to the saved native
 * implementation otherwise. Real shadow-DOM slots elsewhere on the page
 * keep their native behaviour exactly.
 *
 * SSR. This module is import-safe in Node. The polyfill setup is guarded
 * on `typeof HTMLSlotElement !== 'undefined'`, so the server pipeline
 * loads slot.js without blowing up. Server-side slot substitution lives
 * in render-server.js (injectDSD); slot.js drives the client runtime
 * only.
 */

// ---------------------------------------------------------------------------
// Module-scope constants
// ---------------------------------------------------------------------------

function detectBrowser() {
  return typeof HTMLElement !== 'undefined' && typeof HTMLSlotElement !== 'undefined';
}

let inBrowser = detectBrowser();

/**
 * Symbol-keyed slot state stored on each light-DOM WebComponent host.
 * Lazily initialised by ensureSlotState(host).
 */
export const SLOT_STATE = Symbol('webjs.slot.state');

/** Marker attribute that opts a <slot> element into framework projection. */
export const LIGHT_SLOT_ATTR = 'data-webjs-light';

/** Records whether a slot is showing real assignment or fallback. */
export const PROJECTION_ATTR = 'data-projection';

export const PROJECTION_ACTUAL = 'actual';
export const PROJECTION_FALLBACK = 'fallback';

/**
 * Symbol-keyed property on a slot element that holds a DocumentFragment
 * containing the slot's fallback content (cloned from the compiled template
 * by render-client.js at slot-part bind time). The apply step swaps these
 * nodes into and out of the slot as the projection state toggles between
 * "actual" and "fallback".
 */
export const SLOT_FALLBACK_FRAG = Symbol('webjs.slot.fallbackFrag');

/** Maximum recursion depth for assignedNodes({flatten: true}); guards cycles. */
const FLATTEN_MAX_DEPTH = 64;

// ---------------------------------------------------------------------------
// Saved native references and prototype polyfills
//
// Module-load tries to install polyfills immediately. In a pure Node
// process without a DOM library, HTMLSlotElement is undefined and the
// install is a no-op. Tests that set up linkedom AFTER module load can
// call installSlotPolyfills() explicitly to re-attempt the install.
// Subsequent calls are idempotent; native references are captured only
// on the first successful install.
// ---------------------------------------------------------------------------

let NATIVE_assignedNodes = null;
let NATIVE_assignedElements = null;
let NATIVE_assignedSlot_desc = null;
let polyfillsInstalled = false;

/**
 * Install the slot DOM-API polyfills on HTMLSlotElement.prototype and
 * Element.prototype if the current realm has those globals. Idempotent.
 * No-op when the realm has no DOM (server-side import-only path).
 */
export function installSlotPolyfills() {
  if (polyfillsInstalled) return;
  inBrowser = detectBrowser();
  if (!inBrowser) return;
  NATIVE_assignedNodes = HTMLSlotElement.prototype.assignedNodes;
  NATIVE_assignedElements = HTMLSlotElement.prototype.assignedElements;
  NATIVE_assignedSlot_desc = Object.getOwnPropertyDescriptor(Element.prototype, 'assignedSlot');

  HTMLSlotElement.prototype.assignedNodes = function patchedAssignedNodes(options) {
    // Two conditions must both hold for the polyfill to take over:
    //   1. The slot carries the framework's data-webjs-light marker.
    //   2. The slot is NOT currently inside a shadow root.
    // Slots that end up in a shadow tree (their host has a ShadowRoot)
    // delegate to native projection, which the browser performs from the
    // host's light-DOM children. discoverSlots cannot tell at template
    // compile time whether the template will be cloned into a light or
    // shadow render root (templates cache by strings identity), so the
    // shadow-vs-light determination has to happen on every API call.
    if (this.hasAttribute(LIGHT_SLOT_ATTR) && !isInShadowRoot(this)) {
      return lightAssignedNodes(this, options);
    }
    return NATIVE_assignedNodes ? NATIVE_assignedNodes.call(this, options) : [];
  };

  HTMLSlotElement.prototype.assignedElements = function patchedAssignedElements(options) {
    if (this.hasAttribute(LIGHT_SLOT_ATTR) && !isInShadowRoot(this)) {
      return lightAssignedNodes(this, options).filter((n) => n.nodeType === 1);
    }
    return NATIVE_assignedElements ? NATIVE_assignedElements.call(this, options) : [];
  };

  Object.defineProperty(Element.prototype, 'assignedSlot', {
    configurable: true,
    enumerable: true,
    get: function patchedAssignedSlot() {
      const native =
        NATIVE_assignedSlot_desc && NATIVE_assignedSlot_desc.get
          ? NATIVE_assignedSlot_desc.get.call(this)
          : null;
      if (native) return native;
      return findLightAssignedSlot(this);
    },
  });
  polyfillsInstalled = true;
}

// First-chance install at module load.
installSlotPolyfills();

/**
 * True when the given node lives inside a shadow root (so native browser
 * slot projection applies). A ShadowRoot exposes its owning element as
 * `host`; the document does not. Walks the parentNode chain manually
 * with a depth cap to avoid hangs on accidentally cyclic DOMs (e.g.,
 * test fixtures that wire two slots into each other).
 *
 * @param {Node} node
 * @returns {boolean}
 */
function isInShadowRoot(node) {
  let n = node;
  for (let depth = 0; depth < 128; depth++) {
    const parent = n.parentNode;
    if (!parent) return false;
    if (parent === n) return false;
    // A real ShadowRoot is a DocumentFragment (nodeType 11) exposing its
    // owner as `.host`. `.host` truthiness ALONE misfires on ordinary
    // elements: HTMLAnchorElement/HTMLAreaElement expose a URL-derived
    // `.host`, so a slot inside an <a> card read as "in shadow DOM".
    if (parent.nodeType === 11 && /** @type {any} */ (parent).host) return true;
    n = parent;
  }
  return false;
}

/**
 * Resolve assigned nodes for a light-DOM slot. Per spec, returns []
 * when the slot is displaying fallback content.
 *
 * @param {HTMLSlotElement} slot
 * @param {{ flatten?: boolean }} [options]
 * @returns {Node[]}
 */
function lightAssignedNodes(slot, options) {
  if (slot.getAttribute(PROJECTION_ATTR) === PROJECTION_FALLBACK) return [];
  const direct = Array.from(slot.childNodes);
  if (!options || !options.flatten) return direct;
  return flattenAssignedNodes(direct, new Set(), 0);
}

/**
 * Walk a node list, expanding any data-webjs-light slot into its assigned
 * nodes recursively. Native shadow slots encountered in the chain delegate
 * to their native assignedNodes({flatten: true}).
 *
 * @param {Node[]} nodes
 * @param {Set<HTMLSlotElement>} visited
 * @param {number} depth
 * @returns {Node[]}
 */
function flattenAssignedNodes(nodes, visited, depth) {
  if (depth >= FLATTEN_MAX_DEPTH) return nodes.slice();
  const out = [];
  for (const node of nodes) {
    if (node.nodeType === 1 && /** @type {Element} */ (node).tagName === 'SLOT') {
      const slot = /** @type {HTMLSlotElement} */ (node);
      if (visited.has(slot)) continue;
      visited.add(slot);
      if (slot.hasAttribute(LIGHT_SLOT_ATTR)) {
        const inner = lightAssignedNodes(slot, { flatten: false });
        if (inner.length > 0) {
          for (const n of flattenAssignedNodes(inner, visited, depth + 1)) out.push(n);
        } else {
          // Fallback content contributes its children.
          for (const n of flattenAssignedNodes(Array.from(slot.childNodes), visited, depth + 1)) {
            out.push(n);
          }
        }
      } else if (NATIVE_assignedNodes) {
        const inner = NATIVE_assignedNodes.call(slot, { flatten: true });
        for (const n of inner) out.push(n);
      } else {
        out.push(node);
      }
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * Walk an element's ancestor chain to find a data-webjs-light slot it is
 * currently projected into. Returns null if the element is in a fallback
 * slot or no light slot at all.
 *
 * @param {Element} el
 * @returns {HTMLSlotElement | null}
 */
function findLightAssignedSlot(el) {
  let p = el.parentElement;
  while (p) {
    if (p.tagName === 'SLOT' && p.hasAttribute(LIGHT_SLOT_ATTR)) {
      return p.getAttribute(PROJECTION_ATTR) === PROJECTION_ACTUAL
        ? /** @type {HTMLSlotElement} */ (p)
        : null;
    }
    p = p.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-host state: the slot record
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SlotState
 * @property {Map<string|null, Node[]>} assignedByName The slot record:
 *   captured (or programmatically set) content per slot name (null is the
 *   default slot). The single source of truth for what each slot shows.
 * @property {WeakMap<HTMLSlotElement, Node[]>} lastSnapshot Per-slot
 *   record of the previous assigned-node set for slotchange equality.
 * @property {Set<HTMLSlotElement>} [pendingSlotChanges] Slots whose
 *   assignment changed since the last microtask flush (coalesced slotchange).
 * @property {boolean} [slotChangeScheduled] True while a coalesced
 *   slotchange flush is queued for this host.
 */

/**
 * Lazily create and return the slot state for a host element.
 *
 * @param {Element} host
 * @returns {SlotState}
 */
export function ensureSlotState(host) {
  /** @type {any} */
  const h = host;
  let state = h[SLOT_STATE];
  if (!state) {
    state = {
      assignedByName: new Map(),
      lastSnapshot: new WeakMap(),
    };
    h[SLOT_STATE] = state;
  }
  return state;
}

/** True when the host has slot state initialised. */
export function hasSlotState(host) {
  return Boolean(/** @type {any} */ (host)[SLOT_STATE]);
}

// ---------------------------------------------------------------------------
// Capture: once per host lifetime
// ---------------------------------------------------------------------------

/**
 * Move every authored child of `host` into the slot record, partitioning
 * by each child's `slot=""` attribute. After this runs, `host` has no
 * children; the renderer re-inserts them at slot-apply time inside the
 * correct <slot> elements. Runs ONCE per host lifetime (first mount, no
 * SSR); there is no later re-capture, so rendered nodes can never be
 * misclassified as authored children (#1006, closed by construction).
 *
 * @param {Element} host
 */
export function captureAuthoredChildren(host) {
  const state = ensureSlotState(host);
  while (host.firstChild) {
    const node = host.firstChild;
    const name = slotNameOf(node);
    appendToMap(state.assignedByName, name, node);
    host.removeChild(node);
  }
}

/**
 * After SSR + hydration, projected children already live inside their
 * <slot data-webjs-light> elements. Walk the host's render tree and
 * record those existing assignments in the record without moving DOM.
 * The capture-once counterpart for the hydration path.
 *
 * @param {Element} host
 */
export function adoptSSRAssignments(host) {
  const state = ensureSlotState(host);
  const slots = host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}]`);
  for (const slot of slots) {
    /** @type {HTMLSlotElement} */
    const s = /** @type {any} */ (slot);
    // Only the host's OWN slots. A nested component's slot (another custom
    // element sits between it and the host) belongs to THAT component and is
    // adopted from its own record. Without this filter, a nested actual slot
    // that precedes the outer host's same-named slot in document order wins
    // the first-wins `has(name)` check below, so the outer record adopts the
    // inner component's children and the outer's first apply physically steals
    // them. `applySlotAssignments` and the router both filter; this path must
    // too.
    if (!isOwnSlot(host, s)) continue;
    if (s.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL) continue;
    const name = keyOfName(s.getAttribute('name'));
    if (!state.assignedByName.has(name)) {
      const children = Array.from(s.childNodes);
      state.assignedByName.set(name, children);
      state.lastSnapshot.set(s, children.slice());
    }
  }
}

/**
 * Normalise a slot name to the record key, applied at EVERY name read
 * (capture, adopt, application, rescue, and the public API) so the record
 * key is uniform end to end. The default slot is stored under `null`;
 * `''` and `'default'` are aliases for it. Consequence: `default` is a
 * RESERVED slot name (a literal `name="default"` slot addresses the
 * default slot); the SSR substitution applies the same rule.
 *
 * @param {string | null | undefined} name
 * @returns {string | null}
 */
function keyOfName(name) {
  return name == null || name === '' || name === 'default' ? null : name;
}

/**
 * Read the slot="" attribute on an element child. Text and comment nodes
 * always route to the default slot (key = null).
 *
 * @param {Node} node
 * @returns {string | null}
 */
function slotNameOf(node) {
  if (node.nodeType !== 1) return null;
  const el = /** @type {Element} */ (node);
  return keyOfName(el.getAttribute('slot'));
}

/** Append a value to a Map<K, V[]>, creating the array on first hit. */
function appendToMap(map, key, value) {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(value);
}

// ---------------------------------------------------------------------------
// The public children-as-values API (#1015)
// ---------------------------------------------------------------------------

/**
 * A read view of the host's slot record: `{ default: Node[], [name]: Node[] }`.
 * Fresh arrays each call, so callers cannot corrupt the record. Enables
 * conditional-on-slot rendering (`this.slots.header ? ... : ...`).
 *
 * @param {Element} host
 * @returns {Record<string, Node[]>}
 */
export function slotsView(host) {
  /** @type {Record<string, Node[]>} */
  const view = {};
  const state = /** @type {SlotState | undefined} */ (/** @type {any} */ (host)[SLOT_STATE]);
  if (!state) return view;
  for (const [name, nodes] of state.assignedByName) {
    view[name == null ? 'default' : name] = nodes.slice();
  }
  return view;
}

/**
 * Does the host's slot record carry content for `name`?
 *
 * @param {Element} host
 * @param {string | null} [name]
 * @returns {boolean}
 */
export function hasSlotContent(host, name) {
  const state = /** @type {SlotState | undefined} */ (/** @type {any} */ (host)[SLOT_STATE]);
  if (!state) return false;
  const arr = state.assignedByName.get(keyOfName(name));
  return Boolean(arr && arr.length);
}

/**
 * Replace a slot's content (#1015): THE dynamic path for slotted children.
 * Updates the record, re-applies the host's slot assignments, and fires
 * `slotchange` on any slot whose assignment changed. Accepts a Node, a
 * Node[], a string (becomes a Text node), or null/[] to clear the slot
 * back to its fallback content.
 *
 * This replaces the deleted live re-projection observers: an external
 * `appendChild` or `slot=""` flip on a mounted host is inert by design;
 * the owner of dynamic slot content calls this API instead (the client
 * router does exactly that during a same-route morph).
 *
 * @param {Element} host
 * @param {string | null} name
 * @param {Node | Node[] | string | null} value
 */
export function setSlotContent(host, name, value) {
  const state = ensureSlotState(host);
  const key = keyOfName(name);
  const nodes = normalizeSlotValue(host, value);
  if (nodes.length) state.assignedByName.set(key, nodes);
  else state.assignedByName.delete(key);
  applySlotAssignments(host);
}

/**
 * @param {Element} host
 * @param {Node | Node[] | string | null} value
 * @returns {Node[]}
 */
function normalizeSlotValue(host, value) {
  if (value == null) return [];
  if (typeof value === 'string') {
    const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
    return doc ? [doc.createTextNode(value)] : [];
  }
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

// ---------------------------------------------------------------------------
// Render-owned slot application
// ---------------------------------------------------------------------------

/**
 * Place the slot record into the host's OWN light-DOM slots (#1015). The
 * renderer's slot parts call this after the template commits, and
 * `setSlotContent` calls it after a record update. Idempotent and cheap on
 * no-change passes.
 *
 *   1. Collect the host's OWN slots (no other custom element between the
 *      slot and the host; a nested component's slots belong to it).
 *   2. Group by `name`, first-wins: the first slot of each name shows the
 *      record content, later duplicates show fallback.
 *   3. `data-projection` is stamped "actual" or "fallback" accordingly;
 *      fallback content swaps through the part-owned holding fragment.
 *   4. `slotchange` fires on slots whose assigned set actually changed.
 *
 * @param {Element} host
 */
export function applySlotAssignments(host) {
  if (!inBrowser) return;
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return;

  // 1. The host's own slots, document order.
  /** @type {HTMLSlotElement[]} */
  const slots = [];
  for (const el of host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}]`)) {
    if (isOwnSlot(host, el)) slots.push(/** @type {HTMLSlotElement} */ (el));
  }

  // 2. Group by current `name` attribute in document order.
  /** @type {Map<string|null, HTMLSlotElement[]>} */
  const groups = new Map();
  for (const slot of slots) {
    const name = keyOfName(slot.getAttribute('name'));
    let arr = groups.get(name);
    if (!arr) {
      arr = [];
      groups.set(name, arr);
    }
    arr.push(slot);
  }

  // 3. Assign per the first-wins rule.
  /** @type {HTMLSlotElement[]} */
  const slotsChanged = [];
  for (const [name, group] of groups) {
    const assigned = state.assignedByName.get(name) || [];
    for (let i = 0; i < group.length; i++) {
      const slot = group[i];
      if (i === 0 && assigned.length > 0) {
        if (applyActualAssignment(state, slot, assigned)) {
          slotsChanged.push(slot);
        }
      } else {
        if (applyFallback(state, slot)) slotsChanged.push(slot);
      }
    }
  }

  // 4. Queue slotchange on slots whose assignment actually changed. Native
  //    timing: assignment recomputes synchronously (placement above already
  //    ran) but the slotchange EVENT is async and coalesced (one per slot per
  //    microtask). Synchronous dispatch here would let an author mutation
  //    inside a slotchange handler recurse into this writer mid-loop, and
  //    would fire N events for an N-node loop; coalescing matches the spec.
  for (const slot of slotsChanged) queueSlotChange(state, slot);
}

/**
 * True when `slot` belongs to `host` directly: no OTHER custom element
 * sits between them. A slot nested inside a child custom element belongs
 * to THAT component and is applied from its own record.
 *
 * @param {Element} host
 * @param {Element} slot
 * @returns {boolean}
 */
function isOwnSlot(host, slot) {
  for (let p = slot.parentElement; p && p !== host; p = p.parentElement) {
    if (p.tagName.includes('-')) return false;
  }
  return true;
}

/**
 * Set a slot to actual-assignment mode and move the given nodes into it.
 * Preserves DOM identity by re-using the same Node references when they
 * are already inside the slot in the same order.
 *
 * @param {SlotState} state
 * @param {HTMLSlotElement} slot
 * @param {Node[]} assigned
 * @returns {boolean} True if the slot's assignment changed compared to
 *   its last snapshot (so slotchange should fire).
 */
export function applyActualAssignment(state, slot, assigned) {
  const wasFallback = slot.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL;
  const prev = state.lastSnapshot.get(slot) || [];
  const equal = !wasFallback && arraysEqual(prev, assigned);
  if (equal) return false;

  // Fast path: the assigned nodes are ALREADY the slot's children in the
  // same order (the router's morph reconciles in place, then syncs the
  // record). Skip the detach/re-append churn (which would bounce nested
  // custom elements through a disconnect/connect cycle) and just settle
  // the snapshot; slotchange still reflects the set change vs the
  // previous snapshot.
  if (!wasFallback && arraysEqual(Array.from(slot.childNodes), assigned)) {
    state.lastSnapshot.set(slot, assigned.slice());
    return !arraysEqual(prev, assigned);
  }

  // Preserve fallback content. If the slot currently holds fallback nodes
  // (either because we just hydrated from SSR's data-projection="fallback"
  // or because the slot-part placed them there at bind time), move them
  // back into the part-owned holding fragment so they survive for a later
  // transition. Identified via the SLOT_FALLBACK_FRAG symbol that the
  // slot-part wrote to the element.
  const fallbackFrag = /** @type {DocumentFragment | undefined} */ (
    /** @type {any} */ (slot)[SLOT_FALLBACK_FRAG]
  );
  if (wasFallback && fallbackFrag) {
    while (slot.firstChild) fallbackFrag.appendChild(slot.firstChild);
  } else {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
  }
  for (const node of assigned) slot.appendChild(node);
  slot.setAttribute(PROJECTION_ATTR, PROJECTION_ACTUAL);
  state.lastSnapshot.set(slot, assigned.slice());
  return true;
}

/**
 * Set a slot to fallback mode: clear any actual-assignment children and
 * restore the part-owned fallback fragment. The record keeps the nodes
 * (they are values now), so a later `setSlotContent` or slot re-creation
 * re-places them.
 *
 * @param {SlotState} state
 * @param {HTMLSlotElement} slot
 * @returns {boolean} True if the slot transitioned from actual to
 *   fallback this pass.
 */
export function applyFallback(state, slot) {
  const wasActual = slot.getAttribute(PROJECTION_ATTR) === PROJECTION_ACTUAL;
  slot.setAttribute(PROJECTION_ATTR, PROJECTION_FALLBACK);
  if (!wasActual) {
    // Already fallback. Make sure the fallback content is materialised
    // in the slot if the slot-part has a holding fragment with nodes.
    restoreFallbackInto(slot);
    return false;
  }

  // Slot transitioning from actual to fallback (the record no longer has
  // content for this name).
  state.lastSnapshot.delete(slot);
  while (slot.firstChild) slot.removeChild(slot.firstChild);
  restoreFallbackInto(slot);
  return true;
}

/**
 * Move the slot-part's holding fragment back into the slot. No-op if no
 * fragment is attached or it is already empty.
 *
 * @param {HTMLSlotElement} slot
 */
function restoreFallbackInto(slot) {
  const frag = /** @type {DocumentFragment | undefined} */ (
    /** @type {any} */ (slot)[SLOT_FALLBACK_FRAG]
  );
  if (!frag || frag.childNodes.length === 0) return;
  slot.appendChild(frag);
}

// ---------------------------------------------------------------------------
// Renderer teardown hook (called from render-client.js)
// ---------------------------------------------------------------------------

/**
 * Detach a slot's record-owned children from the slot element before the
 * renderer's template teardown disposes the slot's subtree (a conditional
 * fragment collapsing). The RECORD keeps the node references, so when a
 * re-render re-creates the slot, `applySlotAssignments` re-places the very
 * same nodes: children are values, teardown never disposes consumer nodes.
 *
 * @param {Element} host
 * @param {HTMLSlotElement} slot
 */
export function rescueAssignedNodes(host, slot) {
  if (!hasSlotState(host)) return;
  const state = ensureSlotState(host);
  const name = keyOfName(slot.getAttribute('name'));
  const assigned = state.assignedByName.get(name);
  if (assigned) {
    for (const node of assigned) {
      if (node.parentNode === slot) slot.removeChild(node);
    }
  }
  state.lastSnapshot.delete(slot);
}

// ---------------------------------------------------------------------------
// slotchange event dispatch
// ---------------------------------------------------------------------------

/** Fire a `slotchange` event on the slot (bubbles, not composed; per spec). */
export function fireSlotChange(slot) {
  slot.dispatchEvent(new Event('slotchange', { bubbles: true, composed: false }));
}

/**
 * Queue a coalesced `slotchange` for a slot. The event is dispatched on a
 * microtask, and a slot that changes more than once before the flush fires
 * exactly once (native `slotchange` timing: async and coalesced per slot).
 * A slot detached before the flush is skipped.
 *
 * @param {SlotState} state
 * @param {HTMLSlotElement} slot
 */
export function queueSlotChange(state, slot) {
  if (!state.pendingSlotChanges) state.pendingSlotChanges = new Set();
  state.pendingSlotChanges.add(slot);
  if (state.slotChangeScheduled) return;
  state.slotChangeScheduled = true;
  queueMicrotask(() => {
    state.slotChangeScheduled = false;
    const pending = state.pendingSlotChanges || new Set();
    state.pendingSlotChanges = new Set();
    for (const s of pending) {
      if (s.isConnected) fireSlotChange(s);
    }
  });
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Strict per-index equality on two arrays. */
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
