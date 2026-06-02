import { isTemplate } from './html.js';
import { escapeText, escapeAttr } from './escape.js';
import { lookup, lookupModuleUrl, allTags } from './registry.js';
import { stylesToString, isCSS } from './css.js';
import { isRepeat } from './repeat.js';
import { isSuspense } from './suspense.js';
import { isUnsafeHTML, isLive, isKeyed, isGuard, isTemplateContent, isRef, isCache, isUntil, isAsyncAppend, isAsyncReplace, isWatch } from './directives.js';
import { stringify, parse } from './serialize.js';
import { cspNonce } from './csp-nonce.js';

/**
 * Render a TemplateResult (or any renderable value) to an HTML string.
 *
 * Async by design: template holes may be Promises, components' `render()`
 * methods may be async, and data-fetching inside nested components is
 * awaited before the final string is emitted.
 *
 * If `opts.suspenseCtx` is provided, Suspense boundaries encountered during
 * the render will push `{ id, promise }` into `opts.suspenseCtx.pending`
 * and their fallback HTML is emitted immediately. The caller is responsible
 * for streaming each resolved promise afterwards. Without a suspenseCtx,
 * Suspense still works but we fall back to emitting only the fallback
 * (the promise is dropped: appropriate for static pre-render).
 *
 * @typedef {{ pending: {id: string, promise: Promise<unknown>}[], nextId: number }} SuspenseCtx
 *
 * @param {unknown} value
 * @param {{ ssr?: boolean, suspenseCtx?: SuspenseCtx }} [opts]
 * @returns {Promise<string>}
 */
export async function renderToString(value, opts = { ssr: true }) {
  const ctx = opts && opts.suspenseCtx;
  const html = await render(value, ctx);
  return opts && opts.ssr === false ? html : await injectDSD(html, ctx);
}

/**
 * @param {unknown} value
 * @param {SuspenseCtx} [ctx]
 * @returns {Promise<string>}
 */
async function render(value, ctx) {
  if (value == null || value === false || value === true) return '';
  if (value && typeof /** @type any */ (value).then === 'function') {
    value = await value;
    return render(value, ctx);
  }
  // unsafeHTML: inject raw HTML string without escaping.
  if (isUnsafeHTML(value)) {
    return String(/** @type any */ (value).value ?? '');
  }
  // live() on the server just unwraps and renders the inner value.
  if (isLive(value)) {
    return render(/** @type any */ (value).value, ctx);
  }
  // watch() on the server reads the signal once and inlines the
  // result. Subscription is a client-only concern; the SSR HTML
  // freezes a snapshot of the current value.
  if (isWatch(value)) {
    return render(/** @type any */ (value).signal.get(), ctx);
  }
  // keyed() on the server: render the wrapped template; key is client-only.
  if (isKeyed(value)) {
    return render(/** @type any */ (value).value, ctx);
  }
  // guard() on the server: always invoke the value function (no cache on SSR).
  if (isGuard(value)) {
    return render(/** @type any */ (value).fn(), ctx);
  }
  // templateContent() on the server: emit the template's innerHTML verbatim.
  if (isTemplateContent(value)) {
    const tpl = /** @type any */ (value).template;
    return String(tpl?.innerHTML ?? '');
  }
  // ref() on the server: no-op (no DOM yet). Returns empty string.
  if (isRef(value)) {
    return '';
  }
  // cache() on the server: pass-through to the inner value.
  if (isCache(value)) {
    return render(/** @type any */ (value).value, ctx);
  }
  // until() on the server: render the first synchronous candidate, or
  // await the first Promise to settle when all candidates are Promises.
  // Rejections are swallowed (treated as "no value"); if every candidate
  // rejects, render empty rather than crash the SSR pipeline.
  if (isUntil(value)) {
    const args = /** @type any */ (value).args;
    for (const a of args) {
      if (!a || typeof (/** @type any */ (a).then) !== 'function') {
        return render(a, ctx);
      }
    }
    if (args.length > 0) {
      try {
        const winner = await Promise.race(args.map((p) => Promise.resolve(p).catch(() => undefined)));
        return render(winner, ctx);
      } catch {
        return '';
      }
    }
    return '';
  }
  // asyncAppend / asyncReplace on the server: render empty. Full
  // streaming is a follow-up; pages should use Suspense for streaming.
  if (isAsyncAppend(value) || isAsyncReplace(value)) {
    return '';
  }
  if (Array.isArray(value)) {
    const parts = await Promise.all(value.map((v) => render(v, ctx)));
    return parts.join('');
  }
  if (isRepeat(value)) {
    const r = /** @type any */ (value);
    const parts = await Promise.all(r.items.map((it, i) => render(r.templateFn(it, i), ctx)));
    return parts.join('');
  }
  if (isSuspense(value)) {
    const s = /** @type any */ (value);
    const fallback = await render(s.fallback, ctx);
    if (ctx) {
      const id = `s${ctx.nextId++}`;
      ctx.pending.push({ id, promise: Promise.resolve(s.children) });
      return `<webjs-boundary id="${id}">${fallback}</webjs-boundary>`;
    }
    return fallback;
  }
  if (isTemplate(value)) return renderTemplate(/** @type any */ (value), ctx);
  return escapeText(String(value));
}

/**
 * @param {import('./html.js').TemplateResult} tr
 * @param {SuspenseCtx} [ctx]
 * @returns {Promise<string>}
 */
