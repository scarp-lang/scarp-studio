# Compiler-owned navigation reports

Inspect Symbols and Inspect References are explicit static project actions for
the published Scarp 0.0.7-alpha.3 compiler. They require a selected manifest
and clean saved project buffers. The native backend uses fixed arguments, its
existing timeout and output bounds, and a separate structured response field.

Studio validates the requested schema, bounds, dense identities, owner links,
reference targets, acyclic ownership, and coordinate encodings before showing
a report. Filters use exact native IDs rather than matching names. A symbols
report does not imply zero references. Raw output remains available if the
structured report is missing, malformed or too large.

These reports are historical and read-only. The compiler does not return
content identities for all imported files, and its byte offsets/scalar columns
are not Monaco offsets. Consequently Studio never opens a returned path,
navigates an editor or applies edits from this report. Rerun inspection after
changing source or project selection. This is not a language server.


## Published compiler qualification

The Windows compatibility workflow now also pins the published alpha.3
archive digest and runs the existing native service integration and QA
fixture checks. A disposable project exercises the real inspection JSON
through the same TypeScript parser used by Studio, including import alias
identity, same-spelling shadowed bindings, named arguments, public
functions, implicit builtins, Unicode comments, CRLF and byte spans.
Invalid graphs must emit diagnostics with no partial inventory. This is
compiler and wire-format evidence, not native GUI acceptance.


## Historical inspection overview

The overview groups definitions by file and classifies each observed reference
as local, cross-file, or implicit-target according to the target definition's
actual source location. Cross-file edges count occurrences and distinct
compiler symbol IDs separately. This does not infer a call graph, dependency
completeness or unused-code findings. A definitions-only report has unknown
reference counts, not zero. Ownership follows explicit compiler owner IDs;
the tree is not a reconstructed scope tree. All views are bounded/paginated.
The optional read-only summary defaults to IDs and counts, excluding paths
and names. Including labels is explicit and may expose private filenames.
