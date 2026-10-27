import { isTemplate } from '../html.js';
import { attrHoleValue } from '../binding-prefixes.js';
import { escapeText, escapeAttr } from '../escape.js';
import {
  assertNotFunctionActionAttr, assertNotFunctionReflectedActionProp,
  assertIdentifiableAction, bindFormActionStartTag, isBoundFormAction, resolveFormActionId,
  assertConvergentBoundForm, assertSubmitterHasNoName, assertSubmitterHasNoValue,
  assertSubmitterHasNoFormAttribute,
  assertSingleSubmitterAction, bindSubmitterStartTag, parseStartTagAttrs,
  isSubmitterReflectedProp, FORM_ACTION_FIELD,
} from '../form-action.js';
import { isRepeat } from '../repeat.js';
import { isSuspense } from '../suspense.js';
import { isUnsafeHTML, isLive, isKeyed, isGuard, isTemplateContent, isRef, isCache, isUntil, isAsyncAppend, isAsyncReplace, isWatch } from '../directives.js';
import { stringify } from '../serialize.js';
import { lookup } from '../registry.js';
import { kebabCase, decodeAttrEntities } from './text.js';
import { isTextOnlyTag } from './html-scan.js';
import { compile, compileRaw, TEXT, OPEN, TAG_END, CLOSE, HOLE, CHILD, RAW, ATTR, VALUE, isVoidElement } from './compile.js';
import { beginComponent, settleRender, finishComponent, finishSlot, finishSuspense, extractSlotAttr } from './expand.js';

/**
 * The SSR op walker (#1646): ONE interpreter over the compiled ops that
 * replaces the two per-character state machines (`renderTemplate` and
 * `streamTemplate`) and the output rescans (`inertRanges`, the `injectDSD`
 * regex walk, `substituteSlotsInRender`). A page is built front to back into
 * one buffer, values are rendered where their holes sit, and a registered
 * custom element is expanded in place as its ops go by, so nothing is
 * scanned twice and every component instance renders exactly once.
 *
 * Two sinks share the one interpreter. The buffered sink is `this.buf`. The
 * streaming sink (`controller` set, used by `renderToStream(v, { ssr: false })`)
 * flushes `buf` to the controller before every child hole and at the end of
 * every template, and hands a primitive value over as its own chunk, which
 * are exactly the chunk boundaries the old `streamTemplate` produced.
 *
 * `expand` is the one mode switch: off, no element is instantiated and a
 * `<webjs-suspense>` keeps its tag and loses its `.fallback`, which is the
 * `ssr: false` contract. On, component frames, light-DOM slot projection,
 * Declarative Shadow DOM, and `<webjs-suspense>` boundaries are produced here.
 *
 * Frames. A frame is pushed at a start tag the walker takes over (a
 * registered custom element, a streamed or blocking `<webjs-suspense>`, a
 * `<slot>` inside a light-DOM component's own template) and holds the buffer
 * that was being written (`outer`) while the element's children are captured
 * into a fresh one. The matching end tag finishes the frame, which emits the
 * element and appends it to `outer`. A light-DOM component frame also tracks
 * element depth so its authored children are partitioned by top-level
 * `slot=""` attribute STRUCTURALLY, from the segments the walk saw, rather
 * than by rescanning the captured string.
 *
 * `inert` holds the text-only elements (`title`, `textarea`, `script`, ...)
 * currently open: while one is, a start or end tag from a nested VALUE is
 * text, as the compiler already guarantees for the static template around it.
 * `defer` is set while a streamed boundary's children are captured, so they
 * leave the main flow with their components unexpanded, which is what lets
 * their data fetches run after the first flush (#471).
 */

/** @typedef {import('./stream.js').SuspenseCtx & { usedComponents?: Set<string>, dev?: boolean }} Ctx */

export class Walker {
  /**
   * @param {Ctx | undefined} ctx
   * @param {{ expand?: boolean, dev?: boolean, controller?: ReadableStreamDefaultController<string> | null, ancestors?: any[] }} [opts]
   */
  constructor(ctx, opts = {}) {
    this.ctx = ctx;
    this.expand = opts.expand !== false;
    this.dev = opts.dev;
    this.controller = opts.controller || null;
    this.buf = '';
    /** @type {any[]} */
    this.frames = [];
    /** @type {any[]} */
    this.ancestors = opts.ancestors ? opts.ancestors.slice() : [];
    /** @type {{ tag: string, partition: Map<string|null, string>, consumed: Set<string|null> } | null} */
    this.owner = null;
    /** @type {string[]} */
    this.inert = [];
    this.defer = 0;
    /** @type {any} */
    this.tagState = null;
  }

