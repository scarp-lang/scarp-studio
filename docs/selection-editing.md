# Reviewed selection editing

Open Explorer's **Developer tools → Reviewed editing → Selection editing**.
Select one or more nonempty ranges in the active Monaco editor, then click
**Capture editor selections**. Capture is explicit; Studio does not interpret
the cursor position as a selection or guess from visible line numbers.

Supported operations:

- Surround each selection with literal prefix and suffix.
- Remove matching outer text from every selection, atomically.
- Repeat each selected string two to five times without inserting a separator.
- Apply Unicode uppercase or lowercase conversion.
- Replace case-sensitive, non-overlapping literal matches inside each range.
- Delete exactly the captured ranges.

Review every escaped before/after row before confirming. Coordinates use the
editor's UTF-16 columns and offsets. A changed source, tab session or live
selection rejects confirmation. The exact synchronized model text is required:
if Monaco normalizes a mixed-line-ending buffer, capture fails rather than
guessing how offsets map to the original source.

These are text operations, not compiler-aware refactoring. Case conversion
can expand characters and literal replacement can change strings, comments or
identifiers. Nothing outside the reviewed ranges is rewritten. The tool refuses
overlapping/adjacent ranges, split surrogate pairs, split CRLF pairs and
boundary edits that accidentally fuse independent CR and LF separators.

A single memory transaction changes the active buffer. Save baselines remain
unchanged. Auto Save holds the reviewed replacement until the ordinary edit
or explicit save workflow releases it. Undo is available only while the
post-edit snapshots are still exact. The workbench never writes source files
or runs the compiler.

Limits: 24 selections, 512 Ki UTF-16 units of source, 24 Ki units of selected
text and 24 Ki units of transformed text. Each literal option is limited to
120 UTF-16 units and rejects malformed Unicode and control characters.
