/** The `<webjs-stream>` element-level update custom element (#248). */
export class WebjsStream extends HTMLElement {}

/** Apply a `<webjs-stream>` payload (string / nodes) into a document. */
export function renderStream(
  input: string | DocumentFragment | Node,
  doc?: Document,
): void;