  // -------------------------------------------------------------------------
  // Sinks
  // -------------------------------------------------------------------------

  /** Streaming only: hand the buffered static text to the controller. */
  flush() {
    if (this.controller && this.buf) {
      this.controller.enqueue(this.buf);
      this.buf = '';
    }
  }

  /** A string a VALUE produced, which is its own chunk when streaming. */
  emit(s) {
    if (this.controller) {
      this.flush();
      this.controller.enqueue(s);
    } else {
      this.buf += s;
    }
  }

  /**
   * Run `fn` against a fresh buffer and frame stack and return what it wrote,
   * restoring everything after, including on a throw (so a failed component
   * template leaves no partial bytes behind). The per-start-tag state is
   * saved too, because a `.fallback=${html\`...\`}` hole renders a template
   * while its own start tag is still being read.
   *
   * The open text-only elements, the deferred-region depth and the ancestor
   * chain are restored as well. A throw abandons the frames and text-only
   * elements opened inside `fn` without finishing them, and the per-component
   * error isolation (#469) catches that throw and keeps walking, so without
   * the restore one failed component left every later element on the page
   * unexpanded (a stale `inert` or `defer`) or resolving `closest()` against
   * an instance it does not sit inside (a stale ancestor).
   * @param {() => Promise<void>} fn
   * @returns {Promise<string>}
   */
  async capture(fn) {
    const buf = this.buf;
    const frames = this.frames;
    const tagState = this.tagState;
    const controller = this.controller;
    const inert = this.inert;
    const defer = this.defer;
    const ancestorDepth = this.ancestors.length;
    this.buf = '';
    this.frames = [];
    this.tagState = null;
    this.controller = null;
    this.inert = inert.slice();
    try {
      // Called through the comma form so the no-free-identifiers guard, which
      // does not read method parameters, does not mistake `fn` for a lost import.
      await (0, fn)();
      await this.finishOpenFrames();
      return this.buf;
    } finally {
      this.buf = buf;
      this.frames = frames;
      this.tagState = tagState;
      this.controller = controller;
      this.inert = inert;
      this.defer = defer;
      this.ancestors.length = ancestorDepth;
    }
  }

  // -------------------------------------------------------------------------
  // Values
  // -------------------------------------------------------------------------

  /**
   * Render any value at a child position. The ladder is the one `render()`
   * and `streamRender()` each carried before; a nested template recurses into
   * the op loop on the same sink.
   * @param {unknown} value
   */
  async value(value) {
    if (value == null || value === false || value === true) return;
    if (typeof (/** @type any */ (value).then) === 'function') {
      return this.value(await value);
    }
    if (typeof value === 'string') { this.emit(escapeText(value)); return; }
    if (isTemplate(value)) return this.template(/** @type any */ (value));
    if (Array.isArray(value)) {
      for (const v of value) await this.value(v);
      return;
    }
    // An unsafeHTML value is raw markup. With expansion on, the components it
    // carries render too (the output rescan used to find them), through the
    // same tokenizer the template went through, so a tag written inside one
    // of its comments or attribute values stays text (#1128).
    if (isUnsafeHTML(value)) {
      const s = String(/** @type any */ (value).value ?? '');
      if (this.expand) await this.ops(compileRaw(s), EMPTY);
      else this.emit(s);
      return;
    }
    // live() is transparent on the server, since the dirty-check it carries
    // is a client-only concern (#1443).
    if (isLive(value)) return this.value(/** @type any */ (value).value);
    // watch() reads the signal once; subscription is a client-only concern.
    if (isWatch(value)) return this.value(/** @type any */ (value).signal.get());
    if (isKeyed(value)) return this.value(/** @type any */ (value).value);
    if (isGuard(value)) return this.value(/** @type any */ (value).fn());
    if (isTemplateContent(value)) {
      const tpl = /** @type any */ (value).template;
      const s = String(tpl?.innerHTML ?? '');
      if (this.expand) await this.ops(compileRaw(s), EMPTY);
      else this.emit(s);
      return;
    }
    if (isRef(value)) return;
    if (isCache(value)) return this.value(/** @type any */ (value).value);
    // until() renders the first synchronous candidate, else the first promise
    // to settle; a rejection counts as "no value" rather than crashing the render.
    if (isUntil(value)) {
      const args = /** @type any */ (value).args;
      for (const a of args) {
        if (!a || typeof (/** @type any */ (a).then) !== 'function') return this.value(a);
      }
      if (args.length > 0) {
        try {
          const winner = await Promise.race(args.map((p) => Promise.resolve(p).catch(() => undefined)));
          return this.value(winner);
        } catch {
          return;
        }
      }
      return;
    }
    // asyncAppend / asyncReplace render nothing at SSR; Suspense streams.
    if (isAsyncAppend(value) || isAsyncReplace(value)) return;
    if (isRepeat(value)) {
      const r = /** @type any */ (value);
      for (let i = 0; i < r.items.length; i++) await this.value(r.templateFn(r.items[i], i));
      return;
    }
    if (isSuspense(value)) {
      const s = /** @type any */ (value);
      const ctx = this.ctx;
      if (ctx) {
        const id = `s${ctx.nextId++}`;
        this.emit(`<webjs-boundary id="${id}">`);
        await this.value(s.fallback);
        this.emit('</webjs-boundary>');
        ctx.pending.push({ id, promise: Promise.resolve(s.children) });
      } else {
        await this.value(s.fallback);
      }
      return;
    }
    this.emit(escapeText(String(value)));
  }

