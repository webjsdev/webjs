/**
 * Which kit stylesheets a /ui page links beyond the two ui.css carries
 * (#1666). A preview in a style the page does not link renders unstyled, so
 * each section that shows another style is pinned here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraStylesFor } from '#lib/ui/style-links.ts';

test('the AI Elements patterns and the helper pages link rhea', () => {
  assert.deepEqual(extraStylesFor('/ui/docs/ai-elements/chat'), ['rhea']);
  assert.deepEqual(extraStylesFor('/ui/docs/ai-elements/prompt-input/'), ['rhea']);
  assert.deepEqual(extraStylesFor('/ui/docs/helpers/ai-sdk'), ['rhea']);
});

test('the AI Elements index and the react pages link nothing extra', () => {
  assert.deepEqual(extraStylesFor('/ui/docs/ai-elements'), []);
  assert.deepEqual(extraStylesFor('/ui/docs/react/questionnaire'), []);
});

test('the home and blocks pages keep their styles', () => {
  assert.deepEqual(extraStylesFor('/ui'), ['luma', 'rhea']);
  assert.deepEqual(extraStylesFor('/ui/blocks/sidebar'), ['luma']);
});
