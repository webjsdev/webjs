import type { TemplateResult } from './html.js';

export function fixture(template: TemplateResult | string): Promise<Element>;
export function ssrFixture(template: TemplateResult | string): Promise<Element>;
export function waitForUpdate(el: Element): Promise<void>;
export function assertNoA11yViolations(el: Element, opts?: Record<string, unknown>): Promise<void>;
export function click(el: Element): void;
export function shadowQuery(el: Element, selector: string): Element | null;
export function shadowQueryAll(el: Element, selector: string): Element[];
