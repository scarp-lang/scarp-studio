# Scarp v0.0.7-alpha.3 compatibility

Studio's editor lexical index recognizes ordinary escaped strings, raw single-line strings
and triple-quoted multiline strings from the published compiler. The index is not a
compiler lexer: it does not decode escapes or validate program semantics.

- Raw literals begin with `r"` and end at the next quote. A backslash is literal text.
- Multiline literals begin and end with three quotes. Newlines, isolated quotes,
  comment-looking text and delimiters inside them are payload, not code.
- Identifier editing, source-quality cleanup, references, dependency inspection,
  outlines and signature assistance must not reinterpret payload as executable syntax.
- Hover and completion use bounded model-prefix context on continuation lines.
  If the prefix exceeds the budget, they suppress suggestions rather than guessing.
- Native prompt and structured-test compatibility explicitly includes the published
  0.0.7-alpha.1 through alpha.3 releases. Future alpha series are not assumed compatible.
  Existing 0.0.6 behavior is preserved.

The official compiler remains authoritative. Studio does not infer generic types or
claim to implement the compiler's type system. The published compiler source is
available at https://github.com/scarp-lang/scarp/tree/v0.0.7-alpha.3.
