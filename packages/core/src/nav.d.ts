export function notFound(): never;
export function redirect(url: string, status?: number): never;
export function isNotFound(e: unknown): boolean;
export function isRedirect(e: unknown): boolean;
