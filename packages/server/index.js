export { startServer, createRequestHandler } from './src/dev.js';
export { assertNodeVersion, checkNodeVersion, requiredNodeMajor, parseMajor, parseRequiredMajor } from './src/node-version.js';
export { validateEnv, formatEnvErrors, loadEnvSchema, applyEnvValidation } from './src/env-schema.js';
export { buildRouteTable, matchPage, matchApi } from './src/router.js';
export { generateRouteTypes } from './src/route-types.js';
export { ssrPage, ssrNotFound } from './src/ssr.js';
export { handleApi } from './src/api.js';
export {
  buildActionIndex,
  isServerFile,
  hashFile,
  resolveServerModule,
  serveActionStub,
  invokeAction,
} from './src/actions.js';
export { buildImportMap, importMapTag, setVendorEntries } from './src/importmap.js';
export {
  scanBareImports,
  extractPackageName,
  vendorImportMapEntries,
  resolveVendorImports,
  clearVendorCache,
  getPackageVersion,
  jspmGenerate,
  pinAll,
  unpinPackage,
  listPinned,
  auditPinned,
  findOutdated,
  updatePinned,
  readPinFile,
  serveDownloadedBundle,
  SUPPORTED_PROVIDERS,
  normalizeProvider,
} from './src/vendor.js';
export { buildModuleGraph, transitiveDeps } from './src/module-graph.js';
export { scanComponents, primeComponentRegistry, extractComponents, findOrphanComponents } from './src/component-scanner.js';
export { headers, cookies, getRequest, withRequest, cspNonce, requestId } from './src/context.js';
export { defaultLogger } from './src/logger.js';
export { rateLimit, parseWindow, clientIp, stampRemoteIp } from './src/rate-limit.js';
export { cors, resolveOrigin, applyCorsHeaders } from './src/cors.js';
export { memoryStore, redisStore, getStore, setStore } from './src/cache.js';
export { cache } from './src/cache-fn.js';
export { revalidateTag, revalidateTags } from './src/cache-tags.js';
export { revalidatePath, revalidateAll } from './src/html-cache.js';
export { Session, session, cookieSessionStorage, storeSessionStorage, cookieSession, storeSession, getSession } from './src/session.js';
export { broadcast } from './src/broadcast.js';
export { json, readBody } from './src/json.js';
export { sitemap, sitemapIndex } from './src/sitemap.js';
export { attachWebSocket } from './src/websocket.js';
export { getSerializer, setSerializer, defaultSerializer } from './src/serializer.js';

// Auth (NextAuth-style)
export { createAuth, Credentials, Google, GitHub } from './src/auth.js';

// Test harness helpers (issue #267): thin builders over handle()
export {
  testRequest,
  toRequest,
  getCsrf,
  readCsrfCookie,
  getSetCookies,
  cookiesToHeader,
  withCookies,
  withSessionCookie,
  loginAndGetCookies,
  actionEndpoint,
  invokeActionForTest,
  rawActionRequest,
} from './src/testing.js';
