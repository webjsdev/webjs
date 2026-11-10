/**
 * The WebJs wire serializer (rich-type round-trip: Date / Map / Set / BigInt /
 * Error / typed arrays / Blob / File / FormData / Symbols / cycles).
 */
export function stringify(value: unknown): Promise<string>;
/** `stringify` done synchronously, for a value holding no File or Blob (it throws on one). */
export function stringifySync(value: unknown): string;
export function parse(text: string): unknown;
export function serialize(value: unknown): Promise<unknown>;
export function deserialize(value: unknown): unknown;
