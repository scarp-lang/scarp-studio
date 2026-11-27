# Source quality workbench

This development feature appears in Explorer below Source Insights. Expand it
to inspect the current buffer or all open Scarp buffers. It is an approximate
editor-only analysis and is not a substitute for **Verify** with the compiler.

## Observations

The panel distinguishes review observations (possible unterminated strings,
unexpected controls, invisible directional formatting and unmatched delimiters)
from style observations (trailing whitespace, mixed indentation, long lines,
mixed newline conventions and missing final newline). It uses UTF-16 line and
column coordinates; length is not a count of displayed graphemes. Strings and
comments are not interpreted as delimiter syntax. Directional controls are
reported even in strings and comments; their presence is not proof of malice.

Filter by rule, severity, text or cleanup availability. Select a finding to
navigate to the exact current buffer. The report is local and copyable. It
contains file names but no absolute paths or source excerpts.

## Reviewed cleanup

Only trailing horizontal whitespace outside strings and missing final newlines
are eligible for cleanup. Other observations require manual decisions. Mixed
line endings are not normalized; a final newline is not automatically offered
for a mixed-ending buffer. Lexical issues and incomplete scans prevent unsafe
cleanup. If any analysis budget is reached, narrow the scope before applying.

Select cleanup findings, inspect the number of changes in each buffer, and
confirm. All source snapshots must still match. Source text remains in memory;
there is no native file write. Exact changed snapshots are held from Auto Save
until manual Save or further edits. Undo is offered while every open buffer
still matches the post-cleanup snapshot. It never overwrites newer edits.

## Limits and validation

40 open buffers, 2 Mi UTF-16 units across the selected scope, 512 Ki units per
buffer, 24,000 lexical tokens, 240 observations per buffer and 600 observations
across the workbench. Partial analysis is labelled as such. The scope is open
buffers only: no recursive file scan, external process, compiler run, telemetry,
or filesystem traversal. Use disposable sources for Windows GUI acceptance.
