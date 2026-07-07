// WHY a hand-written interface (not `typeof todos.$inferSelect` from the schema):
// this type is imported by the browser-shipped <todo-app> component. A VALUE
// import from `db/*.server.ts` would pin the component to a server module and
// crash it at load (webjs check flags it). A browser-safe shape here is safe.
// See agent-docs/types-and-mutations.md.
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  pending?: boolean; // client-only: true while an optimistic create is in flight
}