  /** @param {import('../html.js').TemplateResult} tr */
  async template(tr) {
    await this.ops(compile(tr.strings), tr.values);
    this.flush();
  }

  // -------------------------------------------------------------------------
  // The op loop
  // -------------------------------------------------------------------------

  /**
   * @param {import('./compile.js').Op[]} ops
   * @param {unknown[]} values
   */
  async ops(ops, values) {
    let vi = 0;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.t) {
        case TEXT:
          this.buf += op.s;
          break;
        case OPEN:
          this.open(/** @type string */ (op.tag));
          break;
        case TAG_END: {
          // Sync for an ordinary element; a frame-taking tag returns a promise.
          const p = this.tagEnd(op);
          if (p) await p;
          break;
        }
        case CLOSE: {
          const p = this.close(op);
          if (p) await p;
          break;
        }
        case HOLE: {
          let val = values[vi++];
          if (val && typeof (/** @type any */ (val).then) === 'function') val = await val;
          // Unwrap live() once, here, before the position dispatch, exactly
          // where the client's applyPart() unwraps it (#1443). AFTER the
          // await, since a hole may hold a promise that resolves TO a live().
          if (isLive(val)) val = /** @type any */ (val).value;
          switch (op.k) {
            case CHILD:
              this.flush();
              // The common primitive child needs no promise.
              if (typeof val === 'string') this.emit(escapeText(val));
              else if (typeof val === 'number') this.emit(escapeText(String(val)));
              else await this.value(val);
              break;
            case RAW:
              // Inside a comment, a <script> or a <style>: emitted as-is. The
              // author owns what closes the tag, the usual caveat for CSS/JS.
              this.buf += String(val ?? '');
              break;
            case ATTR:
              await this.attr(op, val);
              break;
            case VALUE:
              // A hole inside a quoted/unquoted value, the `action="${fn}"` and
              // mixed `action="/x/${fn}"` shapes (#1154).
              assertNotFunctionActionAttr(val, op.name, op.tag);
              this.buf += escapeAttr(String(val ?? ''));
              break;
            default:
              break;
          }
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Start tags
  // -------------------------------------------------------------------------

  /** @param {string} tag */
  open(tag) {
    // A top-level child of a light-DOM component: the segment it occupies in
    // the captured children is what the slot partition is built from.
    const top = this.frames[this.frames.length - 1];
    if (top && top.partition && top.depth === 0 && !this.inert.length) {
      top.seg = { start: this.buf.length, end: 0, slot: null };
    }
    // A tag the walker will take over (a registered element, a boundary, a
    // slot inside a light-DOM template) accumulates its start tag in a FRESH
    // buffer, so taking it at the `>` never slices the page built so far:
    // on JavaScriptCore that slice materialised the whole rope each time.
    let outer;
    let formOuter;
    if (this.expand && this.defer === 0 && !this.inert.length
        && (tag === 'webjs-suspense' || (tag === 'slot' && this.owner !== null) || (tag.includes('-') && lookup(tag)))) {
      outer = this.buf;
      this.buf = '';
    } else if (tag === 'form' || tag === 'button' || tag === 'input') {
      // The tags a form action can bind to. The bound-form edits rewrite the
      // start tag (strip the action attribute's trailing whitespace, parse the
      // attributes, splice in method / enctype and the identity), so that tag
      // is built in its own buffer and joined back at its `>`: rewriting it in
      // place copied the whole page built so far, once per bound form.
      formOuter = this.buf;
      this.buf = '';
    }
    this.tagState = {
      tag,
      start: this.buf.length,
      outer,
      formOuter,
      // #1155 / #1207 bookkeeping, judged at the `>` because the action hole
      // may come after the shapes it refuses.
      actionId: /** @type {string | null} */ (null),
      submitterTag: /** @type {string | null} */ (null),
      actionCount: 0,
      /** @type {string[] | null} */ propAttrs: null,
      /** @type {string[] | null} */ submitterProps: null,
      /** @type {string | null} */ fallback: null,
    };
  }

  /**
   * @param {import('./compile.js').Op} op
   * @param {unknown} val
   */
  async attr(op, val) {
    const ts = this.tagState;
    const name = /** @type string */ (op.name);
    const tag = /** @type string */ (op.tag);
    if (op.kind === 'event') {
      // An event listener is client-only behaviour, dropped at SSR.
      return;
    }
    if (op.kind === 'prop') {
      // `<webjs-suspense .fallback=${html`...`}>` (#471) is the boundary's
      // placeholder, rendered now so the walker can emit it at the tag. Only
      // a streamed boundary (a ctx) shows it: a blocking one renders its
      // children inline, so expanding the fallback's components there would
      // run their renders (and their data fetches) for bytes that are dropped.
      if (tag === 'webjs-suspense' && name === 'fallback') {
        if (this.expand && this.ctx && ts) ts.fallback = await this.capture(() => this.value(val));
        return;
      }
      if (!tag.includes('-')) {
        // A native element's `.prop` is dropped at SSR. It still refuses a
        // function where the property is a REFLECTED IDL attribute (`.action`
        // on a form, `.formAction` on a button or input), and records the
        // form-shape props judged at the `>`.
        assertNotFunctionReflectedActionProp(val, name, tag);
        if (ts) notePropAttr(ts, name, tag);
        return;
      }
      // `ssr: false` drops every prop, since nothing consumes the carrier.
      if (!this.expand) return;
      // `undefined` has no HTML representation; `null` is a real value.
      if (val === undefined) return;
      try {
        const encoded = await stringify(val);
        this.buf += `data-webjs-prop-${kebabCase(name)}="${escapeAttr(encoded)}"`;
      } catch (e) {
        console.warn(
          `[webjs] property binding .${name} has an unserializable `
          + `value during SSR. Dropping. The browser will see the `
          + `property as undefined. Detail: ${e && /** @type any */ (e).message}`
        );
      }
      return;
    }
    if (op.kind === 'bool') {
      // `?action=${fn}` is meaningless in every case; refusing it keeps the
      // rule true for every sigil rather than only the quoted ones.
      assertNotFunctionActionAttr(val, name, tag);
      if (val) this.buf += `${name}=""`;
      return;
    }
    // A plain `name=${value}` hole.
    if (isBoundFormAction(val, name, tag)) {
      if (ts) noteActionHole(ts, name, tag);
      if (tag === 'form') {
        // #1155, the form-level binding. The `action=` attribute is gone
        // already (its lead was never emitted), so the form posts to the
        // page's own url; the identity is remembered for the `>`. Trailing
        // whitespace goes with the attribute, since every injected attribute
        // carries its own leading space.
        if (ts) ts.actionId = assertIdentifiableAction(await resolveFormActionId(val), tag);
        this.buf = this.buf.replace(/\s+$/, '');
      } else {
        // #1207, the submitter binding. The identity replaces the
        // `formaction=` hole IN PLACE with the button's own name/value pair.
        // Refused here only where the answer cannot change later.
        assertSingleSubmitterAction(!!ts && ts.submitterTag != null, tag);
        const attrs = parseStartTagAttrs(ts ? this.buf.slice(ts.start) : '');
        if (attrs.has('name')) assertSubmitterHasNoName(attrs.get('name') || '', tag, false);
        if (attrs.has('value')) assertSubmitterHasNoValue(tag);
        if (attrs.has('form')) assertSubmitterHasNoFormAttribute(tag);
        const subId = assertIdentifiableAction(await resolveFormActionId(val), tag);
        if (ts) ts.submitterTag = tag;
        this.buf += `name="${FORM_ACTION_FIELD}" value="${escapeAttr(subId)}"`;
      }
      return;
    }
    // A second `action` hole that resolved to a plain url still COUNTS.
    if (ts) noteActionHole(ts, name, tag);
    // #1154: never stringify a function into action= / formaction=.
    assertNotFunctionActionAttr(val, name, tag);
    // #1573: `null` / `undefined` (and `false` off an aria-* name) omit the
    // attribute, whose lead was never emitted.
    const written = attrHoleValue(name, val);
    if (written !== null) this.buf += `${op.lead}"${escapeAttr(written)}"`;
  }

  /**
   * The `>` of a start tag. Returns a promise only when the tag takes a
   * frame, so the op loop stays synchronous across ordinary markup.
   * @param {import('./compile.js').Op} op
   * @returns {Promise<void> | undefined}
   */
  tagEnd(op) {
    const ts = this.tagState;
    this.tagState = null;
    // A boundary met while a streamed boundary's children are being captured
    // is expanded later, from the string: its rendered `.fallback` rides the
    // tag as `data-webjs-fallback` (what the old machine emitted for every
    // boundary) and `openSuspense` reads it back at stream time.
    if (ts && ts.fallback != null && this.defer > 0 && ts.tag === 'webjs-suspense') {
      this.buf += ` data-webjs-fallback="${escapeAttr(ts.fallback)}"`;
    }
    this.buf += op.close;
    if (!ts) return;
    const tag = ts.tag;
    if (ts.actionId != null || ts.submitterTag != null) this.closeBoundFormTag(ts);
    if (ts.formOuter !== undefined) {
      // Rejoin a form-capable start tag built in its own buffer (see `open`).
      ts.start = ts.formOuter.length;
      this.buf = ts.formOuter + this.buf;
    }

    if (this.inert.length) return;
    const selfClose = !!op.selfClose;
    if (isTextOnlyTag(tag) && !selfClose) this.inert.push(tag);

    const top = this.frames[this.frames.length - 1];
    if (ts.outer !== undefined) {
      if (tag === 'webjs-suspense') return this.openSuspense(op, ts, top, selfClose);
      if (tag === 'slot') return this.openSlot(op, ts, top, selfClose);
      return this.openComponent(op, ts, top, selfClose, lookup(tag));
    }
    // An ordinary element. One that shares its tag with an open frame (a
    // boundary or a component inside a deferred region, a same-tag element
    // left as text) nests inside that frame, so its end tag must not close
    // the frame: count it on the nearest frame with that tag.
    if (!selfClose && !isVoidElement(tag)) {
      for (let k = this.frames.length - 1; k >= 0; k--) {
        if (this.frames[k].tag === tag) { this.frames[k].nested = (this.frames[k].nested || 0) + 1; break; }
      }
    }
    if (top && top.partition && top.seg && top.depth === 0) {
      const startTag = this.buf.slice(ts.start);
      top.seg.slot = extractSlotAttr(startTag.slice(1 + tag.length, startTag.length - op.close.length));
      if (selfClose || isVoidElement(tag)) this.endSeg(top);
      else top.depth += 1;
    } else if (top && top.partition && !selfClose && !isVoidElement(tag)) {
      top.depth += 1;
    }
  }

  async openSuspense(op, ts, top, selfClose) {
    this.closeSeg(top, ts);
    let fallback = ts.fallback;
    if (fallback === null) {
      // A boundary arriving as a string (a streamed parent's children) carries
      // its fallback as `data-webjs-fallback`; expand it now, as the old scan
      // did over the placeholder after reading it.
      const m = /data-webjs-fallback="([^"]*)"/i.exec(this.buf);
      if (m) {
        const raw = decodeAttrEntities(m[1]);
        fallback = await this.capture(() => this.ops(compileRaw(raw), EMPTY));
      }
    }
    const frame = { kind: 'suspense', tag: ts.tag, outer: ts.outer, fallback: fallback || '', id: /** @type {string | null} */ (null) };
    if (this.ctx) frame.id = `s${this.ctx.nextId++}`;
    this.buf = '';
    if (this.ctx) this.defer += 1;
    if (selfClose) { await this.finish(frame); return; }
    this.frames.push(frame);
  }

