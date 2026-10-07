/**
 * Real-browser tests for keeping what a person typed across a failed
 * submission (#1581). A 422 re-render applied in place used to bring every
 * field the page did not refill back EMPTY, because an inserted error message
 * shifts the differ's positional match and the inputs are recreated from
 * server markup. The router now snapshots the submitted form and restores each
 * control whose server-rendered default did not change.
 *
 * MUST run in a real browser: it drives a real submit through the enabled
 * router, with fetch stubbed to answer like the server's failure re-render.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { enableClientRouter } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

let navGuard;
const tick = () => new Promise((r) => setTimeout(r, 30));

function htmlResponse(body, status) {
  return new Response(body, { status, headers: { 'content-type': 'text/html', 'x-webjs-build': '' } });
}

// The form as the page first renders it, and as its 422 re-render comes back:
// an error paragraph is inserted ABOVE the inputs (shifting every position),
// and the page refills only `name`, the field it remembered.
const FORM_ATTRS = 'method="POST" action="/contact"';
function fields(nameValue, extra = '') {
  return `
    <input name="name" value="${nameValue}">
    <input name="email" type="email">
    <input name="pw" type="password">
    <textarea name="message"></textarea>
    <select name="priority"><option value="low">Low</option><option value="high">High</option></select>
    <label><input type="radio" name="attending" value="yes" checked> Yes</label>
    <label><input type="radio" name="attending" value="no"> No</label>
    <input type="checkbox" name="news" value="1">
    ${extra}
    <button type="submit">Send</button>`;
}
const RERENDER = (attrs = FORM_ATTRS, extra = '') => `<!--wj:children:/:/--><main><form ${attrs}><p class="error">Name is required</p>${fields('', extra)}</form></main><!--/wj:children:/-->`;

suite('Client router: typed values survive a failed submission (#1581)', () => {
  let container, origFetch, bOpen, bClose, respond;
  function setup(formAttrs = FORM_ATTRS, extra = '') {
    navGuard = installNavGuard();
    enableClientRouter();
    container = document.createElement('div');
    bOpen = document.createComment('wj:children:/:/');
    bClose = document.createComment('/wj:children:/');
    document.body.append(bOpen, container, bClose);
    container.innerHTML = `<main><form ${formAttrs}>${fields('', extra)}</form></main>`;
    origFetch = window.fetch;
    window.fetch = async () => respond();
  }
  function teardown() {
    navGuard.remove();
    window.fetch = origFetch;
    // The swap replaces the container with the response's <main>, so clear the
    // whole range between the markers, not just the original container.
    while (bOpen.nextSibling && bOpen.nextSibling !== bClose) bOpen.nextSibling.remove();
    container.remove();
    bOpen.remove();
    bClose.remove();
  }
  function type(form) {
    form.elements.name.value = '';
    form.elements.email.value = 'ada@example.com';
    form.elements.pw.value = 'secret';
    form.elements.message.value = 'See you there';
    form.elements.priority.value = 'high';
    form.querySelector('input[value="no"]').checked = true;
    form.elements.news.checked = true;
  }

  test('every unrefilled control comes back as typed; password does not', async () => {
    setup();
    respond = () => htmlResponse(RERENDER(), 422);
    try {
      const form = container.querySelector('form');
      type(form);
      form.querySelector('button').click();
      await tick();
      const now = document.querySelector('main form');
      assert.ok(now.querySelector('.error'), 'the 422 re-render was applied');
      assert.equal(now.elements.email.value, 'ada@example.com');
      assert.equal(now.elements.message.value, 'See you there');
      assert.equal(now.elements.priority.value, 'high');
      assert.equal(now.querySelector('input[value="no"]').checked, true, 'the chosen radio is kept');
      assert.equal(now.querySelector('input[value="yes"]').checked, false);
      assert.equal(now.elements.news.checked, true);
      assert.equal(now.elements.pw.value, '', 'a password is never restored');
    } finally { teardown(); }
  });

  test('a value the server rendered on purpose wins over the typed one', async () => {
    setup();
    // The server normalizes the email and refills it, so the control's default
    // changed and the server's value stands.
    respond = () => htmlResponse(RERENDER().replace('<input name="email" type="email">', '<input name="email" type="email" value="ada@example.org">'), 422);
    try {
      const form = container.querySelector('form');
      type(form);
      form.querySelector('button').click();
      await tick();
      const now = document.querySelector('main form');
      assert.equal(now.elements.email.value, 'ada@example.org', 'server value wins');
      assert.equal(now.elements.message.value, 'See you there', 'the rest is still restored');
    } finally { teardown(); }
  });

  test('a successful response restores nothing', async () => {
    setup();
    respond = () => htmlResponse(`<!--wj:children:/:/--><main><form ${FORM_ATTRS}>${fields('')}</form></main><!--/wj:children:/-->`, 200);
    try {
      const form = container.querySelector('form');
      type(form);
      form.querySelector('button').click();
      await tick();
      const now = document.querySelector('main form');
      assert.notEqual(now, form, 'precondition: the form was replaced');
      assert.equal(now.elements.message.value, '', 'a success is a fresh form');
    } finally { teardown(); }
  });

  test('data-preserve-values="false" opts a form out', async () => {
    const attrs = `${FORM_ATTRS} data-preserve-values="false"`;
    setup(attrs);
    respond = () => htmlResponse(RERENDER(attrs), 422);
    try {
      const form = container.querySelector('form');
      type(form);
      form.querySelector('button').click();
      await tick();
      assert.equal(document.querySelector('main form').elements.message.value, '');
    } finally { teardown(); }
  });
});