async function renderTemplate(tr, ctx) {
  const { strings, values } = tr;
  let out = '';
  let state = 'text';
  let attrName = '';
  let attrStart = 0;
  let attrQuote = '';
  let commentDashes = 0;
  let currentTag = '';   // lowercased tag name currently being parsed
  let rawTail = '';      // rolling lowercased tail, tracks </script>/</style>

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      switch (state) {
        case 'text':
          out += c;
          if (c === '<') state = 'tag-open';
          break;
        case 'tag-open':
          out += c;
          if (c === '!') state = 'bang-1';
          else if (c === '/') { state = 'tag-name'; currentTag = ''; }
          else if (/[a-zA-Z]/.test(c)) { state = 'tag-name'; currentTag = c.toLowerCase(); }
          else state = 'text';
          break;
        case 'bang-1':
          out += c;
          state = c === '-' ? 'bang-dash' : 'tag-name';
          break;
        case 'bang-dash':
          out += c;
          if (c === '-') { state = 'comment'; commentDashes = 0; }
          else state = 'tag-name';
          break;
        case 'comment':
          out += c;
          if (c === '-') commentDashes += 1;
          else if (c === '>' && commentDashes >= 2) { state = 'text'; commentDashes = 0; }
          else commentDashes = 0;
          break;
        case 'tag-name':
          out += c;
          if (c === '>') {
            state = isRawtextTag(currentTag) ? 'rawtext' : 'text';
            if (state === 'rawtext') rawTail = '';
          } else if (/\s/.test(c)) state = 'in-tag';
          else currentTag += c.toLowerCase();
          break;
        case 'in-tag':
          out += c;
          if (c === '>') {
            state = isRawtextTag(currentTag) ? 'rawtext' : 'text';
            if (state === 'rawtext') rawTail = '';
          } else if (!/\s/.test(c) && c !== '/') {
            state = 'attr-name';
            attrName = c;
            attrStart = out.length - 1;
          }
          break;
        case 'rawtext':
          out += c;
          rawTail = (rawTail + c.toLowerCase()).slice(-9);
          if (rawTail.endsWith('</script>') || rawTail.endsWith('</style>')) {
            state = 'text';
            rawTail = '';
            currentTag = '';
          }
          break;
        case 'attr-name':
          if (c === '=') { state = 'after-eq'; out += c; }
          else if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; out += c; }
          else if (c === '>') { state = 'text'; attrName = ''; out += c; }
          else { attrName += c; out += c; }
          break;
        case 'after-eq':
          if (c === '"' || c === "'") { state = 'attr-quoted'; attrQuote = c; out += c; }
          else if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; out += c; }
          else if (c === '>') { state = 'text'; attrName = ''; out += c; }
          else { state = 'attr-unquoted'; out += c; }
          break;
        case 'attr-unquoted':
          if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; out += c; }
          else if (c === '>') { state = 'text'; attrName = ''; out += c; }
          else out += c;
          break;
        case 'attr-quoted':
          out += c;
          if (c === attrQuote) { state = 'in-tag'; attrName = ''; }
          break;
      }
    }

    if (i < values.length) {
      let val = values[i];
      // Resolve promises anywhere in the value graph.
      if (val && typeof /** @type any */ (val).then === 'function') {
        val = await val;
      }
      if (state === 'comment') {
        // Holes inside <!-- comments --> are emitted raw (no escaping; comments
        // are inert and not rendered by browsers).
        out += String(val ?? '');
        commentDashes = 0;
      } else if (state === 'rawtext') {
        // Inside <script> / <style>: emit the value as-is (no HTML escaping).
        // Author is responsible for not closing the tag with user-controlled
        // data: the usual caveat for CSS/JS interpolation.
        out += String(val ?? '');
        rawTail = '';
      } else if (state === 'text') {
        out += await render(val, ctx);
      } else if (state === 'after-eq') {
        const prefix = attrName[0];
        const name = attrName.slice(1);
        if (prefix === '@') {
          // Event listener. Client-only behaviour, drop at SSR.
          out = out.slice(0, attrStart);
          state = 'in-tag';
          attrName = '';
        } else if (prefix === '.') {
          // Property binding. Only meaningful on custom elements (which
          // have a hyphen in the tag name and a WebComponent subclass
          // that knows how to apply + strip data-webjs-prop-* on
          // hydration). For native elements (`<input .value=${v}>`)
          // the attribute would be dead weight (nothing consumes it),
          // so we drop it the same way the old behaviour did. The
          // client renderer still applies the property when the
          // template runs in the browser, which is the only place a
          // page-level `.prop` on a native element could have set the
          // property to begin with.
          out = out.slice(0, attrStart);
          if (!currentTag.includes('-')) {
            state = 'in-tag';
            attrName = '';
            continue;
          }
          // `undefined` has no meaningful HTML representation. Drop
          // silently so the consumer falls back to its constructor
          // default. `null` is preserved because it's a real value
          // distinct from "not set".
          if (val === undefined) {
            state = 'in-tag';
            attrName = '';
            continue;
          }
          try {
            const encoded = await stringify(val);
            out += `data-webjs-prop-${kebabCase(name)}="${escapeAttr(encoded)}"`;
          } catch (e) {
            // Unserializable value (function, class instance with
            // private state, DOM node, etc.). Drop with a warning so
            // SSR does not crash. Same constraint as Next.js RSC.
            console.warn(
              `[webjs] property binding .${name} has an unserializable `
              + `value during SSR. Dropping. The browser will see the `
              + `property as undefined. Detail: ${e && e.message}`
            );
          }
          state = 'in-tag';
          attrName = '';
        } else if (prefix === '?') {
          out = out.slice(0, attrStart);
          if (val) out += `${name}=""`;
          state = 'in-tag';
          attrName = '';
        } else {
          out += `"${escapeAttr(String(val ?? ''))}"`;
          state = 'in-tag';
          attrName = '';
        }
      } else if (state === 'attr-quoted' || state === 'attr-unquoted') {
        out += escapeAttr(String(val ?? ''));
      }
    }
  }
  return out;
}

