import { svg } from '@webjsdev/core';

/**
 * The Tabler icons the RTL example uses that lib/ui/tabler.ts does not carry,
 * from @tabler/icons 3.34.1 (MIT; see packages/ui/THIRD_PARTY_NOTICES.md),
 * drawn the way that module draws them.
 */
function tabler(name: string, paths: string[], cls = '') {
  return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'tabler-icon tabler-icon-' + name + (cls ? ' ' + cls : '')}><path stroke="none" d="M0 0h24v24H0z" fill="none"/>${paths.map((d) => svg`<path d=${d} />`)}</svg>`;
}

export const IconChevronDown = (cls = '') => tabler('chevron-down', ['M6 9l6 6l6 -6'], cls);
export const IconMinus = (cls = '') => tabler('minus', ['M5 12l14 0'], cls);
export const IconAt = (cls = '') => tabler('at', ['M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M16 12v1.5a2.5 2.5 0 0 0 5 0v-1.5a9 9 0 1 0 -5.5 8.28'], cls);
export const IconPaperclip = (cls = '') => tabler('paperclip', ['M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5'], cls);
export const IconWorld = (cls = '') => tabler('world', ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'], cls);
export const IconApps = (cls = '') => tabler('apps', ['M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M14 7l6 0', 'M17 4l0 6'], cls);
export const IconBook = (cls = '') => tabler('book', ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6l0 13', 'M12 6l0 13', 'M21 6l0 13'], cls);
export const IconCircleDashedPlus = (cls = '') => tabler('circle-dashed-plus', ['M8.56 3.69a9 9 0 0 0 -2.92 1.95', 'M3.69 8.56a9 9 0 0 0 -.69 3.44', 'M3.69 15.44a9 9 0 0 0 1.95 2.92', 'M8.56 20.31a9 9 0 0 0 3.44 .69', 'M15.44 20.31a9 9 0 0 0 2.92 -1.95', 'M20.31 15.44a9 9 0 0 0 .69 -3.44', 'M20.31 8.56a9 9 0 0 0 -1.95 -2.92', 'M15.44 3.69a9 9 0 0 0 -3.44 -.69', 'M9 12h6', 'M12 9v6'], cls);
export const IconArrowUp = (cls = '') => tabler('arrow-up', ['M12 5l0 14', 'M18 11l-6 -6', 'M6 11l6 -6'], cls);
export const IconX = (cls = '') => tabler('x', ['M18 6l-12 12', 'M6 6l12 12'], cls);
