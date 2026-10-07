// The row shape is DERIVED from the schema, never re-declared, so a renamed
// column is a compile error in every consumer. `import type` keeps it safe in
// the browser-shipped todo-app component because the stripper erases it; a
// value import from db/*.server.ts would pin the component to a server module
// (webjs check's no-server-import-in-browser-module).
import type { todos } from '#db/schema.server.ts';

type TodoRow = typeof todos.$inferSelect;

export interface Todo extends TodoRow {
  pending?: boolean; // client-only: true while an optimistic create is in flight
}