// Browser-only names whose absence during SSR produces a recognisable error.
// Mirrors the `no-browser-globals-in-render` webjs check rule, which catches
// these at edit time; this turns the runtime SSR crash into the same guidance.
const SSR_BROWSER_GLOBALS = new Set([
  'document', 'window', 'localStorage', 'sessionStorage', 'navigator',
  'matchMedia', 'requestAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
]);
// Attribute methods (get/set/has/remove/toggleAttribute), the event methods
// (add/removeEventListener, dispatchEvent), and attachInternals are backed by
// the server-side element shim and work at SSR, so they are NOT listed here.
// What remains is the genuinely browser-only HTMLElement surface that still
// has no server stand-in and throws at SSR.
const SSR_HTMLELEMENT_METHODS = new Set([
  'attachShadow', 'querySelector', 'querySelectorAll',
  'getBoundingClientRect', 'focus', 'blur', 'scrollIntoView',
]);

/**
 * If `e` is the recognisable failure of touching a browser-only API during
 * SSR (a `ReferenceError` for a browser global, or a `TypeError` calling an
 * HTMLElement method that does not exist on the bare server-side instance),
 * return an actionable, member-naming hint; otherwise null.
 * @param {unknown} e
 * @returns {string | null}
 */
function browserMemberHint(e) {
  const msg = e && typeof (/** @type any */ (e).message) === 'string' ? /** @type any */ (e).message : '';
  let m = /^(\w+) is not defined$/.exec(msg);
  if (e instanceof ReferenceError && m && SSR_BROWSER_GLOBALS.has(m[1])) {
    return `\`${m[1]}\` is a browser-only global and is undefined during SSR.`;
  }
  m = /\.(\w+) is not a function$/.exec(msg);
  if (e instanceof TypeError && m && SSR_HTMLELEMENT_METHODS.has(m[1])) {
    return `\`${m[1]}\` is an HTMLElement method that does not exist on the server-side component instance during SSR.`;
  }
  return null;
}

/**
 * Scan an HTML string for registered custom elements and inject
 * Declarative Shadow DOM (`<template shadowrootmode="open">`).
 * Awaits each component's render() so async components are fully resolved.
 *
 * @param {string} html
 * @param {SuspenseCtx} [ctx]
 * @returns {Promise<string>}
 */
