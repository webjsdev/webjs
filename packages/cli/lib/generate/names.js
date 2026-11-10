/**
 * Resource names for `webjs generate`: one parsed name gives every spelling a
 * generated file needs (`post`, `posts`, `Post`, `blog-posts`, `blog_posts`).
 *
 * The name is interpolated into generated source, so it is validated here
 * once, as `app-name.js` does for `webjs create`: only letters and digits in
 * words separated by `_`, `-` or case changes, starting with a letter.
 *
 * Pluralization is deliberately tiny and predictable (Rails' common rules plus
 * a few irregulars), with `--plural` as the escape hatch, rather than an
 * inflection library.
 */

const IRREGULAR = {
  person: 'people',
  man: 'men',
  woman: 'women',
  child: 'children',
  mouse: 'mice',
  goose: 'geese',
  foot: 'feet',
  tooth: 'teeth',
};
const UNCOUNTABLE = new Set(['equipment', 'information', 'news', 'series', 'species', 'data', 'feedback', 'metadata']);

/**
 * Plural of one lowercase word.
 * @param {string} word
 * @returns {string}
 */
export function pluralize(word) {
  if (UNCOUNTABLE.has(word)) return word;
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es';
  if (/[^aeiou]o$/.test(word) && !/(photo|piano|memo|logo|video|radio|zoo)$/.test(word)) return word + 'es';
  return word + 's';
}

/**
 * Split a name in any common spelling into lowercase words.
 * `BlogPost`, `blog_post`, `blog-post` and `blogPost` all give `['blog', 'post']`.
 * @param {string} raw
 * @returns {string[] | null} null when the name is not a valid identifier
 */
export function splitWords(raw) {
  if (typeof raw !== 'string' || !/^[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)*$/.test(raw)) return null;
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .split(/[_-]/)
    .map((w) => w.toLowerCase());
}

const pascal = (/** @type {string[]} */ words) => words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const camel = (/** @type {string[]} */ words) => words[0] + pascal(words.slice(1));

/**
 * @typedef {object} ResourceNames
 * @property {string} singular camelCase singular (`blogPost`), a variable name
 * @property {string} plural camelCase plural (`blogPosts`), the table export
 * @property {string} Singular PascalCase singular (`BlogPost`), the type name
 * @property {string} Plural PascalCase plural (`BlogPosts`)
 * @property {string} kebab kebab singular (`blog-post`), for file names
 * @property {string} kebabPlural kebab plural (`blog-posts`), the URL segment and module dir
 * @property {string} table snake plural (`blog_posts`), the SQL table name
 * @property {string} human lowercase words (`blog post`), for UI text
 * @property {string} humanPlural lowercase words plural (`blog posts`)
 */

/**
 * Every spelling of a resource name. Accepts a singular or plural name, as
 * Rails does: `posts` is singularized to `post` only when it ends in a plain
 * `s` that `pluralize` would have added.
 * @param {string} raw
 * @param {{ plural?: string }} [opts] `plural` overrides the plural word
 * @returns {ResourceNames}
 */
export function resourceNames(raw, opts = {}) {
  const words = splitWords(raw);
  if (!words) {
    throw new Error(`"${raw}" is not a valid resource name. Use letters and digits, starting with a letter, for example post, BlogPost or blog_post.`);
  }
  const last = words[words.length - 1];
  let singularLast = last;
  for (const [s, p] of Object.entries(IRREGULAR)) if (p === last) singularLast = s;
  if (singularLast === last && !UNCOUNTABLE.has(last)) {
    if (last.endsWith('ies') && last.length > 4) singularLast = last.slice(0, -3) + 'y';
    else if (/(ss|us|is)$/.test(last)) singularLast = last;
    else if (/(xes|zes|ches|shes|sses)$/.test(last)) singularLast = last.slice(0, -2);
    else if (last.endsWith('s') && last.length > 2) singularLast = last.slice(0, -1);
  }
  const singularWords = [...words.slice(0, -1), singularLast];
  let pluralWords;
  if (opts.plural) {
    const p = splitWords(opts.plural);
    if (!p) throw new Error(`"${opts.plural}" is not a valid plural. Use letters and digits, starting with a letter.`);
    pluralWords = p;
  } else {
    pluralWords = [...words.slice(0, -1), pluralize(singularLast)];
  }
  if (pluralWords.join('_') === singularWords.join('_')) {
    throw new Error(`"${raw}" has the same singular and plural form. Pass --plural with a different word.`);
  }
  return {
    singular: camel(singularWords),
    plural: camel(pluralWords),
    Singular: pascal(singularWords),
    Plural: pascal(pluralWords),
    kebab: singularWords.join('-'),
    kebabPlural: pluralWords.join('-'),
    table: pluralWords.join('_'),
    human: singularWords.join(' '),
    humanPlural: pluralWords.join(' '),
  };
}
