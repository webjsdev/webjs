/**
 * Hydration slot adoption: keep a light-DOM host's SSR-projected children in
 * the document while its first client render replaces the SSR markup (#1666).
 *
 * Hydration renders the template from a fresh clone and swaps it in for the
 * SSR markup. The projected children sit inside the SSR `<slot>`, so swapping
 * the SSR tree out took them out of the document, and the first slot apply put
 * them back a microtask later. A removal is not free: the HTML spec navigates
 * a re-inserted iframe again (and `loading="lazy"` defers only the FIRST
 * insertion, so a hidden lazy frame loads), and every nested custom element
 * disconnects and reconnects.
 *
 * So for each of the template's own slots whose SSR counterpart holds exactly
 * the nodes the host's record adopted, the SSR slot and its ancestor chain up
 * to the host are KEPT: the parts that target a fresh element on that chain
 * are pointed at its live twin, and the fresh siblings around the chain are
 * inserted into the live elements instead of the live tree being replaced. No
 * kept node moves, so the projected children never leave the document. The
 * fresh slot's cloned fallback goes to the slot's holding fragment, where the
 * slot part would have put it.
 *
 * Conservative by construction: a slot is adopted only when every link of
 * both chains matches by tag, no link is a custom element (whose SSR markup is
 * its own rendered template) or a `<form>` (form-action reconciliation inserts
 * children into it), the slot's name is static, and the kept nodes sit in the
 * same relative order on both sides. Anything else, a slot inside a
 * conditional template among them, falls back to the plain swap.
 *
 * @module
 */
import {
  PROJECTION_ACTUAL, PROJECTION_ATTR, SLOT_FALLBACK_FRAG, SLOT_OWNER_ATTR,
  ensureSlotState, hasSlotState, keyOfName,
} from '../slot.js';

/**
 * Live SSR slots a hydration render adopted. The slot part's finalize reads
 * it to leave the slot's children (the projected nodes) in place instead of
 * harvesting them as fallback, since the holding fragment is already set.
 * @type {WeakSet<Element>}
 */
export const adoptedSlots = new WeakSet();

/**
 * @typedef {{ map: Map<Node, Element>, slots: [Element, Element][], chains: [Element, Element][] }} AdoptionPlan
 */

/**
 * Plan the adoption for a hydration render, after the parts are bound and
 * before any is applied. Returns null when no slot qualifies.
 *
 * @param {Element | DocumentFragment | ShadowRoot} container
 * @param {DocumentFragment} frag the fresh clone
 * @param {any[]} bound the template's bound parts
 * @returns {AdoptionPlan | null}
 */
export function planSlotAdoption(container, frag, bound) {
  if (/** @type {any} */ (container).nodeType !== 1 || !hasSlotState(/** @type {Element} */ (container))) return null;
  const state = ensureSlotState(/** @type {Element} */ (container));
  /** @type {Set<Element>} */
  const dynamicName = new Set();
  for (const p of bound) {
    if ((p.kind === 'attr' || p.kind === 'attr-mixed' || p.kind === 'bool') && p.name === 'name') dynamicName.add(p.el);
  }
  /** @type {Map<Node, Element>} fresh element to its live twin */
  const map = new Map();
  /** @type {Set<Element>} */
  const usedLive = new Set();
  /** @type {[Element, Element][]} */
  const slots = [];
  /** @type {[Element, Element][]} */
  const chains = [];
  for (const p of bound) {
    if (p.kind !== 'slot') continue;
    const slotF = /** @type {Element} */ (p.slotEl);
    if (dynamicName.has(slotF)) continue;
    const assigned = state.assignedByName.get(keyOfName(slotF.getAttribute('name')));
    if (!assigned || assigned.length === 0) continue;
    const slotL = /** @type {Element | null} */ (assigned[0].parentNode);
    if (!slotL || slotL.nodeType !== 1 || slotL.localName !== 'slot' || usedLive.has(slotL)) continue;
    if (slotL.getAttribute(PROJECTION_ATTR) !== PROJECTION_ACTUAL) continue;
    if (!sameNodes(slotL.childNodes, assigned)) continue;
    const fChain = ancestorsUpTo(slotF, frag);
    const lChain = ancestorsUpTo(slotL, container);
    if (!fChain || !lChain || fChain.length !== lChain.length) continue;
    let ok = true;
    for (let i = 0; i < fChain.length && ok; i++) {
      const f = fChain[i];
      const l = lChain[i];
      const name = f.localName;
      if (name !== l.localName || name.includes('-') || name === 'form') ok = false;
      else {
        const prior = map.get(f);
        if (prior ? prior !== l : usedLive.has(l)) ok = false;
      }
    }
    if (!ok) continue;
    map.set(slotF, slotL);
    usedLive.add(slotL);
    slots.push([slotF, slotL]);
    for (let i = 0; i < fChain.length; i++) {
      if (map.has(fChain[i])) continue;
      map.set(fChain[i], lChain[i]);
      usedLive.add(lChain[i]);
      chains.push([fChain[i], lChain[i]]);
    }
  }
  if (slots.length === 0) return null;
  // No kept node may have to move: under each kept parent the kept children
  // must already sit in the order the template puts them in.
  for (const fParent of [frag, ...chains.map(([f]) => f)]) {
    let last = null;
    for (const child of fParent.childNodes) {
      const live = map.get(child);
      if (!live) continue;
      if (last && !(last.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING)) return null;
      last = live;
    }
  }
  return { map, slots, chains };
}

