// A process-wide counter the page renders and the actions change. Held on
// globalThis so a dev re-import of this module keeps the count.
const g = globalThis as unknown as { __nextActionsCount?: number; __nextActionsRuns?: number };

export function count(): number {
  return g.__nextActionsCount || 0;
}

export function increment(): number {
  g.__nextActionsCount = count() + 1;
  return g.__nextActionsCount;
}

/** How many times the form-bound create action has run (a 307 re-POST ran it twice). */
export function runs(): number {
  return g.__nextActionsRuns || 0;
}

export function recordRun(): void {
  g.__nextActionsRuns = runs() + 1;
}
