import type { Route } from './routes.js';

export function enableClientRouter(): void;
export function disableClientRouter(): void;
export function navigate(url: Route, opts?: { replace?: boolean }): Promise<void>;
export function loadFrame(
  frameEl: Element,
  url: string,
): Promise<{ ok: boolean; status: number | null; aborted: boolean }>;
export function revalidate(url?: string): void;
