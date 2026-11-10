/**
 * A bound action stub renders its hidden identity field on the CLIENT, in a
 * real browser: `<form action=${rsvp.bind(null, slug)}>` re-rendered by a
 * component must submit the same `<hash>/<fn>#<args>` value the server emitted,
 * or a hydrated form posts a different action than its SSR copy. The browser
 * reads identity synchronously, which is why a stub's bound copy carries it as
 * a property rather than going through the async server resolver.
 */

import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { FORM_ACTION_ID_KEY, installActionBind, bindActionId } from '../../../src/form-action.js';

import { assert } from '../../../../../test/browser-assert.js';

/** What a generated stub looks like: its identity stamped on, and the bind. */
function stub(id) {
  const fn = async () => {};
  Object.defineProperty(fn, FORM_ACTION_ID_KEY, { value: id });
  return installActionBind(fn);
}

const mounted = [];
function host() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  mounted.push(el);
  return el;
}

teardown(() => {
  for (const el of mounted.splice(0)) el.remove();
});

suite('bound form action (client renderer)', () => {
  test('writes the bound identity into the hidden field', () => {
    const rsvp = stub('abc1234567/rsvp');
    const el = host();
    render(html`<form action=${rsvp.bind(null, 'meetup', 3)}><input name="email"></form>`, el);
    const field = el.querySelector('input[name="__webjs_action"]');
    assert.ok(field, 'the hidden identity field is present');
    assert.equal(field.value, bindActionId('abc1234567/rsvp', ['meetup', 3]));
    assert.equal(el.querySelector('form').getAttribute('method'), 'post');
  });

  test('a re-render with a new bound argument updates the field', () => {
    const rsvp = stub('abc1234567/rsvp');
    const el = host();
    const view = (slug) => html`<form action=${rsvp.bind(null, slug)}><input name="email"></form>`;
    render(view('one'), el);
    render(view('two'), el);
    const field = el.querySelector('input[name="__webjs_action"]');
    assert.equal(field.value, bindActionId('abc1234567/rsvp', ['two']));
    assert.equal(el.querySelectorAll('input[name="__webjs_action"]').length, 1, 'one field, not two');
  });

  test('a submitter bound the same way carries its own bound identity', () => {
    const rsvp = stub('abc1234567/rsvp');
    const el = host();
    render(html`<form action=${rsvp}><button formaction=${rsvp.bind(null, 'vip')}>VIP</button></form>`, el);
    const button = el.querySelector('button');
    assert.equal(button.getAttribute('name'), '__webjs_action');
    assert.equal(button.value, bindActionId('abc1234567/rsvp', ['vip']));
  });
});
