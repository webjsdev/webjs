/**
 * assertNoA11yViolations() tests (#268), real browser via WTR.
 *
 * The opt-in axe-core assertion runs in the WTR Chromium session. These tests
 * assert BOTH directions:
 *   - a good element (a button with an accessible name) PASSES (resolves);
 *   - a violating element (an <input> with no label) is FLAGGED, throwing an
 *     Error whose message names the violation so the failure is actionable.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { ssrFixture, assertNoA11yViolations } from '../../../src/testing.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
};

suite('assertNoA11yViolations() (#268)', () => {

  test('passes a good element (button with an accessible name)', async () => {
    class A11yGood extends WebComponent {
      render() { return html`<button type="button">Save changes</button>`; }
    }
    A11yGood.register('a11y-good');
    const el = await ssrFixture(html`<a11y-good></a11y-good>`);
    // Should resolve with no throw.
    await assertNoA11yViolations(el);
  });

  test('flags a missing-label input by throwing a named violation', async () => {
    // An <input> with no associated <label>, no aria-label, no title is a
    // textbook axe "label" violation.
    class A11yBad extends WebComponent {
      render() { return html`<input type="text" name="email">`; }
    }
    A11yBad.register('a11y-bad');
    const el = await ssrFixture(html`<a11y-bad></a11y-bad>`);

    let threw = null;
    try {
      await assertNoA11yViolations(el);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'a missing-label input must throw');
    assert.ok(/a11y/i.test(threw.message), `message should mention a11y, got: ${threw.message}`);
    // The message lists the violation id so the failure is actionable. axe ids
    // a missing label as either "label" or, depending on ruleset, "aria-input-field-name".
    assert.ok(/label|aria-input-field-name/.test(threw.message),
      `message should name the missing-label violation, got: ${threw.message}`);
  });

  test('flags an image with no alt text', async () => {
    // A second concrete violation direction: <img> with no alt is the classic
    // "image-alt" failure.
    class A11yImg extends WebComponent {
      render() { return html`<img src="/x.png">`; }
    }
    A11yImg.register('a11y-img');
    const el = await ssrFixture(html`<a11y-img></a11y-img>`);

    let threw = null;
    try {
      await assertNoA11yViolations(el);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'an alt-less image must throw');
    assert.ok(/image-alt/.test(threw.message), `message should name image-alt, got: ${threw.message}`);
  });
});
