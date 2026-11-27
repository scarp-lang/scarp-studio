# Compiler output inspection

The Inspect tab provides read-only inspection of the text currently shown
by the compiler output workflow. It does not execute Scarp, open paths
found in text, create diagnostics, or navigate source files. Existing
Output and Problems views remain available. Source freshness warnings are
separate from searched text.

Search literal text (not regular expressions), optionally matching case or
whole words. Search is per line and finds non-overlapping occurrences.
Whole-word boundaries use Unicode letters, numbers and underscore.
Coordinates are original UTF-16 offsets. Search results are paged.
Choose a match or enter an indexed output line number. Inspect neighbors
and original LF, CRLF, CR or EOF endings. Long previews are bounded around
the selected occurrence, with omitted edges marked. Review Copyable Output
Excerpt displays selected text; nothing is copied automatically.
Raw output can contain private text or paths. No output is saved by Inspect.

The index scans at most 256 Ki UTF-16 units and 6,000 complete lines,
rejecting incomplete lines at the boundary, including split CRLF. Queries
have a 120-unit limit; at most 500 occurrences are reported. Limited counts
are lower bounds, and a no-match result may not cover the entire output.
Excerpts are limited to 21 lines and 8192 units. The current selection
and search reset when output text changes or the inspector is closed.
Inspection pauses while native operations are busy.

Choose a previous record from History's explicitly retained raw output.
Records with omitted middle text or missing original-length metadata are
not accepted as exact baselines. Comparison uses the bounded line-diff
algorithm from Working Changes, with a 128 Ki-unit per-side ceiling.
It shows historical-to-current additions and removals. A limited report
is not a complete diff. Identical output does not establish identical
source, environment, input, exit code, or correct behavior.
Removing retained output also removes it from the comparison.
