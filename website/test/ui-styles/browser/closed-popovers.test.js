/**
 * A closed popover panel stays hidden in every style (#1666). The browser
 * hides one through its user-agent `[popover]:not(:popover-open)` rule, which
 * any author `display` beats, and most of shadcn's styles give the popover
 * content `flex` and the tooltip content `inline-flex` (Radix never has the
 * content in the document while closed, so they never had to care). So under
 * nova a closed popover painted over the page. Each kit panel carries
 * `not-open:hidden`; this checks the computed display with the real /ui
 * stylesheet and the site's copies of the kit modules.
 */
import { popoverContentClass } from '/modules/ui/components/popover.ts';
import { tooltipContentClass } from '/modules/ui/components/tooltip.ts';

const assert = {
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('a closed popover panel is hidden whatever display its style gives it', () => {
  // The stylesheets a /ui page links: ui.css states the cascade layers
  // (theme, base, components, utilities), so the styles' layer(base) rules
  // sit below the utilities, and each style is its own sheet.
  suiteSetup(async () => {
    for (const href of ['/public/ui.css', '/public/ui-styles/nova.css', '/public/ui-styles/new-york.css']) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.appendChild(link);
      await loaded;
    }
  });

  for (const style of ['nova', 'new-york']) {
    test(`style-${style}: popover and tooltip content`, () => {
      const root = document.createElement('div');
      root.className = 'ui-site';
      root.innerHTML = `<div class="style-${style}">
        <div popover data-slot="popover-content" class="${popoverContentClass()}">Popover</div>
        <div popover="manual" role="tooltip" data-slot="tooltip-content" class="${tooltipContentClass()}">Tip</div>
      </div>`;
      document.body.appendChild(root);
      try {
        const [pop, tip] = root.querySelectorAll('[popover]');
        assert.equal(getComputedStyle(pop).display, 'none', 'a closed popover is not painted');
        assert.equal(getComputedStyle(tip).display, 'none', 'a closed tooltip is not painted');
        pop.showPopover();
        tip.showPopover();
        const open = { nova: 'flex', 'new-york': 'block' }[style];
        assert.equal(getComputedStyle(pop).display, open, 'an open popover takes its style\'s display');
        pop.hidePopover();
        tip.hidePopover();
        assert.equal(getComputedStyle(pop).display, 'none', 'and closed again it is hidden');
      } finally {
        root.remove();
      }
    });
  }
});
