/**
 * Client router: refreshing the layout chrome after a mutation (#1557).
 *
 * A boundary swap rewrites what sits INSIDE one `<!--wj:children:...-->` range.
 * A layout's own markup (the header, nav, footer it renders around
 * `${children}`) sits OUTSIDE every range it owns, so no boundary tier can
 * reach it. That is right for a link click, where the layout is identical by
 * construction, and wrong after a form submission: the action may have set or
 * cleared a cookie the layout reads (a sign-in that should flip "Sign in" to
 * "Sign out"), and the layout markup on screen predates it.
 *
 * So a mutating submission is applied in two steps. The boundary plan runs
 * exactly as it does for any navigation (its remount-vs-morph rules are
 * unchanged), and then this module MORPHS the chrome: every node outside the
 * plan's anchor range, walked level by level from `<body>` down to the range.
 * The morph is the same keyed + positional reconcile the boundary tier uses,
 * so a hydrated component in the layout keeps its instance unless its own
 * markup changed, and a form control keeps what the reader typed.
 *
 * It is split into a PLAN and an APPLY so the caller can decide before
 * touching the DOM. The plan refuses (returns null) whenever the walk cannot be
 * proven safe, and the caller then takes the full-body tier instead, which is
 * always correct and only loses component state:
 *   - the live and incoming ancestor chains of the range differ in depth or in
 *     tag at any level, so there is no level-by-level pairing to trust;
 *   - a hydrated component sits on the chain (a layout whose `${children}`
 *     renders inside a slotted shell component). Its subtree is render-owned,
 *     and reconciling into it would corrupt its template parts (#906).
 *
 * Nodes appended to `<body>` at runtime (a dev overlay, a dialog portal, a
 * toast region) have no server-rendered counterpart. They always sit AFTER the
 * server-rendered content, so at the body level a live node with no incoming
 * peer is kept when it trails the last matched node, and removed only when it
 * sits among the server-rendered nodes. Below `<body>` every node is layout
 * output, so an unmatched live node there is removed like in any morph.
 *
 * @module
 */
import { LIVE_ATTRS } from './constants.js';
import { diffElementInPlace, isHydratedComponent, keyOf } from './dom-differ.js';
import { reactivateScripts, upgradeCustomElements } from './upgrade.js';
import { regraftPermanentInSlice } from './view-transition.js';

/**
 * @typedef {{ live: Element[], incoming: Element[],
 *   liveRange: { start: Comment, end: Comment },
 *   incomingRange: { start: Comment, end: Comment } }} ChromePlan
 */

/**
 * The ancestor chain of `node` from `root` down to its parent, `root` first.
 * Null when `node` is not inside `root`.
 *
 * @param {Node} node
 * @param {Element} root
 * @returns {Element[] | null}
 */
function chainTo(node, root) {
  /** @type {Element[]} */
  const chain = [];
  for (let el = node.parentNode; el; el = el.parentNode) {
    chain.unshift(/** @type {Element} */ (el));
    if (el === root) return chain;
  }
  return null;
}

/**
 * Decide whether the chrome around a boundary range can be morphed level by
 * level, before anything is written.
 *
 * @param {{ start: Comment, end: Comment }} liveRange  The plan's live anchor.
 * @param {{ start: Comment, end: Comment }} incomingRange  Its incoming peer.
 * @param {Element} liveBody
 * @param {Element} incomingBody
 * @returns {ChromePlan | null}  Null when the walk is not provably safe.
 */
export function planLayoutChrome(liveRange, incomingRange, liveBody, incomingBody) {
  const live = chainTo(liveRange.start, liveBody);
  const incoming = chainTo(incomingRange.start, incomingBody);
  if (!live || !incoming || live.length !== incoming.length) return null;
  for (let i = 1; i < live.length; i++) {
    if (live[i].tagName !== incoming[i].tagName) return null;
    if (isHydratedComponent(live[i])) return null;
  }
  return { live, incoming, liveRange, incomingRange };
}

/**
 * The child nodes of `parent` strictly before `from` and strictly after `to`.
 *
 * @param {Element} parent
 * @param {Node} from
 * @param {Node} to
 * @returns {{ before: Node[], after: Node[] }}
 */
function sidesOf(parent, from, to) {
  /** @type {Node[]} */
  const before = [];
  /** @type {Node[]} */
  const after = [];
  let side = before;
  for (let n = parent.firstChild; n; n = n.nextSibling) {
    if (n === from) { side = null; }
    if (side) side.push(n);
    if (n === to) side = after;
  }
  return { before, after };
}

/**
 * The attribute half of `diffElementInPlace`, for an element ON the chain: its
 * children are split around the chain and morphed run by run, so the recursion
 * that function would do is exactly what must not happen here.
 *
 * @param {Element} dst
 * @param {Element} src
 */
function syncAttributes(dst, src) {
  for (const attr of src.attributes) {
    if (LIVE_ATTRS.has(attr.name) || attr.name === 'data-wj-serialized') continue;
    if (dst.getAttribute(attr.name) !== attr.value) dst.setAttribute(attr.name, attr.value);
  }
  for (const attr of [...dst.attributes]) {
    if (LIVE_ATTRS.has(attr.name)) continue;
    if (!src.hasAttribute(attr.name)) dst.removeAttribute(attr.name);
  }
}

