# Compare open source buffers

Choose a target and reference from already-open buffers, using working
text or the last saved editor snapshot for each. A source may be compared
with its own saved snapshot. No files are opened or read by comparison.

The existing bounded line diff shows changes from target to reference,
with optional context and navigation only to working-source coordinates.
A changed editor session makes a comparison historical. A limited diff
cannot be assumed complete. The shared diff now counts lines before
allocating line arrays and interns full line identities before LCS work.

For a working target, Review Exact Transfer Blocks prepares a separate
complete inventory of contiguous changed text spans. Select the blocks
to copy from reference into target. Before/after previews include
literal escaped line separators and control characters. Transfer requires
a complete review of at most 48 blocks, 4096 UTF-16 units per side of
each block, and 48 Ki units of total changed text. Partial selection
can be semantically incorrect; Studio does not infer compiler validity.

Confirmation recomputes the exact plan against the original editor
generation and applies only the selected spans. The saved snapshots
and reference remain unchanged. Separator-fusing partial joins are
rejected. Apply and guarded Undo use the existing Auto Save review
hold, with no direct disk write or compiler execution.
