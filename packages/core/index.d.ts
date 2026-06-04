/**
 * Public type surface for `webjs`.
 *
 * The runtime is packages/core/index.js (JSDoc-annotated JavaScript); this
 * overlay exists so TypeScript-based editors (tsserver under VS Code,
 * Neovim, Zed, WebStorm) resolve richer types than JSDoc alone can express
 * - specifically the generic component factory and property-descriptor
 * inference helpers. Zero runtime cost.
 */

export * from './src/component.d.ts';
export type {
  Metadata,
  MetadataContext,
  TitleMetadata,
  ViewportMetadata,
  RobotsMetadata,
  AlternatesMetadata,
  VerificationMetadata,
  OpenGraphMetadata,
  TwitterMetadata,
  AppleWebAppMetadata,
  IconsMetadata,
  IconDescriptor,
  AuthorMetadata,
  PreloadDescriptor,
  JsonLd,
} from './src/metadata.d.ts';

// Typed route props + the opt-in generated route union (#258). The
// `WebjsRoutes` / `RouteParamMap` interfaces are exported as VALUES-of-types
// (interfaces) so app code and the generated `.webjs/routes.d.ts` can augment
// them via `declare module '@webjsdev/core'`.
export type {
  Route,
  RouteParams,
  PageProps,
  LayoutProps,
  RouteHandlerContext,
  WebjsRoutes,
  RouteParamMap,
} from './src/routes.d.ts';

// The package.json `webjs` config block (#259). Typed reference for the
// elide / headers / redirects / trailingSlash / csp / ingress-limit knobs;
// the companion JSON Schema (packages/server/webjs-config.schema.json) gives
// editors native validation of package.json itself.
export type {
  WebjsConfig,
  WebjsHeaderRule,
  WebjsHeaderDirective,
  WebjsRedirectRule,
  WebjsTrailingSlash,
  WebjsCspConfig,
} from './src/webjs-config.d.ts';

export { html, isTemplate, MARKER } from './src/html.js';
export { css, isCSS, adoptStyles, stylesToString } from './src/css.js';
export { register, lookup, lookupModuleUrl, isLazy, allTags, primeModuleUrl, tagOf } from './src/registry.js';
export { renderToString, renderToStream } from './src/render-server.js';
export { render } from './src/render-client.js';
export { escapeText, escapeAttr } from './src/escape.js';
export { notFound, redirect, isNotFound, isRedirect } from './src/nav.js';
export { expose, getExposed, validateInput } from './src/expose.js';
export { repeat, isRepeat } from './src/repeat.js';
export { Suspense, isSuspense } from './src/suspense.js';
export { connectWS } from './src/websocket-client.js';
export { richFetch } from './src/rich-fetch.js';
export { enableClientRouter, disableClientRouter } from './src/router-client.js';

// `navigate` is typed against the generated `Route` union (#258) rather than
// the JSDoc `string`. Until an app runs `webjs types`, `Route` resolves to
// `string`, so this is non-breaking; once generated, a bogus in-app path is a
// tsserver error. The runtime is the same async function in router-client.js.
import type { Route } from './src/routes.d.ts';
export function navigate(url: Route, opts?: { replace?: boolean }): Promise<void>;
export { unsafeHTML, isUnsafeHTML, live, isLive } from './src/directives.js';
export { createContext, ContextProvider, ContextConsumer, ContextRequestEvent } from './src/context.js';
export { Task, TaskStatus } from './src/task.js';

// Optimistic-mutation helper: set a signal to an expected value immediately,
// run the action, roll back on a thrown error or a `{ success: false }`
// ActionResult, keep the value on success. Returns the action's result.
export function optimistic<T, R>(
  signal: { get(): T; set(v: T): void },
  value: T,
  action: () => Promise<R> | R,
): Promise<R>;
