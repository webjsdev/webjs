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
let NATIVE_assign = null;
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

  NATIVE_assign = HTMLSlotElement.prototype.assign;
  HTMLSlotElement.prototype.assign = function patchedAssign(...nodes) {
    if (this.hasAttribute(LIGHT_SLOT_ATTR) && !isInShadowRoot(this)) {
      // Manual slot assignment (imperative, overrides attribute mode). Record
      // the manual list for this slot's name in a per-host overlay that
      // repartition honors, then re-derive + re-place through the one writer.
      const host = hostOfSlot(this);
      if (host) {
        const state = ensureSlotState(host);
        if (!state.manualByName) state.manualByName = new Map();
        state.manualByName.set(keyOfName(this.getAttribute('name')), nodes.filter(Boolean));
        repartition(state);
        applySlotAssignments(host);
      }
      return undefined;
    }
    return NATIVE_assign ? NATIVE_assign.apply(this, nodes) : undefined;
  };
  polyfillsInstalled = true;
}

/** Walk up from a light slot to its owning host (the nearest SLOT_STATE). */
function hostOfSlot(slot) {
  for (let p = slot.parentElement; p; p = p.parentElement) {
    if (/** @type {any} */ (p)[SLOT_STATE]) return p;
  }
  return null;
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
 * @property {Node[]} authored The ordered source of truth: every authored
 *   child of the host, in host-child order. `assignedByName` is DERIVED from
 *   this by `repartition` (grouping each node by its current `slot=`
 *   attribute), so there is one place a node's assignment is decided.
 * @property {Map<string|null, Node[]>} assignedByName The DERIVED slot record:
 *   `authored` grouped per slot name (null is the default slot). Never mutated
 *   directly; always rebuilt by `repartition`.
 * @property {WeakMap<HTMLSlotElement, Node[]>} lastSnapshot Per-slot
 *   record of the previous assigned-node set for slotchange equality.
 * @property {Set<HTMLSlotElement>} [pendingSlotChanges] Slots whose
 *   assignment changed since the last microtask flush (coalesced slotchange).
 * @property {boolean} [slotChangeScheduled] True while a coalesced
 *   slotchange flush is queued for this host.
 * @property {MutationObserver} [backstop] Sensor for raw direct-child writes
 *   that bypass the patched methods (never moves nodes; folds into `authored`).
 * @property {MutationObserver} [flipSensor] Sensor for `slot=` / `name=`
 *   attribute flips (never moves nodes; re-derives + re-places).
 * @property {Map<string|null, Node[]>} [manualByName] Overlay for
 *   `HTMLSlotElement.assign()` manual assignment: a node here goes to the named
 *   slot regardless of its `slot=` attribute.
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
      authored: [],
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
    state.authored.push(node);
    // Detached by the framework, awaiting placement at slot-apply time: the
    // prune rule must not treat this parentless window as an author removal.
    FRAMEWORK_DETACHED.add(node);
    host.removeChild(node);
  }
  repartition(state);
}

/**
 * Rebuild `assignedByName` from `authored`: group every authored node by its
 * current `slot=""` attribute (default = null key). Pure and idempotent, the
 * single place a node's slot assignment is decided. Called after any change
 * to `authored` and at the top of `applySlotAssignments`.
 *
 * @param {SlotState} state
 */
