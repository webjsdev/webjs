/**
 * Pagination: page navigation. Pure class helpers; pagination links use
 * `buttonClass()` so visual matches buttons exactly.
 *
 * shadcn parity: Pagination, PaginationContent, PaginationItem, PaginationLink,
 * PaginationPrevious, PaginationNext, PaginationEllipsis.
 *
 * Usage:
 *   <nav role="navigation" aria-label="pagination" class=${paginationClass()}>
 *     <ul class=${paginationContentClass()}>
 *       <li>
 *         <a class=${paginationPreviousClass()} href="?page=1">‹ Previous</a>
 *       </li>
 *       <li>
 *         <a class=${paginationLinkClass({ isActive: false })} href="?page=2">2</a>
 *       </li>
 *       <li>
 *         <a class=${paginationLinkClass({ isActive: true })} aria-current="page">3</a>
 *       </li>
 *       <li class=${paginationEllipsisClass()} aria-hidden="true">…</li>
 *       <li>
 *         <a class=${paginationNextClass()} href="?page=4">Next ›</a>
 *       </li>
 *     </ul>
 *   </nav>
 *
 * Design tokens used: inherited from buttonClass.
 */
import { cn } from '../lib/utils.ts';
import { buttonClass, type ButtonSize } from './button.ts';

export const paginationClass = (): string => 'mx-auto flex w-full justify-center';

export const paginationContentClass = (): string => 'flex flex-row items-center gap-1';

export function paginationLinkClass(opts: { isActive?: boolean; size?: ButtonSize } = {}): string {
  return cn(buttonClass({ variant: opts.isActive ? 'outline' : 'ghost', size: opts.size ?? 'icon' }));
}

export const paginationPreviousClass = (): string =>
  cn(buttonClass({ variant: 'ghost', size: 'default' }), 'gap-1 px-2.5 sm:pl-2.5');

export const paginationNextClass = (): string =>
  cn(buttonClass({ variant: 'ghost', size: 'default' }), 'gap-1 px-2.5 sm:pr-2.5');

export const paginationEllipsisClass = (): string => 'flex size-9 items-center justify-center';
