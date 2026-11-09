import { Directive } from './directive.js';
import type { PartInfo } from './directive.js';

export { directive, Directive, PartType } from './directive.js';
export type { PartInfo, Part, DirectiveResult, DirectiveParameters } from './directive.js';

/** lit's `AsyncDirective`: can `setValue()` outside a render and observes connection. */
export abstract class AsyncDirective extends Directive {
  constructor(partInfo: PartInfo);
  /** Whether the host component is in the document. */
  isConnected: boolean;
  /** Commit a value to the part outside a render. A no-op on the server. */
  setValue(value: unknown): void;
  /** The host left the document, or the part was torn down. */
  protected disconnected(): void;
  /** The host came back. */
  protected reconnected(): void;
}