export function repartition(state) {
  const byName = state.assignedByName;
  byName.clear();
  const manual = state.manualByName;
  for (const node of state.authored) {
    let key = slotNameOf(node);
    // A node named in a manual `HTMLSlotElement.assign()` overlay goes to that
    // slot, overriding its `slot=` attribute (native manual-assignment mode).
    if (manual && manual.size) {
      for (const [mname, mnodes] of manual) {
        if (mnodes.indexOf(node) !== -1) {
          key = mname;
          break;
        }
      }
    }
    appendToMap(byName, key, node);
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
  /** @type {Set<string|null>} first-wins per name across the host's own slots */
  const seen = new Set();
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
    if (!seen.has(name)) {
      seen.add(name);
      const children = Array.from(s.childNodes);
      // The SSR'd projected children retain their own `slot=` attribute, so
      // pushing them into `authored` and re-deriving reproduces the same
      // per-name grouping without moving any DOM (no flash).
      for (const child of children) state.authored.push(child);
      state.lastSnapshot.set(s, children.slice());
    }
  }
  repartition(state);
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
// Router coordination seam
// ---------------------------------------------------------------------------

/**
 * Replace the authored content assigned to slot `name` with `nodes`, in place
 * of the old slice's position (a new name appends). The ONE public seam the
 * client router uses to reconcile a reused light host's projected content
 * during a same-route morph (replacing the deleted `setSlotContent`): the
 * router never touches `authored` / `assignedByName` / `lastSnapshot` directly,
 * and this is the same record-then-place primitive the interception layer runs.
 *
 * @param {Element} host
 * @param {string | null} name
 * @param {Node[] | Node | null} nodes
 */
export function projectAuthored(host, name, nodes) {
  const state = ensureSlotState(host);
  const key = keyOfName(name);
  const list = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes ? [nodes] : [];
  // Position of the old slice for this name (so cross-name ordering survives).
  let at = state.authored.findIndex((n) => slotNameOf(n) === key);
  state.authored = state.authored.filter((n) => slotNameOf(n) !== key);
  if (at === -1 || at > state.authored.length) at = state.authored.length;
  for (const n of list) {
    if (n.nodeType === 1) {
      if (key == null) /** @type {Element} */ (n).removeAttribute('slot');
      else /** @type {Element} */ (n).setAttribute('slot', key);
    }
    FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
  }
  state.authored.splice(at, 0, ...list);
  repartition(state);
  applySlotAssignments(host);
}

// ---------------------------------------------------------------------------
// Native-write window + host interception (native slot-API liveness)
// ---------------------------------------------------------------------------

/**
 * Set on a host WHILE the renderer is committing into it. The patched host
 * methods check it and delegate to the saved native, so a renderer commit is
 * never mistaken for authored content. This is the one discriminator between
 * renderer writes and author writes: a synchronous framework-write window, set
 * structurally (an own symbol), never inferred from comment markers.
 */
export const RENDERING = Symbol('webjs.slot.rendering');

/** Marks a host whose mutating methods have been patched (install once). */
const INTERCEPTED = Symbol('webjs.slot.intercepted');

/** The per-host hidden holding element for authored nodes whose slot name
 *  matches no rendered slot (native keeps them connected but unrendered). */
const PARK = Symbol('webjs.slot.park');

/**
 * Authored nodes the framework detached ON PURPOSE (capture, teardown rescue),
 * so the prune rule does not treat them as author-removed while they sit
 * parentless waiting to be (re)placed. Cleared once a node is placed.
 */
const FRAMEWORK_DETACHED = new WeakSet();

// Saved native references, captured once in the browser (Node has no `Node`).
let N_appendChild = null;
let N_insertBefore = null;
let N_removeChild = null;
let N_replaceChild = null;
let N_append = null;
let N_prepend = null;
let N_replaceChildren = null;
let INNER_HTML_DESC = null;
let TEXT_CONTENT_DESC = null;

function captureNatives() {
  if (N_appendChild || !inBrowser) return;
  N_appendChild = Node.prototype.appendChild;
  N_insertBefore = Node.prototype.insertBefore;
  N_removeChild = Node.prototype.removeChild;
  N_replaceChild = Node.prototype.replaceChild;
  N_append = Element.prototype.append;
  N_prepend = Element.prototype.prepend;
  N_replaceChildren = Element.prototype.replaceChildren;
  INNER_HTML_DESC = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  TEXT_CONTENT_DESC = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
}

/**
 * Run `fn` with the renderer-write window open on `host`, restoring the prior
 * flag afterward (re-entrancy safe: nested renderer commits nest cleanly). The
 * renderer wraps every host-receiver commit in this; a write to a light host
 * inside the window bypasses the interception and hits the native DOM.
 *
 * @template T
 * @param {any} host
 * @param {() => T} fn
 * @returns {T}
 */
export function withRendererWrites(host, fn) {
  const prev = host[RENDERING];
  host[RENDERING] = true;
  try {
    return fn();
  } finally {
    host[RENDERING] = prev;
    // When the OUTERMOST window closes, discard the childList records this
    // renderer commit produced on the host, synchronously, before the backstop
    // observer's async callback can see them. The backstop then only ever
    // observes genuine author / external writes. (The flip sensor is NOT
    // drained: a renderer `name=` write on a slot is exactly what must
    // re-project a dynamic `name=${...}`.)
    if (!prev) {
      const state = host[SLOT_STATE];
      if (state && state.backstop) state.backstop.takeRecords();
    }
  }
}

/**
 * Install the two read-only sensors on a light host. Neither moves a node; each
 * only folds a mutation into `authored` and calls the single renderer-owned
 * writer. Installed on connect, torn down on disconnect.
 *   - Bypass backstop (childList, subtree:false): catches raw writes that skip
 *     the patched methods (`Node.prototype.appendChild.call`, Range ops).
 *   - Flip sensor (attributes slot/name, subtree:true): catches an `el.slot=`
 *     flip on a projected child and a slot `name=` change.
 *
 * @param {Element} host
 */
export function installSlotSensors(host) {
  if (!inBrowser) return;
  const h = /** @type {any} */ (host);
  const state = ensureSlotState(host);
  if (state.backstop) return;

  state.backstop = new MutationObserver((records) => {
    let dirty = false;
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node === h[PARK]) continue;
        if (state.authored.indexOf(node) !== -1) continue;
        // A raw direct-child insert that bypassed the patched methods. Records
        // reaching this async callback are never renderer commits (those are
        // drained at the window close), so fold it in as authored content.
        FRAMEWORK_DETACHED.add(node);
        state.authored.push(node);
        dirty = true;
      }
      for (const node of r.removedNodes) {
        const i = state.authored.indexOf(node);
        if (i !== -1 && !host.contains(node)) {
          state.authored.splice(i, 1);
          dirty = true;
        }
      }
    }
    if (dirty) applySlotAssignments(host);
  });
  state.backstop.observe(host, { childList: true, subtree: false });

  state.flipSensor = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') {
        // A slot=/name= flip somewhere in the tree. Re-derive + re-place; the
        // writer is idempotent, so an unrelated flip settles to a no-op.
        applySlotAssignments(host);
        return;
      }
    }
  });
  state.flipSensor.observe(host, {
    attributes: true,
    attributeFilter: ['slot', 'name'],
    subtree: true,
  });
}

