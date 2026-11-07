import { html } from '@webjsdev/core';

/**
 * The Hugeicons glyphs the typeset builder uses (#1666), generated with
 * scripts/gen-hugeicons.mjs from @hugeicons/core-free-icons 1.2.1, the version
 * shadcn's site pins (MIT, Copyright (c) 2025 Hugeicons, see
 * packages/ui/THIRD_PARTY_NOTICES.md). Kept beside the builder rather than in
 * lib/ui/hugeicons.ts, since nothing else draws them.
 *
 * LineHeightIcon is not a Hugeicons glyph: shadcn draws it inline in its
 * customizer, and it is copied from there.
 */

export function LineHeightIcon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="LineHeightIcon" class=${cls}><path d="M4.5 3.5H19.5" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path><path d="M4.5 20.5H19.5" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path><path d="M17 17L14.8905 11.4741C13.9109 8.90801 13.4211 7.625 12.625 7.625C11.8289 7.625 11.3391 8.90801 10.3595 11.4741L8.25 17" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path><path d="M9.5 13H15.75" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path></svg>`;
}

export function ArrowHorizontalIcon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="ArrowHorizontalIcon" class=${cls}><path d="M5 9C4.39316 9.58984 2 11.1597 2 12C2 12.8403 4.39316 14.4102 5 15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M19 9C19.6068 9.58984 22 11.1597 22 12C22 12.8403 19.6068 14.4102 19 15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M2.42285 11.9795H21.868" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function LinkSquare02Icon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="LinkSquare02Icon" class=${cls}><path d="M11.0991 3.00012C7.45013 3.00669 5.53932 3.09629 4.31817 4.31764C3.00034 5.63568 3.00034 7.75704 3.00034 11.9997C3.00034 16.2424 3.00034 18.3638 4.31817 19.6818C5.63599 20.9999 7.75701 20.9999 11.9991 20.9999C16.241 20.9999 18.3621 20.9999 19.6799 19.6818C20.901 18.4605 20.9906 16.5493 20.9972 12.8998" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M20.556 3.49612L11.0487 13.0586M20.556 3.49612C20.062 3.00151 16.7343 3.04761 16.0308 3.05762M20.556 3.49612C21.05 3.99074 21.0039 7.32273 20.9939 8.02714" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function Menu09Icon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="Menu09Icon" class=${cls}><path d="M4 8.5L20 8.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M4 15.5L20 15.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function ParagraphSpacingIcon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="ParagraphSpacingIcon" class=${cls}><path d="M3 2H21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M3 22H21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M9.47266 8.50877L11.2737 6.37445C11.6424 5.93292 12.2676 5.92911 12.6732 6.37445L14.4529 8.50877M11.9734 7.08442V11.4079L11.9719 16.9993M14.4727 15.575L12.6716 17.7093C12.3029 18.1508 11.6777 18.1546 11.2721 17.7093L9.4924 15.575" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function SquareLock01Icon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="SquareLock01Icon" class=${cls}><path d="M4.26781 18.8447C4.49269 20.515 5.87613 21.8235 7.55966 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.879 17.7547 20 16.6376 20 15.5C20 14.3624 19.879 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55966 9.09909C5.87613 9.17649 4.49269 10.485 4.26781 12.1553C4.12104 13.2453 4 14.3624 4 15.5C4 16.6376 4.12104 17.7547 4.26781 18.8447Z" stroke="currentColor" stroke-width=${sw}></path><path d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5V9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M11.9961 15.5H12.0051" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function SquareUnlock01Icon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="SquareUnlock01Icon" class=${cls}><path d="M4.26781 18.8447C4.49269 20.515 5.87613 21.8235 7.55966 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.879 17.7547 20 16.6376 20 15.5C20 14.3624 19.879 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55966 9.09909C5.87613 9.17649 4.49269 10.485 4.26781 12.1553C4.12104 13.2453 4 14.3624 4 15.5C4 16.6376 4.12104 17.7547 4.26781 18.8447Z" stroke="currentColor" stroke-width=${sw}></path><path d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C13.9593 2 15.5 3.5 16 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path><path d="M11.9961 15.5H12.0051" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=${sw}></path></svg>`;
}

export function TextSmallcapsIcon(cls = '', sw = 1.5) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" data-icon="TextSmallcapsIcon" class=${cls}><path d="M10.5714 18H5.42857M8 3V18M8 3C6.81082 3 5.28326 3.12265 4.06709 3.24346C3.55271 3.29456 3.29552 3.32011 3.06788 3.41021C2.59438 3.59763 2.21271 4.00855 2.06906 4.48556C2 4.71489 2 4.97659 2 5.5M8 3C9.18918 3 10.7167 3.12265 11.9329 3.24346C12.4473 3.29456 12.7045 3.32011 12.9321 3.41021C13.4056 3.59763 13.7873 4.00855 13.9309 4.48556C14 4.71489 14 4.97659 14 5.5" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path><path d="M19.7143 21H16.2857M18 12V21M18 12C17.2072 12 16.1888 12.0818 15.3781 12.1623C15.0351 12.1964 14.8637 12.2134 14.7119 12.2735C14.3963 12.3984 14.1418 12.6724 14.046 12.9904C14 13.1433 14 13.3177 14 13.6667M18 12C18.7928 12 19.8112 12.0818 20.6219 12.1623C20.9649 12.1964 21.1363 12.2134 21.2881 12.2735C21.6037 12.3984 21.8582 12.6724 21.954 12.9904C22 13.1433 22 13.3177 22 13.6667" stroke="currentColor" stroke-linecap="round" stroke-width=${sw}></path></svg>`;
}

// Lucide's check, copy and chevron-down (ISC; see
// packages/ui/THIRD_PARTY_NOTICES.md), which shadcn's typeset panel imports
// from lucide-react. Copied here rather than imported from lib/ui/lucide.ts,
// whose module the elision analyser reads as client work, so importing it
// would ship the typeset page to the browser.

export function CheckIcon(cls = '') {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-check' + (cls ? ' ' + cls : '')}><path d="M20 6 9 17l-5-5"></path></svg>`;
}

export function CopyIcon(cls = '') {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-copy' + (cls ? ' ' + cls : '')}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
}

export function ChevronDownIcon(cls = '') {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-chevron-down' + (cls ? ' ' + cls : '')}><path d="m6 9 6 6 6-6"></path></svg>`;
}