/**
 * Pair a run of live siblings with its incoming run, in order. An element
 * matches by `keyOf` first, then the NEXT unkeyed live element of the same tag
 * at or after the last match; a text or comment node matches the next live
 * node of its type the same way. Each match is diffed in place.
 *
 * A forward scan rather than the same-index pairing `reconcileChildren` uses,
 * because chrome changes by INSERTING or REMOVING a sibling (a banner shown
 * only when signed in), and same-index pairing shifts every node after the
 * change onto the wrong peer: the header would no longer match the header, and
 * the body-level rule below would then keep the old one beside the new one.
 *
 * @param {Node[]} live
 * @param {Node[]} incoming  Already imported into the live document.
 * @returns {Node[]}  The final ordered list: reused live nodes and fresh ones.
 */
function matchRun(live, incoming) {
  /** @type {Map<string, Element>} */
  const keyed = new Map();
  for (const n of live) {
    if (n.nodeType !== 1) continue;
    const k = keyOf(/** @type {Element} */ (n));
    if (k) keyed.set(k, /** @type {Element} */ (n));
  }
  const used = new Set();
  let cursor = 0;
  /** @type {Node[]} */
  const out = [];
  for (const inc of incoming) {
    if (inc.nodeType === 1) {
      const k = keyOf(/** @type {Element} */ (inc));
      const hit = k ? keyed.get(k) : null;
      if (hit && !used.has(hit)) {
        used.add(hit);
        diffElementInPlace(hit, /** @type {Element} */ (inc));
        out.push(hit);
        cursor = Math.max(cursor, live.indexOf(hit) + 1);
        continue;
      }
    }
    let j = cursor;
    for (; j < live.length; j++) {
      const n = live[j];
      if (used.has(n) || n.nodeType !== inc.nodeType) continue;
      if (n.nodeType !== 1) break;
      const el = /** @type {Element} */ (n);
      if (!keyOf(el) && el.tagName === /** @type {Element} */ (inc).tagName) break;
    }
    if (j < live.length && (inc.nodeType === 1 || inc.nodeType === 3 || inc.nodeType === 8)) {
      const n = live[j];
      used.add(n);
      if (n.nodeType === 1) diffElementInPlace(/** @type {Element} */ (n), /** @type {Element} */ (inc));
      else if (n.nodeValue !== inc.nodeValue) n.nodeValue = inc.nodeValue;
      out.push(n);
      cursor = j + 1;
      continue;
    }
    out.push(inc);
  }
  return out;
}

/**
 * Morph one run of siblings (the nodes on one side of the chain at one level)
 * into place before `ref`, and return the nodes it inserted fresh.
 *
 * Placement walks back to front and skips a node already sitting before its
 * successor, so a reused node is never moved. Moving a connected custom
 * element fires `disconnectedCallback` and `connectedCallback`, which a
 * component can reasonably treat as an unmount.
 *
 * @param {Element} parent
 * @param {Node[]} live
 * @param {Node[]} incomingRaw  Incoming nodes, still in the parsed document.
 * @param {Node | null} ref  Insert before this node (null appends). Never a
 *   node of `live`, which this run may remove.
 * @param {boolean} keepTrailing  Keep unmatched live nodes after the last
 *   matched one (the body level, where they are runtime additions).
 * @returns {Node[]}
 */
function morphRun(parent, live, incomingRaw, ref, keepTrailing) {
  const incoming = incomingRaw.map((n) => document.importNode(n, true));
  regraftPermanentInSlice(live, incoming);
  const finalNodes = matchRun(live, incoming);
  const finalSet = new Set(finalNodes);
  let anchor = ref;
  if (keepTrailing) {
    let last = -1;
    for (let i = 0; i < live.length; i++) if (finalSet.has(live[i])) last = i;
    const trailing = live.slice(last + 1);
    if (trailing.length) {
      for (const n of trailing) finalSet.add(n);
      anchor = trailing[0];
    }
  }
  for (const n of live) {
    if (!finalSet.has(n) && n.parentNode === parent) parent.removeChild(n);
  }
  for (let i = finalNodes.length - 1; i >= 0; i--) {
    const n = finalNodes[i];
    if (n.parentNode !== parent || n.nextSibling !== anchor) parent.insertBefore(n, anchor);
    anchor = n;
  }
  const reused = new Set(live);
  return finalNodes.filter((n) => !reused.has(n));
}

/**
 * Morph the chrome a `planLayoutChrome` plan describes. Runs AFTER the
 * boundary plan has written the range, and never touches the range itself.
 *
 * @param {ChromePlan} plan
 */
export function morphLayoutChrome(plan) {
  const { live, incoming, liveRange, incomingRange } = plan;
  /** @type {Node[]} */
  const touched = [];
  for (let i = 0; i < live.length; i++) {
    const L = live[i];
    const I = incoming[i];
    // `<body>` attributes are left alone: a dialog or a scroll lock writes
    // them at runtime, and no layout renders the body tag itself.
    if (i > 0) syncAttributes(L, I);
    const last = i === live.length - 1;
    const liveFrom = last ? liveRange.start : live[i + 1];
    const liveTo = last ? liveRange.end : live[i + 1];
    const incFrom = last ? incomingRange.start : incoming[i + 1];
    const incTo = last ? incomingRange.end : incoming[i + 1];
    const l = sidesOf(L, liveFrom, liveTo);
    const n = sidesOf(I, incFrom, incTo);
    const fresh = [
      ...morphRun(L, l.before, n.before, liveFrom, false),
      // The after-run owns every node to the end of the parent, so it appends.
      ...morphRun(L, l.after, n.after, null, i === 0),
    ];
    for (const node of fresh) if (node.nodeType === 1) touched.push(reactivateScripts(/** @type {Element} */ (node)));
    for (const side of [l.before, l.after]) {
      for (const node of side) if (node.nodeType === 1 && node.isConnected) touched.push(/** @type {Element} */ (node));
    }
  }
  for (const el of touched) if (el.isConnected) upgradeCustomElements(/** @type {Element} */ (el));
}