/**
 * Tear down the sensors, processing any queued records FIRST (a bare
 * `disconnect()` drops them, which would lose an inner flip queued mid-apply
 * when a nested element bounces through disconnect/connect).
 *
 * @param {Element} host
 */
export function teardownSlotSensors(host) {
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return;
  if (state.backstop) {
    state.backstop.takeRecords();
    state.backstop.disconnect();
    state.backstop = undefined;
  }
  if (state.flipSensor) {
    state.flipSensor.takeRecords();
    state.flipSensor.disconnect();
    state.flipSensor = undefined;
  }
}

/**
 * Reconnect sweep: after a host is re-inserted, fold any direct host child that
 * is not already authored, not the park, and not the render root into
 * `authored` (covers a raw bypass write made while the host was disconnected,
 * which no sensor was live to see). Then re-apply.
 *
 * @param {Element} host
 */
export function reconnectSweep(host) {
  if (!inBrowser) return;
  const h = /** @type {any} */ (host);
  const state = /** @type {SlotState | undefined} */ (h[SLOT_STATE]);
  if (!state) return;
  const inst = h[Symbol.for('webjs.instance')];
  let changed = false;
  for (const node of Array.from(host.childNodes)) {
    if (node === h[PARK]) continue;
    if (state.authored.indexOf(node) !== -1) continue;
    // Skip the renderer's own top-level nodes (tracked on the instance).
    if (inst && instanceOwns(inst, node)) continue;
    FRAMEWORK_DETACHED.add(node);
    state.authored.push(node);
    changed = true;
  }
  if (changed) applySlotAssignments(host);
}

/**
 * True when `node` is renderer-owned: it is one of the instance's bookend
 * markers (`wjm-s` / `wjm-e`) or sits between them. Object-identity check
 * against the marker refs the instance holds, never comment-text sniffing.
 */
function instanceOwns(inst, node) {
  if (!inst || !inst.startNode || !inst.endNode) return false;
  if (node === inst.startNode || node === inst.endNode) return true;
  for (let n = inst.startNode.nextSibling; n && n !== inst.endNode; n = n.nextSibling) {
    if (n === node) return true;
  }
  return false;
}

