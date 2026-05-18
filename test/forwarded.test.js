/**
 * Tests for urlFromRequest: the helper that builds a URL from a Node
 * IncomingMessage while honoring standard reverse-proxy headers.
 *
 * Real-world impact: every webjs app deployed behind a TLS-terminating
 * proxy (Railway, Fly, Render, Vercel, Cloudflare, nginx, Caddy)
 * receives plain HTTP at the container with `X-Forwarded-Proto: https`
 * + `X-Forwarded-Host: your-domain.com` headers. Without honoring
 * those, `ctx.url.origin` returns `http://internal-host` and breaks
 * og:url / og:image meta tags, OAuth callback URLs, and any user code
 * building absolute URLs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlFromRequest } from '../packages/server/src/forwarded.js';

function makeReq(url, headers = {}) {
  return { url, headers };
}

test('urlFromRequest: no proxy headers → http + Host header (current localhost behavior)', () => {
  const u = urlFromRequest(makeReq('/about', { host: 'localhost:3000' }));
  assert.equal(u.href, 'http://localhost:3000/about');
});

test('urlFromRequest: no Host header at all → falls back to localhost', () => {
  const u = urlFromRequest(makeReq('/', {}));
  assert.equal(u.href, 'http://localhost/');
});

test('urlFromRequest: undefined req.url → defaults to "/"', () => {
  const u = urlFromRequest(makeReq(undefined, { host: 'localhost:3000' }));
  assert.equal(u.pathname, '/');
});

test('urlFromRequest: X-Forwarded-Proto=https flips scheme', () => {
  const u = urlFromRequest(makeReq('/docs', {
    host: 'internal-host:3000',
    'x-forwarded-proto': 'https',
  }));
  assert.equal(u.protocol, 'https:');
});

test('urlFromRequest: X-Forwarded-Host overrides Host', () => {
  const u = urlFromRequest(makeReq('/docs', {
    host: 'internal-host:3000',
    'x-forwarded-host': 'docs.webjs.dev',
  }));
  assert.equal(u.host, 'docs.webjs.dev');
});

test('urlFromRequest: both forwarded headers → public origin restored end-to-end (the Railway case)', () => {
  const u = urlFromRequest(makeReq('/docs/getting-started', {
    host: 'webjs-docs.railway.internal:3000',
    'x-forwarded-host': 'docs.webjs.dev',
    'x-forwarded-proto': 'https',
  }));
  assert.equal(u.href, 'https://docs.webjs.dev/docs/getting-started');
  assert.equal(u.origin, 'https://docs.webjs.dev');
});

test('urlFromRequest: comma-separated proxy chain → first entry wins (closest to client)', () => {
  // CDN -> load balancer -> container. The CDN's view (https) is what
  // the browser sent; that's what we want, not the LB's intermediate.
  const u = urlFromRequest(makeReq('/x', {
    host: 'container:3000',
    'x-forwarded-proto': 'https, http',
    'x-forwarded-host': 'docs.webjs.dev, internal.lb',
  }));
  assert.equal(u.protocol, 'https:');
  assert.equal(u.host, 'docs.webjs.dev');
});

test('urlFromRequest: array-valued headers (Node sometimes returns these)', () => {
  // When the same header appears multiple times on the wire, Node's
  // IncomingMessage.headers returns it as an array. Pick the first.
  const u = urlFromRequest(makeReq('/x', {
    host: 'container',
    'x-forwarded-proto': ['https', 'http'],
    'x-forwarded-host': ['docs.webjs.dev', 'internal'],
  }));
  assert.equal(u.protocol, 'https:');
  assert.equal(u.host, 'docs.webjs.dev');
});

test('urlFromRequest: empty forwarded header values fall back to Host + http', () => {
  // Some buggy proxies set the header to empty string. Treat as absent.
  const u = urlFromRequest(makeReq('/', {
    host: 'fallback-host:3000',
    'x-forwarded-proto': '',
    'x-forwarded-host': '',
  }));
  assert.equal(u.protocol, 'http:');
  assert.equal(u.host, 'fallback-host:3000');
});

test('urlFromRequest: WEBJS_NO_TRUST_PROXY=1 disables proxy-header trust entirely', () => {
  const prev = process.env.WEBJS_NO_TRUST_PROXY;
  process.env.WEBJS_NO_TRUST_PROXY = '1';
  try {
    const u = urlFromRequest(makeReq('/x', {
      host: 'real-host:3000',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'attacker.example.com',
    }));
    // Forwarded values are ignored: fall back to Host header + http.
    assert.equal(u.protocol, 'http:');
    assert.equal(u.host, 'real-host:3000');
  } finally {
    if (prev !== undefined) process.env.WEBJS_NO_TRUST_PROXY = prev;
    else delete process.env.WEBJS_NO_TRUST_PROXY;
  }
});

test('urlFromRequest: preserves query string + hash through proxy', () => {
  const u = urlFromRequest(makeReq('/search?q=hello&page=2#results', {
    host: 'container',
    'x-forwarded-host': 'docs.webjs.dev',
    'x-forwarded-proto': 'https',
  }));
  assert.equal(u.href, 'https://docs.webjs.dev/search?q=hello&page=2#results');
});
