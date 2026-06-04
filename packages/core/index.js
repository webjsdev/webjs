/**
 * webjs/core public surface.
 *
 * Isomorphic: this module is safe to import on both server and client.
 * The client renderer is lazy-loaded by the WebComponent base. The server
 * renderer is only reached on the server.
 */

export { html, isTemplate, MARKER } from './src/html.js';
export { css, isCSS, adoptStyles, stylesToString } from './src/css.js';
export { WebComponent } from './src/component.js';
export { register, lookup, lookupModuleUrl, isLazy, allTags, primeModuleUrl, tagOf } from './src/registry.js';
export { renderToString, renderToStream } from './src/render-server.js';
export { render } from './src/render-client.js';
export { escapeText, escapeAttr } from './src/escape.js';
export { notFound, redirect, isNotFound, isRedirect } from './src/nav.js';
export { cspNonce, setCspNonceProvider } from './src/csp-nonce.js';
export { expose, getExposed, validateInput } from './src/expose.js';
export { repeat, isRepeat } from './src/repeat.js';
export { Suspense, isSuspense } from './src/suspense.js';
export { connectWS } from './src/websocket-client.js';
export { richFetch } from './src/rich-fetch.js';
export {
  stringify, parse,
  serialize, deserialize,
} from './src/serialize.js';
export { enableClientRouter, disableClientRouter, navigate, revalidate } from './src/router-client.js';
export { WebjsFrame } from './src/webjs-frame.js';
export { WebjsStream, renderStream } from './src/webjs-stream.js';

// Signals (TC39 Stage-1 shape), also available via '@webjsdev/core/signals'
export { signal, computed, effect, batch, isSignal, Signal } from './src/signal.js';

// Optimistic-mutation helper (thin signal wrapper, rolls back on failure)
export { optimistic } from './src/optimistic.js';

// Directives, also available via '@webjsdev/core/directives'. The full
// lit-html-parity set is re-exported so the bare specifier exposes the same
// directive surface in Node as the browser bundle does.
export {
  unsafeHTML, isUnsafeHTML, live, isLive, keyed, isKeyed, guard, isGuard,
  templateContent, isTemplateContent, ref, isRef, createRef, cache, isCache,
  until, isUntil, asyncAppend, isAsyncAppend, asyncReplace, isAsyncReplace,
  watch, isWatch,
} from './src/directives.js';

// Context Protocol, also available via '@webjsdev/core/context'
export { createContext, ContextProvider, ContextConsumer, ContextRequestEvent } from './src/context.js';

// Task controller, also available via '@webjsdev/core/task'
export { Task, TaskStatus } from './src/task.js';