/** The host's hidden park element, created + attached lazily. */
function parkFor(host) {
  const h = /** @type {any} */ (host);
  let park = h[PARK];
  if (!park || !park.isConnected) {
    if (!park) {
      park = host.ownerDocument.createElement('wj-slot-park');
      park.setAttribute('hidden', '');
      park.style.display = 'none';
      h[PARK] = park;
    }
    // Attach inside the host, after the rendered output, via the native path
    // (never through the patched appendChild).
    withRendererWrites(host, () => N_appendChild.call(host, park));
  }
  return park;
}

/**
 * Expand one argument of a DOM insertion call into a flat node list. A
 * DocumentFragment is DRAINED (native contract: the fragment ends empty) and
 * its children returned; a string becomes a Text node when `allowString`
 * (append / prepend / replaceChildren accept strings, appendChild does not).
 *
 * @param {Element} host
 * @param {any} arg
 * @param {boolean} allowString
 * @returns {Node[]}
 */
function expandArg(host, arg, allowString) {
  if (allowString && typeof arg === 'string') {
    return [host.ownerDocument.createTextNode(arg)];
  }
  if (arg && arg.nodeType === 11) {
    const kids = Array.from(arg.childNodes);
    for (const k of kids) N_removeChild.call(arg, k);
    return kids;
  }
  return [/** @type {Node} */ (arg)];
}

/**
 * Splice `nodes` into `authored` before `ref` (a node already in authored) or
 * at the end when `ref` is null. Nodes already present are removed from their
 * current position first (native move semantics for a re-inserted child).
 *
 * @param {SlotState} state
 * @param {Node[]} nodes
 * @param {Node | null} ref
 */
function authoredSplice(state, nodes, ref) {
  const a = state.authored;
  for (const n of nodes) {
    const i = a.indexOf(n);
    if (i !== -1) a.splice(i, 1);
  }
  let at = ref == null ? a.length : a.indexOf(ref);
  if (at === -1) at = a.length;
  a.splice(at, 0, ...nodes);
}

/** Commit an authored mutation: record it, re-derive, re-place. */
function commitAuthored(host, state) {
  repartition(state);
  applySlotAssignments(host);
}

/**
 * Install the per-instance interception on a LIGHT-DOM host so native DOM
 * writes drive the slot record. Own data properties / accessors shadow the
 * prototype methods; installed once, never removed (so a mutation while the
 * host is disconnected still updates the record). No-op in shadow DOM.
 *
 * @param {Element} host
 */
