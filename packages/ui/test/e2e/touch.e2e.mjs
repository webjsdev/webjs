/**
 * Touch-emulation e2e for interactive Tier-2 components (#745, tracked by #747).
 *
 * hover-card / dropdown-submenu / sonner each broke on iOS touch in ways no
 * desktop test caught. Touch *events* (`pointerType`, `matchMedia('(hover:none)')`)
 * emulate faithfully under Playwright's iPhone context (unlike the #730
 * engine-strictness quirk), so this runs on ordinary CI hardware: it boots the
 * ui-website and TAPS each component's primary trigger, asserting the open /
 * render outcome that was broken pre-#746.
 *
 * Self-contained: boots the website, runs the checks, tears down. Needs
 * Playwright + a browser. Run: `node packages/ui/test/e2e/touch.e2e.mjs`
 * (the runner sets WEBJS_E2E_TOUCH=1). Skips with a clear message if Playwright
 * or a browser is unavailable.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEBSITE = resolve(HERE, '../../packages/website');
const PORT = Number(process.env.WEBJS_E2E_PORT || 5181);
const BASE = `http://localhost:${PORT}`;

function fail(msg) { console.error('FAIL: ' + msg); process.exitCode = 1; }

let pw;
try {
  pw = (await import('playwright')).default ?? (await import('playwright'));
} catch {
  console.log('SKIP touch e2e: playwright not installed.');
  process.exit(0);
}

// Boot the ui-website (copies the registry, then `webjs start`).
const cli = resolve(WEBSITE, '../../../../node_modules/@webjsdev/cli/bin/webjs.js');
spawn(process.execPath, [resolve(WEBSITE, 'scripts/copy-registry.js')], { cwd: WEBSITE, stdio: 'ignore' });
await sleep(800);
const server = spawn(process.execPath, [cli, 'start', '--port', String(PORT)], {
  cwd: WEBSITE,
  stdio: 'ignore',
  env: { ...process.env, WEBJS_E2E_TOUCH: '1' },
});
const teardown = () => { try { server.kill('SIGTERM'); } catch { /* ignore */ } };
process.on('exit', teardown);

// Wait for readiness.
let up = false;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(BASE + '/__webjs/ready').catch(() => null);
    if (r && r.ok) { up = true; break; }
  } catch { /* retry */ }
  await sleep(500);
}
if (!up) { fail('ui-website did not become ready'); teardown(); process.exit(1); }

// Chromium with the iPhone descriptor activates every touch path the fixes key
// on (verified: matchMedia('(hover:none)') + '(pointer:coarse)' both match, and
// page.tap() dispatches pointerType 'touch'), and CI already installs Chromium.
// The engine-strictness quirk that needed real WebKit (#730) is NOT what these
// components depend on, so Chromium emulation is a faithful and CI-cheap target.
let browser;
try {
  browser = await pw.chromium.launch({ headless: true });
} catch (e) {
  console.log('SKIP touch e2e: could not launch Chromium (' + String(e.message).split('\n')[0] + ').');
  teardown();
  process.exit(0);
}

const ctx = await browser.newContext({ ...pw.devices['iPhone 13'] });
const page = await ctx.newPage();
const results = [];

// 1) sonner: tap "Show toast" -> a toast renders.
await page.goto(BASE + '/docs/components/sonner', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const sbtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll('button')].find((b) => /show toast/i.test(b.textContent || '')));
await sbtn.asElement()?.tap();
await page.waitForTimeout(1200);
const toastNodes = await page.evaluate(() =>
  [...document.querySelectorAll('ui-sonner')].reduce((n, s) => n + s.querySelectorAll('.pointer-events-auto').length, 0));
results.push(['sonner toast renders on tap', toastNodes > 0]);

// 2) hover-card: tap trigger -> opens, no navigation.
await page.goto(BASE + '/docs/components/hover-card', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const urlBefore = page.url();
await (await page.$('ui-hover-card-trigger'))?.tap();
await page.waitForTimeout(600);
const hcOpen = await page.evaluate(() => !!document.querySelector('ui-hover-card')?.hasAttribute('open'));
results.push(['hover-card opens on tap without navigating', hcOpen && page.url() === urlBefore]);

// 3) dropdown submenu: open menu, tap sub-trigger -> opens AND stays (past close delay).
await page.goto(BASE + '/docs/components/dropdown-menu', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await (await page.$('ui-dropdown-menu-trigger button, ui-dropdown-menu-trigger'))?.tap();
await page.waitForTimeout(400);
await (await page.$('ui-dropdown-menu-sub-trigger [role="menuitem"], ui-dropdown-menu-sub-trigger'))?.tap();
await page.waitForTimeout(700); // > SUB_CLOSE_DELAY (200ms): proves it STAYS open
const subOpen = await page.evaluate(() => !!document.querySelector('ui-dropdown-menu-sub')?.hasAttribute('open'));
results.push(['dropdown submenu opens and stays open on tap', subOpen]);

await browser.close();
teardown();

let ok = true;
for (const [name, pass] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + ': ' + name);
  if (!pass) { ok = false; fail(name); }
}
if (ok) console.log('touch e2e: all ' + results.length + ' checks passed');
process.exit(ok ? 0 : 1);
