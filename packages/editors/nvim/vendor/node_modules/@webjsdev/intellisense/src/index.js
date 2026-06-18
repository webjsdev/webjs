/**
 * @webjsdev/intellisense: a standalone TypeScript language-service plugin that
 * gives editors webjs-aware intelligence inside `html\`\`` templates, with NO
 * Lit dependency (the bundled `vscode-lit` / `ts-lit-plugin` reliance was
 * removed in Phase 3, #386). It provides, all driven by its own template
 * parser (`./template/parse.js`) and gated on import-graph reachability:
 *
 *   - go-to-definition on custom-element tags, attribute / property / event
 *     names, and CSS class names in `class="…"`;
 *   - binding-aware completions (tag names, `.prop` / `?bool` / plain attrs);
 *   - in-template diagnostics (incompatible bindings, unquoted bindings,
 *     expressionless `.prop`);
 *   - hover.
 *
 * The registration scan is keyed by each SourceFile's version so subsequent
 * lookups are cheap and invalidate incrementally on edits.
 */

'use strict';

/* eslint-disable no-restricted-syntax */

const tpl = require('./template/parse.js');

/**
 * TypeScript Language Service plugin factory.
 *
 * @param {{ typescript: typeof import('typescript') }} modules
 */
function init(modules) {
  const ts = modules.typescript;

  /** @type {Map<string, { version: string, components: Map<string, ComponentRef>, classes: Map<string, CssClassRef[]> }>} */
  const perFileCache = new Map();

  /** @type {Map<string, { version: string, sites: Array<{ tag: string, start: number, length: number }> }>} */
  const regSitesCache = new Map();

  return { create };

  /**
   * Decorate the host language service with webjs's in-template intelligence.
   * The plugin is fully self-contained: it provides its own parser-driven
   * completions, diagnostics, definitions, and hover, with NO dependency on
   * `ts-lit-plugin` (removed in Phase 3, #386). `inner` is the stock tsserver
   * language service; we override only the methods we extend and fall back to
   * it on any error.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   */
  function create(info) {
    const proxy = Object.create(null);
    const inner = info.languageService;
    for (const k of Object.keys(inner)) {
      proxy[k] = /** @type any */ (inner[/** @type any */ (k)]).bind(inner);
    }

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      // Try the stock tsserver answer first (it resolves JSDoc-tagged
      // elements, HTMLElementTagNameMap-augmented tags, and expressions in
      // `${}` holes); only fall through to our resolvers when it has none.
      const upstream = inner.getDefinitionAndBoundSpan(fileName, position);
      if (upstream && upstream.definitions && upstream.definitions.length > 0) {
        return upstream;
      }
      try {
        return (
          webjsTagDefinition(info, fileName, position) ||
          webjsAttrDefinition(info, fileName, position) ||
          webjsCssClassDefinition(info, fileName, position) ||
          upstream
        );
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/intellisense: getDefinitionAndBoundSpan threw: ${String(e)}`,
        );
        return upstream;
      }
    };

    // Hover inside an html`` template: a custom-element tag shows its class,
    // an attribute/property/event shows its declared type. Outside template
    // markup (e.g. inside a `${}` hole) we defer to upstream/tsserver.
    proxy.getQuickInfoAtPosition = (fileName, position) => {
      const upstream = inner.getQuickInfoAtPosition(fileName, position);
      try {
        return webjsTemplateQuickInfo(info, fileName, position) || upstream;
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/intellisense: getQuickInfoAtPosition threw: ${String(e)}`,
        );
        return upstream;
      }
    };

    // Append webjs's in-template diagnostics (incompatible bindings, unquoted
    // bindings, expressionless `.prop`) plus the duplicate-tag check (9004) to
    // the stock semantic diagnostics. Each source has its own try/catch so a
    // throw in one never suppresses the other or the upstream diagnostics
    // (invariant 3: the plugin must never break the editor).
    proxy.getSemanticDiagnostics = (fileName) => {
      const diags = inner.getSemanticDiagnostics(fileName);
      /** @type {import('typescript').Diagnostic[]} */
      let extra = [];
      try {
        extra = extra.concat(webjsAttrValueDiagnostics(info, fileName));
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/intellisense: getSemanticDiagnostics (attr) threw: ${String(e)}`,
        );
      }
      try {
        extra = extra.concat(webjsDuplicateTagDiagnostics(info, fileName));
      } catch (e) {
        info.project.projectService.logger?.info?.(
          `@webjsdev/intellisense: getSemanticDiagnostics (dup-tag) threw: ${String(e)}`,
        );
      }
      return extra.length ? [...diags, ...extra] : diags;
    };

    // Attribute-name auto-complete inside `<webjs-tag |…>` openers, driven by
    // the component class's `static properties` map (see webjsAttrCompletions).
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
          `@webjsdev/intellisense: getCompletionsAtPosition threw: ${String(e)}`,
        );
        return upstream;
      }
    };

    return proxy;
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

    // Must be inside an html`` template.
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;
    const doc = tpl.parseTemplate(ts, templateExpr);
    if (!doc) return undefined;

    const registry = buildRegistry(program);
    if (registry.components.size === 0) return undefined;
    const reachable = collectReachableTags(program, source, registry);

    const ctx = completionContext(doc, position);
    if (!ctx) return undefined;

    // Element-name completions after `<` / `</`: offer reachable custom tags.
    if (ctx.kind === 'tag') {
      const entries = [];
      for (const tag of reachable) {
        const ref = registry.components.get(tag);
        if (!ref) continue;
        entries.push({
          name: tag,
          kind: /** @type any */ (ts.ScriptElementKind).classElement,
          kindModifiers: '',
          sortText: '0',
          labelDetails: { description: ref.className },
        });
      }
      return entries.length ? entries : undefined;
    }

    // Attribute / binding completions inside an open custom-element tag.
    const tag = ctx.node.tag;
    if (!tag.includes('-')) return undefined;
    const ref = registry.components.get(tag);
    if (!ref) return undefined;
    if (!reachable.has(tag)) return undefined;

    const desc = `<${tag}>`;
    const mk = (name, kindKey) => ({
      name,
      kind: /** @type any */ (ts.ScriptElementKind)[kindKey],
      kindModifiers: '',
      sortText: '0',
      labelDetails: { description: desc },
    });

    // `.prop` -> property names; `?bool`/plain -> attribute names; `@event`
    // is permissive (webjs has no declared event source) so we offer nothing
    // rather than guess.
    if (ctx.prefix === 'property') {
      return ref.properties.map((p) => mk(p, 'memberVariableElement'));
    }
    if (ctx.prefix === 'event') return undefined;
    // plain or `?bool`: attribute names (non-state props).
    return ref.attributes.map((a) => mk(a, 'memberVariableElement'));
  }

  /**
   * Classify the completion context at `position` inside a parsed template.
   *
   * @param {import('./template/parse.js').TemplateDocument} doc
   * @param {number} position   Absolute source offset.
   * @returns {{ kind: 'tag' } | { kind: 'attr', node: any, prefix: 'none'|'event'|'property'|'boolean' } | undefined}
   */
  function completionContext(doc, position) {
    const rel = position - doc.startPos;
    if (rel < 0 || rel > doc.masked.length) return undefined;
    const m = doc.masked;

    // Walk back over the partial word currently being typed.
    let w = rel;
    while (w > 0 && /[A-Za-z0-9_\-:.@?]/.test(m[w - 1])) w--;
    const before = m[w - 1];
    // Tag-name context: the partial is preceded by `<` or `</`.
    if (before === '<' || (m[w - 1] === '/' && m[w - 2] === '<')) {
      return { kind: 'tag' };
    }

    // Attribute context: cursor sits in an open tag's attribute area, not in
    // a value. Find the node whose open-tag region contains `position`.
    for (let idx = 0; idx < doc.nodes.length; idx++) {
      const node = doc.nodes[idx];
      const openEnd = node.openEnd ?? (doc.nodes[idx + 1]?.openStart ?? doc.startPos + doc.masked.length);
      const tagNameEnd = node.tagSpan.start + node.tagSpan.length;
      if (position <= tagNameEnd) continue; // in/Before the tag name itself.
      if (position < node.openStart || position > openEnd) continue;
      // Inside a quoted attribute value? Then it's not name-completion.
      const inValue = node.attrs.some(
        (a) => a.valueSpan && position >= a.valueSpan.start && position <= a.valueSpan.start + a.valueSpan.length,
      );
      if (inValue) return undefined;
      // Determine the binding prefix of the partial word.
      const first = m[w];
      const prefix = first === '@' ? 'event' : first === '.' ? 'property' : first === '?' ? 'boolean' : 'none';
      return { kind: 'attr', node, prefix };
    }
    return undefined;
  }

  /* ================================================================
   * Resolver: attribute / property / event name → class member
   * ================================================================ */

  /**
   * The `{ tag, attr, ref, member }` for an attribute name under the cursor
   * inside a reachable webjs tag, or undefined.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   */
  function attrUnderCursor(info, fileName, position) {
    const program = info.languageService.getProgram();
    if (!program) return undefined;
    const source = program.getSourceFile(fileName);
    if (!source) return undefined;
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;
    const doc = tpl.parseTemplate(ts, templateExpr);
    if (!doc) return undefined;
    const hit = tpl.attrNameAtOffset(doc, position);
    if (!hit || !hit.node.isCustom) return undefined;

    const registry = buildRegistry(program);
    const ref = registry.components.get(hit.node.tag);
    if (!ref) return undefined;
    const reachable = collectReachableTags(program, source, registry);
    if (!reachable.has(hit.node.tag)) return undefined;

    const member =
      hit.attr.modifier === 'property'
        ? ref.members.find((mm) => mm.propName === hit.attr.name)
        : ref.members.find((mm) => mm.attrName === hit.attr.name);
    return { tag: hit.node.tag, attr: hit.attr, ref, member, program };
  }

  /**
   * Go-to-definition on an attribute / property / event name: resolve to the
   * class member (the `declare` field or the `static properties` key).
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   * @returns {import('typescript').DefinitionInfoAndBoundSpan | undefined}
   */
  function webjsAttrDefinition(info, fileName, position) {
    const hit = attrUnderCursor(info, fileName, position);
    if (!hit || !hit.member) return undefined;
    const target = findMemberNameSpan(hit.program, hit.ref, hit.member.propName);
    if (!target) return undefined;
    return {
      textSpan: hit.attr.nameSpan,
      definitions: [
        {
          fileName: target.fileName,
          textSpan: target.span,
          kind: /** @type any */ (ts.ScriptElementKind).memberVariableElement,
          name: hit.member.propName,
          containerKind: /** @type any */ (ts.ScriptElementKind).classElement,
          containerName: hit.ref.className,
        },
      ],
    };
  }

  /**
   * Hover for a custom-element tag (its class) or an attribute / property /
   * event (its declared type), inside an html`` template.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @param {number} position
   * @returns {import('typescript').QuickInfo | undefined}
   */
  function webjsTemplateQuickInfo(info, fileName, position) {
    const program = info.languageService.getProgram();
    if (!program) return undefined;
    const source = program.getSourceFile(fileName);
    if (!source) return undefined;
    const templateExpr = findEnclosingTaggedTemplate(source, position, 'html');
    if (!templateExpr) return undefined;
    const doc = tpl.parseTemplate(ts, templateExpr);
    if (!doc) return undefined;

    const registry = buildRegistry(program);
    const reachable = collectReachableTags(program, source, registry);
    const parts = (text) => [{ text, kind: 'text' }];

    // Tag hover.
    const tagHit = tpl.tagNameAtOffset(doc, position);
    if (tagHit && tagHit.isCustom && reachable.has(tagHit.tag)) {
      const ref = registry.components.get(tagHit.tag);
      if (ref) {
        return {
          kind: /** @type any */ (ts.ScriptElementKind).classElement,
          kindModifiers: '',
          textSpan: tagHit.tagSpan,
          displayParts: parts(`(webjs component) <${tagHit.tag}> → ${ref.className}`),
          documentation: [],
        };
      }
    }

    // Attribute / property / event hover.
    const hit = attrUnderCursor(info, fileName, position);
    if (hit && hit.member) {
      const kindWord =
        hit.attr.modifier === 'event' ? 'event' : hit.attr.modifier === 'property' ? 'property' : 'attribute';
      const checker = program.getTypeChecker();
      const t = resolvePropType(hit.program, hit.ref, hit.member.propName, checker);
      const typeStr = t ? `: ${checker.typeToString(t)}` : '';
      const shown = hit.attr.modifier === 'property' ? hit.member.propName : hit.member.attrName;
      return {
        kind: /** @type any */ (ts.ScriptElementKind).memberVariableElement,
        kindModifiers: '',
        textSpan: hit.attr.nameSpan,
        displayParts: parts(`(${kindWord}) ${shown}${typeStr} on <${hit.tag}>`),
        documentation: [],
      };
    }
    return undefined;
  }

  /**
   * The source location of a class member's name (the `declare propName`
   * field if present, else the `static properties` key), for go-to-definition.
   *
   * @param {import('typescript').Program} program
   * @param {ComponentRef} ref
   * @param {string} propName
   * @returns {{ fileName: string, span: import('typescript').TextSpan } | undefined}
   */
  function findMemberNameSpan(program, ref, propName) {
    const compSf = program.getSourceFile(ref.fileName);
    if (!compSf) return undefined;
    const cls = findClassDeclaration(compSf, ref.className);
    if (!cls) return undefined;
    // Prefer the typed `declare propName: T` field.
    for (const member of cls.members) {
      if (!ts.isPropertyDeclaration(member) || !member.name) continue;
      const isStatic = (member.modifiers || []).some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword);
      if (isStatic) continue;
      const nm =
        ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name) ? member.name.text : undefined;
      if (nm === propName) {
        return {
          fileName: ref.fileName,
          span: { start: member.name.getStart(compSf), length: member.name.getWidth(compSf) },
        };
      }
    }
    // Fall back to the `static properties` key.
    for (const member of cls.members) {
      if (!ts.isPropertyDeclaration(member) || !member.name) continue;
      if (!ts.isIdentifier(member.name) || member.name.text !== 'properties') continue;
      const init = member.initializer;
      if (!init || !ts.isObjectLiteralExpression(init)) continue;
      for (const prop of init.properties) {
        if (!prop.name) continue;
        const nm =
          ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) ? prop.name.text : undefined;
        if (nm === propName) {
          return {
            fileName: ref.fileName,
            span: { start: prop.name.getStart(compSf), length: prop.name.getWidth(compSf) },
          };
        }
      }
    }
    return undefined;
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
   *   propName: string,
   *   attrName: string,
   *   state: boolean,
   * }} PropMember
   *   One reactive property. `propName` is the `static properties` key (the
   *   `.prop` binding name, camelCase); `attrName` is its hyphenated HTML
   *   attribute name (the plain / `?bool` binding name); `state: true` means
   *   it has NO attribute (excluded from `observedAttributes`).
   *
   * @typedef {{
   *   fileName: string,
   *   className: string,
   *   classNameSpan: import('typescript').TextSpan,
   *   attributes: string[],
   *   properties: string[],
   *   members: PropMember[],
   * }} ComponentRef
   *   `attributes` = hyphenated attribute names of non-state props (plain /
   *   `?bool` binding targets). `properties` = property names of ALL props
   *   (`.prop` binding targets). `members` = the full records.
   *
   * @typedef {{
   *   fileName: string,
   *   span: import('typescript').TextSpan,
   * }} CssClassRef
   */

  /** Mirror of `@webjsdev/core`'s property -> attribute naming. */
  function hyphenate(s) {
    return s.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

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

    /** @type {Map<string, { span: import('typescript').TextSpan, members: PropMember[] }>} */
    const localClasses = new Map();
    function indexClasses(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        localClasses.set(node.name.text, {
          span: {
            start: node.name.getStart(sf),
            length: node.name.getWidth(sf),
          },
          members: extractStaticProperties(node),
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
              attributes: local.members.filter((m) => !m.state).map((m) => m.attrName),
              properties: local.members.map((m) => m.propName),
              members: local.members,
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
   * Read a class's `static properties = { … }` initializer into per-member
   * records. webjs maps each key to a reactive property (the `.prop` binding
   * name) plus, unless `state: true`, a hyphenated HTML attribute (the plain
   * and `?bool` binding name).
   *
   * @param {import('typescript').ClassDeclaration} cls
   * @returns {PropMember[]}
   */
  function extractStaticProperties(cls) {
    /** @type {PropMember[]} */
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
        if (!key) continue;
        out.push({ propName: key, attrName: hyphenate(key), state: propIsState(prop) });
      }
    }
    if (cls.heritageClauses) {
      for (const clause of cls.heritageClauses) {
        if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
        for (const typeNode of clause.types) {
          const expr = typeNode.expression;
          if (ts.isCallExpression(expr)) {
            const caller = expr.expression;
            if (ts.isIdentifier(caller) && caller.text === 'WebComponent') {
              const arg = expr.arguments[0];
              if (arg && ts.isObjectLiteralExpression(arg)) {
                for (const prop of arg.properties) {
                  if (!prop.name) continue;
                  let key;
                  if (ts.isIdentifier(prop.name) || ts.isPrivateIdentifier(prop.name)) key = prop.name.text;
                  else if (ts.isStringLiteralLike(prop.name)) key = prop.name.text;
                  if (!key) continue;
                  out.push({ propName: key, attrName: hyphenate(key), state: propIsState(prop) });
                }
              }
            }
          }
        }
      }
    }
    return out;
  }

  /**
   * Does a `static properties` entry opt into internal-state mode
   * (`{ state: true }`)? Such props have no HTML attribute.
   *
   * @param {import('typescript').ObjectLiteralElementLike} prop
   * @returns {boolean}
   */
  function propIsState(prop) {
    if (!ts.isPropertyAssignment(prop)) return false;
    let v = prop.initializer;
    if (!v) return false;
    if (ts.isCallExpression(v)) {
      const caller = v.expression;
      if (ts.isIdentifier(caller) && caller.text === 'prop') {
        const args = v.arguments;
        if (args.length === 1 && ts.isObjectLiteralExpression(args[0])) {
          v = args[0];
        } else if (args.length === 2 && ts.isObjectLiteralExpression(args[1])) {
          v = args[1];
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    if (!ts.isObjectLiteralExpression(v)) return false;
    for (const o of v.properties) {
      if (!ts.isPropertyAssignment(o) || !o.name) continue;
      const n = ts.isIdentifier(o.name) || ts.isStringLiteralLike(o.name) ? o.name.text : '';
      if (n === 'state' && o.initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
    }
    return false;
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
   * Resolver 3b: flag a custom-element tag registered more than once
   * across the program (code 9004). SSR overwrites the registry (the
   * LAST `register` / `define` wins) while the browser keeps the FIRST
   * native upgrade, so a duplicate tag resolves inconsistently at
   * runtime. The check rule `no-duplicate-tag` is the CI gate; this is
   * the live in-editor underline on the offending tag literal.
   * ================================================================ */

  /**
   * Return the tag-name string-literal argument node of a
   * `Class.register('tag')` or `customElements.define('tag', Class)` call,
   * or undefined when the call is neither. Unlike `readRegisterCall` /
   * `readDefineCall`, it returns the LITERAL NODE (so the caller has its
   * source span) and does not require the class identifier to resolve
   * locally, since a collision is real regardless of where the class lives.
   *
   * @param {import('typescript').CallExpression} call
   * @returns {import('typescript').StringLiteralLike | undefined}
   */
  function registrationTagArg(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee)) return undefined;
    const name = callee.name.text;
    if (name === 'register') {
      if (!ts.isIdentifier(callee.expression)) return undefined;
      const [arg] = call.arguments;
      if (arg && ts.isStringLiteralLike(arg)) return arg;
      return undefined;
    }
    if (name === 'define') {
      const obj = callee.expression;
      const isCustomElements =
        (ts.isIdentifier(obj) && obj.text === 'customElements') ||
        (ts.isPropertyAccessExpression(obj) && obj.name.text === 'customElements');
      if (!isCustomElements) return undefined;
      const [tagArg] = call.arguments;
      if (tagArg && ts.isStringLiteralLike(tagArg)) return tagArg;
      return undefined;
    }
    return undefined;
  }

  /**
   * Collect every custom-element tag registration across the program, keyed
   * by tag name, each carrying the source location of its tag string literal.
   * Program-wide and NOT import-graph gated: two registrations of the same
   * tag are a runtime hazard whether or not the files import each other.
   *
   * @param {import('typescript').Program} program
   * @returns {Map<string, Array<{ fileName: string, start: number, length: number }>>}
   */
  function collectAllRegistrations(program) {
    /** @type {Map<string, Array<{ fileName: string, start: number, length: number }>>} */
    const sites = new Map();
    for (const sf of program.getSourceFiles()) {
      if (sf.fileName.includes('/node_modules/')) continue;
      for (const s of registrationSitesFor(sf)) {
        const arr = sites.get(s.tag) || [];
        arr.push({ fileName: sf.fileName, start: s.start, length: s.length });
        sites.set(s.tag, arr);
      }
    }
    return sites;
  }

  /**
   * The hyphenated-tag registration sites in ONE source file, memoized by the
   * file's tsserver version so the whole-program scan on each keystroke is not
   * a fresh AST walk of every unchanged file.
   *
   * @param {import('typescript').SourceFile} sf
   * @returns {Array<{ tag: string, start: number, length: number }>}
   */
  function registrationSitesFor(sf) {
    const version =
      /** @type any */ (sf).version !== undefined
        ? String(/** @type any */ (sf).version)
        : `${sf.getFullStart()}:${sf.getEnd()}`;
    const cached = regSitesCache.get(sf.fileName);
    if (cached && cached.version === version) return cached.sites;

    /** @type {Array<{ tag: string, start: number, length: number }>} */
    const sites = [];
    /** @param {import('typescript').Node} node */
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const arg = registrationTagArg(node);
        if (arg && arg.text.includes('-')) {
          sites.push({ tag: arg.text, start: arg.getStart(sf), length: arg.getWidth(sf) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    regSitesCache.set(sf.fileName, { version, sites });
    return sites;
  }

  /**
   * Flag every custom-element tag in THIS file that is also registered
   * elsewhere in the program (code 9004). The underline lands on the tag's
   * string literal. Independent of `webjsAttrValueDiagnostics` (its own
   * try/catch in the decorator) and NOT gated on the import graph.
   *
   * @param {import('typescript/lib/tsserverlibrary').server.PluginCreateInfo} info
   * @param {string} fileName
   * @returns {import('typescript').Diagnostic[]}
   */
  function webjsDuplicateTagDiagnostics(info, fileName) {
    /** @type {import('typescript').Diagnostic[]} */
    const out = [];
    const program = info.languageService.getProgram();
    if (!program) return out;
    const sf = program.getSourceFile(fileName);
    if (!sf) return out;

    const sites = collectAllRegistrations(program);
    const basename = (f) => f.slice(f.lastIndexOf('/') + 1);

    for (const [tag, all] of sites) {
      if (all.length < 2) continue;
      const here = all.filter((s) => s.fileName === fileName);
      if (here.length === 0) continue;
      const others = [...new Set(all.map((s) => s.fileName))].filter((f) => f !== fileName);
      const where = others.length
        ? `also registered in ${others.map(basename).join(', ')}`
        : 'registered more than once in this file';
      for (const s of here) {
        out.push({
          file: sf,
          start: s.start,
          length: s.length,
          messageText:
            `Custom element tag "${tag}" is registered more than once (${where}). ` +
            'A tag must be registered exactly once; the runtime resolves a duplicate ' +
            'inconsistently (SSR keeps the last registration, the browser keeps the ' +
            'first). Rename one registration.',
          category: ts.DiagnosticCategory.Error,
          code: 9004,
          source: 'webjsdev-intellisense',
        });
      }
    }
    return out;
  }

  /* ================================================================
   * Resolver 4: type-check `<webjs-tag attr=${expr}>` interpolations
   * against the property's declared TypeScript type.
   * ================================================================ */

  /**
   * Walk every html`` template in the file and run the webjs in-template
   * diagnostic rules over the parsed AST of each reachable webjs tag. Rules
   * (all zero-false-positive by design, since webjs has no element type map
   * to safely flag unknown tags/attributes against):
   *
   *  - **incompatible-type-binding** (code 9001): an interpolated value whose
   *    type is not assignable to the member's `declare`d type. Covers plain
   *    attributes, `.prop` bindings, and `?bool` (must be boolean-ish);
   *    `@event` must be callable.
   *  - **unquoted-binding** (code 9002, invariant 4): an `@event` / `.prop` /
   *    `?bool` binding whose value is quoted (`@click="${fn}"`). The hole is
   *    dropped at SSR; it must be unquoted.
   *  - **expressionless-property-binding** (code 9003): a `.prop` binding with
   *    no `${}` expression (`.value="x"` sets the property to a literal string,
   *    almost always a mistake).
   *
   * Static (non-interpolated) plain attribute values are never checked.
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

    const push = (start, length, messageText, code) =>
      out.push({
        file: sf,
        start,
        length,
        messageText,
        category: ts.DiagnosticCategory.Error,
        code,
        source: 'webjsdev-intellisense',
      });

    /** @param {import('typescript').Node} node */
    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && tagMatches(node.tag, 'html')) {
        const doc = tpl.parseTemplate(ts, node);
        if (doc) for (const el of doc.nodes) checkNode(doc, el);
      }
      ts.forEachChild(node, visit);
    }

    /**
     * @param {import('./template/parse.js').TemplateDocument} doc
     * @param {any} el
     */
    function checkNode(doc, el) {
      if (!el.isCustom) return;
      if (!reachable.has(el.tag)) return;
      const ref = registry.components.get(el.tag);
      if (!ref) return;

      for (const attr of el.attrs) {
        const bound = attr.modifier !== 'none';
        const hasHole = attr.holeIndex != null;

        // Rule: unquoted-binding (invariant 4).
        if (bound && attr.quoted && (attr.valueKind === 'expression' || attr.valueKind === 'mixed')) {
          const prefix = attr.modifier === 'event' ? '@' : attr.modifier === 'property' ? '.' : '?';
          push(
            attr.nameSpan.start,
            attr.nameSpan.length,
            `The ${prefix}${attr.name} binding on <${el.tag}> must be unquoted ` +
              `(write ${prefix}${attr.name}=\${…}, not quoted). The expression is dropped at SSR otherwise.`,
            9002,
          );
          continue;
        }

        // Rule: expressionless-property-binding.
        if (attr.modifier === 'property' && !hasHole) {
          push(
            attr.nameSpan.start,
            attr.nameSpan.length,
            `The .${attr.name} property binding on <${el.tag}> expects an expression ` +
              `(.${attr.name}=\${value}).`,
            9003,
          );
          continue;
        }

        // Rule: incompatible-type-binding (needs a sole-hole value).
        if (!hasHole) continue;
        const hole = doc.holes[attr.holeIndex];
        if (!hole || !hole.expression) continue;
        const exprType = checker.getTypeAtLocation(hole.expression);
        const exprStart = hole.expression.getStart(sf);
        const exprLen = hole.expression.getEnd() - exprStart;

        if (attr.modifier === 'event') {
          // Event handlers must be callable.
          if (exprType.getCallSignatures().length === 0 && !isAnyOrUnknown(exprType)) {
            push(
              exprStart,
              exprLen,
              `The @${attr.name} handler on <${el.tag}> is '${checker.typeToString(exprType)}', ` +
                `which is not callable.`,
              9001,
            );
          }
          continue;
        }

        // Plain / `.prop` / `?bool`: assignability against the declared type.
        const member =
          attr.modifier === 'property'
            ? ref.members.find((m) => m.propName === attr.name)
            : ref.members.find((m) => m.attrName === attr.name);
        if (!member) continue;
        const propType = resolvePropType(program, ref, member.propName, checker);
        if (!propType) continue; // no `declare` annotation → can't check
        if (checker.isTypeAssignableTo(exprType, propType)) continue;

        const label = attr.modifier === 'property' ? `property '${member.propName}'` : `attribute '${member.attrName}'`;
        push(
          exprStart,
          exprLen,
          `Type '${checker.typeToString(exprType)}' is not assignable to ` +
            `${label} of type '${checker.typeToString(propType)}' on <${el.tag}>.`,
          9001,
        );
      }
    }

    visit(sf);
    return out;
  }

  /** Is `t` the `any` or `unknown` type (so assignability checks are moot)? */
  function isAnyOrUnknown(t) {
    return (t.flags & ts.TypeFlags.Any) !== 0 || (t.flags & ts.TypeFlags.Unknown) !== 0;
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