async function injectDSD(html, ctx, ancestors = []) {
  const tags = allTags();
  if (!tags.length) return html;
  // Sort longest tag name first so the regex alternation tries the most
  // specific match before its prefixes. Combined with the (?=[\s>/])
  // lookahead this prevents `my-card` from spuriously matching the prefix
  // of `<my-card-2>` (or `slot-ssr-1` matching `<slot-ssr-14>`, etc).
  // Attribute section is "anything that isn't `>`, with quoted values as a
  // single unit" so slashes in URL-valued attrs (e.g. then="/dashboard") don't
  // prevent the match. Non-greedy so self-closing `/>` still captures into the
  // third group.
  const sortedTags = [...tags].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `<(${sortedTags.map(escapeRegex).join('|')})(?=[\\s>/])((?:"[^"]*"|'[^']*'|[^>])*?)(/?)>`,
    'g'
  );
  /** @type {{start:number, end:number, text:string}[]} */
  const edits = [];
  for (const m of html.matchAll(pattern)) {
    const [match, tag, attrs, selfClose] = m;
    const Cls = lookup(tag);
    if (!Cls) continue;
    // Track which custom elements actually appeared: used by SSR to emit
    // `<link rel="modulepreload">` hints for their module URLs.
    if (ctx && ctx.usedComponents) ctx.usedComponents.add(tag);
    let opening = selfClose ? `<${tag}${attrs}>` : match;
    try {
      const isShadow = /** @type any */ (Cls).shadow === true;
      const instance = new /** @type any */ (Cls)();
      // Thread the ancestor chain (the enclosing custom-element instances)
      // so the server element shim's closest() can resolve a parent at SSR.
      // Set before performServerUpdate so a willUpdate() that reads a parent
      // via closest() sees the chain. Each child recursion below extends it.
      instance.__ssrTag = tag;
      instance.__ssrAncestors = ancestors;
      const attrMap = parseAttrs(attrs);
      // Decode `data-webjs-prop-*` attributes first (rich-typed values
      // emitted for `.prop=${val}` bindings in the parent template),
      // then coerce the ordinary string attributes by `static
      // properties` type. Property bindings take priority on a name
      // collision because they preserve the original JS reference.
      const propValues = consumePropAttrs(attrMap);
      // Names already present in the source opening tag (including the
      // data-webjs-prop-* bindings, which were stripped from attrMap above
      // but remain in the emitted `attrs` string). Reflected/added
      // attributes are appended only when their name is NOT already here, so
      // existing output stays byte-identical when nothing reflects.
      const presentAttrNames = new Set(Object.keys(parseAttrs(attrs)).map((n) => n.toLowerCase()));
      // Seed the server attribute shim so `this.getAttribute(...)` /
      // `this.hasAttribute(...)` in willUpdate / render read the source
      // attributes (a lit muscle-memory pattern) instead of reading empty.
      seedServerAttrs(instance, attrMap);
      applyAttrsToInstance(instance, attrMap, Cls);
      for (const [k, v] of Object.entries(propValues)) instance[k] = v;
      // Run the pre-render lifecycle (willUpdate, controllers' hostUpdate,
      // then reflect reflect:true props) so derived state computed there is
      // correct in the SSR'd HTML, matching how lit runs the update cycle at
      // SSR. WebComponent instances expose performServerUpdate; bare
      // Base-extending kit components (no lifecycle) do not, so it is guarded.
      if (typeof instance.performServerUpdate === 'function') instance.performServerUpdate();
      let tpl = instance.render ? instance.render() : '';
      if (tpl && typeof tpl.then === 'function') tpl = await tpl;
      // Surface attributes the component set up to and including render()
      // that were not already in the source tag: reflected reflect:true
      // props, an explicit this.setAttribute in the constructor / willUpdate,
      // or a host-attribute mutation inside render() itself (a light-DOM
      // compound-component pattern, e.g. this.dataset.state / this.className /
      // this.hidden on the host). Reading after render() captures all three.
      // Appending keeps the original tag byte-identical when nothing changed.
      opening = appendReflectedAttrs(opening, instance, presentAttrNames);
      // Render the template to HTML. injectDSD recurses on the result so
      // nested custom elements (e.g. <theme-toggle> inside <blog-shell>)
      // get their own DSD pass.
      const rawInner = await render(tpl, ctx);

      if (isShadow) {
        // Shadow DOM: native <slot> stays as-is in the DSD template. The
        // browser handles projection from the host's light-DOM children
        // into the shadow tree natively. No framework substitution here.
        const innerProcessed = await injectDSD(rawInner, ctx, [...ancestors, instance]);
        const rawStyles = /** @type any */ (Cls).styles;
        const styleList = Array.isArray(rawStyles) ? rawStyles : rawStyles && isCSS(rawStyles) ? [rawStyles] : [];
        const styleStr = stylesToString(styleList);
        edits.push({
          start: m.index,
          end: m.index + match.length,
          text: `${opening}<template shadowrootmode="open">${styleStr}${innerProcessed}</template>`,
        });
      } else {
        // Light DOM. When the component has a non-empty rendered template,
        // run the slot pipeline so behaviour matches shadow DOM: authored
        // children are visible only where projected through <slot>; any
        // child without a matching slot is dropped.
        //
        // When rendered template is empty (Base-extending decorator
        // components that have no render() method, or render() that
        // returns an empty template), the host acts as a transparent
        // wrapper: authored children stay in place adjacent to the
        // (empty) hydration marker. This preserves the kit's
        // decorator-pattern components (those extending Base from the
        // ui package's lib/utils.ts) without forcing a render() rewrite.
        const renderedIsEmpty = rawInner.trim() === '';
        if (renderedIsEmpty) {
          edits.push({
            start: m.index,
            end: m.index + match.length,
            text: `${opening}<!--webjs-hydrate-->`,
          });
          continue;
        }
        //
        // 1. Find the matching closing tag in the source HTML (depth-
        //    tracked for nested same-tag elements).
        // 2. Extract authored inner HTML, partition by slot="" attr.
        // 3. Substitute each <slot> in the rendered output with a
        //    framework-marked <slot data-webjs-light data-projection
        //    ="actual|fallback"> element carrying projection or
        //    fallback content per first-wins rule.
        // 4. Recursively run injectDSD on the substituted output so
        //    nested custom elements (inside projected children) get
        //    their own DSD pass.
        let authoredInner = '';
        let closeEnd = m.index + match.length;
        if (!selfClose) {
          const innerStart = m.index + match.length;
          const closeIdx = findClosingTagInString(html, innerStart, tag);
          if (closeIdx !== -1) {
            authoredInner = html.slice(innerStart, closeIdx);
            const closeRe = new RegExp(`</${escapeRegex(tag)}\\s*>`, 'i');
            const tail = html.slice(closeIdx);
            const closeMatch = closeRe.exec(tail);
            const closeLen = closeMatch ? closeMatch[0].length : `</${tag}>`.length;
            closeEnd = closeIdx + closeLen;
          } else {
            // Unclosed in source. Take rest of html as authored content
            // and synthesize a closing tag on output.
            authoredInner = html.slice(innerStart);
            closeEnd = html.length;
          }
        }
        const partitioned = partitionAuthoredBySlot(authoredInner);
        const innerWithSlots = substituteSlotsInRender(rawInner, partitioned);
        const innerProcessed = await injectDSD(innerWithSlots, ctx, [...ancestors, instance]);
        edits.push({
          start: m.index,
          end: closeEnd,
          text: `${opening}<!--webjs-hydrate-->${innerProcessed}</${tag}>`,
        });
      }
    } catch (e) {
      const hint = browserMemberHint(e);
      if (hint) {
        console.error(
          `[webjs] SSR failed for <${tag}>: ${hint} It was touched in the component's constructor or render(), which run during SSR. Move browser-only work to connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor only from server-known inputs (attributes / props).`,
          e,
        );
      } else {
        console.error(`[webjs] SSR failed for <${tag}>:`, e);
      }
    }
  }
  if (!edits.length) return html;

  // Drop edits whose range lives inside an earlier edit's range. This
  // happens when an outer custom element with <slot> in its render takes
  // an edit that spans its opening + closing tags (covering inner custom
  // elements among authored children); the inner matches were enumerated
  // independently against the original html, but those inner elements
  // are processed by the recursive injectDSD call on innerWithSlots.
  // Keeping both edits would double-process them and corrupt the output.
  // A consequence: a nested instance's render() runs once per chain depth
  // (the discarded top-level pass sees an empty ancestor chain, so its
  // closest() reads null; the kept recursive pass has the real chain). The
  // kept pass is the only output, and closest() is a read, so render() must
  // stay pure at SSR (the standard SSR contract), not branch on side effects.
  edits.sort((a, b) => a.start - b.start);
  /** @type {{start:number, end:number, text:string}[]} */
  const filtered = [];
  let consumedTo = -1;
  for (const e of edits) {
    if (e.start >= consumedTo) {
      filtered.push(e);
      consumedTo = e.end;
    }
  }
  // Apply edits from last to first so indices stay stable.
  let out = html;
  for (let i = filtered.length - 1; i >= 0; i--) {
    const { start, end, text } = filtered[i];
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Slot SSR helpers
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** @param {string} tag @returns {boolean} */
function isVoidElement(tag) {
  return VOID_ELEMENTS.has(tag.toLowerCase());
}

/**
 * Find the position of the matching closing tag for `tagName` starting
 * from `fromIndex` in `html`. Handles nested same-tag elements via depth
 * tracking. Returns the index of the `<` of `</tagName>`, or -1 if
 * unclosed.
 *
 * @param {string} html
 * @param {number} fromIndex
 * @param {string} tagName
 * @returns {number}
 */
function findClosingTagInString(html, fromIndex, tagName) {
  const esc = escapeRegex(tagName);
  // Match same-name opening tags. Followed by a name-boundary character
  // so we don't accept <table> as opening <tab>.
  const openRe = new RegExp(`<${esc}(?:[\\s>/])`, 'gi');
  const closeRe = new RegExp(`</${esc}\\s*>`, 'gi');
  openRe.lastIndex = fromIndex;
  closeRe.lastIndex = fromIndex;
  let depth = 1;
  while (depth > 0) {
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) return -1;
    if (o && o.index < c.index) {
      depth++;
      closeRe.lastIndex = o.index + 1;
    } else {
      depth--;
      if (depth === 0) return c.index;
      openRe.lastIndex = c.index + 1;
    }
  }
  return -1;
}

