/**
 * React-isms in an `html` template that can never work, found once per
 * template (the compilers call this beside their compile cache), so the
 * mistake is a loud render error naming the fix instead of a silently wrong
 * page:
 *
 *   - `className=` / `htmlFor=`: JSX's DOM-property spellings. In HTML they
 *     are plain unknown attributes (`classname`, `htmlfor`), so the class
 *     never applies and the label never points at its control.
 *   - A capitalised tag (`<Link>`, `<Button>`): a JSX component. HTML
 *     lowercases it into an unknown element (`<link>` is even a void
 *     metadata element), so nothing renders.
 *
 * The scan follows the HTML tokenizer states that matter: text, a start tag
 * and its attributes, quoted values, comments, and raw text (`script`,
 * `style`, `textarea`, `title`), so prose such as `&lt;Link&gt;` or a
 * `className` mentioned in text is never flagged.
 *
 * @module jsx-guard
 */

const RAW = new Set(['script', 'style', 'textarea', 'title']);

/**
 * @typedef {{ kind: 'attr' | 'tag', name: string }} JsxIsm
 */

/**
 * The first React-ism in a template's static strings, or null.
 * @param {readonly string[]} strings
 * @returns {JsxIsm | null}
 */
export function findJsxIsm(strings) {
  let mode = 'text';      // text | tagname | tag | attr | q | comment | raw
  let quote = '';
  let name = '';
  let tag = '';
  let closing = false;
  let rawTag = '';
  for (let s = 0; s < strings.length; s++) {
    const str = strings[s];
    // A hole ends whatever name was being read.
    if (s > 0) {
      if (mode === 'tagname') mode = 'tag';
      else if (mode === 'attr') { name = ''; mode = 'tag'; }
    }
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      switch (mode) {
        case 'text':
          if (c === '<') {
            if (str.startsWith('<!--', i)) { mode = 'comment'; i += 3; }
            else if (/[A-Za-z/]/.test(str[i + 1] || '')) {
              closing = str[i + 1] === '/';
              if (closing) i++;
              mode = 'tagname';
              tag = '';
            }
          }
          break;
        case 'tagname':
          if (/[\s/>]/.test(c)) {
            if (!closing && /^[A-Z](?=.*[a-z])/.test(tag)) return { kind: 'tag', name: tag };
            mode = c === '>' ? afterTag(tag, closing) : 'tag';
            if (mode === 'raw') rawTag = tag.toLowerCase();
          } else tag += c;
          break;
        case 'tag':
          if (c === '>') { mode = afterTag(tag, closing); if (mode === 'raw') rawTag = tag.toLowerCase(); }
          else if (c === '"' || c === "'") { mode = 'q'; quote = c; }
          else if (!/[\s/=]/.test(c)) { mode = 'attr'; name = c; }
          break;
        case 'attr':
          if (/[\s=/>]/.test(c)) {
            if (name === 'className' || name === 'htmlFor') return { kind: 'attr', name };
            name = '';
            if (c === '>') { mode = afterTag(tag, closing); if (mode === 'raw') rawTag = tag.toLowerCase(); }
            else mode = 'tag';
          } else name += c;
          break;
        case 'q':
          if (c === quote) mode = 'tag';
          break;
        case 'comment':
          if (str.startsWith('-->', i)) { mode = 'text'; i += 2; }
          break;
        case 'raw':
          if (c === '<' && str.slice(i + 2, i + 2 + rawTag.length).toLowerCase() === rawTag && str[i + 1] === '/') {
            mode = 'tagname'; closing = true; tag = ''; i += 1;
          }
          break;
        default:
          break;
      }
    }
  }
  if (mode === 'attr' && (name === 'className' || name === 'htmlFor')) return { kind: 'attr', name };
  return null;
}

/**
 * @param {string} tag
 * @param {boolean} closing
 */
function afterTag(tag, closing) {
  return !closing && RAW.has(tag.toLowerCase()) ? 'raw' : 'text';
}

/**
 * The error message for a React-ism, naming the WebJs fix.
 * @param {JsxIsm} ism
 * @returns {string}
 */
export function jsxIsmMessage(ism) {
  if (ism.kind === 'attr') {
    const html = ism.name === 'className' ? 'class' : 'for';
    return `webjs: \`${ism.name}=\` in an html template is JSX, not HTML: the browser reads it as an unknown \`${ism.name.toLowerCase()}\` attribute and it does nothing. Write \`${html}=\` instead (\`${html}=\${...}\` for a dynamic value). See https://webjs.dev/docs/troubleshooting#jsx-in-html-template`;
  }
  return `webjs: \`<${ism.name}>\` in an html template is a JSX component, not HTML: the browser lowercases it into an unknown \`<${ism.name.toLowerCase()}>\` element and renders nothing. Use the custom element's tag (\`<my-${ism.name.toLowerCase()}>\`, registered with ${ism.name}.register('my-${ism.name.toLowerCase()}')), or a plain element such as \`<a href>\` for a link. See https://webjs.dev/docs/troubleshooting#jsx-in-html-template`;
}

/**
 * Throw when a template carries a React-ism. Called once per template by
 * each compiler, so the cost is paid at first render only.
 * @param {readonly string[]} strings
 */
export function assertNoJsxIsms(strings) {
  const ism = findJsxIsm(strings);
  if (ism) throw new Error(jsxIsmMessage(ism));
}
