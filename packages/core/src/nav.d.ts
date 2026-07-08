export function notFound(): never;
export function redirect(url: string, status?: number | { status?: number }): never;
export function forbidden(): never;
export function unauthorized(): never;
export function isNotFound(e: unknown): boolean;
export function isRedirect(e: unknown): boolean;
export function isForbidden(e: unknown): boolean;
export function isUnauthorized(e: unknown): boolean;
