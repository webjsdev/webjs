/**
 * Light-DOM <slot> runtime for @webjskit/core.
 *
 * Provides functional parity with shadow-DOM <slot> projection inside
 * light-DOM WebComponents (those with static shadow = false). The framework
 * physically projects authored children into <slot> elements at render
 * time and fires slotchange events. The DOM API surface (assignedNodes,
 * assignedElements, assignedSlot) is polyfilled on HTMLSlotElement and
 * Element prototypes so user code reads the same against light-DOM slots
 * as it does against native shadow-DOM slots.
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
 *
 * Cross-file coordination. Two pieces of behaviour live partly here and
 * partly in render-client.js:
 *   1. Fallback content restoration. When a slot transitions to
 *      data-projection="fallback", slot.js clears the actual-assigned
 *      children; the slot-part's apply step in render-client.js
 *      restores the compiled fallback template into the slot.
 *   2. Slot-part teardown (slot inside a conditional that collapsed).
 *      render-client.js calls movePendingFromTorndownSlot() before
 *      removing the slot from the DOM so its assigned children survive
 *      to be re-projected on the next render.
 */

// ---------------------------------------------------------------------------
// Module-scope constants
// ---------------------------------------------------------------------------

const inBrowser =
  typeof HTMLElement !== 'undefined' && typeof HTMLSlotElement !== 'undefined';

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

/** Maximum recursion depth for assignedNodes({flatten: true}); guards cycles. */
const FLATTEN_MAX_DEPTH = 64;

// ---------------------------------------------------------------------------
// Saved native references (browser-only)
// ---------------------------------------------------------------------------

const NATIVE_assignedNodes = inBrowser ? HTMLSlotElement.prototype.assignedNodes : null;
const NATIVE_assignedElements = inBrowser ? HTMLSlotElement.prototype.assignedElements : null;
const NATIVE_assignedSlot_desc = inBrowser
  ? Object.getOwnPropertyDescriptor(Element.prototype, 'assignedSlot')
  : null;

// ---------------------------------------------------------------------------
// Prototype polyfills
// ---------------------------------------------------------------------------

