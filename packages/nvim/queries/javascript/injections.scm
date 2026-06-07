; webjs in-template highlighting for JavaScript (Phase 4 of #381).
; Same as the TypeScript query: a webjs `html` / `css` / `svg` tagged template
; injects the matching language; `${...}` substitutions keep JS highlighting.
; See queries/typescript/injections.scm for the full notes.
; extends

((call_expression
   function: (identifier) @injection.language
   arguments: (template_string) @injection.content)
 (#any-of? @injection.language "html" "css" "svg"))

((call_expression
   function: (member_expression
     property: (property_identifier) @injection.language)
   arguments: (template_string) @injection.content)
 (#any-of? @injection.language "html" "css" "svg"))
