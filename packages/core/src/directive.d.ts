/** lit's `PartType`: the kind of part a directive is bound to. */
export const PartType: {
  readonly ATTRIBUTE: 1;
  readonly CHILD: 2;
  readonly PROPERTY: 3;
  readonly BOOLEAN_ATTRIBUTE: 4;
  readonly EVENT: 5;
  readonly ELEMENT: 6;
};
export type PartType = (typeof PartType)[keyof typeof PartType];

/** lit's `PartInfo`: where a directive instance is used. */
export interface PartInfo {
  readonly type: PartType;
  readonly name?: string;
  readonly tagName?: string;
  readonly strings?: readonly string[];
}

/** The part handed to `update()` on the client (a lit-shaped facade). */
export interface Part {
  readonly type: PartType;
  readonly options: { readonly host: unknown };
  /** Element, attribute, property, boolean and event parts. */
  readonly element?: Element;
  readonly name?: string;
  readonly strings?: readonly string[];
  /** Child parts. */
  readonly parentNode?: Node | null;
  readonly startNode?: Node | null;
  readonly endNode?: Node | null;
}

/** lit's `Directive`: subclass it, implement `render()`, optionally `update()`. */
export abstract class Directive {
  constructor(partInfo: PartInfo);
  abstract render(...props: unknown[]): unknown;
  update(part: Part, props: unknown[]): unknown;
}

/** The value a `directive()` function returns; rendered by both renderers. */
export interface DirectiveResult<C extends abstract new (...args: any[]) => Directive = abstract new (...args: any[]) => Directive> {
  readonly _$webjs: 'directive';
  readonly ctor: C;
  readonly values: unknown[];
}

/** The arguments of a directive class's `render()`. */
export type DirectiveParameters<C extends Directive> = Parameters<C['render']>;

/** lit's `directive()`: the template-facing function for a directive class. */
export function directive<C extends new (partInfo: PartInfo) => Directive>(
  c: C,
): (...values: DirectiveParameters<InstanceType<C>>) => DirectiveResult<C>;

export function isDirectiveResult(x: unknown): x is DirectiveResult;
/** lit's `getDirectiveClass`. */
export function getDirectiveClass(x: unknown): (abstract new (...args: any[]) => Directive) | undefined;