if (inBrowser) {
  HTMLSlotElement.prototype.assignedNodes = function patchedAssignedNodes(options) {
    if (this.hasAttribute(LIGHT_SLOT_ATTR)) {
      return lightAssignedNodes(this, options);
    }
    return NATIVE_assignedNodes.call(this, options);
  };

  HTMLSlotElement.prototype.assignedElements = function patchedAssignedElements(options) {
    if (this.hasAttribute(LIGHT_SLOT_ATTR)) {
      return lightAssignedNodes(this, options).filter((n) => n.nodeType === 1);
    }
    return NATIVE_assignedElements.call(this, options);
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
// Per-host state
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SlotState
 * @property {Map<string|null, Node[]>} assignedByName Captured authored
 *   children per slot name (null is the default slot).
 * @property {Map<string|null, Node[]>} pendingByName Children awaiting a
 *   slot to be (re-)created. Populated when a slot is torn down by a
 *   conditional collapse or removed from the render tree.
 * @property {WeakMap<HTMLSlotElement, Node[]>} lastSnapshot Per-slot
 *   record of the previous assigned-node set for slotchange equality.
 * @property {WeakMap<HTMLSlotElement, MutationObserver>} nameObservers
 *   Per-slot `name` attribute observers.
 * @property {MutationObserver | null} childObserver Host's childList +
 *   child `slot` attribute observer.
 * @property {boolean} scheduled Microtask flag for batched projection.
 * @property {Set<HTMLSlotElement>} ownedSlots Slots we currently track.
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
      pendingByName: new Map(),
      lastSnapshot: new WeakMap(),
      nameObservers: new WeakMap(),
      childObserver: null,
      scheduled: false,
      ownedSlots: new Set(),
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
// Authored-child capture
// ---------------------------------------------------------------------------

/**
 * Move every authored child of `host` into the slot state, partitioning
 * by each child's `slot=""` attribute. After this runs, `host` has no
 * children; the framework re-inserts them at projection time inside the
 * correct <slot> elements. Idempotent.
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
 * record those existing assignments in the state without moving DOM.
 *
 * @param {Element} host
 */
export function adoptSSRAssignments(host) {
  const state = ensureSlotState(host);
  const slots = host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}]`);
  for (const slot of slots) {
    /** @type {HTMLSlotElement} */
    const s = /** @type {any} */ (slot);
    if (s.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL) continue;
    const name = s.getAttribute('name') || null;
    if (!state.assignedByName.has(name)) {
      const children = Array.from(s.childNodes);
      state.assignedByName.set(name, children);
      state.lastSnapshot.set(s, children.slice());
    }
  }
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
  const v = el.getAttribute('slot');
  return v ? v : null;
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

/** Append a list of values to a Map<K, V[]>. */
function appendArrayToMap(map, key, values) {
  if (!values.length) return;
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  for (const v of values) arr.push(v);
}

// ---------------------------------------------------------------------------
// Observers
// ---------------------------------------------------------------------------

/**
 * Attach mutation observers to a host. Watches:
 *   1. Host's childList for authored children added or removed at runtime.
 *   2. Host's children's `slot` attribute for children moving between slots.
 *
 * Slot-name observers are attached separately by projectChildren when it
 * discovers a new slot element.
 *
 * @param {Element} host
 */
export function attachSlotObservers(host) {
  if (!inBrowser) return;
  const state = ensureSlotState(host);
  if (state.childObserver) return;
  state.childObserver = new MutationObserver((records) => {
    let dirty = false;
    for (const r of records) {
      if (r.type === 'childList') {
        for (const node of r.addedNodes) {
          if (node.parentElement === host) {
            appendToMap(state.assignedByName, slotNameOf(node), node);
            host.removeChild(node);
            dirty = true;
          }
        }
        for (const node of r.removedNodes) {
          if (removeFromAssignments(state, node)) dirty = true;
        }
      } else if (r.type === 'attributes' && r.attributeName === 'slot') {
        const target = /** @type {Element} */ (r.target);
        if (target.parentElement === host || hostOwnsAssignedNode(host, target)) {
          if (removeFromAssignments(state, target)) {
            appendToMap(state.assignedByName, slotNameOf(target), target);
            dirty = true;
          }
        }
      }
    }
    if (dirty) scheduleProjection(host);
  });
  state.childObserver.observe(host, {
    childList: true,
    attributes: true,
    attributeFilter: ['slot'],
    subtree: false,
  });
}

/**
 * Detach the host's child observer and every slot-name observer. Called
 * from disconnectedCallback. The state itself is preserved so that a
 * subsequent reconnection picks up where it left off.
 *
 * @param {Element} host
 */
export function detachSlotObservers(host) {
  /** @type {SlotState | undefined} */
  const state = /** @type {any} */ (host)[SLOT_STATE];
  if (!state) return;
  if (state.childObserver) {
    state.childObserver.disconnect();
    state.childObserver = null;
  }
  for (const slot of state.ownedSlots) {
    const obs = state.nameObservers.get(slot);
    if (obs) {
      obs.disconnect();
      state.nameObservers.delete(slot);
    }
  }
}

/** Remove a node from the assignedByName map. Returns true if removed. */
function removeFromAssignments(state, node) {
  for (const [key, arr] of state.assignedByName) {
    const idx = arr.indexOf(node);
    if (idx !== -1) {
      arr.splice(idx, 1);
      if (arr.length === 0) state.assignedByName.delete(key);
      return true;
    }
  }
  return false;
}

/**
 * True when `node` is currently slotted inside one of the host's owned
 * slots. Used to decide whether a `slot` attribute mutation on an
 * already-projected node should trigger a re-projection.
 */
function hostOwnsAssignedNode(host, node) {
  let p = node.parentElement;
  while (p && p !== host) {
    if (p.tagName === 'SLOT' && p.hasAttribute(LIGHT_SLOT_ATTR)) {
      let q = p.parentElement;
      while (q && q !== host) q = q.parentElement;
      return q === host;
    }
    p = p.parentElement;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Microtask-batched projection scheduler
// ---------------------------------------------------------------------------

/**
 * Schedule a projection pass for the host on the next microtask. Multiple
 * calls within one synchronous task collapse to one projection. This is
 * the entry point every observer callback uses.
 *
 * @param {Element} host
 */
export function scheduleProjection(host) {
  const state = ensureSlotState(host);
  if (state.scheduled) return;
  state.scheduled = true;
  queueMicrotask(() => {
    state.scheduled = false;
    projectChildren(host);
  });
}

// ---------------------------------------------------------------------------
// Core projection routine
// ---------------------------------------------------------------------------

/**
 * Walk the host's render tree for light-DOM slots, group by their current
 * `name` attribute, apply the first-wins assignment rule, then materialise
 * the result in DOM. Idempotent and cheap on no-change passes.
 *
 *   1. Each slot is marked data-projection="actual" or "fallback".
 *   2. Each "actual" slot has its current children replaced by the
 *      assigned nodes (Node identity preserved for already-projected
 *      refs by reusing the same Node objects).
 *   3. Each "fallback" slot is reset by the framework's slot-part apply
 *      step in render-client.js, which restores the compiled fallback
 *      template.
 *   4. slotchange fires on slots whose assigned-node set changed.
 *
 * @param {Element} host
 */
export function projectChildren(host) {
  if (!inBrowser) return;
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return;

  // 1. Collect every owned slot in document order.
  const slots = /** @type {HTMLSlotElement[]} */ (
    Array.from(host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}]`))
  );

  // 2. Reconcile ownedSlots membership. Slots that disappeared from the
  // render tree have their assigned children moved to pending so a future
  // re-render can re-project them (slot inside a conditional that
  // collapsed, etc.).
  const newOwned = new Set(slots);
  for (const slot of state.ownedSlots) {
    if (!newOwned.has(slot)) {
      handleSlotRemoved(state, slot);
    }
  }
  for (const slot of newOwned) {
    if (!state.ownedSlots.has(slot)) {
      attachNameObserver(host, slot);
    }
  }
  state.ownedSlots = newOwned;

  // 3. Group slots by current `name` attribute in document order.
  /** @type {Map<string|null, HTMLSlotElement[]>} */
  const groups = new Map();
  for (const slot of slots) {
    const name = slot.getAttribute('name') || null;
    let arr = groups.get(name);
    if (!arr) {
      arr = [];
      groups.set(name, arr);
    }
    arr.push(slot);
  }

  // 4. Drain pending children into assignedByName per group. Pending
  // represents previously-displayed projection (a slot disappeared and
  // is reappearing); putting it ahead of newer captured children keeps
  // visual order stable across conditional toggles.
  for (const name of groups.keys()) {
    const pending = state.pendingByName.get(name);
    if (pending && pending.length) {
      const current = state.assignedByName.get(name) || [];
      const merged = [];
      for (const n of pending) merged.push(n);
      for (const n of current) if (merged.indexOf(n) === -1) merged.push(n);
      state.assignedByName.set(name, merged);
      state.pendingByName.delete(name);
    }
  }

  // 5. Assign per the first-wins rule. Primary (index 0) of each group
  // gets the actual children; the rest show fallback.
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

  // 6. Dispatch slotchange on slots whose assignment actually changed.
  for (const slot of slotsChanged) fireSlotChange(slot);
}