/**
 * Extract the `slot` attribute value from an attribute string. Returns
 * null when the attribute is absent.
 *
 * @param {string} attrsRaw
 * @returns {string | null}
 */
function extractSlotAttr(attrsRaw) {
  const m = /\bslot\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrsRaw);
  if (!m) return null;
  const value = m[1] ?? m[2] ?? m[3] ?? '';
  // Per shadow DOM spec, slot="" (empty) and missing slot attribute
  // both route to the default slot.
  return value === '' ? null : value;
}

/**
 * Partition authored inner HTML by each top-level child's `slot=""`
 * attribute. Text nodes, comment nodes, and elements without `slot=""`
 * all route to the default-slot key (null).
 *
 * Returns a Map keyed by slot name (null for default) whose values are
 * the concatenated HTML strings for that slot in source order.
 *
 * @param {string} html
 * @returns {Map<string|null, string>}
 */
function partitionAuthoredBySlot(html) {
  /** @type {Map<string|null, string>} */
  const groups = new Map();
  let defaultBuf = '';
  let cursor = 0;
  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) {
      defaultBuf += html.slice(cursor);
      break;
    }
    if (lt > cursor) defaultBuf += html.slice(cursor, lt);
    const rest = html.slice(lt);
    if (rest.startsWith('<!--')) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) {
        defaultBuf += rest;
        cursor = html.length;
        break;
      }
      defaultBuf += html.slice(lt, end + 3);
      cursor = end + 3;
      continue;
    }
    if (rest.startsWith('<!') || rest.startsWith('</')) {
      const end = html.indexOf('>', lt);
      if (end === -1) {
        defaultBuf += rest;
        cursor = html.length;
        break;
      }
      defaultBuf += html.slice(lt, end + 1);
      cursor = end + 1;
      continue;
    }
    const tagMatch = /^<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/.exec(rest);
    if (!tagMatch) {
      defaultBuf += '<';
      cursor = lt + 1;
      continue;
    }
    const [tagFull, tagName, attrsRaw, selfCloseSlash] = tagMatch;
    const lower = tagName.toLowerCase();
    const isSelfClose = !!selfCloseSlash || isVoidElement(lower);
    const slotAttr = extractSlotAttr(attrsRaw);
    let elemEnd;
    if (isSelfClose) {
      elemEnd = lt + tagFull.length;
    } else {
      const innerStart = lt + tagFull.length;
      const closeIdx = findClosingTagInString(html, innerStart, lower);
      if (closeIdx === -1) {
        // Unclosed element. Take to end of html.
        const elementHTML = html.slice(lt);
        if (slotAttr !== null) appendStringToMap(groups, slotAttr, elementHTML);
        else defaultBuf += elementHTML;
        cursor = html.length;
        continue;
      }
      const closeRe = new RegExp(`</${escapeRegex(lower)}\\s*>`, 'i');
      const tail = html.slice(closeIdx);
      const closeMatch = closeRe.exec(tail);
      const closeLen = closeMatch ? closeMatch[0].length : `</${lower}>`.length;
      elemEnd = closeIdx + closeLen;
    }
    const elementHTML = html.slice(lt, elemEnd);
    if (slotAttr !== null) appendStringToMap(groups, slotAttr, elementHTML);
    else defaultBuf += elementHTML;
    cursor = elemEnd;
  }
  if (defaultBuf.length > 0) groups.set(null, defaultBuf);
  return groups;
}

/** Append a string to a Map<K, string>, concatenating if the key exists. */
function appendStringToMap(map, key, value) {
  const existing = map.get(key);
  if (existing !== undefined) map.set(key, existing + value);
  else map.set(key, value);
}

/**
 * Substitute every `<slot>` tag in `rendered` with a framework-marked
 * `<slot data-webjs-light data-projection="actual|fallback">` element
 * carrying either the projected children for that slot (from
 * `partitioned`) or the slot's authored fallback content. Multiple
 * slots with the same name follow the first-wins rule per spec; later
 * same-named slots fall back regardless of available projection.
 *
 * @param {string} rendered
 * @param {Map<string|null, string>} partitioned
 * @returns {string}
 */
