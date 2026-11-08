/**
 * Browser tests for <message-scroller-demo>, shadcn's MessageScrollerDemo
 * (the "New Chat" card on the /ui home page). The two delays are set to zero
 * so the scripted conversation runs at once.
 */
import '#components/message-scroller-demo.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${JSON.stringify(s)} to match ${re}`); },
};

const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return fn();
};

const mount = async () => {
  const el = document.createElement('message-scroller-demo');
  el.setAttribute('think-ms', '0');
  el.setAttribute('token-ms', '0');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const send = (el) => el.querySelector('button[type="submit"]').click();
const items = (el) => [...el.querySelectorAll('ui-message-scroller-item')];
// The demo's status is internal state; the queued line draws it as data-status.
const status = (el) => el.querySelector('[data-status]')?.dataset.status;

suite('message-scroller-demo', () => {
  test('opens on the empty state with the first question queued', async () => {
    const el = await mount();
    try {
      assert.ok(el.querySelector('[data-slot="empty"]'), 'the empty state');
      assert.match(el.querySelector('[data-status]').textContent, /^I'm building a chat/);
      assert.equal(el.querySelector('button[type="submit"]').disabled, false);
    } finally {
      el.remove();
    }
  });

  test('send adds the question, then streams the answer and queues the next one', async () => {
    const el = await mount();
    try {
      send(el);
      assert.ok(await until(() => status(el) === 'ready' && items(el).length === 2), 'a question and its answer');
      const [question, answer] = items(el);
      assert.equal(question.getAttribute('message-id'), 'u0');
      assert.ok(question.hasAttribute('scroll-anchor'), 'the question is the turn to anchor');
      assert.ok(!answer.hasAttribute('scroll-anchor'));
      assert.equal(question.querySelector('[data-slot="message"]').dataset.align, 'end');
      assert.equal(answer.querySelector('[data-slot="bubble"]').dataset.variant, 'ghost');
      assert.equal(answer.querySelectorAll('p').length, 2, 'the answer\'s two paragraphs');
      assert.match(answer.textContent, /without fighting the user's intent\./, 'streamed to its last word');
      assert.match(el.querySelector('[data-status]').textContent, /^Okay, but when someone sends/, 'the next question is queued');
      assert.equal(el.querySelector('[data-slot="message-scroller-content"]').getAttribute('role'), 'log');
    } finally {
      el.remove();
    }
  });

  test('both buttons are disabled while a reply is on its way', async () => {
    const el = await mount();
    el.thinkMs = 200;
    try {
      send(el);
      await el.updateComplete;
      assert.equal(status(el), 'submitted');
      assert.equal(el.querySelector('button[type="submit"]').disabled, true, 'send waits');
      assert.equal(el.querySelector('button[aria-label="Reset conversation"]').disabled, true, 'reset waits');
      assert.equal(el.querySelector('[data-status]').dataset.status, 'submitted', 'the queued text dims');
      await until(() => status(el) === 'ready');
    } finally {
      el.remove();
    }
  });

  test('after the last question nothing is queued, and reset starts over', async () => {
    const el = await mount();
    try {
      for (let i = 0; i < 4; i++) {
        send(el);
        assert.ok(await until(() => status(el) === 'ready' && items(el).length === (i + 1) * 2), `turn ${i + 1}`);
      }
      assert.match(el.querySelector('[data-status]').textContent, /No messages queued\. Reset the conversation\./);
      assert.equal(el.querySelector('button[type="submit"]').disabled, true, 'nothing left to send');
      el.querySelector('button[aria-label="Reset conversation"]').click();
      await el.updateComplete;
      assert.ok(el.querySelector('[data-slot="empty"]'), 'back to the empty state');
      assert.match(el.querySelector('[data-status]').textContent, /^I'm building a chat/);
    } finally {
      el.remove();
    }
  });
});
