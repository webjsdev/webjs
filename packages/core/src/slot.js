/**
 * Light-DOM <slot> runtime for @webjsdev/core: FULL NATIVE PARITY (#1021).
 *
 * `<slot>` works identically in light DOM and shadow DOM, through the SAME
 * native DOM API. You write the same template, and moving a component between
 * `static shadow = false` and `true` never needs a rewrite (two KNOWN
 * LIMITATIONS: forwarded-slot CONTENT projection is SSR-only, #1023, with the
 * fallback and the flatten read chain working everywhere; and a layout's
 * children partitioned across MULTIPLE named slots only soft-nav-swap the
 * default slice, #1024, pre-existing). Native `<slot>` is
 * a shadow-DOM primitive, so in light DOM WebJs implements slotting itself, to
 * spec: named + default slots, fallback content, first-wins resolution, dynamic
 * `name=${...}`, and live post-mount writes (appendChild, insertBefore,
 * removeChild, innerHTML, `el.slot=` flips, HTMLSlotElement.assign) plus the
 * full read surface (assignedNodes / assignedElements / {flatten} /
 * assignedSlot / slotchange, with native async-coalesced slotchange timing).
 * One caveat rides assign() specifically. The light-DOM assign() is an
 * EXTENSION of native (an element-bound per-node overlay while name matching
 * keeps working); native shadow assign() requires slotAssignment 'manual' on
 * the shadow root, which WebJs does not set, so in `static shadow = true`
 * mode assign() is a native no-op. Avoid assign() in a component meant to
 * flip modes.
 *
 * ONE WRITER. The design's core invariant: the component's own renderer is the
 * only actor that moves authored nodes into slots (`applySlotAssignments`).
 * `authored: Node[]` is the ordered source of truth; `assignedByName` is a pure
 * derivation (`repartition`). Liveness comes from re-running that one writer,
 * never from a second node-mover. This is what the pre-#1016 architecture got
 * wrong: it live-re-projected via a MutationObserver that PHYSICALLY MOVED
 * nodes, a third DOM writer beside the renderer and the client router, and the
 * ownership overlap was the #906/#908/#912/#914, #1006, and #994 bug cascade.
 *
 * How liveness reaches the one writer:
 *   - Interception: the mutating methods are patched per-instance on a light
 *     host; an author write updates `authored` + repartitions + applies.
 *   - Renderer-write window (RENDERING): the renderer opens it around every
 *     host-receiver commit (including the async paths), so a renderer commit is
 *     never mistaken for authored content. The one discriminator, structural.
 *   - Sensors (read-only, never move nodes): a childList backstop for raw
 *     bypass writes, and a slot/name flip sensor for attribute flips.
 *   - Prune rule: a node the author detaches (el.remove()) or re-parents is
 *     dropped from `authored` by its real parent, killing zombie resurrection
 *     and cross-host theft.
 *   - Self-heal, in resyncActualSlots. The record is NOT the only legitimate
 *     writer INSIDE a slot; a parent component's hole committed there and a
 *     library operating on the assigned container are folded back into
 *     `authored` before every apply, with NODE-scoped order authority
 *     (physical order adopted except for the exact nodes a record op
 *     touched), so the one writer never destroys another writer's work.
 *
 * Documented inherent gaps (all from light DOM having no shadow boundary): structural
 * host reads (`host.children` / `childNodes` / the innerHTML GETTER show the
 * rendered template, not the authored children), `assignedChild.parentNode` is
 * the `<slot>`, `::slotted()` CSS (use normal selectors / Tailwind), and
 * initial-projection lifecycle timing: the first light-DOM projection lands
 * one microtask AFTER the first render, so `firstUpdated` sees the `<slot>`
 * element with EMPTY `assignedNodes()` (shadow DOM projects natively before
 * it); read assigned content from `slotchange` or after a microtask.
 *
 * Live writes need the component's JS on the page. Interception + sensors
 * install in connectedCallback, so a component the framework ELIDES (a
 * display-only slotted wrapper with no client signal) ships no JS and its
 * post-mount native writes are inert, like anything on an elided component.
 * A component that is actually interacted with ships (a client module
 * references its tag); for an imperative consumer reaching it through a
 * string selector the analyser cannot see, force the ship with
 * `static interactive = true`. Shadow components always ship (the DSD
 * carve-out), so this is the one place elision, not slots, sets the boundary.
 *
 * Polyfill safety. Every prototype patch checks for the `data-webjs-light`
 * attribute and falls through to native otherwise, so real shadow-DOM slots
 * keep native behaviour exactly.
 *
 * SSR. This module is import-safe in Node (DOM access is guarded on
 * `typeof HTMLSlotElement !== 'undefined'`). Server-side slot substitution
 * lives in render-server.js (injectDSD); slot.js drives the client runtime.
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

  // Native `assignedSlot` lives on the Slottable mixin, which covers Text as
  // well as Element: a projected text child reports its slot in shadow DOM,
  // so the light parity read must answer for Text too.
  const NATIVE_text_assignedSlot_desc = Object.getOwnPropertyDescriptor(
    Text.prototype,
    'assignedSlot',
  );
  Object.defineProperty(Text.prototype, 'assignedSlot', {
    configurable: true,
    enumerable: true,
    get: function patchedTextAssignedSlot() {
      const native =
        NATIVE_text_assignedSlot_desc && NATIVE_text_assignedSlot_desc.get
          ? NATIVE_text_assignedSlot_desc.get.call(this)
          : null;
      if (native) return native;
      return findLightAssignedSlot(this);
    },
  });

  NATIVE_assign = HTMLSlotElement.prototype.assign;
  HTMLSlotElement.prototype.assign = function patchedAssign(...nodes) {
    if (this.hasAttribute(LIGHT_SLOT_ATTR) && !isInShadowRoot(this)) {
      // Manual slot assignment (imperative, overrides attribute mode). Bound
      // to THIS slot element (native binds slottables to the receiving
      // element, not its name), held via WeakRef (native holds manually
      // assigned slottables weakly), honored by repartition through
      // effectiveKeyOf and by the placement step's per-element routing.
      // NOTE this is a deliberate EXTENSION of native: real manual mode
      // requires slotAssignment 'manual' on the whole shadow root and turns
      // name matching off; here assign() overlays per-node while name
      // matching keeps working for everything else.
      const host = hostOfSlot(this);
      if (host) {
        const state = ensureSlotState(host);
        if (!state.manualAssign) state.manualAssign = new Map();
        const list = nodes.filter(Boolean);
        // LAST-assign-wins: a node handed to this slot leaves any other
        // slot's manual list.
        for (const [slotEl, refs] of state.manualAssign) {
          if (slotEl === this) continue;
          const kept = refs.filter((r) => {
            const n = r.deref();
            return n !== undefined && list.indexOf(n) === -1;
          });
          if (kept.length !== refs.length) {
            if (kept.length) state.manualAssign.set(slotEl, kept);
            else state.manualAssign.delete(slotEl);
          }
        }
        if (list.length) {
          state.manualAssign.set(this, list.map((n) => new WeakRef(n)));
        } else {
          state.manualAssign.delete(this);
        }
        state.pendingRecordNodes = new Set(list);
        repartition(state);
        applySlotAssignments(host);
      }
      return undefined;
    }
    return NATIVE_assign ? NATIVE_assign.apply(this, nodes) : undefined;
  };
  polyfillsInstalled = true;
}

/**
 * The slot ELEMENT a node is manually assigned to via `assign()`, or null.
 * Dead WeakRefs are compacted on the way through.
 *
 * @param {SlotState} state
 * @param {Node} node
 * @returns {HTMLSlotElement | null}
 */
