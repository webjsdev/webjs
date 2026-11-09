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
/** A React-ism in an html template's static strings: `className=` / `htmlFor=` or a capitalised tag. */
export function findJsxIsm(strings: readonly string[]): { kind: 'attr' | 'tag'; name: string } | null;
export function jsxIsmMessage(ism: { kind: 'attr' | 'tag'; name: string }): string;
