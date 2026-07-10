// Optional boot-time hook (app root, sibling of app/). register() runs once at
// server start, the place to wire APM / logging / tracing. setOnError(fn) (from
// @webjsdev/server) registers a sink for every request error the framework
// catches (an SSR render crash, a thrown server action, a 500), so you can
// forward it to Sentry / a logger with the request context. Call setOnError
// INSIDE register() so it runs within the instrumentation context (a top-level
// call has no context yet and is a no-op). Delete this file if you do not need
// the hook.
import { setOnError } from '@webjsdev/server';

export function register() {
  setOnError((error, ctx) => {
    // Replace with your APM. `ctx` carries request context (e.g. a correlation id).
    console.error('[instrumentation] request error:', error, ctx ?? '');
  });
}
