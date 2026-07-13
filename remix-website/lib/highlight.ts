import { html } from '@webjsdev/core';

/*
 * SSR syntax highlighter for the landing code snippet, ported from the Remix
 * site's feature-section tokenizer. Emits <span class="tok-*"> spans whose
 * colors (in home.css) match the Remix brand-cycle palette (keyword blue,
 * string green, number yellow, jsx-tag pink, type red).
 */

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'function', 'return', 'let', 'const',
  'var', 'type', 'interface', 'enum', 'class', 'extends', 'implements', 'if',
  'else', 'switch', 'case', 'break', 'continue', 'for', 'while', 'do', 'try',
  'catch', 'finally', 'throw', 'new', 'await', 'async', 'typeof', 'instanceof',
  'in', 'of', 'this', 'super', 'as', 'satisfies', 'true', 'false', 'null',
  'undefined', 'void', 'number', 'string', 'boolean', 'any', 'never', 'unknown',
  'public', 'private', 'protected', 'readonly', 'static', 'abstract',
]);

type Kind = 'keyword' | 'string' | 'number' | 'jsx' | 'type' | 'default';

const CLASS: Record<Kind, string> = {
  keyword: 'tok-keyword',
  string: 'tok-string',
  number: 'tok-number',
  jsx: 'tok-jsx',
  type: 'tok-type',
  default: '',
};

/** Tokenize a snippet and return an array of highlighted TemplateResults. */
export function highlight(code: string) {
  const out: unknown[] = [];
  const regex =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][\w-]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*\b)/g;

  let cursor = 0;
  for (let m = regex.exec(code); m !== null; m = regex.exec(code)) {
    if (m.index > cursor) out.push(code.slice(cursor, m.index));
    const [full, comment, str, jsxOpen, num, ident] = m;
    let kind: Kind = 'default';
    let text = full;
    if (comment !== undefined) { kind = 'default'; text = full; }
    else if (str !== undefined) { kind = 'string'; text = str; }
    else if (jsxOpen !== undefined) { kind = 'jsx'; text = jsxOpen; }
    else if (num !== undefined) { kind = 'number'; text = num; }
    else if (ident !== undefined) {
      text = ident;
      if (KEYWORDS.has(ident)) kind = 'keyword';
      else if (/^[A-Z]/.test(ident)) kind = 'type';
      else kind = 'default';
    }
    out.push(kind === 'default' ? text : html`<span class=${CLASS[kind]}>${text}</span>`);
    cursor = m.index + full.length;
  }
  if (cursor < code.length) out.push(code.slice(cursor));
  return out;
}
