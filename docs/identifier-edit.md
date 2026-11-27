# Reviewed literal identifier edits

Identifier Edit in the Explorer scans the active or all open buffers for
a case-sensitive literal ASCII code identifier. This is not semantic
Rename Symbol: Studio's lexical inventory does not resolve scopes,
shadowing, types, aliases, imports, overloads or binding identity.
Review every intended occurrence and verify the resulting program.

Strings and line comments are excluded. The review rejects unsupported
or incomplete lexical input, oversized scans, keywords and known builtin
names. It never reads unopened files. Existing replacement spellings
are reported as collision hints; they do not prove a name collision or
absence of one. Qualified and declaration-like sites are marked as hints.

Select individual sites, or explicitly select all. Each site has the
original filename, coordinates and bounded before/after line context.
Review the selected set and acknowledge the lexical limitation before
confirming. Only selected exact token spans are changed. A changed
editor generation invalidates the scan even if text is later restored.
The complete scan is recomputed before applying. Atomic in-memory
replacement, Auto Save hold and guarded undo share existing editor safety
mechanisms. No direct disk writes or compiler commands occur.

The scan covers at most 24 open buffers, 1 Mi UTF-16 units total and
160 matching sites. A limited scan cannot be used to change source.
