; webjs in-template highlighting (Phase 4 of #381).
;
; `extends` ADDS these injections to nvim-treesitter's built-in TypeScript
; injections rather than replacing them, so nothing already configured is lost.
;
; A webjs tagged template parses as
;   (call_expression (identifier) (template_string))
; The captured tag name IS the injected language: `html` -> html, `css` -> css,
; `svg` -> svg. `${...}` substitutions inside the template are NOT included in
; the injected range, so they keep their TypeScript highlighting.
; extends

; html`…` / css`… ` / svg`…`  (bare tag)
((call_expression
   function: (identifier) @injection.language
   arguments: (template_string) @injection.content)
 (#any-of? @injection.language "html" "css" "svg"))

; this.html`…` / x.css`…`  (member tag, e.g. `static styles = css\`\``)
((call_expression
   function: (member_expression
     property: (property_identifier) @injection.language)
   arguments: (template_string) @injection.content)
 (#any-of? @injection.language "html" "css" "svg"))