export function installSlotInterception(host) {
  if (!inBrowser) return;
  const h = /** @type {any} */ (host);
  if (h[INTERCEPTED]) return;
  captureNatives();
  h[INTERCEPTED] = true;
  const state = ensureSlotState(host);

  h.appendChild = function (node) {
    if (h[RENDERING]) return N_appendChild.call(this, node);
    const nodes = expandArg(host, node, false);
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, null);
    commitAuthored(host, state);
    return node;
  };

  h.insertBefore = function (node, ref) {
    if (h[RENDERING]) return N_insertBefore.call(this, node, ref);
    if (ref != null && state.authored.indexOf(ref) === -1) {
      throw new DOMException(
        'insertBefore: reference node is not an assigned child of this host',
        'NotFoundError',
      );
    }
    const nodes = expandArg(host, node, false);
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, ref || null);
    commitAuthored(host, state);
    return node;
  };

  h.removeChild = function (node) {
    if (h[RENDERING]) return N_removeChild.call(this, node);
    const i = state.authored.indexOf(node);
    if (i === -1) return N_removeChild.call(this, node);
    state.authored.splice(i, 1);
    commitAuthored(host, state);
    return node;
  };

  h.replaceChild = function (newNode, oldNode) {
    if (h[RENDERING]) return N_replaceChild.call(this, newNode, oldNode);
    const i = state.authored.indexOf(oldNode);
    if (i === -1) return N_replaceChild.call(this, newNode, oldNode);
    const nodes = expandArg(host, newNode, false);
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    // remove any incoming already authored, then swap old for new at its slot.
    for (const n of nodes) {
      const j = state.authored.indexOf(n);
      if (j !== -1) state.authored.splice(j, 1);
    }
    const at = state.authored.indexOf(oldNode);
    state.authored.splice(at, 1, ...nodes);
    commitAuthored(host, state);
    return oldNode;
  };

  h.append = function (...args) {
    if (h[RENDERING]) return N_append.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, null);
    commitAuthored(host, state);
  };

  h.prepend = function (...args) {
    if (h[RENDERING]) return N_prepend.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, state.authored[0] || null);
    commitAuthored(host, state);
  };

  h.replaceChildren = function (...args) {
    if (h[RENDERING]) return N_replaceChildren.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    state.authored = nodes.slice();
    commitAuthored(host, state);
  };

  Object.defineProperty(h, 'innerHTML', {
    configurable: true,
    get() {
      return INNER_HTML_DESC.get.call(this);
    },
    set(str) {
      if (h[RENDERING]) {
        INNER_HTML_DESC.set.call(this, str);
        return;
      }
      const tmpl = host.ownerDocument.createElement('template');
      INNER_HTML_DESC.set.call(tmpl, String(str));
      const nodes = Array.from(tmpl.content.childNodes);
      for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
      state.authored = nodes;
      commitAuthored(host, state);
    },
  });

  Object.defineProperty(h, 'textContent', {
    configurable: true,
    get() {
      return TEXT_CONTENT_DESC.get.call(this);
    },
    set(str) {
      if (h[RENDERING]) {
        TEXT_CONTENT_DESC.set.call(this, str);
        return;
      }
      const nodes =
        str == null || str === ''
          ? []
          : [host.ownerDocument.createTextNode(String(str))];
      for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
      state.authored = nodes;
      commitAuthored(host, state);
    },
  });
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

  // 0. Prune the record of nodes the author detached out from under us (an
  //    `el.remove()` on a projected child, or a re-parent elsewhere): their
  //    parent is no longer one of our own slots / the park, and we did not
  //    detach them ourselves. Then re-derive from the surviving `authored` so a
  //    `slot=` change (or any authored mutation) is reflected before placement.
  pruneAuthored(host, state);
  repartition(state);

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

  // 5. Park authored nodes whose name matches no rendered own-slot. Native
  //    shadow keeps an unassigned child connected but unrendered (a nested
  //    custom element still upgrades and runs connectedCallback); a hidden
  //    holding element inside the host reproduces that. Parked nodes have
  //    parentNode === park, so the prune rule keeps them.
  const matched = new Set(groups.keys());
  const toPark = [];
  for (const n of state.authored) {
    if (!matched.has(slotNameOf(n))) toPark.push(n);
  }
  if (toPark.length) {
    const park = parkFor(host);
    for (const n of toPark) {
      if (n.parentNode !== park) {
        FRAMEWORK_DETACHED.delete(n);
        withRendererWrites(host, () => N_appendChild.call(park, n));
      }
    }
  }
}

/**
 * Prune `authored` of nodes the author detached out from under the record: a
 * node whose parent is neither one of the host's own actual slots nor the park,
 * and which the framework did not itself detach (capture / teardown rescue mark
 * such nodes so they survive the parentless window before (re)placement). This
 * closes the zombie-child resurrection (`el.remove()` on a projected node) and
 * cross-host theft: the ownership question is answered structurally by the
 * node's real parent, never by stale bookkeeping.
 *
 * @param {Element} host
 * @param {SlotState} state
 */
function pruneAuthored(host, state) {
  const park = /** @type {any} */ (host)[PARK];
  state.authored = state.authored.filter((n) => {
    if (FRAMEWORK_DETACHED.has(n)) return true;
    const p = n.parentNode;
    if (p == null) return false;
    if (p === park) return true;
    if (
      p.nodeType === 1 &&
      /** @type {Element} */ (p).tagName === 'SLOT' &&
      /** @type {Element} */ (p).hasAttribute(LIGHT_SLOT_ATTR) &&
      isOwnSlot(host, /** @type {Element} */ (p))
    ) {
      return true;
    }
    return false;
  });
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
  for (const node of assigned) {
    // The node is now placed and author-live: it is no longer framework
    // detached, so a later author `el.remove()` on it is prunable.
    FRAMEWORK_DETACHED.delete(node);
    slot.appendChild(node);
  }
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
      if (node.parentNode === slot) {
        // Framework-detached on teardown: the record keeps the ref (children
        // are values), so the prune rule must not drop it while it is parked
        // out of the tree waiting for a re-created slot to re-place it.
        FRAMEWORK_DETACHED.add(node);
        slot.removeChild(node);
      }
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
