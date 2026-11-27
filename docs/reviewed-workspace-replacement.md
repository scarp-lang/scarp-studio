# Reviewed workspace search replacement

Search Workspace remains read-only and limited to the existing Explorer
listing and read budget. In its result, open Review Selected Workspace
Replacements, enter replacement text, and explicitly select occurrences.
This is literal case-sensitive or insensitive search using the existing
whole-word option, not semantic rename. Strings/comments may match.
Incomplete search coverage is disclosed; selected visible sites only
can change. It is not a project-wide Replace All claim.

The staging action checks unique native listing membership and exact
original search snapshots. It rereads selected unopened sources with
the existing bounded scoped reader; an external change, read failure
or stale editor/listing generation aborts the batch before opening tabs.
Already-open source text wins, with original revision checks. The
selected files are opened as clean editor buffers using the existing
atomic restore reducer. Stage changes only the set of open tabs.

After staging, all selected spans are recomputed against the actual
open buffers. Preview displays escaped before/after context for every
selected changed occurrence. Confirmation rechecks the complete editor
generation, original search and exact replacement plan. Only reviewed
spans change, atomically in memory. Auto Save holds edited buffers.
Guarded undo restores reviewed content, not the closed/open tab set.
Save manually; the existing disk conflict checks still apply.

Budgets: 12 selected files, 120 selected occurrences, 512 KiB per file,
2 MiB total selected source text. Files remain open if preview is
cancelled; no disk writes, file creation, deletion or compiler commands
occur. A disk file can still change after a successful staging read.