function manualSlotFor(state, node) {
  const manual = state.manualAssign;
  if (!manual || !manual.size) return null;
  for (const [slotEl, refs] of manual) {
    let found = false;
    const live = refs.filter((r) => {
      const n = r.deref();
      if (n === undefined) return false;
      if (n === node) found = true;
      return true;
    });
    if (live.length !== refs.length) {
      if (live.length) manual.set(slotEl, live);
      else manual.delete(slotEl);
    }
    if (found) {
      // A manual entry is honoured only while its RECEIVING element is still
      // part of this host's tree. A torn-down (conditionally re-rendered)
      // slot element leaves the entry DORMANT: the node falls back to its
      // slot= attribute (routed by name or parked, native's
      // unassigned-but-connected behaviour) instead of being excluded from
      // every slot and lost. The entry is kept, not deleted, so a re-attached
      // element (the cache directive) resumes its assignment, matching
      // native's element-bound persistence.
      const hostEl = state.host;
      if (hostEl && (slotEl === hostEl || hostEl.contains(slotEl))) return slotEl;
      return null;
    }
  }
  return null;
}

/**
 * Walk up from a light slot to its owning host: the nearest SLOT_STATE
 * ancestor that actually OWNS the slot. A slot separated from that ancestor
 * by another custom element (a forwarded slot inside a foreign / elided
 * component) is nobody's here: attributing it to the outer host would
 * redirect the outer host's own same-named slot, so `assign()` on such a
 * slot is inert instead (the same carve-out as every other elided-component
 * write).
 */
