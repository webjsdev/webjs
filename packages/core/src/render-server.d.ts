export interface SuspenseContext {
  pending: { id: string; promise: Promise<unknown> }[];
  nextId: number;
}

export function renderToString(
  value: unknown,
  opts?: { ssr?: boolean; suspenseCtx?: SuspenseContext },
): Promise<string>;

export function renderToStream(
  value: unknown,
  opts?: { ssr?: boolean; suspenseCtx?: SuspenseContext },
): ReadableStream;
