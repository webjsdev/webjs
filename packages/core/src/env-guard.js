/**
 * Server-side runtime guard against server secrets leaking into SSR'd HTML.
 *
 * A component's render() runs on the server during SSR. Without
 * protection, process.env.SECRET inside render() returns the real
 * value and gets interpolated into the served HTML, then read as
 * undefined after hydration in the browser. The runtime shim only
 * protects the browser-runtime reads, not the SSR-time reads.
 *
 * This module installs a Proxy on process.env. When code runs inside
 * a component render context (tracked via AsyncLocalStorage), reads
 * for non-public keys return undefined. Outside that context (page
 * functions, server actions, middleware), process.env behaves
 * normally with full server access.
 *
 * Companion to the WEBJS_PUBLIC_* SSR shim (catches the browser
 * runtime case) and the no-server-env-in-components lint rule
 * (catches the static-access case). Together the three layers catch
 * static, dynamic, and post-hydration variants of the leak.
 *
 * Note: server-only by design. Loaded transitively only from
 * render-server.js. Browser-bound graphs never touch this file, so
 * the node:async_hooks import never reaches the browser.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const componentRenderContext = new AsyncLocalStorage();

let _installed = false;

/**
 * Replace process.env with a Proxy that filters non-public keys
 * when accessed from inside a component render context. Idempotent.
 */
function installEnvProxy() {
  if (_installed) return;
  _installed = true;

  const realEnv = process.env;

  const inRenderScope = () => componentRenderContext.getStore() === true;
  const isAllowedKey = (k) =>
    typeof k === 'string' && (k.startsWith('WEBJS_PUBLIC_') || k === 'NODE_ENV');

  const proxy = new Proxy(realEnv, {
    get(target, key) {
      if (inRenderScope() && !isAllowedKey(key)) return undefined;
      return Reflect.get(target, key);
    },
    has(target, key) {
      if (inRenderScope() && !isAllowedKey(key)) return false;
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      const keys = Reflect.ownKeys(target);
      if (!inRenderScope()) return keys;
      return keys.filter(isAllowedKey);
    },
    getOwnPropertyDescriptor(target, key) {
      if (inRenderScope() && !isAllowedKey(key)) return undefined;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  Object.defineProperty(process, 'env', {
    value: proxy,
    writable: true,
    configurable: true,
  });
}

installEnvProxy();

/**
 * Run fn inside the component-render context. While fn (and any
 * awaited work it spawns) is on the call stack, process.env reads
 * for non-public keys return undefined.
 *
 * @template T
 * @param {() => T | Promise<T>} fn
 * @returns {T | Promise<T>}
 */
export function withComponentRender(fn) {
  return componentRenderContext.run(true, fn);
}
