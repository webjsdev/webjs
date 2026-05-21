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
export { expose, getExposed } from './src/expose.js';
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

// Signals (TC39 Stage-1 shape), also available via '@webjskit/core/signals'
export { signal, computed, effect, batch, isSignal, Signal } from './src/signal.js';

// Directives, also available via '@webjskit/core/directives'
export { unsafeHTML, isUnsafeHTML, live, isLive } from './src/directives.js';

// Context Protocol, also available via '@webjskit/core/context'
export { createContext, ContextProvider, ContextConsumer, ContextRequestEvent } from './src/context.js';

// Task controller, also available via '@webjskit/core/task'
export { Task, TaskStatus } from './src/task.js';
