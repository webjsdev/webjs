/**
 * `formInput` (#1664): the one input shape a form submission gives a server
 * action, readable as a plain object AND through the FormData readers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formInput, isFormData } from '../../src/action-input.js';

function fd(entries) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

test('a field reads as a property, the shape RPC and route() already give', () => {
  const input = formInput(fd([['title', 'Hello'], ['done', 'on']]));
  assert.equal(input.title, 'Hello');
  assert.equal(input.done, 'on');
  assert.deepEqual({ ...input }, { title: 'Hello', done: 'on' });
  assert.deepEqual(Object.keys(input), ['title', 'done'], 'only the fields are enumerable');
  assert.equal(JSON.stringify(input), '{"title":"Hello","done":"on"}');
});

test('the FormData readers still work, delegating to the original', () => {
  const input = formInput(fd([['title', 'Hello'], ['tag', 'a'], ['tag', 'b']]));
  assert.equal(input.get('title'), 'Hello');
  assert.equal(input.get('missing'), null);
  assert.deepEqual(input.getAll('tag'), ['a', 'b']);
  assert.equal(input.has('tag'), true);
  assert.deepEqual([...input.keys()], ['title', 'tag', 'tag']);
  assert.deepEqual([...input.values()], ['Hello', 'a', 'b']);
  const seen = [];
  input.forEach((v, k) => seen.push(`${k}=${v}`));
  assert.deepEqual(seen, ['title=Hello', 'tag=a', 'tag=b']);
});

test('iteration, Object.fromEntries and URLSearchParams consume it like a FormData', () => {
  const input = formInput(fd([['a', '1'], ['b', '2']]));
  assert.deepEqual([...input], [['a', '1'], ['b', '2']]);
  assert.deepEqual(Object.fromEntries(input), { a: '1', b: '2' });
  assert.equal(new URLSearchParams(input).toString(), 'a=1&b=2');
});

test('a repeated plain name keeps its last value on the property', () => {
  const input = formInput(fd([['tag', 'a'], ['tag', 'b']]));
  assert.equal(input.tag, 'b');
});

test('a name ending in [] collects every value into an array without the brackets', () => {
  const input = formInput(fd([['tags[]', 'a'], ['tags[]', 'b'], ['one[]', 'x']]));
  assert.deepEqual(input.tags, ['a', 'b']);
  assert.deepEqual(input.one, ['x'], 'a single checked box is still an array');
  assert.deepEqual(input.getAll('tags[]'), ['a', 'b'], 'the reader sees the submitted name');
});

test('a File stays a real File', async () => {
  const file = new File(['hi'], 'note.txt', { type: 'text/plain' });
  const input = formInput(fd([['avatar', file]]));
  assert.ok(input.avatar instanceof File);
  assert.equal(input.avatar.name, 'note.txt');
  assert.equal(await input.avatar.text(), 'hi');
  assert.ok(input.get('avatar') instanceof File);
});

test('a field named __proto__ is plain data and never reaches the prototype', () => {
  const input = formInput(fd([['__proto__', 'polluted'], ['constructor', 'x']]));
  assert.ok(input instanceof FormData);
  assert.equal(Object.getOwnPropertyDescriptor(input, '__proto__').value, 'polluted');
  assert.equal(input.constructor, 'x');
  assert.equal(({}).polluted, undefined);
});

test('a field sharing a reader name wins as data', () => {
  const input = formInput(fd([['get', 'mine'], ['title', 't']]));
  assert.equal(input.get, 'mine');
  assert.equal(input.getAll('title')[0], 't', 'the other readers stay');
});

test('it is a real FormData, and the writers keep the properties in step', async () => {
  const input = formInput(fd([['a', '1'], ['tags[]', 'x']]));
  assert.ok(input instanceof FormData, 'instanceof FormData holds, as Next and TanStack hand an action');
  assert.equal(isFormData(input), false, 'isFormData means a FormData not yet converted');
  assert.equal(isFormData(new FormData()), true);
  input.append('tags[]', 'y');
  assert.deepEqual(input.tags, ['x', 'y']);
  input.set('a', '2');
  assert.equal(input.a, '2');
  input.append('b', 'new');
  assert.equal(input.b, 'new');
  input.delete('a');
  assert.equal('a' in input, false, 'a deleted field loses its property');
  assert.deepEqual(Object.keys(input), ['tags', 'b']);
  const body = await new Response(input).text();
  assert.match(body, /name="tags\[\]"/, 'it serializes as a multipart body, like any FormData');
});


test('a repeated plain name warns once per action and field, only when a warn sink is given', () => {
  const messages = [];
  const warn = (m) => messages.push(m);
  formInput(fd([['color', 'red'], ['color', 'blue'], ['ok[]', '1'], ['ok[]', '2']]), { warn, label: 'pickColorsA' });
  formInput(fd([['color', 'red'], ['color', 'blue']]), { warn, label: 'pickColorsA' });
  assert.equal(messages.length, 1, 'deduped, and a [] name never warns');
  assert.match(messages[0], /"color" was submitted 2 times to pickColorsA/);
  assert.match(messages[0], /color\[\]/);
  assert.match(messages[0], /getAll\('color'\)/);

  // Production passes no warn sink, so nothing is reported.
  formInput(fd([['size', 's'], ['size', 'm']]), { label: 'pickColorsB' });
  assert.equal(messages.length, 1);
});

// Review follow-ups on #1664: the readers must agree with the properties for a
// `[]` group, and a name mixed with its `[]` form must not drop a value.
test('the bracket-less name reads a [] group through get, getAll and has', () => {
  const input = formInput(fd([['tags[]', 'a'], ['tags[]', 'b']]));
  assert.deepEqual(input.tags, ['a', 'b']);
  assert.deepEqual(input.getAll('tags'), ['a', 'b'], 'getAll agrees with the property');
  assert.equal(input.get('tags'), 'a');
  assert.equal(input.has('tags'), true);
  assert.equal(input.has('missing'), false);
  assert.deepEqual(input.getAll('tags[]'), ['a', 'b'], 'the submitted spelling still reads');
  assert.deepEqual(Object.fromEntries(input), { 'tags[]': 'b' }, 'iteration reports names as submitted, like FormData');
});

test('a plain name mixed with its [] form is one array group, in either order, and dev warns about it', () => {
  const messages = [];
  const warn = (m) => messages.push(m);
  const a = formInput(fd([['x', '1'], ['x[]', '2']]), { warn, label: 'mixA' });
  assert.deepEqual(a.x, ['1', '2'], 'the plain value is kept');
  const b = formInput(fd([['x[]', '1'], ['x', '2']]), { warn, label: 'mixB' });
  assert.deepEqual(b.x, ['1', '2'], 'and the array is not replaced');
  assert.deepEqual(b.getAll('x').sort(), ['1', '2']);
  assert.equal(messages.length, 2, 'the mixed spelling warns once per action, since Rails rejects it outright');
  assert.match(messages[0], /"x" was submitted both as "x" and as "x\[\]" to mixA/);
  formInput(fd([['x', '1'], ['x[]', '2']]), { warn, label: 'mixA' });
  assert.equal(messages.length, 2, 'deduped per action and field');
  formInput(fd([['g[]', '1'], ['g[]', '2']]), { warn, label: 'mixA' });
  assert.equal(messages.length, 2, 'a consistent [] group never warns');
});
