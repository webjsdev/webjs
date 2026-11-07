/**
 * Phone-width audit of /ui against a local shadcn/ui site (#1666).
 *
 * Manual dev tool, not part of the build or deploy. With this site on OURS and
 * shadcn's apps/v4 on THEIRS:
 *
 *   node scripts/audit-390.mjs <out-dir> [ours] [theirs]
 *
 * For each page pair it loads both at 390x844 in light and in dark, writes a
 * full-page screenshot of each (cut at 4000px), and records what a phone shows
 * wrong without anyone looking: a page wider than the screen, the elements
 * that stick out past it, and console errors. The findings land in
 * <out-dir>/audit.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const out = resolve(process.argv[2] ?? 'audit-390');
const OURS = process.argv[3] ?? 'http://localhost:5001';
const THEIRS = process.argv[4] ?? 'http://localhost:4000';

const COMPONENTS = [
  'accordion', 'alert-dialog', 'button', 'calendar', 'combobox', 'command', 'data-table', 'dialog',
  'drawer', 'dropdown-menu', 'hover-card', 'popover', 'select', 'sheet', 'tooltip',
];
const PAGES = [
  ...COMPONENTS.map((c) => [`/ui/docs/components/${c}`, `/docs/components/base/${c}`]),
  ['/ui/docs/installation', '/docs/installation'],
  ['/ui/docs/theming', '/docs/theming'],
  ['/ui/docs/ai-elements', '/docs/ai-elements'],
  ['/ui/charts/area', '/charts/area'],
  ['/ui/charts/pie', '/charts/pie'],
  ['/ui/create', '/create'],
  ['/ui/typeset', '/typeset'],
  ['/ui/colors', '/colors'],
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];

/** What sticks out past the viewport, the widest first. */
function measure() {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
    // Count only elements whose own box escapes, not every child inside one.
    const parent = el.parentElement?.getBoundingClientRect();
    if (parent && parent.right > vw + 1 && r.right <= parent.right + 1) continue;
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if ((o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') && a.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
    }
    if (clipped) continue;
    const id = el.id ? '#' + el.id : '';
    const slot = el.getAttribute('data-slot') ? `[data-slot=${el.getAttribute('data-slot')}]` : '';
    wide.push({ el: el.tagName.toLowerCase() + id + slot, cls: String(el.className?.baseVal ?? el.className).slice(0, 120), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 40) });
  }
  wide.sort((a, b) => b.right - a.right);
  return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, overflow: wide.slice(0, 8) };
}

for (const [ours, theirs] of PAGES) {
  for (const theme of ['light', 'dark']) {
    for (const [site, base, path] of [['ours', OURS, ours], ['theirs', THEIRS, theirs]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('webjs_theme', t); localStorage.setItem('theme', t); } catch {}
      }, theme);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      let status = 0;
      try {
        const res = await page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
        status = res?.status() ?? 0;
        await page.waitForTimeout(1200);
        const m = await page.evaluate(measure);
        const name = `${path.replace(/^\//, '').replace(/\//g, '_') || 'home'}-${theme}-${site}.png`;
        const height = Math.min(4000, await page.evaluate(() => document.documentElement.scrollHeight));
        await page.screenshot({ path: resolve(out, name), clip: { x: 0, y: 0, width: 390, height }, fullPage: true });
        results.push({ site, path, theme, status, ...m, errors, shot: name });
      } catch (e) {
        results.push({ site, path, theme, status, error: String(e).slice(0, 200) });
      }
      await ctx.close();
    }
  }
  console.log('done', ours);
}
await browser.close();
writeFileSync(resolve(out, 'audit.json'), JSON.stringify(results, null, 2));
console.log(`wrote ${resolve(out, 'audit.json')}`);
