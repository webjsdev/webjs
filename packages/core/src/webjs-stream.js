/**
 * `<webjs-stream action="..." target="...">`: a self-applying surgical
 * DOM-update element (Turbo Streams parity, webjs-shaped).
 *
 * The router's primary mechanism swaps a whole layout-marker region (or a
 * `<webjs-frame>`). That is coarse: a comment-append, an optimistic row
 * removal, or a toast insertion has to redraw a whole region or hand-write
 * DOM JS. `<webjs-stream>` is the element-level grammar for those surgical
 * updates. The payload is plain HTML the browser already parses: a
 * `<webjs-stream>` wrapping a single `<template>`, carrying an `action` and a
 * `target` (an element id) or `targets` (a CSS selector). There is no protocol
 * parser; the element clones its `<template>` content and applies it with
 * native DOM methods, then removes itself.
 *
 *   <webjs-stream action="append" target="comments">
 *     <template><li>Nice post!</li></template>
 *   </webjs-stream>
 *
 * Actions (mirroring Turbo's set):
 *
 *   - `append`  / `prepend`: add the template content as the last / first
 *     children of the target.
 *   - `before`  / `after`: insert the template content as siblings before /
 *     after the target.
 *   - `replace`: replace the target element itself with the template content.
 *   - `update`: replace the target's children with the template content.
 *   - `remove`: remove the target element (no template needed).
 *
 * Two delivery paths share this ONE applier:
 *
 *   - **HTTP (content-negotiated form response).** A `<form>` submission rides
 *     the client router, which sends `Accept: text/vnd.webjs-stream.html`. When
 *     the server answers with that content type, the router applies the
 *     `<webjs-stream>` elements in the body surgically (no region swap). With
 *     JS OFF the browser sends no such Accept, so the server returns a normal
 *     render/redirect and the form degrades to a full-page round-trip. The
 *     grammar is therefore additive and progressive-enhancement-safe.
 *   - **Live channel (`broadcast()` / `connectWS`).** A server message that is
 *     a `<webjs-stream>` HTML string is applied by `renderStream(message)` from
 *     a `connectWS` handler, so chat / notifications / presence reuse the same
 *     applier instead of bespoke per-app DOM code.
 *
 * The element is inert server-side: `renderToString` emits it as plain
 * `<webjs-stream action=... target=...>` HTML and never touches the class
 * (it is defined only when `HTMLElement` exists). A `<webjs-stream>` that is
 * server-rendered into a page (rather than streamed in) self-applies on
 * hydration exactly as a streamed one does, so there is no separate code path.
 *
 * @element webjs-stream
 * @attr {string} action: Required. One of append / prepend / before / after /
 *   replace / update / remove.
 * @attr {string} target: An element id to apply the action to.
 * @attr {string} targets: A CSS selector matching one or more targets (applied
 *   to each). `target` and `targets` are mutually exclusive; `target` wins.
 */

/** The actions that operate by inserting the template content. */
const INSERT_ACTIONS = new Set(['append', 'prepend', 'before', 'after', 'replace', 'update']);

/**
 * Apply one resolved action against one target element.
 * @param {string} action
 * @param {Element} target
 * @param {DocumentFragment | null} frag  Cloned template content (null for remove).
 */
function applyTo(action, target, frag) {
  switch (action) {
    case 'append': if (frag) target.append(frag); break;
    case 'prepend': if (frag) target.prepend(frag); break;
    case 'before': if (frag) target.before(frag); break;
    case 'after': if (frag) target.after(frag); break;
    case 'replace': if (frag) target.replaceWith(frag); break;
    case 'update': if (frag) target.replaceChildren(frag); break;
    case 'remove': target.remove(); break;
    default: break; // unknown action: no-op
  }
}

const WebjsStream = (typeof HTMLElement !== 'undefined')
  ? class WebjsStream extends HTMLElement {
    connectedCallback() {
      // Apply once. A streamed-in element runs this on insertion; a
      // server-rendered one runs it on upgrade. Either way it self-removes.
      if (this._webjsApplied) return;
      this._webjsApplied = true;
      this._webjsApply();
    }

    _webjsApply() {
      const action = (this.getAttribute('action') || '').toLowerCase();
      const doc = this.ownerDocument || document;
      // Resolve targets: an id via `target`, or a selector via `targets`.
      /** @type {Element[]} */
      let targets = [];
      const id = this.getAttribute('target');
      if (id) {
        const el = doc.getElementById(id);
        if (el) targets = [el];
      } else {
        const sel = this.getAttribute('targets');
        if (sel) {
          try { targets = Array.from(doc.querySelectorAll(sel)); } catch { targets = []; }
        }
      }
      // The single child <template> carries the content for an insert action.
      const tpl = INSERT_ACTIONS.has(action)
        ? /** @type {HTMLTemplateElement | null} */ (this.querySelector('template'))
        : null;
      try {
        for (const target of targets) {
          // Clone per target so multiple `targets` each get their own nodes.
          const frag = tpl ? /** @type {DocumentFragment} */ (tpl.content.cloneNode(true)) : null;
          applyTo(action, target, frag);
        }
      } finally {
        // The stream element itself never stays in the live DOM.
        this.remove();
      }
    }
  }
  : /** @type {any} */ (null);

if (typeof customElements !== 'undefined' && WebjsStream && !customElements.get('webjs-stream')) {
  customElements.define('webjs-stream', WebjsStream);
}

/**
 * Apply a server-sent stream payload to the live DOM. The payload is HTML
 * containing one or more `<webjs-stream>` elements (each wrapping a
 * `<template>`); appending them to the document upgrades each one, which
 * self-applies its action and self-removes. Use this from a `connectWS` /
 * `broadcast` message handler so a live channel reuses the same applier as the
 * HTTP path.
 *
 *   connectWS('/feed', { message: (m) => renderStream(m) });
 *
 * @param {string | DocumentFragment | Node} input  The stream HTML (or parsed nodes).
 * @param {Document} [doc]  The document to apply into (defaults to `document`).
 */
function renderStream(input, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return;
  let nodes;
  if (typeof input === 'string') {
    const tpl = d.createElement('template');
    tpl.innerHTML = input;
    nodes = tpl.content;
  } else if (input && /** @type any */ (input).nodeType === 11) {
    nodes = input; // a DocumentFragment
  } else if (input && /** @type any */ (input).nodeType) {
    nodes = input; // a single Node
  } else {
    return;
  }
  // Appending to the body inserts + upgrades each <webjs-stream>, which applies
  // and removes itself synchronously on connect. A non-stream node appended
  // here is harmless (the caller controls the payload), but in practice the
  // payload is only <webjs-stream> elements.
  d.body.append(nodes);
}

export { WebjsStream, renderStream };