  async openSlot(op, ts, top, selfClose) {
    const tag = ts.tag;
    this.closeSeg(top, ts);
    const startTag = this.buf;
    const attrsRaw = startTag.slice(1 + tag.length, startTag.length - op.close.length);
    const frame = { kind: 'slot', tag, outer: ts.outer, attrsRaw, owner: this.owner };
    this.buf = '';
    if (selfClose) { await this.finish(frame); return; }
    this.frames.push(frame);
  }

  async openComponent(op, ts, top, selfClose, Cls) {
    const tag = ts.tag;
    this.closeSeg(top, ts);
    const startTag = this.buf;
    // The opening tag as the DSD walk had it, `<tag attrs>`, with a
    // self-closing solidus dropped.
    const opening = op.selfClose ? startTag.slice(0, startTag.length - op.close.length) + '>' : startTag;
    const attrs = startTag.slice(1 + tag.length, startTag.length - op.close.length);
    this.buf = '';
    const frame = beginComponent(this, tag, Cls, opening, attrs);
    if (frame.pending) await settleRender(frame);
    frame.outer = ts.outer;
    if (frame.instance) { this.ancestors.push(frame.instance); frame.pushedAncestor = true; }
    if (selfClose) { await this.finish(frame); return; }
    this.frames.push(frame);
  }

