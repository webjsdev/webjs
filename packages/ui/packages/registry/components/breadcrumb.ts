/**
 * Breadcrumb: semantic nav with breadcrumb list. Pure class helpers; use
 * native `<nav>`, `<ol>`, `<li>`, `<a>`, `<span>`.
 *
 * shadcn parity: Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
 * BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis.
 *
 * Usage:
 *   <nav aria-label="breadcrumb" data-slot="breadcrumb">
 *     <ol class=${breadcrumbListClass()}>
 *       <li class=${breadcrumbItemClass()}>
 *         <a class=${breadcrumbLinkClass()} href="/">Home</a>
 *       </li>
 *       <li class=${breadcrumbSeparatorClass()} role="presentation" aria-hidden="true">
 *         <svg>›</svg>
 *       </li>
 *       <li class=${breadcrumbItemClass()}>
 *         <span class=${breadcrumbPageClass()} aria-current="page">Posts</span>
 *       </li>
 *     </ol>
 *   </nav>
 *
 * Design tokens used: --muted-foreground, --foreground.
 */

export const breadcrumbListClass = (): string =>
  'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5';

export const breadcrumbItemClass = (): string => 'inline-flex items-center gap-1.5';

export const breadcrumbLinkClass = (): string => 'transition-colors hover:text-foreground';

export const breadcrumbPageClass = (): string => 'font-normal text-foreground';

export const breadcrumbSeparatorClass = (): string => '[&>svg]:size-3.5';

export const breadcrumbEllipsisClass = (): string => 'flex size-9 items-center justify-center';
