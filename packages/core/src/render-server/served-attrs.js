import { escapeAttr } from '../escape.js';
import { decodeAttrEntities } from './text.js';
import { appendReflectedAttrs } from './attrs.js';

/**
 * Serve a custom element's attributes as the element left them after the
 * server pass, the way lit-ssr's `ElementRenderer.renderAttributes()` emits
 * the instance's final attributes rather than the ones the tag was written
 * with. The browser does the same after upgrade: an element that sets, changes
 * or removes an attribute during its first update shows the result, so the
 * served bytes now match the hydrated DOM instead of the source tag.
 *
 * Three cases, per attribute:
 *   - one the element added is appended (`appendReflectedAttrs`, unchanged);
 *   - one the element CHANGED is served with its new value;
 *   - one the element REMOVED is dropped from the tag.
 * An attribute the element left alone keeps its source text BYTE FOR BYTE
 * (its quoting, its entity spelling, its position), so a page whose
 * components touch nothing renders exactly as before.
 *
 * What stays as written, and why each is safe:
 *   - `data-webjs-prop-*`: a parent's `.prop=${value}` binding, consumed into
 *     the property BEFORE the instance existed (`consumePropAttrs`), so the
 *     instance never holds it and reading it back would drop it. It is kept as
 *     written, because the browser decodes it again on upgrade.
 *   - `data-wj-host`: added AFTER this step by `withHostMarker`. When a
 *     re-processed string already carries it (a streamed boundary's children),
 *     it was seeded into the instance like any other attribute and is
 *     unchanged, so it is kept.
 *   - `data-wj-slot-owner`: the renderer stamps it on `<slot>` elements, not on
 *     hosts. A host can only carry it in a re-processed string, where it was
 *     seeded and is unchanged, so it is kept.
 *   - an attribute that came from a template hole: by this point its value is
 *     plain text in the opening tag, seeded like a static one, so the same
 *     rule applies. Serving the element's value cannot desynchronize the hole:
 *     a host inside a component's template is re-created by that component's
 *     client render, which writes the hole's value again, and a host written
 *     by a page or a layout never hydrates its attributes at all.
 *
 * @param {string} opening  the element's opening tag, `<tag attrs>`, ending in `>`
 * @param {any} instance  the server-side instance (the element shim, or a real
 *   `HTMLElement` when `renderToString` runs in a browser)
 * @param {Set<string>} presentAttrNames  lowercased names already in the source tag
 * @returns {string}
 */
export function serveInstanceAttrs(opening, instance, presentAttrNames) {
  if (!instance || typeof instance.getAttribute !== 'function' || typeof instance.getAttributeNames !== 'function') return opening;
  const nameEnd = opening.search(/[\s>]/);
  const head = opening.slice(0, nameEnd);
  const body = opening.slice(nameEnd, -1);
  // The same attribute grammar `parseAttrs` reads the source with, so every
  // name seeded into the instance is found again here.
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let out = '';
  let last = 0;
  let changed = false;
  let m;
  while ((m = re.exec(body)) !== null) {
    const raw = m[0];
    const name = m[1];
    if (name.toLowerCase().startsWith('data-webjs-prop-')) continue;
    const written = decodeAttrEntities(m[2] ?? m[3] ?? m[4] ?? '');
    const now = instance.getAttribute(name);
    if (now === written) continue;
    changed = true;
    if (now === null) {
      // Removed: drop it together with the whitespace that separated it.
      let start = m.index;
      while (start > last && /\s/.test(body[start - 1])) start--;
      out += body.slice(last, start);
    } else {
      out += body.slice(last, m.index) + (now === '' ? name : `${name}="${escapeAttr(String(now))}"`);
    }
    last = m.index + raw.length;
  }
  const rewritten = changed ? `${head}${out}${body.slice(last)}>` : opening;
  return appendReflectedAttrs(rewritten, instance, presentAttrNames);
}
