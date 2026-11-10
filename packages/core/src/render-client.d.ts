export interface RenderOptions { host?: object; }
/** What `render()` returns, lit's `RootPart`: `setConnected(false)` disconnects the async directives the render created, `setConnected(true)` reconnects them. */
export interface RootPart {
  setConnected(isConnected: boolean): void;
}
export function render(value: unknown, container: Element | DocumentFragment | ShadowRoot, options?: RenderOptions): RootPart;
