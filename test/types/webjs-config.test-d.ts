/**
 * Compile-time type tests for the `WebjsConfig` type (#259).
 *
 * NOT executed by node:test. tsserver (your editor) and the
 * `type-fixtures.test.mjs` runner consume it via `tsc --noEmit`. A valid
 * config must type-check clean; every `// @ts-expect-error` line asserts
 * that a typo or wrong-typed value is REJECTED. tsc fails with an
 * "unused @ts-expect-error" if the type ever widens to accept the bad
 * value, so each one is a self-checking counterfactual: widening the type
 * to accept a typo, or dropping a field, breaks the build here.
 */

import type {
  WebjsConfig,
  WebjsHeaderRule,
  WebjsRedirectRule,
  WebjsCspConfig,
  WebjsTrailingSlash,
} from '@webjsdev/core';

/* ------------- A fully-populated, valid config ------------- */

const full: WebjsConfig = {
  elide: false,
  headers: [
    { source: '/embed/:path*', headers: [{ key: 'X-Frame-Options', value: null }] },
    { source: '/app/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
  ],
  redirects: [
    { source: '/old', destination: '/new' },
    { source: '/blog/:slug', destination: '/posts/:slug', permanent: false },
    { source: '/legacy', destination: '/', statusCode: 301 },
  ],
  trailingSlash: 'never',
  csp: { directives: { 'connect-src': "'self' https://api.example.com" }, reportOnly: true },
  maxBodyBytes: 262144,
  maxMultipartBytes: 5242880,
  requestTimeoutMs: 30000,
  headersTimeoutMs: 20000,
  keepAliveTimeoutMs: 5000,
};
void full;

/* ------------- The minimal / boolean-csp forms ------------- */

const minimal: WebjsConfig = {};
void minimal;

const cspBoolean: WebjsConfig = { csp: true };
void cspBoolean;

/* ------------- Nested type aliases are usable directly ------------- */

const headerRule: WebjsHeaderRule = {
  source: '/x',
  headers: [{ key: 'X-Test' }, { key: 'X-Drop', value: null }],
};
void headerRule;

const redirectRule: WebjsRedirectRule = { source: '/a', destination: '/b' };
void redirectRule;

const cspConfig: WebjsCspConfig = { reportOnly: false };
void cspConfig;

const slash: WebjsTrailingSlash = 'always';
void slash;

/* ------------- Counterfactuals (each MUST be an error) ------------- */

// @ts-expect-error elide is a boolean, not a string.
const badElide: WebjsConfig = { elide: 'yes' };
void badElide;

// @ts-expect-error trailingSlash is a fixed enum; 'sometimes' is not a member.
const badEnum: WebjsConfig = { trailingSlash: 'sometimes' };
void badEnum;

// @ts-expect-error an unknown key is rejected under excess-property checking.
const unknownKey: WebjsConfig = { notAKey: 1 };
void unknownKey;

// @ts-expect-error a typo'd key (`redirect` for `redirects`) is rejected.
const typoKey: WebjsConfig = { redirect: [] };
void typoKey;

// @ts-expect-error statusCode is a fixed redirect-code union; 200 is not allowed.
const badStatus: WebjsConfig = { redirects: [{ source: '/a', destination: '/b', statusCode: 200 }] };
void badStatus;

// @ts-expect-error a redirect rule requires a destination.
const missingDest: WebjsConfig = { redirects: [{ source: '/a' }] };
void missingDest;

// @ts-expect-error a numeric knob is a number, not a string.
const badNumber: WebjsConfig = { maxBodyBytes: '1mb' };
void badNumber;

// @ts-expect-error a header value of true is rejected (only string, null, or false).
const badHeaderValue: WebjsConfig = { headers: [{ source: '/a', headers: [{ key: 'X-Test', value: true }] }] };
void badHeaderValue;