  /**
   * A frame-taking start tag that is itself a top-level child of a light-DOM
   * component: its segment's slot name is read now, so the finished element
   * lands in the right slot.
   */
  closeSeg(top, ts) {
    if (!(top && top.partition && top.seg && top.depth === 0)) return;
    const startTag = this.buf;
    top.seg.slot = extractSlotAttr(startTag.slice(1 + ts.tag.length).replace(/\/?>$/, ''));
    top.pendingSeg = top.seg;
    top.seg = null;
  }

  /** A top-level child segment of a light-DOM component ended. */
  endSeg(frame) {
    const seg = frame.seg;
    frame.seg = null;
    if (!seg || seg.slot === null) return;
    seg.end = this.buf.length;
    (frame.segments ??= []).push(seg);
  }

  /**
   * The bound-form edits that need the WHOLE start tag: forcing `method` /
   * `enctype` and placing the hidden identity field (#1155), and a bound
   * submitter's own `formmethod` / `formenctype` (#1307), through the same
   * helpers the old machines called, over the same start-tag text.
   */
  closeBoundFormTag(ts) {
    const duplicateAction = ts.actionCount > 1;
    if (ts.actionId != null) {
      assertConvergentBoundForm({ duplicateAction, propAttrs: ts.propAttrs || [] });
      const bound = bindFormActionStartTag(this.buf.slice(ts.start), ts.actionId);
      this.buf = this.buf.slice(0, ts.start) + bound.tag + bound.hidden;
    }
    if (ts.submitterTag != null) {
      this.buf = this.buf.slice(0, ts.start)
        + bindSubmitterStartTag(this.buf.slice(ts.start), ts.submitterTag, { duplicateAction, propAttrs: ts.submitterProps || [] });
    }
  }

