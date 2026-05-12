import { isTemplate } from './html.js';
import { escapeText, escapeAttr } from './escape.js';
import { lookup, lookupModuleUrl, allTags } from './registry.js';
import { stylesToString, isCSS } from './css.js';
import { isRepeat } from './repeat.js';
import { isSuspense } from './suspense.js';
import { isUnsafeHTML, isLive } from './directives.js';

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
 * (the promise is dropped — appropriate for static pre-render).
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
  // unsafeHTML — inject raw HTML string without escaping.
  if (isUnsafeHTML(value)) {
    return String(/** @type any */ (value).value ?? '');
  }
  // live() — on the server, just unwrap and render the inner value.
  if (isLive(value)) {
    return render(/** @type any */ (value).value, ctx);
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
        // data — the usual caveat for CSS/JS interpolation.
        out += String(val ?? '');
        rawTail = '';
      } else if (state === 'text') {
        out += await render(val, ctx);
      } else if (state === 'after-eq') {
        const prefix = attrName[0];
        const name = attrName.slice(1);
        if (prefix === '@' || prefix === '.') {
          out = out.slice(0, attrStart);
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

/**
 * Scan an HTML string for registered custom elements and inject
 * Declarative Shadow DOM (`<template shadowrootmode="open">`).
 * Awaits each component's render() so async components are fully resolved.
 *
 * @param {string} html
 * @param {SuspenseCtx} [ctx]
 * @returns {Promise<string>}
 */
async function injectDSD(html, ctx) {
  // Sort by length descending so longer tags (e.g. `ui-card-header`) match
  // before shorter prefixes (e.g. `ui-card`). JS regex alternation otherwise
  // picks the FIRST match in the source order — so `<ui-card-header>` would
  // match as `ui-card` with `-header` swallowed into the attrs group.
  const tags = allTags().slice().sort((a, b) => b.length - a.length);
  if (!tags.length) return html;
  // Attribute section is "anything that isn't `>`, with quoted values as a
  // single unit" so slashes in URL-valued attrs (e.g. then="/dashboard") don't
  // prevent the match. Non-greedy so self-closing `/>` still captures into the
  // third group. The `(?=[\s>/])` lookahead enforces a tag-name boundary so a
  // shorter alternative can't partial-match a longer tag.
  const pattern = new RegExp(
    `<(${tags.map(escapeRegex).join('|')})(?=[\\s>/])((?:"[^"]*"|'[^']*'|[^>])*?)(/?)>`,
    'g'
  );
  /** @type {{start:number, end:number, text:string}[]} */
  const edits = [];
  for (const m of html.matchAll(pattern)) {
    const [match, tag, attrs, selfClose] = m;
    const Cls = lookup(tag);
    if (!Cls) continue;
    // Track which custom elements actually appeared — used by SSR to emit
    // `<link rel="modulepreload">` hints for their module URLs.
    if (ctx && ctx.usedComponents) ctx.usedComponents.add(tag);
    const opening = selfClose ? `<${tag}${attrs}>` : match;
    try {
      const isShadow = /** @type any */ (Cls).shadow === true;
      const instance = new /** @type any */ (Cls)();
      const attrMap = parseAttrs(attrs);
      applyAttrsToInstance(instance, attrMap, Cls);

      // Extract source children (the content between opening and closing
      // tag) so wrapper-style components — `<ui-card>title</ui-card>`,
      // `<ui-dialog-content>…</ui-dialog-content>`, etc. — can read them via
      // `this.innerHTML` in their connectedCallback. Without this the
      // `_slot = this.innerHTML` pattern silently produces empty output
      // server-side and the original children float outside the rendered
      // wrapper (shadcn-style composition broken).
      let childContent = '';
      let closingTagEnd = m.index + match.length;
      if (!selfClose) {
        const balanced = findClosingTag(html, tag, m.index + match.length);
        if (balanced.end !== -1) {
          childContent = html.slice(m.index + match.length, balanced.start);
          closingTagEnd = balanced.end;
        }
      }

      // Expose children to the instance both as `innerHTML` (so component
      // overrides reading `this.innerHTML` work) and via a connectedCallback
      // call (so the component's setup runs the same way as in the browser).
      // The base WebComponent.connectedCallback no-ops outside the browser,
      // so subclass overrides are the only ones that execute.
      try { instance.innerHTML = childContent; } catch { /* ignore — read-only */ }
      try { instance.connectedCallback?.(); } catch { /* tolerated */ }

      let tpl = instance.render ? instance.render() : '';
      if (tpl && typeof tpl.then === 'function') tpl = await tpl;
      // Render the template to HTML, then recursively inject DSD for
      // any nested custom elements (e.g. <theme-toggle> inside <blog-shell>).
      const rawInner = await render(tpl, ctx);
      const inner = await injectDSD(rawInner, ctx);

      if (isShadow) {
        // Shadow DOM: wrap in Declarative Shadow DOM template. Keep original
        // children outside the template (they go in as ::slotted).
        /** @type {any} */
        const rawStyles = /** @type any */ (Cls).styles;
        const styleList = Array.isArray(rawStyles) ? rawStyles : rawStyles && isCSS(rawStyles) ? [rawStyles] : [];
        const styleStr = stylesToString(styleList);
        edits.push({
          start: m.index,
          end: m.index + match.length,
          text: `${opening}<template shadowrootmode="open">${styleStr}${inner}</template>`,
        });
      } else if (childContent && instance.render) {
        // Light DOM with source children + an explicit render() override:
        // the render output has already incorporated those children (via the
        // wrapper pattern), so REPLACE the source children. This is the
        // shadcn-style composition path. Store the ORIGINAL user children in
        // a `data-webjs-children` attribute (URI-encoded) so the client can
        // recover them at hydration time — without this the client would
        // re-capture the post-SSR innerHTML and produce a doubled render.
        const encodedChildren = encodeURIComponent(childContent);
        // Inject the attribute right before the closing `>` of the opening tag.
        const withAttr = opening.replace(/(\/?)>$/, ` data-webjs-children="${encodedChildren}"$1>`);
        edits.push({
          start: m.index,
          end: closingTagEnd,
          text: `${withAttr}<!--webjs-hydrate-->${inner}</${tag}>`,
        });
      } else {
        // Light DOM, no source children: insert render() output between
        // opening and closing tag, preserving the existing structure (the
        // original behaviour for self-contained components like
        // <theme-toggle>).
        edits.push({
          start: m.index,
          end: m.index + match.length,
          text: `${opening}<!--webjs-hydrate-->${inner}`,
        });
      }
    } catch (e) {
      console.error(`[webjs] SSR failed for <${tag}>:`, e);
    }
  }
  if (!edits.length) return html;
  // Apply edits from last to first to keep indices stable.
  let out = html;
  for (let i = edits.length - 1; i >= 0; i--) {
    const { start, end, text } = edits[i];
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}

/** @param {string} s */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the matching closing tag for `<tag>` starting from `from`, accounting
 * for same-name nesting. Returns `{ start, end }` of the closing tag in the
 * source string — `start` is the position of `<`, `end` is one past `>`. If
 * no balanced closing exists, returns `{ start: -1, end: -1 }`.
 *
 * @param {string} html
 * @param {string} tag
 * @param {number} from
 */
function findClosingTag(html, tag, from) {
  const open = new RegExp(`<${escapeRegex(tag)}(\\s[^>]*)?>`, 'g');
  const close = new RegExp(`</${escapeRegex(tag)}>`, 'g');
  open.lastIndex = from;
  close.lastIndex = from;
  let depth = 1;
  while (depth > 0) {
    const o = open.exec(html);
    const c = close.exec(html);
    if (!c) return { start: -1, end: -1 };
    if (o && o.index < c.index) {
      depth++;
      close.lastIndex = o.index + o[0].length;
    } else {
      depth--;
      if (depth === 0) return { start: c.index, end: c.index + c[0].length };
      open.lastIndex = c.index + c[0].length;
    }
  }
  return { start: -1, end: -1 };
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
      try { instance[propName] = JSON.parse(raw); } catch { instance[propName] = raw; }
    } else instance[propName] = raw;
  }
}

/** @param {string} s */
function camelCase(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Streaming renderer
// ---------------------------------------------------------------------------

/**
 * Render a TemplateResult (or any renderable value) to a `ReadableStream`
 * that yields HTML chunks as strings.
 *
 * Works identically to {@link renderToString} but streams partial HTML as
 * it is rendered — avoiding buffering the entire page in memory. For
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
          // No DSD injection — just stream the raw rendered chunks.
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

    // Flush the buffer before processing the value hole — but only when
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
            `<script>` +
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
