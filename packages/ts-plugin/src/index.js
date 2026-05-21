/**
 * @webjsdev/ts-plugin: a TypeScript language-service plugin that resolves
 *
 *   1. Custom-element tag names inside `html\`\`` tagged templates → the
 *      corresponding WebComponent class declaration.
 *   2. CSS class names inside `class="…"` attributes of `html\`\`` templates
 *      → the rule that defines them in a `css\`\`` tagged template.
 *
 * Runs alongside ts-lit-plugin. Whenever upstream returns no definition,
 * this plugin tries both resolvers in turn.
 *
 * Registration scan is keyed by each SourceFile's version so subsequent
 * lookups are cheap and invalidate incrementally on edits.
 */

'use strict';

/* eslint-disable no-restricted-syntax */

/**
 * TypeScript Language Service plugin factory.
 *
 * @param {{ typescript: typeof import('typescript') }} modules
 */
function init(modules) {
  const ts = modules.typescript;

  /** @type {Map<string, { version: string, components: Map<string, ComponentRef>, classes: Map<string, CssClassRef[]> }>} */
  const perFileCache = new Map();

  return { create };

  /**
   * Load `ts-lit-plugin` programmatically and let it enhance the
   * language service first, so our wrapping sits on top of its
   * template-literal intelligence. This is what lets users install
   * `@webjsdev/ts-plugin` as a single plugin (instead of needing to
   * list `ts-lit-plugin` separately in tsconfig).
   *
   * Failure modes:
   *  - ts-lit-plugin missing from node_modules (very unlikely: we
   *    declare it as a runtime dep)
   *  - factory shape changed in an incompatible way upstream
   *  - factory throws
   *
   * In every failure path we log + fall back to the bare language
   * service so the editor degrades to "no template intelligence" but
   * never crashes.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @returns {import('typescript/lib/tsserverlibrary').LanguageService}
   */
  function loadLitEnhanced(info) {
    try {
      // eslint-disable-next-line global-require
      const litFactory = require('ts-lit-plugin');
      const litMod = typeof litFactory === 'function' ? litFactory({ typescript: ts }) : null;
      const litCreate = litMod && typeof litMod.create === 'function' ? litMod.create : null;
      if (!litCreate) {
        info.project.projectService.logger?.info?.(
          '@webjsdev/ts-plugin: ts-lit-plugin has unexpected factory shape: falling back to bare LS',
        );
        return info.languageService;
      }
      const enhanced = litCreate(info);
      return enhanced || info.languageService;
    } catch (e) {
      info.project.projectService.logger?.info?.(
        `@webjsdev/ts-plugin: ts-lit-plugin failed to load: falling back to bare LS: ${String(e)}`,
      );
      return info.languageService;
    }
  }

  /** @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info */
  function create(info) {
    const proxy = Object.create(null);
    const inner = loadLitEnhanced(info);
    for (const k of Object.keys(inner)) {
      proxy[k] = /** @type any */ (inner[/** @type any */ (k)]).bind(inner);
    }

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      // Always try upstream first: ts-lit-plugin / stock tsserver may
      // already have an answer for Lit-style components, JSDoc-tagged
      // elements, or HTMLElementTagNameMap-augmented tags.
      const upstream = inner.getDefinitionAndBoundSpan(fileName, position);
      if (upstream && upstream.definitions && upstream.definitions.length > 0) {
        return upstream;
      }
      try {
        return (
          webjsTagDefinition(info, fileName, position) ||
          webjsCssClassDefinition(info, fileName, position) ||
          upstream
        );
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/ts-plugin: getDefinitionAndBoundSpan threw: ${String(e)}`,
        );
        return upstream;
      }
    };

    // ts-lit-plugin doesn't know about webjs components (no `@customElement`
    // decorator, no HTMLElementTagNameMap augmentation), so it flags every
    // `<my-component>` inside an html`` template as "Unknown tag". Filter
    // those out: but ONLY for tags that this file can actually reach
    // through its import graph. A tag registered somewhere in the program
    // but not imported here is still genuinely unknown at runtime, so the
    // diagnostic must stay.
    proxy.getSemanticDiagnostics = (fileName) => {
      const diags = inner.getSemanticDiagnostics(fileName);
      try {
        const filtered = filterLitTagDiagnostics(info, fileName, diags);
        const attrDiags = webjsAttrValueDiagnostics(info, fileName);
        return attrDiags.length ? [...filtered, ...attrDiags] : filtered;
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/ts-plugin: getSemanticDiagnostics threw: ${String(e)}`,
        );
        return diags;
      }
    };
    proxy.getSuggestionDiagnostics = (fileName) => {
      const diags = inner.getSuggestionDiagnostics(fileName);
      try { return filterLitTagDiagnostics(info, fileName, diags); }
      catch (e) { return diags; }
    };

    // Attribute-name auto-complete inside `<webjs-tag |…>` openers. The
    // `static properties = { … }` map on the component class drives the
    // completion list. ts-lit-plugin's own completions kick in only when
    // it recognises the tag, which it doesn't for webjs.
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const upstream = inner.getCompletionsAtPosition(fileName, position, options);
      try {
        const ours = webjsAttrCompletions(info, fileName, position);
        if (!ours || ours.length === 0) return upstream;
        if (!upstream) {
          return {
            isGlobalCompletion: false,
            isMemberCompletion: false,
            isNewIdentifierLocation: false,
            entries: ours,
          };
        }
        // De-dupe by name in case upstream and we both contributed the same
        // attribute (unlikely, but keep the IDE list clean).
        const seen = new Set(upstream.entries.map((e) => e.name));
        return {
          ...upstream,
          entries: [...upstream.entries, ...ours.filter((e) => !seen.has(e.name))],
        };
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/ts-plugin: getCompletionsAtPosition threw: ${String(e)}`,
        );
        return upstream;
      }
    };

    return proxy;
  }

  /* ================================================================
   * Diagnostic filter: drop ts-lit-plugin "unknown tag/attr" reports
   * for webjs components that are reachable from `fileName`.
   * ================================================================ */

  /**
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {readonly import('typescript').Diagnostic[] | undefined} diags
   */
  function filterLitTagDiagnostics(info, fileName, diags) {
    if (!diags || diags.length === 0) return diags;
    const program = info.languageService.getProgram();
    if (!program) return diags;
    const sf = program.getSourceFile(fileName);
    if (!sf) return diags;

    const registry = buildRegistry(program);
    if (registry.components.size === 0) return diags;
    const reachable = collectReachableTags(program, sf, registry);
    if (reachable.size === 0) return diags;

    return diags.filter((d) => !shouldSuppressDiagnostic(d, sf, reachable));
  }

  /**
   * A diagnostic is suppressible only if:
   *   1. It originates from ts-lit-plugin (source contains "lit"); and
   *   2. Its span sits on, or inside an opening tag whose name is, a
   *      reachable webjs tag.
   *
   * @param {import('typescript').Diagnostic} d
   * @param {import('typescript').SourceFile} sf
   * @param {Set<string>} reachable
   */
  function shouldSuppressDiagnostic(d, sf, reachable) {
    const source = /** @type any */ (d).source;
    if (typeof source !== 'string' || !/lit/i.test(source)) return false;
    if (typeof d.start !== 'number' || typeof d.length !== 'number') return false;
    const text = sf.text;
    // Case A: the span itself is the tag name.
    const spanText = text.slice(d.start, d.start + d.length).toLowerCase();
    if (reachable.has(spanText)) return true;
    // Case B: the span sits inside an opening tag whose name is reachable
    // (ts-lit-plugin "unknown attribute" diagnostics target the attribute
    // identifier, not the tag).
    const tag = enclosingOpenTag(text, d.start);
    return !!tag && reachable.has(tag);
  }

  /**
   * Walk backwards from `pos` to find the nearest `<tag-name` opener that
   * has not yet been closed by `>`. Returns the lowercased tag name, or
   * undefined if the position is not inside an opening tag.
   *
   * @param {string} text
   * @param {number} pos
   */
  function enclosingOpenTag(text, pos) {
    for (let i = pos - 1; i >= 0; i--) {
      const c = text[i];
      if (c === '>') return undefined;
      if (c !== '<') continue;
      // Found a `<`; read the tag name that follows.
      let j = i + 1;
      if (text[j] === '/') return undefined;
      let name = '';
      while (j < text.length) {
        const ch = text[j];
        if (/[A-Za-z0-9_-]/.test(ch)) { name += ch; j++; }
        else break;
      }
      if (!name || !name.includes('-')) return undefined;
      return name.toLowerCase();
    }
    return undefined;
  }

  /**
   * Build the set of webjs tag names reachable from `entry` through its
   * (transitive) import graph. A tag is reachable if and only if the
   * file that registers it appears anywhere in entry's import closure
   * (entry counts as importing itself).
   *
   * @param {import('typescript').Program} program
   * @param {import('typescript').SourceFile} entry
   * @param {{ components: Map<string, ComponentRef> }} registry
   * @returns {Set<string>}
   */
  function collectReachableTags(program, entry, registry) {
    const checker = program.getTypeChecker();
    /** @type {Map<string, string[]>} */
    const tagsByFile = new Map();
    for (const [tag, ref] of registry.components) {
      const arr = tagsByFile.get(ref.fileName) || [];
      arr.push(tag);
      tagsByFile.set(ref.fileName, arr);
    }

    /** @type {Set<string>} */
    const visited = new Set();
    /** @type {Set<string>} */
    const tags = new Set();
    /** @type {string[]} */
    const stack = [entry.fileName];
    while (stack.length) {
      const fn = stack.pop();
      if (!fn || visited.has(fn)) continue;
      visited.add(fn);
      const arr = tagsByFile.get(fn);
      if (arr) for (const t of arr) tags.add(t);
      const sf = program.getSourceFile(fn);
      if (!sf) continue;
      for (const stmt of sf.statements) {
        const spec =
          ts.isImportDeclaration(stmt) ? stmt.moduleSpecifier
            : ts.isExportDeclaration(stmt) && stmt.moduleSpecifier ? stmt.moduleSpecifier
              : undefined;
        if (!spec || !ts.isStringLiteralLike(spec)) continue;
        const sym = checker.getSymbolAtLocation(spec);
        if (!sym || !sym.declarations) continue;
        for (const d of sym.declarations) {
          if (ts.isSourceFile(d)) stack.push(d.fileName);
        }
      }
    }
    return tags;
  }

  /* ================================================================
   * Resolver 3: attribute-name completions inside `<webjs-tag …>`
   * ================================================================ */

  /**
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   * @returns {import('typescript').CompletionEntry[] | undefined}
   */
  function webjsAttrCompletions(info, fileName, position) {
    const program = info.languageService.getProgram();
    if (!program) return undefined;
    const source = program.getSourceFile(fileName);
    if (!source) return undefined;

    // Must be inside an html`` template, in an opening-tag attribute slot.
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;
    const { rawText, startPos } = getTemplateText(templateExpr);
    const offset = position - startPos;
    if (offset < 0 || offset > rawText.length) return undefined;

    const sanitised = stripHoles(rawText);
    const tag = enclosingOpenTag(sanitised, offset);
    if (!tag) return undefined;

    const registry = buildRegistry(program);
    const ref = registry.components.get(tag);
    if (!ref || !ref.attributes || ref.attributes.length === 0) return undefined;

    // Restrict to tags reachable from this file. Without the import,
    // suggesting attributes would imply the element is usable here when
    // it isn't.
    const reachable = collectReachableTags(program, source, registry);
    if (!reachable.has(tag)) return undefined;

    return ref.attributes.map((name) => ({
      name,
      kind: /** @type any */ (ts.ScriptElementKind).memberVariableElement,
      kindModifiers: '',
      sortText: '0',
      labelDetails: { description: `<${tag}>` },
    }));
  }

  /* ================================================================
   * Resolver 1: custom-element tag → component class
   * ================================================================ */

  /**
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   * @returns {import('typescript').DefinitionInfoAndBoundSpan | undefined}
   */
  function webjsTagDefinition(info, fileName, position) {
    const program = info.languageService.getProgram();
    if (!program) return undefined;
    const source = program.getSourceFile(fileName);
    if (!source) return undefined;

    const hit = tagUnderCursor(source, position);
    if (!hit) return undefined;

    const registry = buildRegistry(program);
    const ref = registry.components.get(hit.tag);
    if (!ref) return undefined;

    return {
      textSpan: hit.span,
      definitions: [
        {
          fileName: ref.fileName,
          textSpan: ref.classNameSpan,
          kind: /** @type any */ (ts.ScriptElementKind).classElement,
          name: ref.className,
          containerKind: /** @type any */ (ts.ScriptElementKind).moduleElement,
          containerName: '',
        },
      ],
    };
  }

  /* ================================================================
   * Resolver 2: CSS class name in html`class="…"` → css`` rule
   * ================================================================ */

  /**
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   * @returns {import('typescript').DefinitionInfoAndBoundSpan | undefined}
   */
  function webjsCssClassDefinition(info, fileName, position) {
    const program = info.languageService.getProgram();
    if (!program) return undefined;
    const source = program.getSourceFile(fileName);
    if (!source) return undefined;

    const hit = classUnderCursor(source, position);
    if (!hit) return undefined;

    const registry = buildRegistry(program);
    const refs = registry.classes.get(hit.className);
    if (!refs || refs.length === 0) return undefined;

    return {
      textSpan: hit.span,
      definitions: refs.map((r) => ({
        fileName: r.fileName,
        textSpan: r.span,
        kind: /** @type any */ (ts.ScriptElementKind).classElement,
        name: `.${hit.className}`,
        containerKind: /** @type any */ (ts.ScriptElementKind).moduleElement,
        containerName: '',
      })),
    };
  }

  /* ---------------- cursor → tag detection ---------------- */

  /**
   * If `position` lies on a custom-element tag name inside an `html\`\``
   * tagged template literal, return the tag and the span covering it.
   *
   * @param {import('typescript').SourceFile} source
   * @param {number} position
   * @returns {{ tag: string, span: import('typescript').TextSpan } | undefined}
   */
  function tagUnderCursor(source, position) {
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;

    const { rawText, startPos } = getTemplateText(templateExpr);
    const offset = position - startPos;
    if (offset < 0 || offset > rawText.length) return undefined;

    return findTagAtOffset(rawText, offset, startPos);
  }

  /**
   * If `position` lies on a class name inside a `class="…"` attribute of
   * an `html\`\`` template, return the class and its span.
   *
   * @param {import('typescript').SourceFile} source
   * @param {number} position
   * @returns {{ className: string, span: import('typescript').TextSpan } | undefined}
   */
  function classUnderCursor(source, position) {
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;

    const { rawText, startPos } = getTemplateText(templateExpr);
    const offset = position - startPos;
    if (offset < 0 || offset > rawText.length) return undefined;

    return findClassAtOffset(rawText, offset, startPos);
  }

  /**
   * Walk up from the token at `position` looking for a tagged template
   * whose tag identifier matches `name` (e.g. `html`, `css`). Returns
   * that template node or undefined.
   *
   * @param {import('typescript').SourceFile} source
   * @param {number} position
   * @param {string} name
   * @returns {import('typescript').TaggedTemplateExpression | undefined}
   */
  function findEnclosingTaggedTemplate(source, position, name) {
    function walk(node) {
      if (position < node.getStart(source) || position > node.getEnd()) {
        return undefined;
      }
      let found;
      ts.forEachChild(node, (c) => {
        const hit = walk(c);
        if (hit) {
          found = hit;
          return true;
        }
        return undefined;
      });
      if (found) return found;

      if (ts.isTaggedTemplateExpression(node) && tagMatches(node.tag, name)) {
        return /** @type import('typescript').TaggedTemplateExpression */ (node);
      }
      return undefined;
    }
    return walk(source);
  }

  /**
   * @param {import('typescript').Expression} tag
   * @param {string} name
   */
  function tagMatches(tag, name) {
    if (ts.isIdentifier(tag)) return tag.text === name;
    if (ts.isPropertyAccessExpression(tag)) return tag.name.text === name;
    return false;
  }

  /**
   * Extract the raw template source (braces of `${...}` are preserved).
   *
   * @param {import('typescript').TaggedTemplateExpression} expr
   * @returns {{ rawText: string, startPos: number }}
   */
  function getTemplateText(expr) {
    const t = expr.template;
    const src = expr.getSourceFile().text;
    const startPos = t.getStart(expr.getSourceFile());
    const endPos = t.getEnd();
    return { rawText: src.slice(startPos, endPos), startPos };
  }

  /**
   * Scan the raw template text and find the tag name whose span contains
   * `offset`. Returns the tag (lowercased) and its absolute span in the
   * source file.
   *
   * @param {string} raw
   * @param {number} offset
   * @param {number} startPos
   * @returns {{ tag: string, span: import('typescript').TextSpan } | undefined}
   */
  function findTagAtOffset(raw, offset, startPos) {
    const sanitised = stripHoles(raw);
    const re = /<\/?([a-zA-Z][a-zA-Z0-9_-]*)/g;
    let m;
    while ((m = re.exec(sanitised)) !== null) {
      const tagStart = m.index + m[0].indexOf(m[1]);
      const tagEnd = tagStart + m[1].length;
      if (offset >= tagStart && offset <= tagEnd) {
        const tag = m[1].toLowerCase();
        if (!tag.includes('-')) return undefined;
        return {
          tag,
          span: { start: startPos + tagStart, length: m[1].length },
        };
      }
    }
    return undefined;
  }

  /**
   * Scan the raw template text for `class="…"` / `class='…'` attributes
   * and return the class name whose span contains `offset`.
   *
   * Only string-literal attribute values are considered; `class=${…}`
   * dynamic expressions are skipped (we can't statically know the
   * concatenated class set).
   *
   * @param {string} raw
   * @param {number} offset
   * @param {number} startPos
   * @returns {{ className: string, span: import('typescript').TextSpan } | undefined}
   */
  function findClassAtOffset(raw, offset, startPos) {
    const sanitised = stripHoles(raw);
    // Match `class="..."` or `class='...'`. The value is captured so we can
    // walk its individual class names.
    const re = /\bclass\s*=\s*(["'])([^"']*)\1/g;
    let m;
    while ((m = re.exec(sanitised)) !== null) {
      const valueStart = m.index + m[0].indexOf(m[2]); // skip `class="`
      const value = m[2];
      if (offset < valueStart || offset > valueStart + value.length) continue;
      // Split the value into whitespace-separated class tokens and find
      // which one the cursor is on.
      let i = 0;
      while (i < value.length) {
        while (i < value.length && /\s/.test(value[i])) i++;
        const tokenStart = i;
        while (i < value.length && !/\s/.test(value[i])) i++;
        const tokenEnd = i;
        if (tokenEnd > tokenStart) {
          const absStart = valueStart + tokenStart;
          const absEnd = valueStart + tokenEnd;
          if (offset >= absStart && offset <= absEnd) {
            const className = value.slice(tokenStart, tokenEnd);
            if (!isValidClassIdent(className)) return undefined;
            return {
              className,
              span: {
                start: startPos + absStart,
                length: className.length,
              },
            };
          }
        }
      }
    }
    return undefined;
  }

  /** @param {string} s */
  function isValidClassIdent(s) {
    return /^[A-Za-z_][\w-]*$/.test(s);
  }

  /**
   * Replace balanced `${...}` blocks with spaces of identical length.
   * Handles nested braces (e.g. ${[{a:1}]}). Does NOT try to parse JS;
   * just tracks brace depth after a `${`.
   *
   * @param {string} raw
   */
  function stripHoles(raw) {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '$' && raw[i + 1] === '{') {
        const start = i;
        i += 2;
        let depth = 1;
        while (i < raw.length && depth > 0) {
          if (raw[i] === '{') depth++;
          else if (raw[i] === '}') depth--;
          if (depth === 0) break;
          i++;
        }
        const len = i - start + 1;
        out += ' '.repeat(len);
        continue;
      }
      out += raw[i];
    }
    return out;
  }

  /* ---------------- program-wide registry ---------------- */

  /**
   * @typedef {{
   *   fileName: string,
   *   className: string,
   *   classNameSpan: import('typescript').TextSpan,
   *   attributes: string[],
   * }} ComponentRef
   *
   * @typedef {{
   *   fileName: string,
   *   span: import('typescript').TextSpan,
   * }} CssClassRef
   */

  /**
   * Build or return cached tag → ComponentRef and class-name → CssClassRef
   * registries for the whole program. Invalidated file-by-file on version
   * change (tsserver bumps this on every edit).
   *
   * @param {import('typescript').Program} program
   * @returns {{ components: Map<string, ComponentRef>, classes: Map<string, CssClassRef[]> }}
   */
  function buildRegistry(program) {
    /** @type {Map<string, ComponentRef>} */
    const components = new Map();
    /** @type {Map<string, CssClassRef[]>} */
    const classes = new Map();

    for (const sf of program.getSourceFiles()) {
      if (sf.fileName.includes('/node_modules/')) continue;
      const version =
        /** @type any */ (sf).version !== undefined
          ? String(/** @type any */ (sf).version)
          : `${sf.getFullStart()}:${sf.getEnd()}`;
      const cached = perFileCache.get(sf.fileName);
      let fileComponents;
      let fileClasses;
      if (cached && cached.version === version) {
        fileComponents = cached.components;
        fileClasses = cached.classes;
      } else {
        fileComponents = extractComponents(sf);
        fileClasses = extractCssClasses(sf);
        perFileCache.set(sf.fileName, {
          version,
          components: fileComponents,
          classes: fileClasses,
        });
      }
      for (const [tag, ref] of fileComponents) {
        if (!components.has(tag)) components.set(tag, ref);
      }
      for (const [name, refs] of fileClasses) {
        const all = classes.get(name) || [];
        for (const r of refs) all.push(r);
        classes.set(name, all);
      }
    }
    return { components, classes };
  }

  /**
   * Extract webjs components from a single source file by scanning for
   * `Class.register('tag')` or `customElements.define('tag', Class)`.
   *
   * @param {import('typescript').SourceFile} sf
   * @returns {Map<string, ComponentRef>}
   */
  function extractComponents(sf) {
    /** @type {Map<string, ComponentRef>} */
    const out = new Map();

    /** @type {Map<string, { span: import('typescript').TextSpan, attrs: string[] }>} */
    const localClasses = new Map();
    function indexClasses(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        localClasses.set(node.name.text, {
          span: {
            start: node.name.getStart(sf),
            length: node.name.getWidth(sf),
          },
          attrs: extractStaticProperties(node),
        });
      }
      ts.forEachChild(node, indexClasses);
    }
    indexClasses(sf);

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const match = readDefineCall(node) || readRegisterCall(node);
        if (match && match.tag.includes('-')) {
          const local = localClasses.get(match.className);
          if (local) {
            out.set(match.tag, {
              fileName: sf.fileName,
              className: match.className,
              classNameSpan: local.span,
              attributes: local.attrs,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    return out;
  }

  /**
   * Read the keys of a class's `static properties = { … }` initializer.
   * webjs maps each key to a reactive property + matching attribute, so
   * the keys are exactly the attribute set we want to suggest.
   *
   * @param {import('typescript').ClassDeclaration} cls
   * @returns {string[]}
   */
  function extractStaticProperties(cls) {
    /** @type {string[]} */
    const out = [];
    for (const member of cls.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      const isStatic = (member.modifiers || []).some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      );
      if (!isStatic) continue;
      if (!member.name || !ts.isIdentifier(member.name) || member.name.text !== 'properties') continue;
      const init = member.initializer;
      if (!init || !ts.isObjectLiteralExpression(init)) continue;
      for (const prop of init.properties) {
        if (!prop.name) continue;
        let key;
        if (ts.isIdentifier(prop.name) || ts.isPrivateIdentifier(prop.name)) key = prop.name.text;
        else if (ts.isStringLiteralLike(prop.name)) key = prop.name.text;
        if (key) out.push(key);
      }
    }
    return out;
  }

  /**
   * Extract CSS class definitions from every `css\`…\`` tagged template in
   * the file. Each occurrence of `.class-name` in the template text is
   * recorded as a potential definition: if the user go-to-definitions on
   * a class name and the plugin finds one or more matches across the
   * program, they are offered as the destination(s).
   *
   * This is a lexical scan; it doesn't parse CSS. Good enough for the
   * common case (scope wrappers, nested rules, hover/focus pseudo-classes).
   *
   * @param {import('typescript').SourceFile} sf
   * @returns {Map<string, CssClassRef[]>}
   */
  function extractCssClasses(sf) {
    /** @type {Map<string, CssClassRef[]>} */
    const out = new Map();

    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && tagMatches(node.tag, 'css')) {
        const src = sf.text;
        const t = node.template;
        const start = t.getStart(sf);
        const end = t.getEnd();
        // Scan the raw literal text (including interpolation markers -
        // they're unlikely to collide with a class-name pattern).
        const body = src.slice(start, end);
        const re = /\.([A-Za-z_][\w-]*)/g;
        let m;
        while ((m = re.exec(body)) !== null) {
          // Skip matches that are part of a decimal number (e.g. `1.5rem`):
          // the character preceding the `.` is a digit.
          const prevIdx = m.index - 1;
          if (prevIdx >= 0 && /[0-9]/.test(body[prevIdx])) continue;
          const name = m[1];
          const absStart = start + m.index + 1; // skip the leading `.`
          const ref = {
            fileName: sf.fileName,
            span: { start: absStart, length: name.length },
          };
          const existing = out.get(name);
          if (existing) existing.push(ref);
          else out.set(name, [ref]);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    return out;
  }

  /**
   * Match `Counter.register('my-counter')` where the LHS identifier is
   * a locally-declared class and the sole argument is a string literal.
   *
   * @param {import('typescript').CallExpression} call
   * @returns {{ tag: string, className: string } | undefined}
   */
  function readRegisterCall(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee)) return undefined;
    if (callee.name.text !== 'register') return undefined;
    if (!ts.isIdentifier(callee.expression)) return undefined;
    const [arg] = call.arguments;
    if (!arg || !ts.isStringLiteralLike(arg)) return undefined;
    return { tag: arg.text, className: callee.expression.text };
  }

  /**
   * Match `customElements.define('tag', ClassIdent)` and return the
   * extracted pair. Handles both `customElements.define(...)` and
   * `window.customElements.define(...)` forms.
   *
   * @param {import('typescript').CallExpression} call
   * @returns {{ tag: string, className: string } | undefined}
   */
  function readDefineCall(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee)) return undefined;
    if (callee.name.text !== 'define') return undefined;

    const obj = callee.expression;
    if (ts.isIdentifier(obj)) {
      if (obj.text !== 'customElements') return undefined;
    } else if (ts.isPropertyAccessExpression(obj)) {
      if (obj.name.text !== 'customElements') return undefined;
    } else {
      return undefined;
    }

    const [tagArg, classArg] = call.arguments;
    if (!tagArg || !classArg) return undefined;
    if (!ts.isStringLiteralLike(tagArg)) return undefined;
    if (!ts.isIdentifier(classArg)) return undefined;

    return { tag: tagArg.text, className: classArg.text };
  }

  /* ================================================================
   * Resolver 4: type-check `<webjs-tag attr=${expr}>` interpolations
   * against the property's declared TypeScript type.
   * ================================================================ */

  /**
   * Walk every html`` template in the file. For each `${expr}` that
   * sits in attribute-value position of a reachable webjs tag, look up
   * the matching `declare attr: T` field on the component class and
   * assignability-check `typeof expr` against `T`. Emit a diagnostic
   * for any mismatch.
   *
   * Static (non-interpolated) attribute values like `mode="login"` are
   * not checked: they're plain template text and at runtime always
   * coerce to strings. Only interpolations carry a real value type
   * worth checking.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @returns {import('typescript').Diagnostic[]}
   */
  function webjsAttrValueDiagnostics(info, fileName) {
    /** @type {import('typescript').Diagnostic[]} */
    const out = [];
    const program = info.languageService.getProgram();
    if (!program) return out;
    const sf = program.getSourceFile(fileName);
    if (!sf) return out;

    const registry = buildRegistry(program);
    if (registry.components.size === 0) return out;
    const reachable = collectReachableTags(program, sf, registry);
    if (reachable.size === 0) return out;

    const checker = program.getTypeChecker();

    /** @param {import('typescript').Node} node */
    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && tagMatches(node.tag, 'html')) {
        collectFromTemplate(node);
      }
      ts.forEachChild(node, visit);
    }

    /** @param {import('typescript').TaggedTemplateExpression} expr */
    function collectFromTemplate(expr) {
      const tpl = expr.template;
      if (ts.isNoSubstitutionTemplateLiteral(tpl)) return;
      // tpl is a TemplateExpression: head + spans[].
      const segments = [tpl.head, ...tpl.templateSpans.map((s) => s.literal)];
      // segments[i].text is the cooked text *between* the (i-1)th hole and
      // the ith hole (segments[0] is the head, before the first hole).
      // Walk text segment-by-segment, tracking which interpolation each
      // hole belongs to.
      // Stitch the cooked text together with placeholders to track tags.
      // Simpler: just inspect the trailing text of each segment that
      // precedes a span: does it look like `<webjs-tag … attr=`?
      for (let i = 0; i < tpl.templateSpans.length; i++) {
        // Text immediately preceding the i-th interpolation.
        const preceding = i === 0 ? tpl.head.text : tpl.templateSpans[i - 1].literal.text;
        // Build the *full* preceding text for this interpolation (head +
        // all earlier segments). We need this so an opening `<` from a
        // previous segment is still visible. Use the cumulative slice
        // ending at segment `i`.
        const cumulative = i === 0
          ? preceding
          : segments.slice(0, i + 1).map((s) => s.text).join('•'); // any non-tag char as placeholder
        const ctx = findAttrContext(cumulative);
        if (!ctx) continue;
        if (!reachable.has(ctx.tag)) continue;
        const ref = registry.components.get(ctx.tag);
        if (!ref) continue;
        // Skip if the attr name doesn't match a known prop.
        if (!ref.attributes.includes(ctx.attr)) continue;

        const propType = resolvePropType(program, ref, ctx.attr, checker);
        if (!propType) continue; // no `declare` annotation → can't check

        const span = tpl.templateSpans[i];
        const exprNode = span.expression;
        const exprType = checker.getTypeAtLocation(exprNode);

        if (checker.isTypeAssignableTo(exprType, propType)) continue;

        out.push({
          file: sf,
          start: exprNode.getStart(sf),
          length: exprNode.getEnd() - exprNode.getStart(sf),
          messageText:
            `Type '${checker.typeToString(exprType)}' is not assignable to ` +
            `attribute '${ctx.attr}' of type '${checker.typeToString(propType)}' on <${ctx.tag}>.`,
          category: ts.DiagnosticCategory.Error,
          code: 9001,
          source: 'webjskit-ts-plugin',
        });
      }
    }

    visit(sf);
    return out;
  }

  /**
   * Inspect the tail of `text` (cumulative html`` segments preceding an
   * interpolation) and return the enclosing tag + attribute name if the
   * interpolation sits in attribute-value position of an open tag.
   *
   * @param {string} text
   * @returns {{ tag: string, attr: string } | undefined}
   */
  function findAttrContext(text) {
    // Find the last unclosed `<`. We want the opener whose `>` hasn't
    // appeared yet.
    let depth = 0;
    let openIdx = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '<') { openIdx = i; depth = 1; }
      else if (text[i] === '>' && depth === 1) { depth = 0; openIdx = -1; }
    }
    if (openIdx === -1) return undefined;
    const tagPart = text.slice(openIdx + 1);
    // First token after `<` is the tag name.
    const tm = /^([a-zA-Z][\w-]*)/.exec(tagPart);
    if (!tm) return undefined;
    const tag = tm[1].toLowerCase();
    if (!tag.includes('-')) return undefined;
    // Trailing pattern: ` attrName=` optionally followed by an open quote.
    const am = /\s+([A-Za-z_][\w-]*)\s*=\s*['"`]?$/.exec(tagPart);
    if (!am) return undefined;
    return { tag, attr: am[1] };
  }

  /**
   * Resolve the declared type of `attr` on the given component class.
   * Looks for a class member with that name and a TypeNode annotation
   * (typically a `declare attr: T` field). Returns undefined if no
   * annotation is present: the user hasn't told us the type, so we
   * can't check it.
   *
   * @param {import('typescript').Program} program
   * @param {ComponentRef} ref
   * @param {string} attrName
   * @param {import('typescript').TypeChecker} checker
   * @returns {import('typescript').Type | undefined}
   */
  function resolvePropType(program, ref, attrName, checker) {
    const compSf = program.getSourceFile(ref.fileName);
    if (!compSf) return undefined;
    const cls = findClassDeclaration(compSf, ref.className);
    if (!cls) return undefined;
    for (const member of cls.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      if (!member.name) continue;
      let memberName;
      if (ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name)) {
        memberName = member.name.text;
      } else if (ts.isStringLiteralLike(member.name)) {
        memberName = member.name.text;
      }
      if (memberName !== attrName) continue;
      if (!member.type) return undefined;
      return checker.getTypeFromTypeNode(member.type);
    }
    return undefined;
  }

  /**
   * Locate `class <name> { … }` inside a source file. Returns the
   * ClassDeclaration node, or undefined if not found.
   *
   * @param {import('typescript').SourceFile} sf
   * @param {string} className
   * @returns {import('typescript').ClassDeclaration | undefined}
   */
  function findClassDeclaration(sf, className) {
    /** @type {import('typescript').ClassDeclaration | undefined} */
    let found;
    function walk(node) {
      if (found) return;
      if (ts.isClassDeclaration(node) && node.name && node.name.text === className) {
        found = /** @type any */ (node);
        return;
      }
      ts.forEachChild(node, walk);
    }
    walk(sf);
    return found;
  }
}

module.exports = init;