function hostOfSlot(slot) {
  for (let p = slot.parentElement; p; p = p.parentElement) {
    if (/** @type {any} */ (p)[SLOT_STATE]) {
      return isOwnSlot(p, slot) ? p : null;
    }
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
  // Only an APPLIED actual slot has assigned nodes. A fallback slot reports
  // [], and so does a slot with NO data-projection at all (an orphan slot
  // rendered outside any host, or one not yet placed): its children are
  // cloned fallback content, and native returns [] for a slot outside a
  // shadow tree.
  if (slot.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL) return [];
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
 * Consult a node's DIRECT parent to find a data-webjs-light slot it is
 * currently projected into. Returns null if the element is in a fallback
 * slot or no light slot at all.
 *
 * @param {Element} el
 * @returns {HTMLSlotElement | null}
 */
function findLightAssignedSlot(el) {
  // Native `assignedSlot` answers only for a SLOTTABLE itself. In the light
  // parity model, assigned nodes are exactly the slot element's DIRECT
  // children, so only the immediate parent is consulted: a DESCENDANT of
  // assigned content correctly reads null, matching shadow DOM (where only
  // the host's direct children are slottables).
  const p = el.parentElement;
  if (p && p.tagName === 'SLOT' && p.hasAttribute(LIGHT_SLOT_ATTR)) {
    return p.getAttribute(PROJECTION_ATTR) === PROJECTION_ACTUAL
      ? /** @type {HTMLSlotElement} */ (p)
      : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-host state: the slot record
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SlotState
 * @property {Element} host The owning host element (back-reference so
 *   state-only helpers can test containment).
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
 * @property {Set<Node> | undefined} [pendingRecordNodes] The nodes the
 *   current record op touched (inserted, moved, or removed by an interceptor
 *   / assign() / router splice), consumed by the next apply pass: the resync
 *   step honours record positions for exactly these nodes and adopts
 *   physical order for everything else (node-scoped order authority).
 * @property {boolean} [adopted] True when this state was populated by the
 *   ADOPT connect branch (SSR hydration / serialized restore): the host's
 *   pre-first-render children are rendered markup, so the reconnect fold
 *   must not hoover them.
 * @property {WeakMap<Node, string|null>} [adoptedKey] The slot key a
 *   self-heal fold ADOPTED for a node a non-record writer placed inside a
 *   named slot (its own attribute would key it elsewhere); cleared when the
 *   author explicitly changes the node's slot= attribute.
 * @property {Map<HTMLSlotElement, WeakRef<Node>[]>} [manualAssign] Overlay for
 *   `HTMLSlotElement.assign()` manual assignment, keyed by the RECEIVING slot
 *   element (native binds slottables to the element, so a rename follows the
 *   element and duplicates route correctly); nodes held via WeakRef (native
 *   holds manually assigned slottables weakly). A node here goes to its
 *   assigned slot regardless of its `slot=` attribute.
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
      host,
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
  for (const node of state.authored) {
    appendToMap(byName, effectiveKeyOf(state, node), node);
  }
}

/**
 * The slot key a node is ASSIGNED under: the manual `HTMLSlotElement.assign()`
 * overlay when the node is named in one, else the node's `slot=""` attribute.
 * The ONE key rule, shared by `repartition`, the park step, and the router
 * seam, so a manually-assigned node is never judged by its overlay in one
 * place and its raw attribute in another (which parked an assigned node out
 * of its own slot).
 *
 * @param {SlotState} state
 * @param {Node} node
 * @returns {string | null}
 */
function effectiveKeyOf(state, node) {
  const m = manualSlotFor(state, node);
  if (m) return keyOfName(m.getAttribute('name'));
  // A node a NON-record writer placed inside a NAMED slot (folded by the
  // self-heal resync) keeps the key of the container it was written into;
  // deriving from its (absent or different) slot= attribute would teleport
  // it to the default slot on the next apply. An explicit later slot=
  // change clears the adoption (the flip sensor owns that).
  if (state.adoptedKey) {
    const adopted = state.adoptedKey.get(node);
    if (adopted !== undefined) return adopted;
  }
  return slotNameOf(node);
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
  // Record the connect branch: reconnectSweep's pre-render fold gate keys on
  // this flag (an adopted host's children ARE rendered markup; a captured
  // host's are only bypass writes).
  state.adopted = true;
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
      // per-name grouping without moving any DOM (no flash). Note: `authored`
      // is rebuilt in slot-document order, not the original interleaved
      // host-child order, which SSR did not preserve. Per-name grouping (all
      // that placement uses) is exact; the only observable difference from a
      // fresh mount is the cross-name ordering a post-hydration `insertBefore`
      // with a ref in a DIFFERENT named slot would resolve against.
      // A child whose OWN attribute keys elsewhere (a snapshot-restored
      // adoption or manual assignment, provenance the HTML cannot carry) is
      // re-adopted under the container's key, so the first client render
      // never relocates a node out of the slot the restored markup showed it
      // in.
      for (const child of children) {
        state.authored.push(child);
        // No prune-exemption mark here: when createInstance detaches the old
        // SSR subtree, these children still sit in the OLD slot, which this
        // adopt just recorded in lastSnapshot, so the prune gate keeps them
        // through the detach window. Skipping the mark also means an author
        // removing an adopted child BEFORE the first apply (child.remove()
        // in another component's boot hook) is honoured instead of the node
        // being resurrected by the resync.
        if (slotNameOf(child) !== name) {
          if (!state.adoptedKey) state.adoptedKey = new WeakMap();
          state.adoptedKey.set(child, name);
        }
      }
      state.lastSnapshot.set(s, children.slice());
    }
  }
  // A serialized snapshot (back/forward restore) also carries the PARK: an
  // authored child whose slot name matched no rendered slot at snapshot time
  // sits inside <wj-slot-park>. Sweep its children into the record and drop
  // the serialized park element itself (a fresh park is created on demand),
  // so a parked node survives the restore and a later render that DOES emit
  // its slot pulls it back out.
  for (const oldPark of host.querySelectorAll('wj-slot-park')) {
    if (!isOwnSlot(host, oldPark)) continue;
    for (const child of Array.from(oldPark.childNodes)) {
      // The children keep the DETACHED oldPark as parent until placement;
      // the FRAMEWORK_DETACHED mark is what shields them from the prune
      // rule across that window.
      FRAMEWORK_DETACHED.add(child);
      state.authored.push(child);
    }
    oldPark.remove();
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
export function keyOfName(name) {
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
  // Evict the old slice by the node's EFFECTIVE key (the manual assign()
  // overlay when present, else the slot= attribute): filtering on the raw
  // attribute would evict a manually-assigned attribute-less node from the
  // default slice and silently drop another slot's content.
  let at = state.authored.findIndex((n) => effectiveKeyOf(state, n) === key);
  const evicted = state.authored.filter((n) => effectiveKeyOf(state, n) === key);
  state.authored = state.authored.filter((n) => effectiveKeyOf(state, n) !== key);
  if (at === -1 || at > state.authored.length) at = state.authored.length;
  for (const n of list) {
    // Stamp the slice key onto element nodes so the derived partition
    // matches the projection, EXCEPT nodes with a live manual assign()
    // entry: their routing is element-bound (the overlay outranks the
    // attribute), and the attribute is the author's latent intent that must
    // survive the overlay's release.
    if (n.nodeType === 1 && !manualSlotFor(state, n)) {
      if (key == null) /** @type {Element} */ (n).removeAttribute('slot');
      else /** @type {Element} */ (n).setAttribute('slot', key);
    }
    FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
  }
  state.authored.splice(at, 0, ...list);
  state.pendingRecordNodes = new Set([...evicted, ...list]);
  if (state.adoptedKey) {
    for (const n of state.pendingRecordNodes) state.adoptedKey.delete(n);
  }
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
    // When the OUTERMOST window closes, drain the backstop synchronously before
    // its async callback fires. The drain PROCESSES the records (renderer output
    // is skipped structurally, a genuine bypass write is folded), so this
    // commit's own childList churn is absorbed without losing a real author
    // write that coincided in the same task. (The flip sensor is NOT drained: a
    // renderer `name=` write on a slot is exactly what re-projects a dynamic
    // `name=${...}`.)
    if (!prev) drainRendererBackstop(host);
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

  state.backstop = new MutationObserver((records) => processBackstop(host, state, records));
  state.backstop.observe(host, { childList: true, subtree: false });

  state.flipSensor = new MutationObserver((records) => processFlip(host, records));
  state.flipSensor.observe(host, {
    attributes: true,
    attributeFilter: ['slot', 'name'],
    subtree: true,
  });
}

/**
 * Backstop callback body: fold a raw direct-child add / un-author a raw remove.
 * A renderer-committed node (the render root and everything between the instance
 * bookend markers) is SKIPPED structurally, so this is safe to run on the
 * records drained at a renderer-write window close, not only on genuine
 * author-bypass records. That is what keeps a real bypass write that happened
 * to coincide with a commit in the same task from being silently dropped.
 */
function processBackstop(host, state, records) {
  const h = /** @type {any} */ (host);
  const park = h[PARK];
  const inst = h[Symbol.for('webjs.instance')];
  let dirty = false;
  for (const r of records) {
    for (const node of r.addedNodes) {
      if (node === park) continue;
      if (inst && instanceOwns(inst, node)) continue; // renderer output, not authored
      if (state.authored.indexOf(node) !== -1) {
        // A raw bypass MOVE of an already-authored node back onto the host:
        // the record is right but the node now physically sits outside its
        // slot. Re-apply so the physically-verifying placement step repairs
        // it (no slotchange fires: the assigned SET is unchanged).
        dirty = true;
        continue;
      }
      FRAMEWORK_DETACHED.add(node);
      state.authored.push(node);
      dirty = true;
    }
    for (const node of r.removedNodes) {
      const i = state.authored.indexOf(node);
      // Any authored node in a HOST-childList removal record that is no
      // longer under the host was removed by the AUTHOR: no framework
      // detach path can produce this shape (capture precedes sensor arming;
      // rescue removes from the SLOT, not the host; park and placement
      // moves keep the node under the host, so contains stays true; the
      // render wipe's batch is discarded by the null-instance drain). A
      // marked-node retention guard here defended an impossible case while
      // resurrecting same-batch add-then-remove and add-then-move writes.
      if (i !== -1 && !host.contains(node)) {
        state.authored.splice(i, 1);
        dirty = true;
      }
    }
  }
  if (dirty) applySlotAssignments(host);
}

/**
 * Drain the host's backstop at a renderer-write window close, PROCESSING the
 * records (renderer output is skipped structurally by processBackstop) so a
 * genuine bypass write coinciding with the commit is not lost. Exported so
 * render-client's render() window can share the exact same drain.
 *
 * @param {Element} host
 */
export function drainRendererBackstop(host) {
  const h = /** @type {any} */ (host);
  const state = /** @type {SlotState | undefined} */ (h[SLOT_STATE]);
  if (!(state && state.backstop)) return;
  const records = state.backstop.takeRecords();
  // Only PROCESS when there is a rendered instance: processBackstop skips
  // renderer output via instanceOwns, which needs the instance bookends. On the
  // non-template render path (render() returns a string / array / number) the
  // instance is null and the renderer's own text nodes are direct host
  // children, so processing would fold them into the record and park them (the
  // component would render blank). With no instance to discriminate, discard,
  // matching the pre-processing behavior.
  // Process when an instance exists OR the host has NEVER rendered (the
  // symbol is absent: a pre-first-render bypass write must be folded so the
  // first render's replaceChildren does not silently destroy it); discard
  // only on the EXPLICIT null of the non-template render path, whose text
  // output would otherwise be folded and parked.
  const hasInstanceSym = Symbol.for('webjs.instance') in h;
  if (!hasInstanceSym || h[Symbol.for('webjs.instance')]) {
    processBackstop(host, state, records);
  }
}

/**
 * Flip-sensor callback body: a RELEVANT slot=/name= flip re-derives + re-places.
 * Relevant = a `name=` change on one of the host's own light slots, or a `slot=`
 * change on an authored (projected) child. An unrelated `name=` deep in the tree
 * (e.g. an `<input name>`) is ignored, so common markup does not trigger a
 * spurious full re-apply.
 */
function processFlip(host, records) {
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return;
  // ONE pass over ALL records first: every explicit slot= change clears that
  // node's self-heal adoption (the author's attribute is now the routing
  // intent), unconditionally. Deleting for a node no longer authored is
  // always safe, and gating on authored membership let a stale adoption
  // outlive a same-task detach and mis-route a later re-append. Only then is
  // relevance decided and the single apply run, so a batch with several
  // relevant flips never leaves a later record's adoption uncleared.
  let relevant = false;
  for (const r of records) {
    if (r.type !== 'attributes') continue;
    const target = /** @type {Element} */ (r.target);
    if (r.attributeName === 'name') {
      if (
        target.tagName === 'SLOT' &&
        target.hasAttribute(LIGHT_SLOT_ATTR) &&
        isOwnSlot(host, target)
      ) {
        relevant = true;
      }
    } else if (r.attributeName === 'slot') {
      if (state.adoptedKey) state.adoptedKey.delete(target);
      if (state.authored.indexOf(target) !== -1) relevant = true;
    }
  }
  if (relevant) applySlotAssignments(host);
}

/**
 * Tear down the sensors, PROCESSING any queued records first (a bare
 * `disconnect()` drops them, which would lose a flip or bypass write captured
 * but not yet delivered when the host disconnects).
 *
 * @param {Element} host
 */
export function teardownSlotSensors(host) {
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return;
  if (state.backstop) {
    processBackstop(host, state, state.backstop.takeRecords());
    state.backstop.disconnect();
    state.backstop = undefined;
  }
  if (state.flipSensor) {
    processFlip(host, state.flipSensor.takeRecords());
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
  const rendered = Symbol.for('webjs.instance') in h;
  // Gate on the RECORDED connect branch (adoptSSRAssignments sets
  // state.adopted), never on structural re-detection: a bypass write can
  // itself carry a rendered-looking chunk (slot[data-webjs-light]
  // [data-projection] under plain wrappers) and would spoof a structural
  // check, suppressing the fold for unrelated writes in the same batch.
  // The flag is also free per reconnect where the structural query walked
  // the subtree.
  const adoptedMarkup = !rendered && state.adopted === true;
  let changed = false;
  for (const node of Array.from(host.childNodes)) {
    if (node === h[PARK]) continue;
    if (state.authored.indexOf(node) !== -1) {
      // Authored but physically a direct host child: a bypass MOVE made
      // while disconnected pulled it out of its slot. Re-apply so the
      // placement step repairs it.
      changed = true;
      continue;
    }
    // Skip the renderer's own top-level nodes. With an instance, ownership
    // is checked via the bookends. With an EXPLICIT null instance (the
    // non-template render path sets host[INSTANCE] = null: render() returned
    // a string / number / array) the renderer's text output IS the direct
    // host children, so folding is skipped entirely, like
    // drainRendererBackstop's no-instance guard. A host that has NEVER
    // rendered (the symbol is absent: moved before its deferred first
    // render) has no CLIENT-renderer output, so a disconnected-window
    // bypass write IS folded UNLESS the host carries adopted
    // framework-rendered markup (SSR/hydration before the deferred first
    // render, or a first render that threw): folding THAT subtree would
    // push template wrappers into the record and brick placement on a
    // HierarchyRequestError.
    if (rendered && (!inst || instanceOwns(inst, node))) continue;
    if (!rendered && adoptedMarkup) continue;
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
 * True for a REAL platform Node from any realm: a same-realm Node passes
 * instanceof; a cross-realm Node passes via its own realm's constructor.
 * KNOWN EDGE: a node from a DISCARDED iframe realm (defaultView null) and
 * any cross-realm DOCUMENT (ownerDocument is null on a Document by spec)
 * fail both arms where native would adopt or HierarchyRequestError:
 * appendChild-shaped calls throw TypeError, and the variadic
 * string-accepting calls stringify to text. Both outcomes are strictly
 * safer than admitting an unverifiable object into the record.
 *
 * @param {any} n
 * @returns {boolean}
 */
function isRealmNode(n) {
  return (
    n instanceof Node ||
    Boolean(
      n &&
        typeof n === 'object' &&
        /** @type {any} */ (n).ownerDocument &&
        /** @type {any} */ (n).ownerDocument.defaultView &&
        n instanceof /** @type {any} */ (n).ownerDocument.defaultView.Node,
    )
  );
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
  // WebIDL (Node or DOMString) coercion: append/prepend/replaceChildren
  // stringify ANY argument that is not a real platform Node (a number, null,
  // an object, even a duck-typed fake with a numeric nodeType); native
  // host.append(42) appends the text "42" and host.append({}) appends
  // "[object Object]".
  if (allowString && !isRealmNode(arg)) {
    // A template literal performs exactly ES ToString (ToPrimitive with hint
    // "string": toString before valueOf, and a Symbol THROWS TypeError),
    // matching WebIDL DOMString conversion; '' + x would use hint "default"
    // (valueOf first) and diverge for objects overriding both.
    return [host.ownerDocument.createTextNode(`${/** @type {any} */ (arg)}`)];
  }
  // Non-string path (appendChild / insertBefore / replaceChild): reject any
  // non-platform-node BEFORE the fragment branch, or a duck-typed
  // {nodeType: 11} fake would bypass guardInsertable entirely.
  if (!isRealmNode(arg)) {
    throw new TypeError('Failed to execute insertion on the host: parameter is not of type Node.');
  }
  if (arg && arg.nodeType === 11) {
    const kids = Array.from(arg.childNodes);
    // Guard BEFORE draining: a cycle error must leave the fragment intact
    // (native throws with the fragment untouched).
    guardInsertable(host, kids);
    for (const k of kids) N_removeChild.call(arg, k);
    return kids;
  }
  guardInsertable(host, [/** @type {Node} */ (arg)]);
  return [/** @type {Node} */ (arg)];
}

/**
 * Throw `HierarchyRequestError` (native parity) if any node would create a
 * cycle: the host itself, or an ancestor of the host. Checked BEFORE the record
 * is mutated, so a bad insert leaves `authored` untouched, like native.
 *
 * @param {Element} host
 * @param {Node[]} nodes
 */
function guardInsertable(host, nodes) {
  for (const n of nodes) {
    // Validity BEFORE any record mutation (native throws with zero state
    // change): a non-Node is a TypeError, a Node that is not an insertable
    // child type (an Attr, a Document, a doctype) is a HierarchyRequestError.
    // A duck-typed fake with a numeric nodeType would otherwise pass the
    // guards, mutate the record, and then throw INSIDE the apply pass on
    // every later operation, permanently wedging the host's slot pipeline.
    if (!isRealmNode(n)) {
      throw new TypeError('Failed to execute insertion on the host: parameter is not of type Node.');
    }
    const t = n.nodeType;
    if (t !== 1 && t !== 3 && t !== 4 && t !== 7 && t !== 8 && t !== 11) {
      throw new DOMException(
        'Failed to execute insertion on the host: the node type may not be inserted here.',
        'HierarchyRequestError',
      );
    }
    if (n === host || (t === 1 && /** @type {Element} */ (n).contains(host))) {
      throw new DOMException(
        'Failed to execute insertion on the host: the new child contains the parent.',
        'HierarchyRequestError',
      );
    }
  }
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

/**
 * True when `el` is, or sits inside, an AUTHORED node of this host: such an
 * element is CONTENT (a chunk the author wrote or moved in), never one of
 * the host's own rendered slots, no matter what attributes it carries.
 *
 * Exported for the router's own-slot collection, which must apply the SAME
 * invariant when picking reprojection targets.
 *
 * @param {Element} host
 * @param {Element} el
 * @returns {boolean}
 */
export function isAuthoredContentSlot(host, el) {
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  if (!state) return false;
  return isInsideAuthored(state, host, el);
}

/** @param {SlotState} state @param {Element} host @param {Element} el */
function isInsideAuthored(state, host, el) {
  for (let p = /** @type {Node | null} */ (el); p && p !== host; p = p.parentNode) {
    if (state.authored.indexOf(p) !== -1) return true;
  }
  return false;
}

/**
 * True when an authored node is still VIRTUALLY a child of the host: it
 * physically sits in one of the host's own slots, the park, or the host
 * itself, or the framework holds it detached as a record value (a rescued
 * closed-slot child). A node the author moved elsewhere out-of-band (into a
 * fragment, another element) is NOT a child anymore even while the record
 * still lists it, and native removeChild / replaceChild / insertBefore-ref
 * answer that with NotFoundError.
 *
 * @param {Element} host
 * @param {Node} node
 * @returns {boolean}
 */
function isVirtualChild(host, node) {
  if (FRAMEWORK_DETACHED.has(node)) return true;
  const p = node.parentNode;
  if (p == null) return false;
  if (p === host) return true;
  if (p === /** @type {any} */ (host)[PARK]) return true;
  const state = /** @type {SlotState | undefined} */ (
    /** @type {any} */ (host)[SLOT_STATE]
  );
  return (
    p.nodeType === 1 &&
    /** @type {Element} */ (p).tagName === 'SLOT' &&
    /** @type {Element} */ (p).hasAttribute(LIGHT_SLOT_ATTR) &&
    (host.contains(p) ||
      Boolean(state && state.lastSnapshot.has(/** @type {HTMLSlotElement} */ (p)))) &&
    isOwnSlot(host, /** @type {Element} */ (p))
  );
}

/** The empty set handed to resync when no record op is pending. */
const EMPTY_NODE_SET = new Set();

/**
 * Commit an authored mutation: record it, re-derive, re-place. `touched`
 * lists the nodes this op inserted, moved, or removed, so the resync step
 * honours the record's position for exactly those nodes (an expressed move)
 * while adopting physical order for everything else.
 *
 * @param {Element} host
 * @param {SlotState} state
 * @param {Node[]} [touched]
 */
function commitAuthored(host, state, touched) {
  state.pendingRecordNodes = new Set(touched || []);
  // An author record op on a node ends its self-heal adoption: once the
  // author takes over, the node routes by its own attribute again (also
  // covers an attribute change made while the sensors were down).
  if (state.adoptedKey && touched) {
    for (const n of touched) state.adoptedKey.delete(n);
  }
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
    commitAuthored(host, state, nodes);
    return node;
  };

  h.insertBefore = function (node, ref) {
    if (h[RENDERING]) return N_insertBefore.call(this, node, ref);
    // WebIDL converts arguments LEFT TO RIGHT and DOM pre-insert validity
    // runs the cycle (HierarchyRequestError) step before the ref
    // (NotFoundError) step: validate parameter 1's type and insertability
    // FIRST, without draining a fragment (the drain happens in expandArg
    // only after every validity check passed, so an error leaves the
    // fragment intact like native).
    if (!isRealmNode(node)) {
      throw new TypeError('Failed to execute insertBefore on the host: parameter 1 is not of type Node.');
    }
    guardInsertable(host, node.nodeType === 11 ? Array.from(node.childNodes) : [node]);
    if (ref != null && !isRealmNode(ref)) {
      throw new TypeError('Failed to execute insertBefore on the host: parameter 2 is not of type Node.');
    }
    // A non-null ref MUST be an assigned child (native throws NotFoundError
    // otherwise), checked before the self-ref no-op so insertBefore(x, x) on
    // a NON-child still throws like native.
    if (
      ref != null &&
      (state.authored.indexOf(ref) === -1 || !isVirtualChild(host, ref))
    ) {
      throw new DOMException(
        'insertBefore: reference node is not an assigned child of this host',
        'NotFoundError',
      );
    }
    // insertBefore(n, n) with n an existing child is a native no-op.
    if (node === ref) return node;
    const nodes = expandArg(host, node, false);
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, ref || null);
    commitAuthored(host, state, nodes);
    return node;
  };

  h.removeChild = function (node) {
    if (h[RENDERING]) return N_removeChild.call(this, node);
    const i = state.authored.indexOf(node);
    if (i === -1) return N_removeChild.call(this, node);
    // Record-listed but physically moved elsewhere out-of-band: native
    // answers "not a child" (the record heals on the next apply).
    if (!isVirtualChild(host, node)) {
      throw new DOMException(
        'removeChild: the node is not an assigned child of this host',
        'NotFoundError',
      );
    }
    state.authored.splice(i, 1);
    commitAuthored(host, state, [node]);
    return node;
  };

  h.replaceChild = function (newNode, oldNode) {
    if (h[RENDERING]) return N_replaceChild.call(this, newNode, oldNode);
    const i = state.authored.indexOf(oldNode);
    if (i === -1) return N_replaceChild.call(this, newNode, oldNode);
    // WebIDL converts parameters left to right and the cycle check precedes
    // the NotFound check: validate parameter 1 first, without draining.
    if (!isRealmNode(newNode)) {
      throw new TypeError('Failed to execute replaceChild on the host: parameter 1 is not of type Node.');
    }
    guardInsertable(host, newNode.nodeType === 11 ? Array.from(newNode.childNodes) : [newNode]);
    if (!isVirtualChild(host, oldNode)) {
      throw new DOMException(
        'replaceChild: the node to be replaced is not an assigned child of this host',
        'NotFoundError',
      );
    }
    if (newNode === oldNode) return oldNode; // native no-op
    const nodes = expandArg(host, newNode, false); // guards cycle before draining
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    // Remove any incoming node already authored (so it MOVES to the new slot),
    // but never oldNode itself: it is the replacement target, so skipping it
    // keeps `at` valid even for the pathological replaceChild(fragmentWithOld,
    // old) input, avoiding a splice(-1) that would corrupt an unrelated sibling.
    for (const n of nodes) {
      if (n === oldNode) continue;
      const j = state.authored.indexOf(n);
      if (j !== -1) state.authored.splice(j, 1);
    }
    const at = state.authored.indexOf(oldNode);
    state.authored.splice(at, 1, ...nodes);
    commitAuthored(host, state, [...nodes, oldNode]);
    return oldNode;
  };

  h.append = function (...args) {
    if (h[RENDERING]) return N_append.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    authoredSplice(state, nodes, null);
    commitAuthored(host, state, nodes);
  };

  h.prepend = function (...args) {
    if (h[RENDERING]) return N_prepend.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    // Remove any incoming node from its current position, then insert at the
    // FRONT via unshift. Passing `authored[0]` as an authoredSplice ref would be
    // wrong, because that ref is captured before the incoming-removal, so
    // prepending the current first child loses the ref and appends at the end.
    for (const n of nodes) {
      const j = state.authored.indexOf(n);
      if (j !== -1) state.authored.splice(j, 1);
    }
    state.authored.unshift(...nodes);
    commitAuthored(host, state, nodes);
  };

  h.replaceChildren = function (...args) {
    if (h[RENDERING]) return N_replaceChildren.apply(this, args);
    const nodes = [];
    for (const a of args) nodes.push(...expandArg(host, a, true));
    for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
    const displaced = state.authored;
    state.authored = nodes.slice();
    commitAuthored(host, state, [...displaced, ...nodes]);
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
      // Parse in a DIV (the "in body" fragment context a custom-element host
      // gets natively): a <template> retains table-section tokens (<td>,
      // <tr>) that the real host context drops to text.
      const tmp = host.ownerDocument.createElement('div');
      // innerHTML IS [LegacyNullToEmptyString]: null maps to the empty
      // string (the common clear idiom must clear, not insert the text
      // "null"); undefined stringifies; a Symbol throws (ToString).
      INNER_HTML_DESC.set.call(tmp, str === null ? '' : `${str}`);
      const nodes = Array.from(tmp.childNodes);
      for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
      const displaced = state.authored;
      state.authored = nodes;
      commitAuthored(host, state, [...displaced, ...nodes]);
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
      // Node.textContent is a NULLABLE DOMString? (LegacyNullToEmptyString
      // belongs to innerHTML, not here): WebIDL converts undefined to null
      // for nullable types, so BOTH null and undefined EMPTY, verified
      // against all three engines. A Symbol still throws (ToString).
      const nodes =
        str == null || str === ''
          ? []
          : [host.ownerDocument.createTextNode(`${str}`)];
      for (const n of nodes) FRAMEWORK_DETACHED.add(n); // prune-exempt until placed
      const displaced = state.authored;
      state.authored = nodes;
      commitAuthored(host, state, [...displaced, ...nodes]);
    },
  });
}

// ---------------------------------------------------------------------------
// Render-owned slot application
// ---------------------------------------------------------------------------

/**
 * Place the slot record into the host's OWN light-DOM slots (#1015). The
 * renderer's slot parts call this after the template commits, and the
 * interception + sensors call it after an authored mutation. Idempotent and cheap on
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

  // 0. Self-heal, prune, re-derive, in that order. First fold in what a
  //    NON-record writer wrote inside our own actual slots (a parent
  //    component's hole committed within projected content, or a library
  //    operating on the assigned container): the apply step is the only
  //    record writer, so physical-vs-snapshot divergence means someone else
  //    wrote there, and destroying their nodes on this pass would be the
  //    one-writer violation in reverse. Then prune the record of nodes the
  //    author detached out from under us (an `el.remove()` on a projected
  //    child, or a re-parent elsewhere): their parent is no longer one of our
  //    own slots / the park, and we did not detach them ourselves. Then
  //    re-derive from the surviving `authored` so a `slot=` change (or any
  //    authored mutation) is reflected before placement.
  const pendingNodes = state.pendingRecordNodes || EMPTY_NODE_SET;
  state.pendingRecordNodes = undefined;
  resyncActualSlots(host, state, pendingNodes);
  pruneAuthored(host, state);
  repartition(state);

  // 1. The host's own slots, document order. A slot that is BOUND but not yet
  //    FINALIZED (its slot-part deferred finalize to a microtask: it carries
  //    data-webjs-light from compile time but has neither a data-projection
  //    stamp nor a harvested fallback frag) is EXCLUDED from placement this
  //    pass: treating it as fallback-mode would destroy its un-harvested
  //    fallback clone, and the finalize's own queued apply covers it one
  //    microtask later. Its NAME still counts as rendered (pendingNames) so
  //    the park step does not spuriously park (and bounce) its content.
  /** @type {HTMLSlotElement[]} */
  const slots = [];
  /** @type {Set<string|null>} */
  const pendingNames = new Set();
  for (const el of host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}]`)) {
    if (!isOwnSlot(host, el)) continue;
    // An own slot can NEVER live inside AUTHORED content: a slot element the
    // author moved or wrote into the host (another component's chunk, a
    // spoofed stamp) is inert content, exactly like a <slot> outside a
    // shadow tree natively. Collecting it would hand it assignments whose
    // nodes can CONTAIN it (HierarchyRequestError at placement).
    if (isInsideAuthored(state, host, el)) continue;
    if (
      !el.hasAttribute(PROJECTION_ATTR) &&
      !(SLOT_FALLBACK_FRAG in /** @type {any} */ (el))
    ) {
      pendingNames.add(keyOfName(el.getAttribute('name')));
      continue;
    }
    slots.push(/** @type {HTMLSlotElement} */ (el));
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

  // 3. Assign per the first-wins rule; a node manually bound via `assign()`
  //    routes to ITS slot element (native binds slottables to the receiving
  //    element), everything else to the first slot of its name.
  /** @type {HTMLSlotElement[]} */
  const slotsChanged = [];
  for (const [name, group] of groups) {
    const assigned = state.assignedByName.get(name) || [];
    for (let i = 0; i < group.length; i++) {
      const slot = group[i];
      const own = assigned.filter((n) => {
        const m = manualSlotFor(state, n);
        return m ? m === slot : i === 0;
      });
      if (own.length > 0) {
        if (applyActualAssignment(state, slot, own)) {
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
  //    parentNode === park, so the prune rule keeps them. The park is
  //    RECONCILED to exactly the current unmatched set: a node that left the
  //    record (or now matches a slot) is detached from the park, so a removed
  //    parked child ends up isConnected === false like native removeChild.
  const matched = new Set(groups.keys());
  for (const name of pendingNames) matched.add(name);
  const shouldPark = new Set();
  for (const n of state.authored) {
    if (!matched.has(effectiveKeyOf(state, n))) shouldPark.add(n);
  }
  const existingPark = /** @type {any} */ (host)[PARK];
  if (existingPark) {
    for (const n of Array.from(existingPark.childNodes)) {
      if (!shouldPark.has(n)) N_removeChild.call(existingPark, n);
    }
  }
  if (shouldPark.size) {
    const park = parkFor(host);
    for (const n of shouldPark) {
      if (n.parentNode !== park) {
        FRAMEWORK_DETACHED.delete(n);
        withRendererWrites(host, () => N_appendChild.call(park, n));
      }
    }
  }
}

/**
 * Self-heal `authored` against a NON-record writer that wrote INSIDE one of
 * the host's own actual slots. Two such writers are legitimate: a parent
 * component whose hole was authored as this host's content (its child-part
 * marker projects into the slot, so a later array / template commit inserts
 * or removes nodes there with no interceptor in the way), and a third-party
 * library operating on the assigned container (the documented target for
 * generic DOM code). The apply step is the ONLY record-driven DOM writer, so
 * a slot whose physical childNodes diverge from its `lastSnapshot` was
 * written by someone else since the last apply; destroying those nodes on
 * this pass (the pre-fix behaviour) is the one-writer violation in reverse
 * and detaches DOM a live renderer part still points at.
 *
 * Reconciliation rule, per diverged slot. Order authority is NODE-scoped,
 * never pass-scoped (a pass-scoped rule made the outcome depend on which
 * trigger happened to run the apply):
 * - The PHYSICAL order of the slice is the base: a renderer part reordering
 *   a keyed list inside the slot is never fought back, regardless of what
 *   triggered this apply.
 * - Nodes the current record op TOUCHED (`pendingNodes`: inserted, moved, or
 *   removed by the interceptor / assign() / router splice that triggered
 *   this apply) are taken OUT of the base and re-anchored at their
 *   record-implied position, so an author's expressed move (appendChild of
 *   an existing child = move to end) is honoured; an op-REMOVED node is in
 *   `pendingNodes` but no longer in the record, so it simply drops.
 * - Record nodes missing from the slot (a bypass move onto the host, a
 *   genuine author detach) are also re-anchored; `pruneAuthored`, which runs
 *   right after, decides their fate structurally by their current parent
 *   (re-place vs drop), so no zombie is resurrected.
 *
 * @param {Element} host
 * @param {SlotState} state
 * @param {Set<Node>} pendingNodes
 */
function resyncActualSlots(host, state, pendingNodes) {
  // lastSnapshot is a WeakMap (not iterable): walk the host's own APPLIED
  // actual slots instead, which are exactly the elements a snapshot exists
  // for.
  for (const el of host.querySelectorAll(
    `slot[${LIGHT_SLOT_ATTR}][${PROJECTION_ATTR}="${PROJECTION_ACTUAL}"]`,
  )) {
    if (!isOwnSlot(host, el)) continue;
    if (isInsideAuthored(state, host, el)) continue; // authored content, not a slot
    const slot = /** @type {HTMLSlotElement} */ (el);
    const snapshot = state.lastSnapshot.get(slot);
    if (!snapshot) continue;
    const physical = Array.from(slot.childNodes);
    if (arraysEqual(physical, snapshot)) continue;
    const a = state.authored;
    const key = keyOfName(slot.getAttribute('name'));

    // Base: the slice in PHYSICAL order, minus op-touched nodes (re-anchored
    // below or op-removed). A physical node unknown to the record is a true
    // addition (renderer hole / library write) and folds in at its physical
    // position; when the container is a NAMED slot and the node's own
    // attribute would key it elsewhere, remember the container's key as the
    // node's ADOPTED key so repartition does not teleport it out of the
    // container it was written into.
    const merged = physical.filter((n) => !pendingNodes.has(n));
    for (const n of merged) {
      if (a.indexOf(n) !== -1) continue; // known to the record already
      if (effectiveKeyOf(state, n) !== key) {
        if (!state.adoptedKey) state.adoptedKey = new WeakMap();
        state.adoptedKey.set(n, key);
      }
    }

    // Re-anchor every record node of this slice that is not already in the
    // base, in record order, each after the LAST base member that precedes
    // it in the record (start when none). Covers op-inserted/moved nodes and
    // record nodes missing from the slot (prune settles those right after).
    for (const n of a) {
      if (merged.indexOf(n) !== -1) continue;
      if (effectiveKeyOf(state, n) !== key) continue;
      const nIdx = a.indexOf(n);
      let at = 0;
      for (let i = 0; i < merged.length; i++) {
        const mIdx = a.indexOf(merged[i]);
        if (mIdx !== -1 && mIdx < nIdx) at = i + 1;
      }
      merged.splice(at, 0, n);
    }

    // Replace the old slice with the merged one at the old slice's position.
    const involved = new Set(merged);
    for (const n of snapshot) involved.add(n);
    let at = -1;
    let seen = 0;
    for (const n of a) {
      if (involved.has(n)) {
        if (at === -1) at = seen;
        continue;
      }
      seen += 1;
    }
    const rest = a.filter((n) => !involved.has(n));
    if (at === -1 || at > rest.length) at = rest.length;
    rest.splice(at, 0, ...merged);
    state.authored = rest;
    // The snapshot itself is settled by the placement step this pass.
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
    // A DIRECT host child is still ours: a raw bypass move pulled it out of
    // its slot onto the host (native: a host child stays assigned), and the
    // physically-verifying placement step re-places it this same pass.
    if (p === host) return true;
    if (p === park) return true;
    // The slot-parent keep requires the slot to be recognizably OURS: in
    // this host's tree, or a slot THIS state once applied (lastSnapshot has
    // it), which covers our own detached slots (a cache()-stashed branch, a
    // torn-down conditional) without trusting the bare isOwnSlot walk,
    // whose vacuous-true on ANY fully detached chain would let the apply
    // steal a node back from an unrelated component's torn-down slot the
    // author moved it into.
    if (
      p.nodeType === 1 &&
      /** @type {Element} */ (p).tagName === 'SLOT' &&
      /** @type {Element} */ (p).hasAttribute(LIGHT_SLOT_ATTR) &&
      (host.contains(p) ||
        state.lastSnapshot.has(/** @type {HTMLSlotElement} */ (p))) &&
      isOwnSlot(host, /** @type {Element} */ (p))
    ) {
      return true;
    }
    return false;
  });
  // The manual-assignment overlay needs no pruning here: it holds nodes via
  // WeakRef (native holds manually assigned slottables weakly), so a removed
  // node is not leaked, and an entry for a node assigned BEFORE it becomes a
  // host child stays honoured when the node is later appended (the native
  // assign-first, append-later ordering).
}

/**
 * True when this host's current markup is FRAMEWORK-RENDERED output rather
 * than author-written children: a rendered light template carries the
 * framework's own `slot[data-webjs-light]` elements, an attribute only the
 * renderer / SSR ever stamps (own-slot filtered so a nested serialized
 * component inside genuinely-authored children does not misfire; and
 * `data-wj-host` is NOT usable here, since connectedCallback stamps it on
 * every light host before this check runs). The connectedCallback branch
 * chooser uses this STRUCTURAL signal to pick adopt-not-capture for a
 * framework-rendered subtree, so a back/forward snapshot restore
 * (post-hydration HTML, no `webjs-hydrate` marker) adopts the projected
 * children instead of hoovering the rendered tree into `authored` (the #1006
 * duplication shape on the restore path).
 *
 * @param {Element} host
 * @returns {boolean}
 */
export function hasFrameworkRenderedSubtree(host) {
  if (!inBrowser) return false;
  // BOTH attributes are required. data-webjs-light alone is stamped at
  // TEMPLATE COMPILE time on every <slot> in every html template, including a
  // slot FORWARDED as an authored child of a nested component tag
  // (html`<inner-shell><slot>fallback</slot></inner-shell>`), so matching it
  // alone would misfire on the forwarding shape at a client-side first mount
  // and adopt (discard) the forwarded slot. data-projection is stamped only
  // when the framework has PLACED the slot (SSR substitution or the apply
  // step), so light + projection together mean genuinely rendered output.
  for (const el of host.querySelectorAll(`slot[${LIGHT_SLOT_ATTR}][${PROJECTION_ATTR}]`)) {
    if (isOwnSlot(host, el)) return true;
  }
  return false;
}

/**
 * True when `slot` belongs to `host` directly: no OTHER custom element
 * sits between them. A slot nested inside a child custom element belongs
 * to THAT component and is applied from its own record.
 *
 * SUBTLETY: for a slot in a fully DETACHED chain the walk ends at null
 * without reaching `host` and returns vacuously true. Callers that must not
 * treat a FOREIGN detached slot as owned (the prune rule, isVirtualChild)
 * pair this with a `host.contains(p)` gate; adopted-SSR children in the
 * detached old chain survive pruning via their FRAMEWORK_DETACHED mark, not
 * via this walk.
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
  // These nodes are being placed into an own actual slot, so they are
  // author-live now: clear the prune exemption on EVERY path (including the
  // unchanged and in-place fast paths below, which the router's morph hits).
  // Missing this leaves a reprojected node permanently exempt, so a later
  // el.remove() / cross-host move on it would not be pruned (zombie / theft).
  for (const n of assigned) FRAMEWORK_DETACHED.delete(n);
  const wasFallback = slot.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL;
  const prev = state.lastSnapshot.get(slot) || [];
  const setChanged = wasFallback || !arraysEqual(prev, assigned);

  // Physical fast path: the assigned nodes are ALREADY the slot's children in
  // the same order (the idempotent no-change pass, and the router's morph
  // which reconciles in place then syncs the record). Settle the snapshot;
  // slotchange reflects the SET change vs the previous snapshot. Verifying
  // physically (never trusting the snapshot alone) also makes the apply
  // self-repairing after a bypass move pulled a node out of the slot.
  if (!wasFallback && arraysEqual(Array.from(slot.childNodes), assigned)) {
    state.lastSnapshot.set(slot, assigned.slice());
    return setChanged;
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
  }

  // Incremental reconcile, native parity: an assignment change must never
  // reparent a SURVIVING assigned node (native shadow assignment does not
  // move host children), or appending one sibling would bounce every nested
  // custom element through disconnect/connect, drop focus, and reload an
  // <iframe>/<video> in the projected content. Remove departures, then
  // position each assigned node touching ONLY the new, departing, or
  // out-of-order ones.
  const want = new Set(assigned);
  for (const c of Array.from(slot.childNodes)) {
    if (!want.has(c)) slot.removeChild(c);
  }
  let cursor = slot.firstChild;
  for (const node of assigned) {
    if (node === cursor) {
      cursor = cursor.nextSibling;
      continue;
    }
    slot.insertBefore(node, cursor);
  }
  slot.setAttribute(PROJECTION_ATTR, PROJECTION_ACTUAL);
  state.lastSnapshot.set(slot, assigned.slice());
  return setChanged;
}

/**
 * Set a slot to fallback mode: clear any actual-assignment children and
 * restore the part-owned fallback fragment. The record keeps the nodes
 * (they are values now), so a later authored write or slot re-creation
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
    // Fire regardless of connectivity: native slot assignment (and its
    // slotchange) works in disconnected trees, and dropping the event here
    // would lose it forever for a detached-then-reused host.
    for (const s of pending) fireSlotChange(s);
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