/**
 * Move a slot's previous assignment to the pending map keyed by the
 * slot's last-known name. Used when the slot itself disappears from the
 * render tree (e.g., conditional collapse).
 *
 * @param {SlotState} state
 * @param {HTMLSlotElement} slot
 */
function handleSlotRemoved(state, slot) {
  const obs = state.nameObservers.get(slot);
  if (obs) {
    obs.disconnect();
    state.nameObservers.delete(slot);
  }
  const prev = state.lastSnapshot.get(slot);
  if (prev && prev.length > 0) {
    const lastName = slot.getAttribute('name') || null;
    appendArrayToMap(state.pendingByName, lastName, prev);
  }
  state.lastSnapshot.delete(slot);
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
function applyActualAssignment(state, slot, assigned) {
  const wasFallback = slot.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL;
  const prev = state.lastSnapshot.get(slot) || [];
  const equal = !wasFallback && arraysEqual(prev, assigned);
  if (equal) return false;

  while (slot.firstChild) slot.removeChild(slot.firstChild);
  for (const node of assigned) slot.appendChild(node);
  slot.setAttribute(PROJECTION_ATTR, PROJECTION_ACTUAL);
  state.lastSnapshot.set(slot, assigned.slice());
  return true;
}

/**
 * Set a slot to fallback mode. slot.js clears any actual-assignment
 * children (moving them to pending for re-projection later) and sets the
 * marker attribute. The compiled fallback template is restored by the
 * slot-part's apply step in render-client.js, since the fallback content
 * may include template holes that the renderer needs to bind.
 *
 * @param {SlotState} state
 * @param {HTMLSlotElement} slot
 * @returns {boolean} True if the slot transitioned from actual to
 *   fallback this pass.
 */
function applyFallback(state, slot) {
  const wasActual = slot.getAttribute(PROJECTION_ATTR) === PROJECTION_ACTUAL;
  slot.setAttribute(PROJECTION_ATTR, PROJECTION_FALLBACK);
  if (!wasActual) return false;

  const prev = state.lastSnapshot.get(slot) || [];
  if (prev.length > 0) {
    const lastName = slot.getAttribute('name') || null;
    appendArrayToMap(state.pendingByName, lastName, prev);
  }
  state.lastSnapshot.delete(slot);
  while (slot.firstChild) slot.removeChild(slot.firstChild);
  return true;
}

/**
 * Attach a MutationObserver to a slot's `name` attribute so re-targeting
 * (via dynamic name change) triggers re-projection.
 *
 * @param {Element} host
 * @param {HTMLSlotElement} slot
 */
function attachNameObserver(host, slot) {
  if (!inBrowser) return;
  const state = ensureSlotState(host);
  if (state.nameObservers.has(slot)) return;
  const obs = new MutationObserver(() => scheduleProjection(host));
  obs.observe(slot, { attributes: true, attributeFilter: ['name'] });
  state.nameObservers.set(slot, obs);
}

// ---------------------------------------------------------------------------
// Slot-part teardown hook (called from render-client.js)
// ---------------------------------------------------------------------------

/**
 * Move a slot's currently-projected children to the host's pending map
 * before the slot DOM element is removed by the framework's template
 * teardown (e.g., a conditional fragment collapsing). Called by
 * render-client.js immediately before disposing the slot-part.
 *
 * Without this hook the children would be torn down by the renderer's
 * generic clearInstance() and lose DOM identity.
 *
 * @param {Element} host
 * @param {HTMLSlotElement} slot
 */
export function moveSlotChildrenToPending(host, slot) {
  if (!hasSlotState(host)) return;
  const state = ensureSlotState(host);
  const projected = state.lastSnapshot.get(slot);
  if (!projected || projected.length === 0) return;
  const name = slot.getAttribute('name') || null;
  // Detach nodes from the slot so the renderer's clearInstance doesn't
  // dispose them.
  for (const node of projected) {
    if (node.parentNode === slot) slot.removeChild(node);
  }
  appendArrayToMap(state.pendingByName, name, projected);
  state.lastSnapshot.delete(slot);
  const obs = state.nameObservers.get(slot);
  if (obs) {
    obs.disconnect();
    state.nameObservers.delete(slot);
  }
  state.ownedSlots.delete(slot);
}

// ---------------------------------------------------------------------------
// slotchange event dispatch
// ---------------------------------------------------------------------------

/** Fire a `slotchange` event on the slot (bubbles, not composed; per spec). */
function fireSlotChange(slot) {
  slot.dispatchEvent(new Event('slotchange', { bubbles: true, composed: false }));
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
