/** Client tag-cache coordinator for HTTP-verb server actions (#488). Inert server-side. */
export function registerKeyTags(key: string, tags: string[]): void;
export function markStale(tags: string[]): void;
export function consumeStale(key: string): boolean;
export function parseTagHeader(value: string | null): string[];
