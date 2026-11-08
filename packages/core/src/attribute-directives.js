import { nothing } from './sentinels.js';

/** Map class names to whether each should be present. @param {Record<string, unknown>} classes */
export function classMap(classes) { return { _$webjs: 'class-map', value: classes }; }
/** Map CSS property names to their values. @param {Record<string, string | number | null | undefined>} styles */
export function styleMap(styles) { return { _$webjs: 'style-map', value: styles }; }
/** Remove an attribute when its value is nullish. @template T @param {T} value */
export function ifDefined(value) { return value ?? nothing; }

export function isAttributeMap(value) {
  return value && (value._$webjs === 'class-map' || value._$webjs === 'style-map');
}
export function cssName(name) { return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()); }
export function attributeMapText(value, name) {
  const classes = value._$webjs === 'class-map';
  if (name !== (classes ? 'class' : 'style')) throw new Error('classMap/styleMap must be used in a class/style attribute.');
  // Lit deliberately pads even an empty map to separate adjacent static classes.
  return classes
    ? ' ' + Object.keys(value.value).filter((key) => value.value[key]).join(' ') + ' '
    : Object.entries(value.value).filter(([, v]) => v != null).map(([key, v]) => `${cssName(key)}:${v};`).join('');
}

/** Commit only the map-owned tokens, preserving static and externally added values. */
export function applyAttributeMap(part, value) {
  if (part.kind !== 'attr' && part.kind !== 'attr-mixed') throw new Error('classMap/styleMap require an attribute binding.');
  const classes = value._$webjs === 'class-map';
  if (part.name !== (classes ? 'class' : 'style')) throw new Error('classMap/styleMap must be used in a class/style attribute.');
  if (part.group && part.group.length !== 1) throw new Error('classMap/styleMap require a single expression.');
  if (part.__mapKind !== value._$webjs) {
    part.el.setAttribute(part.name, (part.statics || []).join(classes ? ' ' : ''));
    part.__mapKind = value._$webjs;
    part.__mapKeys = new Set();
    part.__staticClasses = classes ? new Set(part.el.classList) : new Set();
  }
  const next = new Set();
  for (const [key, v] of Object.entries(value.value)) {
    if (classes) {
      if (v && !part.__staticClasses.has(key)) { part.el.classList.add(key); next.add(key); }
    } else if (v != null) {
      const name = cssName(key); const text = String(v);
      part.el.style.setProperty(name, text.replace(/\s*!important\s*$/, ''), /!important\s*$/.test(text) ? 'important' : '');
      next.add(name);
    }
  }
  for (const key of part.__mapKeys) if (!next.has(key)) {
    if (classes) part.el.classList.remove(key); else part.el.style.removeProperty(key);
  }
  part.__mapKeys = next;
}
