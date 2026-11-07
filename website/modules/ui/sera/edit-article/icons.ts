/**
 * The lucide icons the Sera Edit Article screen imports that lib/ui/lucide.ts
 * does not carry, from lucide-react 0.474.0 (ISC, the version shadcn's
 * apps/v4 pins), plus the three it places with a data-icon attribute.
 */
import { svg } from '@webjsdev/core';

const icon = (name: string, inner: ReturnType<typeof svg>, cls = '', dataIcon: string | null = null) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon=${dataIcon} class=${'lucide lucide-' + name + (cls ? ' ' + cls : '')}>${inner}</svg>`;

export const AlignCenterIcon = (cls = '') =>
  icon('align-center', svg`<path d="M17 12H7"></path><path d="M19 18H5"></path><path d="M21 6H3"></path>`, cls);

export const AlignLeftIcon = (cls = '') =>
  icon('align-left', svg`<path d="M15 12H3"></path><path d="M17 18H3"></path><path d="M21 6H3"></path>`, cls);

export const AlignRightIcon = (cls = '') =>
  icon('align-right', svg`<path d="M21 12H9"></path><path d="M21 18H7"></path><path d="M21 6H3"></path>`, cls);

export const Code2Icon = (cls = '') =>
  icon('code-xml', svg`<path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path>`, cls);

export const Heading1Icon = (cls = '') =>
  icon('heading-1', svg`<path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="m17 12 3-2v8"></path>`, cls);

export const Heading2Icon = (cls = '') =>
  icon('heading-2', svg`<path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"></path>`, cls);

export const Heading3Icon = (cls = '') =>
  icon('heading-3', svg`<path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"></path><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"></path>`, cls);

export const LinkIcon = (cls = '') =>
  icon('link', svg`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>`, cls);

export const ListOrderedIcon = (cls = '') =>
  icon('list-ordered', svg`<path d="M10 12h11"></path><path d="M10 18h11"></path><path d="M10 6h11"></path><path d="M4 10h2"></path><path d="M4 6h1v4"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>`, cls);

export const RedoIcon = (cls = '') =>
  icon('redo', svg`<path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>`, cls);

export const UndoIcon = (cls = '') =>
  icon('undo', svg`<path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>`, cls);

export const StrikethroughIcon = (cls = '') =>
  icon('strikethrough', svg`<path d="M16 4H9a3 3 0 0 0-2.83 4"></path><path d="M14 12a4 4 0 0 1 0 8H6"></path><line x1="4" x2="20" y1="12" y2="12"></line>`, cls);

export const TypeIcon = (cls = '') =>
  icon('type', svg`<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" x2="15" y1="20" y2="20"></line><line x1="12" x2="12" y1="4" y2="20"></line>`, cls);

/** lucide's chevron-down, carrying a data-icon attribute for the sera button padding. */
export const ChevronDownIcon = (dataIcon: string) =>
  icon('chevron-down', svg`<path d="m6 9 6 6 6-6"></path>`, '', dataIcon);

/** lucide's external-link, carrying a data-icon attribute for the sera button padding. */
export const ExternalLinkIcon = (dataIcon: string) =>
  icon('external-link', svg`<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>`, '', dataIcon);