function substituteSlotsInRender(rendered, partitioned) {
  /** @type {Set<string|null>} */
  const consumedNames = new Set();
  let result = '';
  let cursor = 0;
  const slotRe = /<slot((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/gi;
  let m;
  while ((m = slotRe.exec(rendered)) !== null) {
    result += rendered.slice(cursor, m.index);
    const [fullOpen, attrsRaw, selfCloseSlash] = m;
    const isSelfClose = !!selfCloseSlash;
    const nameMatch = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrsRaw);
    const name = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]) : null;
    // Strip the `name` attribute from the carried-through attribute
    // string so we can re-add it (with escaping) on the framework slot.
    const otherAttrs = attrsRaw.replace(/\bname\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '').trim();
    let fallback = '';
    let totalEnd;
    if (isSelfClose) {
      totalEnd = m.index + fullOpen.length;
    } else {
      const innerStart = m.index + fullOpen.length;
      const closeIdx = findClosingTagInString(rendered, innerStart, 'slot');
      if (closeIdx === -1) {
        fallback = rendered.slice(innerStart);
        totalEnd = rendered.length;
      } else {
        fallback = rendered.slice(innerStart, closeIdx);
        const closeRe = /<\/slot\s*>/i;
        const tail = rendered.slice(closeIdx);
        const closeMatch = closeRe.exec(tail);
        const closeLen = closeMatch ? closeMatch[0].length : '</slot>'.length;
        totalEnd = closeIdx + closeLen;
      }
    }
    const projected = partitioned.get(name);
    const nameAttr = name !== null ? ` name="${escapeAttr(name)}"` : '';
    const extraAttrs = otherAttrs ? ` ${otherAttrs}` : '';
    if (projected !== undefined && !consumedNames.has(name)) {
      consumedNames.add(name);
      result += `<slot data-webjs-light data-projection="actual"${nameAttr}${extraAttrs}>${projected}</slot>`;
    } else {
      result += `<slot data-webjs-light data-projection="fallback"${nameAttr}${extraAttrs}>${fallback}</slot>`;
    }
    cursor = totalEnd;
    slotRe.lastIndex = totalEnd;
  }
  result += rendered.slice(cursor);
  return result;
}

/** @param {string} s */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} tag */
function isRawtextTag(tag) {
  return tag === 'script' || tag === 'style';
}

/**
 * Minimal attribute string parser.
 * @param {string} attrStr
 * @returns {Record<string,string>}
 */
