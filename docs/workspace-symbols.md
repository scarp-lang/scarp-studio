# Workspace symbol explorer

Open Explorer and expand Workspace Symbols. The index reads only immutable
snapshots of open editor buffers, including unsaved buffers. It performs no
filesystem reads, compiler invocations, telemetry, or source edits.

## Declaration inventory

The lexical index recognizes function, record, variant, bind, var and literal
import-alias headers. Comments and strings do not become declaration tokens.
It recognizes common multiline headers and nested block declarations, and
labels explicit pub and pure modifiers. The labels are lexical observations,
not compiler-enforced visibility or purity. It does not index parameters or
all compiler syntax. An unfinished or malformed source may yield limited
coverage.

Filter by name, file, declaration kind, nesting, or modifier. Order results
by source, name or kind. Select a declaration to navigate to the exact open
buffer snapshot. The report contains document names and identifier names,
not absolute paths or source excerpts.

## Repeated names and call-like sites

Repeated spellings may be legal across different files and lexical scopes.
The repeated-name view does not issue duplicate-name diagnostics.

The call view groups unqualified call-like tokens by spelling. It labels
matching observed functions, other same-name declarations, catalog names,
or names not represented in the index. These are not resolved call graph
edges; parameters, imports, callable values and compiler scope are not
resolved. An unmatched name is not evidence of an undefined function.
Do not use this feature as a semantic rename, unused-code checker or compiler
diagnostic source.

## Limits

At most 40 buffers, 2 Mi UTF-16 source units in the selected scope, 512 Ki
units per file, 400 declarations and 1,200 call-like sites per file, 1,500
declarations and 4,000 call-like sites overall. Token/nesting budgets and
incomplete source are reported explicitly. Indexing is lazy while collapsed;
results use bounded pages. Use Verify with the installed compiler for
authoritative language diagnostics.
