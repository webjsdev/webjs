/**
 * The overlay half of the phone-width audit (scripts/audit-390.mjs): opens the
 * lead demo's overlay on each overlay docs page, ours and shadcn's, at
 * 390x844 in light and dark, and screenshots the viewport with it open.
 *
 *   node scripts/audit-390-overlays.mjs <out-dir> [ours] [theirs]
 *
 * The trigger is the first button in the page's first component preview, or
 * for a hover card and a tooltip, a hover over it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const out = resolve(process.argv[2] ?? 'audit-390');
const OURS = process.argv[3] ?? 'http://localhost:5001';
const THEIRS = process.argv[4] ?? 'http://localhost:4000';
const OVERLAYS = ['alert-dialog', 'combobox', 'command', 'dialog', 'drawer', 'dropdown-menu', 'hover-card', 'popover', 'select', 'sheet', 'tooltip'];
const HOVER = new Set(['hover-card', 'tooltip']);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const name of OVERLAYS) {
  for (const theme of ['light', 'dark']) {
    for (const [site, url] of [['ours', `${OURS}/ui/docs/components/${name}`], ['theirs', `${THEIRS}/docs/components/base/${name}`]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, hasTouch: !HOVER.has(name), isMobile: !HOVER.has(name) });
      await ctx.addInitScript((t) => { try { localStorage.setItem('webjs_theme', t); localStorage.setItem('theme', t); } catch {} }, theme);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(1200);
        const preview = page.locator('[data-slot="component-preview"]').first();
        await preview.scrollIntoViewIfNeeded();
        const trigger = preview.locator('button, [role=combobox], input, a').first();
        if (HOVER.has(name)) await trigger.hover(); else await trigger.click();
        await page.waitForTimeout(900);
        const shot = `overlay-${name}-${theme}-${site}.png`;
        await page.screenshot({ path: resolve(out, shot) });
        results.push({ name, theme, site, shot, errors });
      } catch (e) {
        results.push({ name, theme, site, error: String(e).slice(0, 200) });
      }
      await ctx.close();
    }
  }
  console.log('done', name);
}
await browser.close();
writeFileSync(resolve(out, 'overlays.json'), JSON.stringify(results, null, 2));
console.log('wrote overlays.json');
