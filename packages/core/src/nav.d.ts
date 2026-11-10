export function notFound(): never;
/** How the client records a redirect that reaches the browser (Next's RedirectType). */
export type RedirectType = 'push' | 'replace';
export function redirect(url: string, status?: number | RedirectType | { status?: number; type?: RedirectType }): never;
export function permanentRedirect(url: string, type?: RedirectType): never;
export function forbidden(): never;
export function unauthorized(): never;
export function isNotFound(e: unknown): boolean;
export function isRedirect(e: unknown): boolean;
export function isForbidden(e: unknown): boolean;
export function isUnauthorized(e: unknown): boolean;
