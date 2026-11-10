/**
 * A checked checkbox draws its tick and a checked radio its dot from the
 * helper's classes alone (#1666). They used to come from a stylesheet each
 * module injected when it loaded in the browser, so with JavaScript off a
 * checked box showed no tick and a checked radio no dot, and every page
 * importing either shipped whole. This checks the paint with the real /ui
 * stylesheets and NO injected stylesheet in the document (any one a module
 * still added is removed before measuring, so an injection cannot pass it).
 */
import { checkboxClass } from '/modules/ui/components/checkbox.ts';
import { radioClass } from '/modules/ui/components/radio-group.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('a checked checkbox and radio paint with no script', () => {
  suiteSetup(async () => {
    for (const href of ['/ui.css', '/ui-styles/nova.css', '/ui-styles/new-york.css']) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.appendChild(link);
      await loaded;
    }
  });

  test('importing the helpers injects no stylesheet', () => {
    assert.equal(document.getElementById('ui-checkbox-styles'), null, 'checkbox');
    assert.equal(document.getElementById('ui-radio-styles'), null, 'radio');
  });

  for (const style of ['nova', 'new-york']) {
    test(`style-${style}: the tick, the indeterminate dash and the dot`, () => {
      document.getElementById('ui-checkbox-styles')?.remove();
      document.getElementById('ui-radio-styles')?.remove();
      const root = document.createElement('div');
      root.className = 'ui-site';
      root.innerHTML = `<div class="style-${style}">
        <input type="checkbox" data-slot="checkbox" checked class="${checkboxClass()}">
        <input type="checkbox" data-slot="checkbox" class="${checkboxClass()}">
        <input type="checkbox" data-slot="checkbox" class="${checkboxClass()}">
        <input type="radio" data-slot="radio" name="r" checked class="${radioClass()}">
        <input type="radio" data-slot="radio" name="r" class="${radioClass()}">
      </div>`;
      document.body.appendChild(root);
      try {
        const [on, off, mixed, radioOn, radioOff] = root.querySelectorAll('input');
        mixed.indeterminate = true;
        const tick = getComputedStyle(on, '::before');
        assert.ok(tick.maskImage.includes('svg'), `the tick is masked to the check icon (${tick.maskImage.slice(0, 60)})`);
        assert.equal(tick.position, 'absolute', 'the tick fills the box');
        assert.equal(tick.backgroundColor, getComputedStyle(on).color, 'the tick is drawn in the box\'s text colour');
        assert.ok(tick.backgroundColor !== getComputedStyle(on).backgroundColor, 'which differs from the checked fill');
        assert.equal(getComputedStyle(off, '::before').maskImage, 'none', 'an unchecked box draws no tick');
        assert.ok(getComputedStyle(mixed, '::before').maskImage.includes('linear-gradient'), 'an indeterminate box draws the dash');
        assert.ok(getComputedStyle(radioOn).backgroundImage.includes('radial-gradient'), 'a checked radio draws its dot');
        assert.equal(getComputedStyle(radioOff).backgroundImage, 'none', 'an unchecked radio draws none');
      } finally {
        root.remove();
      }
    });
  }
});