function parseAttrs(attrStr) {
  /** @type {Record<string,string>} */
  const out = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/**
 * Seed the element's attributes from the source opening tag so reads like
 * `this.getAttribute(name)` / `this.hasAttribute(name)` inside willUpdate /
 * render return the real value during SSR. Goes through `setAttribute`, which
 * both the server element shim (Node SSR) and a real `HTMLElement`
 * (renderToString called in a browser, e.g. tests) implement, so the path
 * does not depend on the shim's internal store. A bare Base-extending kit
 * component without `setAttribute` is skipped.
 *
 * @param {any} instance
 * @param {Record<string,string>} attrs  parsed source attributes (data-webjs-prop-* already removed)
 */
function seedServerAttrs(instance, attrs) {
  if (!instance || typeof instance.setAttribute !== 'function') return;
  for (const [name, raw] of Object.entries(attrs)) {
    instance.setAttribute(name, unescapeAttr(raw));
  }
}

/**
 * Append attributes the component set before render (reflected reflect:true
 * properties, or an explicit `this.setAttribute` in the constructor /
 * willUpdate) to the element's opening tag, skipping any name already present
 * in the source tag. Reads via the standard `getAttributeNames` /
 * `getAttribute` API so it works whether the instance is the server shim or a
 * real `HTMLElement`. Returns the opening tag unchanged when there is nothing
 * to add, so existing SSR output stays byte-identical when no component
 * reflects, which preserves the elision on-vs-off differential invariant.
 *
 * @param {string} opening  the element's opening tag, ending in `>`
 * @param {any} instance
 * @param {Set<string>} presentAttrNames  lowercased names already in the source tag
 * @returns {string}
 */
function appendReflectedAttrs(opening, instance, presentAttrNames) {
  if (!instance || typeof instance.getAttributeNames !== 'function') return opening;
  let extra = '';
  for (const rawName of instance.getAttributeNames()) {
    const name = String(rawName).toLowerCase();
    if (presentAttrNames.has(name)) continue;
    const value = instance.getAttribute(rawName);
    extra += value === '' ? ` ${name}` : ` ${name}="${escapeAttr(String(value))}"`;
  }
  if (!extra) return opening;
  // Insert before the closing `>` (the opening tag is normalised to end in
  // `>`; a self-closing source tag was already rewritten without the slash).
  return `${opening.slice(0, -1)}${extra}>`;
}

/**
 * Coerce attribute strings to typed properties on a component instance
 * based on its static `properties` declaration.
 */
function applyAttrsToInstance(instance, attrs, Cls) {
  const props = Cls.properties || {};
  for (const [key, raw] of Object.entries(attrs)) {
    const def = props[key] || props[camelCase(key)];
    const propName = props[key] ? key : camelCase(key);
    if (!def) {
      instance[propName] = raw;
      continue;
    }
    if (def.type === Number) instance[propName] = Number(raw);
    else if (def.type === Boolean) instance[propName] = raw !== 'false';
    else if (def.type === Object || def.type === Array) {
      // `raw` is the entity-encoded attribute text (parseAttrs returns the
      // literal characters between the quotes), so decode the HTML entities
      // before JSON.parse. A JSON attribute carries `&quot;` for every `"`;
      // parsing it raw throws and would silently fall back to the string,
      // leaving an Object/Array prop holding a string at SSR.
      try { instance[propName] = JSON.parse(unescapeAttr(raw)); } catch { instance[propName] = raw; }
    } else instance[propName] = raw;
  }
}

/** @param {string} s */
function camelCase(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Inverse of camelCase. `userName` -> `user-name`, `userID` -> `user-i-d`.
 * Used to serialize property-binding names into HTML attribute names,
 * which are case-insensitive in the parser. The original JS property
 * name is recovered via camelCase() on the consumer side.
 *
 * @param {string} s
 */
function kebabCase(s) {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Reverse `escapeAttr` on a server-side attribute value. Needed
 * because `parseAttrs` returns the literal characters between the
 * quote marks; HTML entities are not decoded by the regex. The
 * browser handles this automatically, so client-side reads via
 * `getAttribute()` do not need the same step.
 *
 * @param {string} s
 */
function unescapeAttr(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/**
 * Decode `data-webjs-prop-<kebab>` attributes from a parsed attribute
 * map, returning a map of camelCase property name to decoded value.
 * Mutates `attrs` by deleting the consumed entries so they do not
 * appear in the rendered output a second time.
 *
 * @param {Record<string,string>} attrs
 * @returns {Record<string, unknown>}
 */
function consumePropAttrs(attrs) {
  /** @type {Record<string, unknown>} */
  const props = {};
  for (const key of Object.keys(attrs)) {
    if (!key.startsWith('data-webjs-prop-')) continue;
    const propName = camelCase(key.slice('data-webjs-prop-'.length));
    try {
      props[propName] = parse(unescapeAttr(attrs[key]));
    } catch {
      // Malformed payload. Skip silently so the rest of the component
      // can still render. The client-side hydration will also try and
      // fail, which is fine: undefined-prop semantics.
    }
    delete attrs[key];
  }
  return props;
}

// ---------------------------------------------------------------------------
// Streaming renderer
// ---------------------------------------------------------------------------

/**
 * Render a TemplateResult (or any renderable value) to a `ReadableStream`
 * that yields HTML chunks as strings.
 *
 * Works identically to {@link renderToString} but streams partial HTML as
 * it is rendered: avoiding buffering the entire page in memory. For
 * Suspense boundaries, the fallback is yielded immediately and resolved
 * content is streamed afterwards at the end of the response.
 *
 * **AI hint:** Use `renderToStream` when you want to pipe SSR output
 * directly into a `Response` for streaming delivery (e.g. HTTP chunked
 * transfer). It accepts the same arguments as `renderToString`.
 *
 * @param {unknown} value  A TemplateResult, string, array, or any renderable.
 * @param {{ ssr?: boolean, suspenseCtx?: SuspenseCtx }} [opts]
 * @returns {ReadableStream<string>}
 */
export function renderToStream(value, opts = { ssr: true }) {
  const ctx = opts && opts.suspenseCtx;
  return new ReadableStream({
    async start(controller) {
      try {
        if (opts && opts.ssr === false) {
          // No DSD injection: just stream the raw rendered chunks.
          await streamRender(value, ctx, controller);
        } else {
          // Render to string first to run DSD injection (which operates on
          // the full HTML), then enqueue the result. This matches the
          // semantics of renderToString but still gives us a stream.
          const html = await render(value, ctx);
          const full = await injectDSD(html, ctx);
          controller.enqueue(full);
        }

        // Stream resolved Suspense boundaries after the main content.
        if (ctx && ctx.pending.length) {
          await streamSuspenseBoundaries(ctx, controller);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Recursively render a value, enqueuing HTML chunks into the stream
 * controller as they become available.
 *
 * @param {unknown} value
 * @param {SuspenseCtx} [ctx]
 * @param {ReadableStreamDefaultController<string>} controller
 */
async function streamRender(value, ctx, controller) {
  if (value == null || value === false || value === true) return;
  if (value && typeof /** @type any */ (value).then === 'function') {
    value = await value;
    return streamRender(value, ctx, controller);
  }
  if (isUnsafeHTML(value)) {
    controller.enqueue(String(/** @type any */ (value).value ?? ''));
    return;
  }
  if (isLive(value)) {
    return streamRender(/** @type any */ (value).value, ctx, controller);
  }
  if (isWatch(value)) {
    return streamRender(/** @type any */ (value).signal.get(), ctx, controller);
  }
  if (isKeyed(value)) {
    return streamRender(/** @type any */ (value).value, ctx, controller);
  }
  if (isGuard(value)) {
    return streamRender(/** @type any */ (value).fn(), ctx, controller);
  }
  if (isTemplateContent(value)) {
    const tpl = /** @type any */ (value).template;
    controller.enqueue(String(tpl?.innerHTML ?? ''));
    return;
  }
  if (isRef(value)) {
    return;
  }
  if (isCache(value)) {
    return streamRender(/** @type any */ (value).value, ctx, controller);
  }
  if (isUntil(value)) {
    const args = /** @type any */ (value).args;
    for (const a of args) {
      if (!a || typeof (/** @type any */ (a).then) !== 'function') {
        return streamRender(a, ctx, controller);
      }
    }
    if (args.length > 0) {
      try {
        const winner = await Promise.race(args.map((p) => Promise.resolve(p).catch(() => undefined)));
        return streamRender(winner, ctx, controller);
      } catch {
        return;
      }
    }
    return;
  }
  if (isAsyncAppend(value) || isAsyncReplace(value)) {
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) await streamRender(v, ctx, controller);
    return;
  }
  if (isRepeat(value)) {
    const r = /** @type any */ (value);
    for (let i = 0; i < r.items.length; i++) {
      await streamRender(r.templateFn(r.items[i], i), ctx, controller);
    }
    return;
  }
  if (isSuspense(value)) {
    const s = /** @type any */ (value);
    if (ctx) {
      const id = `s${ctx.nextId++}`;
      controller.enqueue(`<webjs-boundary id="${id}">`);
      await streamRender(s.fallback, ctx, controller);
      controller.enqueue(`</webjs-boundary>`);
      ctx.pending.push({ id, promise: Promise.resolve(s.children) });
    } else {
      await streamRender(s.fallback, ctx, controller);
    }
    return;
  }
  if (isTemplate(value)) {
    await streamTemplate(/** @type any */ (value), ctx, controller);
    return;
  }
  controller.enqueue(escapeText(String(value)));
}

/**
 * Stream a TemplateResult by yielding each static string piece and
 * processing each value hole incrementally.
 *
 * @param {import('./html.js').TemplateResult} tr
 * @param {SuspenseCtx} [ctx]
 * @param {ReadableStreamDefaultController<string>} controller
 */
async function streamTemplate(tr, ctx, controller) {
  const { strings, values } = tr;
  let state = 'text';
  let attrName = '';
  let attrStart = 0;
  let attrQuote = '';
  let commentDashes = 0;
  let currentTag = '';
  let rawTail = '';
  // Buffer used for attribute handling where we may need to backtrack.
  let buf = '';

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      switch (state) {
        case 'text':
          buf += c;
          if (c === '<') state = 'tag-open';
          break;
        case 'tag-open':
          buf += c;
          if (c === '!') state = 'bang-1';
          else if (c === '/') { state = 'tag-name'; currentTag = ''; }
          else if (/[a-zA-Z]/.test(c)) { state = 'tag-name'; currentTag = c.toLowerCase(); }
          else state = 'text';
          break;
        case 'bang-1':
          buf += c;
          state = c === '-' ? 'bang-dash' : 'tag-name';
          break;
        case 'bang-dash':
          buf += c;
          if (c === '-') { state = 'comment'; commentDashes = 0; }
          else state = 'tag-name';
          break;
        case 'comment':
          buf += c;
          if (c === '-') commentDashes += 1;
          else if (c === '>' && commentDashes >= 2) { state = 'text'; commentDashes = 0; }
          else commentDashes = 0;
          break;
        case 'tag-name':
          buf += c;
          if (c === '>') {
            state = isRawtextTag(currentTag) ? 'rawtext' : 'text';
            if (state === 'rawtext') rawTail = '';
          } else if (/\s/.test(c)) state = 'in-tag';
          else currentTag += c.toLowerCase();
          break;
        case 'in-tag':
          buf += c;
          if (c === '>') {
            state = isRawtextTag(currentTag) ? 'rawtext' : 'text';
            if (state === 'rawtext') rawTail = '';
          } else if (!/\s/.test(c) && c !== '/') {
            state = 'attr-name';
            attrName = c;
            attrStart = buf.length - 1;
          }
          break;
        case 'rawtext':
          buf += c;
          rawTail = (rawTail + c.toLowerCase()).slice(-9);
          if (rawTail.endsWith('</script>') || rawTail.endsWith('</style>')) {
            state = 'text';
            rawTail = '';
            currentTag = '';
          }
          break;
        case 'attr-name':
          if (c === '=') { state = 'after-eq'; buf += c; }
          else if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; buf += c; }
          else if (c === '>') { state = 'text'; attrName = ''; buf += c; }
          else { attrName += c; buf += c; }
          break;
        case 'after-eq':
          if (c === '"' || c === "'") { state = 'attr-quoted'; attrQuote = c; buf += c; }
          else if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; buf += c; }
          else if (c === '>') { state = 'text'; attrName = ''; buf += c; }
          else { state = 'attr-unquoted'; buf += c; }
          break;
        case 'attr-unquoted':
          if (/\s/.test(c)) { state = 'in-tag'; attrName = ''; buf += c; }
          else if (c === '>') { state = 'text'; attrName = ''; buf += c; }
          else buf += c;
          break;
        case 'attr-quoted':
          buf += c;
          if (c === attrQuote) { state = 'in-tag'; attrName = ''; }
          break;
      }
    }

    // Flush the buffer before processing the value hole: but only when
    // we're in text state (in attribute states we may need the buffer for
    // backtracking).
    if (i < values.length) {
      let val = values[i];
      if (val && typeof /** @type any */ (val).then === 'function') {
        val = await val;
      }
      if (state === 'comment') {
        buf += String(val ?? '');
        commentDashes = 0;
      } else if (state === 'rawtext') {
        buf += String(val ?? '');
        rawTail = '';
      } else if (state === 'text') {
        // Flush the buffered static content before streaming the value.
        if (buf) { controller.enqueue(buf); buf = ''; }
        await streamRender(val, ctx, controller);
      } else if (state === 'after-eq') {
        const prefix = attrName[0];
        const name = attrName.slice(1);
        if (prefix === '@' || prefix === '.') {
          buf = buf.slice(0, attrStart);
          state = 'in-tag';
          attrName = '';
        } else if (prefix === '?') {
          buf = buf.slice(0, attrStart);
          if (val) buf += `${name}=""`;
          state = 'in-tag';
          attrName = '';
        } else {
          buf += `"${escapeAttr(String(val ?? ''))}"`;
          state = 'in-tag';
          attrName = '';
        }
      } else if (state === 'attr-quoted' || state === 'attr-unquoted') {
        buf += escapeAttr(String(val ?? ''));
      }
    }
  }

  // Flush any remaining buffer content.
  if (buf) controller.enqueue(buf);
}

/**
 * After the main HTML has been streamed, resolve pending Suspense promises
 * and stream their replacement content as out-of-order `<template>` tags
 * with tiny inline scripts that swap the fallback for the resolved HTML.
 *
 * @param {SuspenseCtx} ctx
 * @param {ReadableStreamDefaultController<string>} controller
 */
async function streamSuspenseBoundaries(ctx, controller) {
  // Resolve the per-request nonce once per call. The provider in
  // @webjsdev/server sources it from AsyncLocalStorage; outside a
  // request scope (or in the browser) the helper returns '' and we
  // emit the script unnonced, which is fine on documents not under
  // strict CSP and matches the no-nonce case for the rest of the
  // SSR pipeline.
  const nonce = cspNonce();
  const nonceAttr = nonce ? ` nonce="${escapeAttr(nonce)}"` : '';
  while (ctx.pending.length) {
    const batch = ctx.pending.splice(0);
    await Promise.all(
      batch.map(async ({ id, promise }) => {
        try {
          const resolved = await promise;
          const html = await render(resolved, ctx);
          const full = await injectDSD(html, ctx);
          controller.enqueue(
            `<template data-webjs-resolve="${id}">${full}</template>` +
            `<script${nonceAttr}>` +
            `(function(){` +
            `var t=document.currentScript.previousElementSibling;` +
            `var b=document.getElementById("${id}");` +
            `if(b&&t){b.innerHTML=t.innerHTML;t.remove()}` +
            `document.currentScript.remove()` +
            `})()` +
            `</script>`
          );
        } catch (err) {
          console.error(`[webjs] Suspense boundary "${id}" rejected:`, err);
        }
      })
    );
  }
}
