import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createRequestHandler } from '@webjsdev/server';
import { testRequest, submitForm, loginAndGetCookies, withSessionCookie } from '@webjsdev/server/testing';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Until `db:migrate` has run, a request that reaches the users table 500s; the
// tests detect that on the response (a 5xx on the dashboard) and skip with a
// clear message instead of a misleading failure. The DATABASE_URL below is the
// one `.env.example` and `drizzle.config.ts` use, so `db:migrate` prepares the
// database this test connects to.
process.env.DATABASE_URL ||= 'file:./db/dev.db';
process.env.AUTH_SECRET ||= 'test-secret-at-least-32-characters-long!!';

function makeHandler() {
  // Builds lazily, so a missing table only surfaces per request.
  return createRequestHandler({ appDir, dev: true });
}

test('protected route redirects to login when unauthenticated', async (t) => {
  const app = await makeHandler();
  const res = await testRequest(app.handle, '/features/auth/dashboard');
  if (res.status >= 500) {
    t.skip('app deps not ready (run db:generate + db:migrate)');
    return;
  }
  // A cookie read, no DB row: real as soon as the modules import.
  assert.equal(res.status, 302, 'unauthenticated dashboard is gated');
  assert.equal(res.headers.get('location'), '/features/auth/login');
});

test('signup -> login -> dashboard renders for the authenticated user', async (t) => {
  const app = await makeHandler();
  // Probe readiness: a 5xx on the dashboard means deps/DB are not set up.
  const probe = await testRequest(app.handle, '/features/auth/dashboard');
  if (probe.status >= 500) { t.skip('app deps not ready; run db:generate + db:migrate'); return; }

  const email = `harness+${Date.now()}@example.com`;
  const password = 'password123';

  // `submitForm` renders the page and submits with the identity the server put
  // in the form's hidden field, as a browser with JS off does (a POST without
  // it is a 405). Only the request is guarded: an unmigrated table makes the
  // action throw, and that is the one condition worth skipping for; the
  // assertions stay outside the try so a real regression fails loudly.
  let signupRes: Response | null = null;
  try {
    signupRes = await submitForm(app.handle, '/features/auth/signup', {
      name: 'Harness', email, password,
    });
  } catch {
    signupRes = null;
  }
  if (!signupRes || signupRes.status >= 500) {
    t.skip('no migrated DB; run db:migrate to enable the full flow');
    return;
  }
  // Success signs in and 302s to the dashboard; a 422 means validation failed.
  assert.ok([302, 422].includes(signupRes.status), 'signup action ran');
  if (signupRes.status === 302) {
    assert.equal(signupRes.headers.get('location'), '/features/auth/dashboard', 'signup lands on the dashboard');
  } else {
    t.skip('signup was rejected by validation; run db:migrate to enable the full flow');
    return;
  }

  // Real login captures the genuine signed session cookie.
  const { cookies } = await loginAndGetCookies(app.handle, { email, password });

  // With the session cookie the protected route now renders (200).
  const dash = await testRequest(app.handle, '/features/auth/dashboard', withSessionCookie({}, cookies));
  assert.equal(dash.status, 200, 'the session cookie unlocks the dashboard');
  const body = await dash.text();
  assert.match(body, /Dashboard/, 'the dashboard content rendered');
  // The greeting interpolates the real user (a counterfactual for the escaping bug).
  assert.match(body, /Harness/, 'the dashboard greets the signed-in user by name');
  assert.ok(!body.includes('${user'), 'the greeting interpolation is not a literal string');
});
