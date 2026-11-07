/**
 * Browser tests for <docs-command-menu>, the /ui header's search (shadcn's
 * CommandMenu). The markup is the server fragment from
 * lib/ui/docs/command-menu.ts, rendered here on the client.
 */
import { render } from '@webjsdev/core';
import { commandMenu } from '#lib/ui/docs/command-menu.ts';
import '#components/docs-command-menu.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const mount = async () => {
  const box = document.createElement('div');
  document.body.append(box);
  render(commandMenu(), box);
  await new Promise((r) => setTimeout(r, 50));
  await tick();
  return box;
};

const dialog = (box) => box.querySelector('ui-dialog');
const key = (k, opts = {}, target = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

suite('docs-command-menu', () => {
  test('Ctrl+K and "/" toggle the palette, as shadcn\'s do', async () => {
    const box = await mount();
    try {
      key('k', { ctrlKey: true });
      await tick();
      assert.equal(dialog(box).open, true, 'Ctrl+K opens it');
      key('k', { metaKey: true });
      await tick();
      assert.equal(dialog(box).open, false, 'Cmd+K closes it again');
      key('/');
      await tick();
      assert.equal(dialog(box).open, true, '"/" opens it');
    } finally {
      dialog(box).open = false;
      box.remove();
    }
  });

  test('a shortcut typed into a field is left to the field', async () => {
    const box = await mount();
    const field = document.createElement('input');
    document.body.append(field);
    try {
      key('/', {}, field);
      await tick();
      assert.equal(dialog(box).open, false);
    } finally {
      field.remove();
      box.remove();
    }
  });

  test('a navigation closes it, and the next open starts on an empty search', async () => {
    const box = await mount();
    try {
      dialog(box).open = true;
      await tick();
      const input = box.querySelector('input[data-slot="command-input"]');
      input.value = 'button';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.dispatchEvent(new Event('webjs:navigate'));
      await tick();
      assert.equal(dialog(box).open, false, 'closed by the navigation');
      key('k', { ctrlKey: true });
      await tick();
      assert.equal(dialog(box).open, true);
      assert.equal(input.value, '', 'the search starts empty');
    } finally {
      dialog(box).open = false;
      box.remove();
    }
  });
});
