/**
 * A part composed over another part wins its conflicts, in the site's runtime
 * CSS as in shadcn (#1666). A FieldLabel is a Label: it carries both
 * `cn-label` (`leading-none`) and `cn-field-label` (`leading-snug`), and
 * shadcn's tailwind-merge resolves the conflict in the FieldLabel's favour.
 * Loaded as CSS the two rules tie on specificity and every style file defines
 * `.cn-label` later, so the label rendered 14px tall instead of 19.25px and
 * every labelled field drew short. scope-ui-styles.mjs raises a composing
 * part's selector by its composition rank; this checks the computed result
 * with the real /ui stylesheet.
 */
const assert = {
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('composite parts outrank the part they compose over', () => {
  suiteSetup(async () => {
    if (!document.querySelector('link[data-test-ui-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/public/ui.css';
      link.dataset.testUiCss = '';
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.appendChild(link);
      await loaded;
    }
  });

  for (const style of ['nova', 'new-york']) {
    test(`style-${style}: a field label takes the field label's line height, not the label's`, () => {
      const root = document.createElement('div');
      root.className = 'ui-site';
      root.innerHTML = `<div class="style-${style}">
        <label data-slot="field-label" class="cn-label cn-field-label flex w-fit items-center">Email</label>
        <label data-slot="label" class="cn-label flex items-center">Plain</label>
      </div>`;
      document.body.appendChild(root);
      try {
        const [field, plain] = root.querySelectorAll('label');
        assert.equal(getComputedStyle(field).fontSize, '14px');
        assert.equal(getComputedStyle(field).lineHeight, '19.25px', 'leading-snug of a 14px label');
        assert.equal(Math.round(field.getBoundingClientRect().height * 100) / 100, 19.25);
        assert.equal(getComputedStyle(plain).lineHeight, '14px', 'a plain Label keeps leading-none');
      } finally {
        root.remove();
      }
    });
  }
});
