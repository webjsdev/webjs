/**
 * HTML element-class predicates shared by the SSR compiler and walker.
 *
 * Everything here is a pure function of its argument: no component registry,
 * no renderer, no DOM. That is what keeps this module a leaf.
 *
 * Until #1646 this module also held the output rescanners (`inertRanges`,
 * `findClosingTagInString`, the per-tag regexes). The compiler now records the
 * same contexts as ops in its one tokenizer pass, so nothing rescans rendered
 * HTML and those scanners are gone.
 */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** @param {string} tag @returns {boolean} */
export function isVoidElement(tag) {
  return VOID_ELEMENTS.has(tag.toLowerCase());
}

/**
 * Raw-text elements for the purposes of HOLE escaping: a hole inside one is
 * emitted as-is. Deliberately just these two: widening it would change how
 * holes inside the other text-only elements are escaped.
 * @param {string} tag
 */
export function isRawtextTag(tag) {
  return tag === 'script' || tag === 'style';
}

/**
 * RCDATA elements: their content is text (character references aside), so a
 * tag-shaped string inside one is not markup. Kept next to `isRawtextTag` so
 * the two lists stay together rather than drifting apart.
 * @param {string} tag
 * @returns {boolean}
 */
export function isRcdataTag(tag) {
  return tag === 'textarea' || tag === 'title';
}

/**
 * Elements whose content the HTML tokenizer never reads as markup (#1128):
 * a tag-shaped string inside one is never an element. Every raw-text and
 * RCDATA element, plus the legacy ones (`<iframe>` with fallback markup is the
 * realistic trigger).
 *
 * `<noscript>` is excluded on purpose: its content IS parsed as markup when
 * scripting is disabled, which for a progressive-enhancement framework is the
 * case that matters, so components inside it must keep rendering. `<template>`
 * content is parsed too (Declarative Shadow DOM and the streamed swap
 * templates depend on that).
 *
 * @param {string} tag
 * @returns {boolean}
 */
export function isTextOnlyTag(tag) {
  return isRawtextTag(tag) || isRcdataTag(tag)
    || tag === 'iframe' || tag === 'xmp' || tag === 'noembed'
    || tag === 'noframes' || tag === 'plaintext';
}
