// Server-only utility (no 'use server'): a tiny in-process counter shared by
// the GET read and the POST mutation in the #488 verb demo. Not RPC-callable;
// the browser import would throw at load (it never imports this directly).
let count = 0;
export function greetingCount(): number { return count; }
export function bumpGreeting(): void { count += 1; }
