# Reviewed line tools

Open the Explorer's Line Tools section. Choose inclusive one-based first
and last line numbers or use the current cursor line. Select a literal
text operation and review it. Tools do not understand Scarp semantics:
reordering, affixing, removing duplicate lines or changing indentation
can change program behavior. They are not an automatic formatter.

Sort is stable lexicographic ordering with an optional case-insensitive
comparison. Reverse changes the order of lines. Indent inserts the chosen
number of spaces on nonempty lines; outdent removes one leading tab or up
to that many leading spaces. Prefix and suffix add literal non-control
text to each selected line. Trim removes trailing spaces and tabs.
Deduplicate keeps the first occurrence of each exact line.

Line separator slots are retained by position, including mixed LF, CRLF
and CR. If deduplication shortens the range, the final selected separator
is retained, preserving the boundary with following source. A terminal
empty editor line after a final newline cannot be selected. No characters
outside the reviewed range change.

Review displays the complete before and after text of the selected range
with original separator labels. Limits: 512 Ki UTF-16 source units,
80 selected lines, 320 units per preview line, 24 Ki preview units on each
side, 80-unit literal affix. A limited or no-op transformation is rejected.
A changed editor session invalidates confirmation even after identical
text is restored. Apply uses the existing atomic buffer replacement path
and Auto Save review hold. Undo is guarded by exact current snapshots.
No operation saves to disk or launches the compiler automatically.

A transformation that would fuse adjacent CR and LF separator slots is
rejected. Quoted preview strings show empty rows and escaped controls
explicitly; the preview is not the literal replacement syntax.
