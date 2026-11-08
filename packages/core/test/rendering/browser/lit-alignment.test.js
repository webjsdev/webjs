import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { WebComponent } from '../../../src/component.js';
import { until } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

// Behavioral cases from lit-html EventPart, pinned to Lit b17fb14470c69a68205c10b69451883da07f4dde.
suite('Lit JS event compatibility', () => {
  test('function receiver, explicit host, arrows, bound functions and object listeners', () => {
    const container = document.createElement('div');
    let receiver;
    function listener() { receiver = this; }
    const view = (fn) => html`<button @click=${fn}>Go</button>`;
    render(view(listener), container);
    const button = container.querySelector('button');
    button.click(); assert.equal(receiver, button);
    const host = {};
    // Use a fresh container because render options, like Lit, belong to the root.
    const hosted = document.createElement('div');
    render(view(listener), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, host);
    const bound = {};
    render(view(listener.bind(bound)), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, bound);
    const object = { handleEvent() { receiver = this; } };
    render(view(object), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, object);
    render(view(null), hosted, { host });
    receiver = null; hosted.querySelector('button').click(); assert.equal(receiver, null);
  });
  test('once is not rearmed by changing a handler without changing options', () => {
    const container = document.createElement('div'); let clicks = 0;
    const view = (handler) => html`<button @click=${handler}>Go</button>`;
    const a = { once: true, handleEvent() { clicks++; } };
    render(view(a), container); container.querySelector('button').click();
    render(view({ ...a }), container); container.querySelector('button').click();
    assert.equal(clicks, 1);
    render(view(null), container); render(view(a), container);
    container.querySelector('button').click(); assert.equal(clicks, 2);
  });
  test('component host survives nested asynchronous directive rendering', async () => {
    class Owner extends WebComponent({}) {
      onClick() { this.clicked = true; }
      render() { return html`${until(Promise.resolve(html`<button @click=${this.onClick}>Go</button>`), '')}`; }
    }
    Owner.register('lit-event-owner');
    const el = document.createElement('lit-event-owner'); document.body.append(el);
    await el.updateComplete; await new Promise((resolve) => setTimeout(resolve, 0));
    el.querySelector('button').click(); assert.equal(el.clicked, true); el.remove();
  });
});