  // -------------------------------------------------------------------------
  // End tags and frames
  // -------------------------------------------------------------------------

  /**
   * An end tag. Returns a promise only when it finishes a frame.
   * @param {import('./compile.js').Op} op
   * @returns {Promise<void> | undefined}
   */
  close(op) {
    const tag = /** @type string */ (op.tag);
    if (this.inert.length) {
      if (this.inert[this.inert.length - 1] !== tag) { this.buf += op.text; return; }
      this.inert.pop();
      this.buf += op.text;
      this.ordinaryClose();
      return;
    }
    // The nearest frame this end tag closes; frames above it are unclosed.
    // A same-tag element nested inside that frame closes itself instead.
    for (let k = this.frames.length - 1; k >= 0; k--) {
      if (this.frames[k].tag !== tag) continue;
      if (this.frames[k].nested > 0) { this.frames[k].nested -= 1; break; }
      return this.closeFrames(k, op.text);
    }
    this.buf += op.text;
    this.ordinaryClose();
  }

  async closeFrames(k, closeText) {
    while (this.frames.length - 1 > k) await this.finish(this.frames.pop());
    const frame = this.frames.pop();
    frame.closeText = closeText;
    await this.finish(frame);
  }

  /** Depth bookkeeping for an ordinary element's end tag. */
  ordinaryClose() {
    const top = this.frames[this.frames.length - 1];
    if (!(top && top.partition)) return;
    if (top.depth > 0) top.depth -= 1;
    if (top.depth === 0 && top.seg) this.endSeg(top);
  }

