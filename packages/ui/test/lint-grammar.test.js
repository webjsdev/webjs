/**
 * `webjsui lint` token grammar (`src/lint/grammar.js`): how one class is
 * parsed, the arbitrary VALUE versus arbitrary VARIANT rule, and the
 * category taxonomy transcribed from shadcn-ui/lint.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToken, isAllowed, GROUP_CATEGORY, categoryOf } from '../src/lint/grammar.js';

test('parseToken: arbitrary VARIANTS are not arbitrary values', () => {
  for (const [token, variants, utility] of [
    ['[&_svg]:size-4', ['[&_svg]'], 'size-4'],
    ["[&_svg:not([class*='size-'])]:size-4", ["[&_svg:not([class*='size-'])]"], 'size-4'],
    ['has-[>svg]:px-3', ['has-[>svg]'], 'px-3'],
    ['data-[state=open]:flex', ['data-[state=open]'], 'flex'],
  ]) {
    const p = parseToken(token);
    assert.deepEqual(p.variants, variants, token);
    assert.equal(p.utility, utility, token);
    assert.equal(p.arbitraryValue, false, token);
  }
});

test('parseToken: arbitrary VALUES and arbitrary PROPERTIES are', () => {
  for (const [token, variants, utility] of [
    ['focus-visible:ring-[3px]', ['focus-visible'], 'ring-[3px]'],
    ['p-[13px]', [], 'p-[13px]'],
    ['[padding:13px]', [], '[padding:13px]'],
  ]) {
    const p = parseToken(token);
    assert.deepEqual(p.variants, variants, token);
    assert.equal(p.utility, utility, token);
    assert.equal(p.arbitraryValue, true, token);
  }
  // The only `:` in `[padding:13px]` is inside the brackets, so it is the utility whole.
  assert.equal(parseToken('[padding:13px]').category, 'spacing');
});

test('parseToken: the `(--var)` shorthand is not an arbitrary value', () => {
  const p = parseToken('bg-(--brand)');
  assert.equal(p.arbitraryValue, false);
  assert.equal(p.group, 'bg-color');
});

test('parseToken: variants, base, opacity, negative, important', () => {
  const p = parseToken('dark:hover:bg-primary/90');
  assert.deepEqual(p.variants, ['dark', 'hover']);
  assert.equal(p.base, 'bg-primary');
  assert.equal(p.opacity, '90');
  assert.equal(p.category, 'color');
  assert.equal(parseToken('-mt-4').negative, true);
  assert.equal(parseToken('-mt-4').base, 'mt-4');
  assert.equal(parseToken('p-4!').important, true);
  assert.equal(parseToken('p-4!').base, 'p-4');
  // A fraction is not an opacity: only a colour group takes the suffix.
  assert.equal(parseToken('w-1/2').opacity, null);
  assert.equal(parseToken('w-1/2').base, 'w-1/2');
});

test('parseToken: colour versus size disambiguation on shared prefixes', () => {
  assert.equal(parseToken('text-sm').group, 'font-size');
  assert.equal(parseToken('text-red-600').group, 'text-color');
  assert.equal(parseToken('text-[13px]').group, 'font-size');
  assert.equal(parseToken('text-[#333]').group, 'text-color');
  assert.equal(parseToken('border-2').group, 'border-w');
  assert.equal(parseToken('border-t-red-500').group, 'border-color-t');
  assert.equal(parseToken('ring-2').group, 'ring-w');
  assert.equal(parseToken('ring-red-500').group, 'ring-color');
  assert.equal(parseToken('shadow-lg').group, 'shadow');
  assert.equal(parseToken('shadow-red-500').group, 'shadow-color');
  assert.equal(parseToken('rounded-full').group, 'rounded');
  assert.equal(parseToken('rounded-t-lg').group, 'rounded-t');
  assert.equal(parseToken('flex').group, 'display');
  assert.equal(parseToken('flex-1').group, 'flex');
});

test('isAllowed: a category grants the category, a group id grants only that group', () => {
  assert.equal(isAllowed(parseToken('w-9'), ['layout']), true);
  assert.equal(isAllowed(parseToken('h-9'), ['layout']), true);
  assert.equal(isAllowed(parseToken('rounded-full'), ['layout']), false);
  assert.equal(isAllowed(parseToken('rounded-full'), ['layout', 'rounded']), true);
  assert.equal(isAllowed(parseToken('w-9'), ['layout', 'rounded']), true);
  // `rounded` is narrower than the `shape` category it sits in.
  assert.equal(isAllowed(parseToken('border-2'), ['layout']), false);
  assert.equal(isAllowed(parseToken('border-2'), ['layout', 'rounded']), false);
  assert.equal(isAllowed(parseToken('border-2'), ['shape']), true);
  // The corner groups are not covered by the plain radius grant.
  assert.equal(isAllowed(parseToken('rounded-t-lg'), ['rounded']), false);
  assert.equal(isAllowed(parseToken('p-4'), undefined), false);
});

test('GROUP_CATEGORY: keeps shadcn placements (padding is spacing, margin is layout)', () => {
  assert.equal(GROUP_CATEGORY.p, 'spacing');
  assert.equal(GROUP_CATEGORY.m, null);
  assert.equal(GROUP_CATEGORY.rounded, 'shape');
  assert.equal(GROUP_CATEGORY['border-w'], 'shape');
  assert.equal(GROUP_CATEGORY['text-color'], 'color');
  assert.equal(GROUP_CATEGORY['font-size'], 'typography');
  assert.equal(GROUP_CATEGORY.shadow, 'effects');
  assert.equal(GROUP_CATEGORY.transition, 'motion');
  // Upstream carries exactly six named categories; everything else is null.
  const cats = new Set(Object.values(GROUP_CATEGORY).filter(Boolean));
  assert.deepEqual([...cats].sort(), ['color', 'effects', 'motion', 'shape', 'spacing', 'typography']);
  assert.equal(categoryOf('arbitrary..color'), 'color');
  assert.equal(categoryOf('arbitrary..transition-duration'), 'motion');
  assert.equal(categoryOf('arbitrary..grid-template-areas'), null);
});

test('parseToken: a longer head is matched before the prefix it starts with (review findings on PR #1479)', () => {
  assert.equal(parseToken('text-shadow-lg').group, 'text-shadow');
  assert.equal(parseToken('text-shadow-[0_1px_0_#000]').group, 'text-shadow');
  assert.equal(parseToken('text-shadow-red-500').group, 'text-shadow-color');
  assert.equal(isAllowed(parseToken('text-shadow-[0_1px_0_#000]'), ['effects']), true);
  assert.equal(parseToken('bg-blend-multiply').group, 'bg-blend');
  assert.equal(parseToken('bg-blend-multiply').category, 'effects');
});
