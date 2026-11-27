# Generic function editor assistance

The local declaration inventory recognizes the published alpha.3 file-level generic header syntax, including multiple type parameters and the Numeric and Comparable constraints. Local completion, hover and signature labels retain the declared generic labels, and definition navigation preserves the original declaration location. Explicit unqualified calls using the compiler's ::<...>(...) syntax can be recognized with nested collection types and adjacent closing angles. Type argument commas are not value argument commas.

Workspace symbol inventory and parameter hints also recognize these bounded forms. The line-oriented outline remains limited to same-line headers; the full local definition inventory supports multiline headers. Malformed headers, qualified calls, duplicate names and unsupported type argument forms are deliberately not guessed.

This is editor-only lexical assistance, not compiler type inference, specialization validation, semantic navigation or an implementation of user-defined generic types. The compiler remains authoritative. No source or filesystem changes occur when an editor provider requests assistance.