  /** Close every frame still open at the end of a walk (unclosed in source). */
  async finishOpenFrames() {
    while (this.frames.length) await this.finish(this.frames.pop());
  }

  /**
   * Emit a finished frame into its outer buffer.
   * @param {any} frame
   */
  async finish(frame) {
    if (frame.kind === 'suspense' && this.ctx && frame.id) this.defer -= 1;
    const children = this.buf;
    this.buf = frame.outer;
    let out;
    if (frame.kind === 'component') {
      if (frame.seg) this.endSegIn(frame, children);
      out = await finishComponent(this, frame, children);
      if (frame.pushedAncestor) this.ancestors.pop();
    } else if (frame.kind === 'slot') {
      out = finishSlot(frame, children);
    } else {
      out = await finishSuspense(this, frame, children);
    }
    this.buf += out;
    // The element was a top-level child of a light-DOM component: close the
    // segment it occupied.
    const top = this.frames[this.frames.length - 1];
    if (top && top.partition && top.pendingSeg) {
      top.seg = top.pendingSeg;
      top.pendingSeg = null;
      this.endSeg(top);
    }
  }

  /** An unclosed top-level child at the end of a component's children runs to the end. */
  endSegIn(frame, children) {
    const seg = frame.seg;
    frame.seg = null;
    if (seg.slot === null) return;
    seg.end = children.length;
    (frame.segments ??= []).push(seg);
  }
}

const EMPTY = Object.freeze([]);

/**
 * #1155: a `.method` / `.enctype` / `.encoding` prop on a form is dropped at
 * SSR but applied for real in the browser, where all three are reflected IDL
 * attributes, so a bound form carrying one submits differently with JS than
 * without it. Recorded and refused at the `>`, once the tag's action hole is
 * known. #1207 adds the submitter twin.
 */
function notePropAttr(ts, name, tag) {
  const t = String(tag).toLowerCase();
  if (t === 'button' || t === 'input') {
    if (isSubmitterReflectedProp(name)) (ts.submitterProps ??= []).push(String(name));
    return;
  }
  if (t !== 'form') return;
  let n = String(name).toLowerCase();
  if (n === 'encoding') n = 'enctype';
  if (n === 'method' || n === 'enctype') (ts.propAttrs ??= []).push(String(name));
}

function noteActionHole(ts, name, tag) {
  const t = String(tag).toLowerCase();
  const n = String(name).toLowerCase();
  if ((t === 'form' && n === 'action') ||
      ((t === 'button' || t === 'input') && n === 'formaction')) {
    ts.actionCount += 1;
  }
}

/**
 * Render a value to a string.
 * @param {unknown} value
 * @param {Ctx} [ctx]
 * @param {{ expand?: boolean, dev?: boolean, ancestors?: any[] }} [opts]
 * @returns {Promise<string>}
 */
export async function renderValue(value, ctx, opts) {
  const w = new Walker(ctx, opts);
  await w.value(value);
  await w.finishOpenFrames();
  return w.buf;
}

/**
 * Render a raw HTML string with component expansion (the string-input path:
 * a streamed boundary's children, a legacy `injectDSD` caller).
 * @param {string} html
 * @param {Ctx} [ctx]
 * @param {{ dev?: boolean, ancestors?: any[] }} [opts]
 * @returns {Promise<string>}
 */
export async function expandHtml(html, ctx, opts) {
  const w = new Walker(ctx, { ...opts, expand: true });
  await w.ops(compileRaw(html), EMPTY);
  await w.finishOpenFrames();
  return w.buf;
}

/**
 * Stream a value without expansion, chunk boundaries as `streamTemplate` had
 * them: static text up to each child hole, every primitive value, and the
 * tail of every template.
 * @param {unknown} value
 * @param {Ctx | undefined} ctx
 * @param {ReadableStreamDefaultController<string>} controller
 */
export async function streamValue(value, ctx, controller) {
  const w = new Walker(ctx, { expand: false, controller });
  await w.value(value);
  w.flush();
}