/**
 * Point every bound part that targets a kept fresh element at its live twin,
 * and give each kept element the fresh one's static attributes. Runs before
 * the parts apply, so every dynamic value lands on the live element directly.
 *
 * @param {AdoptionPlan} plan
 * @param {any[]} bound
 */
export function retargetParts(plan, bound) {
  /** @type {Map<Element, Set<string>>} attributes a part owns, per live element */
  const owned = new Map();
  for (const p of bound) {
    if (p.kind === 'slot') {
      const live = plan.map.get(p.slotEl);
      if (live) p.slotEl = live;
      continue;
    }
    if (!p.el) continue;
    const live = plan.map.get(p.el);
    if (!live) continue;
    if (p.kind === 'event') {
      p.el.removeEventListener(p.name, p.dispatcher);
      live.addEventListener(p.name, p.dispatcher);
    }
    p.el = live;
    if (p.kind === 'attr' || p.kind === 'attr-mixed' || p.kind === 'bool') {
      let names = owned.get(live);
      if (!names) owned.set(live, names = new Set());
      names.add(p.name);
    }
  }
  for (const [fresh, live] of [...plan.chains, ...plan.slots]) {
    const isSlot = live.localName === 'slot';
    const names = owned.get(live);
    for (const a of Array.from(live.attributes)) {
      if (fresh.hasAttribute(a.name) || names?.has(a.name)) continue;
      // The SSR projection stamps stay: the slot IS projected, and the owner
      // carrier is what isOwnSlot reads until the owner symbol is stamped.
      if (isSlot && (a.name === PROJECTION_ATTR || a.name === SLOT_OWNER_ATTR)) continue;
      live.removeAttribute(a.name);
    }
    for (const a of Array.from(fresh.attributes)) {
      if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    }
  }
}

/**
 * Commit the fresh template into the container around the kept live nodes:
 * every live child that is not kept is removed, every fresh node is inserted
 * in template order, and no kept node moves. The fresh slots' cloned fallback
 * goes to each kept slot's holding fragment.
 *
 * @param {AdoptionPlan} plan
 * @param {Element} container
 * @param {Node[]} top the container's new children, bookends included
 */
export function commitAdoption(plan, container, top) {
  const mapped = (/** @type {Node} */ n) => plan.map.get(n) || n;
  const state = ensureSlotState(container);
  for (const [fresh, live] of plan.chains) mergeChildren(live, Array.from(fresh.childNodes, mapped));
  mergeChildren(container, top.map(mapped));
  for (const [fresh, live] of plan.slots) {
    const fallback = document.createDocumentFragment();
    while (fresh.firstChild) fallback.appendChild(fresh.firstChild);
    /** @type {any} */ (live)[SLOT_FALLBACK_FRAG] = fallback;
    adoptedSlots.add(live);
    // Forget the adopted snapshot so the first apply reports the initial
    // projection (one slotchange), exactly as the plain swap did.
    state.lastSnapshot.delete(live);
  }
}

/**
 * Make `parent`'s children exactly `want`, removing what is not wanted and
 * inserting the rest, without moving a node already in place in order.
 *
 * @param {Node} parent
 * @param {Node[]} want
 */
function mergeChildren(parent, want) {
  const keep = new Set(want);
  for (const c of Array.from(parent.childNodes)) {
    if (!keep.has(c)) parent.removeChild(c);
  }
  let cursor = parent.firstChild;
  for (const node of want) {
    if (node === cursor) {
      cursor = cursor.nextSibling;
      continue;
    }
    parent.insertBefore(node, cursor);
  }
}

/**
 * The element ancestors of `node` below `root`, nearest first, or null when
 * `root` is not an ancestor.
 *
 * @param {Node} node
 * @param {Node} root
 * @returns {Element[] | null}
 */
function ancestorsUpTo(node, root) {
  const out = [];
  let p = node.parentNode;
  while (p && p !== root) {
    if (p.nodeType !== 1) return null;
    out.push(/** @type {Element} */ (p));
    p = p.parentNode;
  }
  return p === root ? out : null;
}

/**
 * @param {NodeListOf<ChildNode>} list
 * @param {Node[]} nodes
 */
function sameNodes(list, nodes) {
  if (list.length !== nodes.length) return false;
  for (let i = 0; i < nodes.length; i++) if (list[i] !== nodes[i]) return false;
  return true;
}
