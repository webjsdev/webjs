import { streamValue } from './walk.js';

/**
 * The value-rendering entry points of the server renderer. Since #1646 the
 * work happens in `compile.js` (one tokenizer pass per template, cached per
 * `TemplateStringsArray` identity) and `walk.js` (one op interpreter with a
 * buffered and a streaming sink, expanding custom elements in the same pass).
 * This module keeps the error helpers and the no-expansion streaming entry
 * `stream.js` uses for `ssr: false`.
 */

export { isProd, browserMemberHint, defaultSSRErrorTemplate } from './errors.js';

/**
 * Stream a value's HTML chunks into a stream controller, without expansion:
 * the `renderToStream(v, { ssr: false })` path.
 * @param {unknown} value
 * @param {import('./stream.js').SuspenseCtx | undefined} ctx
 * @param {ReadableStreamDefaultController<string>} controller
 */
export function streamRender(value, ctx, controller) {
  return streamValue(value, ctx, controller);
}
