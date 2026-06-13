/** Client tag-cache coordinator for HTTP-verb server actions (#488). Inert server-side. */
export function markStale(tags: string[]): void;
export function fetchMark(): number;
export function registerKeyTags(key: string, tags: string[], since?: number): void;
export function consumeStale(key: string): boolean;
export function parseTagHeader(value: string | null): string[];
