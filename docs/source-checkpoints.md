# Session source checkpoints

Source Checkpoints is a development-only Explorer panel. It provides named,
explicit in-memory copies of the current source, distinct from Working
Changes (last saved comparison), draft recovery (opt-in restart recovery)
and version control. It never writes source or stores checkpoints in local
storage. It does not automatically create snapshots.

## Capture and compare

Choose an open source, enter a label, review the capture and confirm. The
review describes the byte count and current buffer. The checkpoint is tied
to the open tab and exact path; ordinary editing or saving to the same path
does not change its captured text. Closing a tab, changing its path (including
Save As), or exiting Studio retires its session checkpoints.

Select a checkpoint to compare the current buffer to its captured text.
Added and removed lines represent the proposed restore, not the direction
of past edits. You can inspect the full captured text in a local read-only
textarea; it may contain private source, so review before copying it.

## Restore and remove

Review the restore and confirm only after checking the displayed diff. If
the comparison is limited, has truncated hunks or has truncated line previews,
the full-buffer restore is unavailable; inspect the checkpoint source and
copy desired text manually. Confirmation checks the exact editor session,
active buffer, current store revision and proposed replacement again.

The restore modifies only the editor buffer and is protected from Auto Save
until explicit Save or further editing. Undo is available while every open
buffer still matches the post-restore snapshot. The independent save service
still checks disk changes. No restore writes a file directly.

Review removal of one checkpoint or all session checkpoints. Removal does not
modify open buffers or disk files. No checkpoint is silently evicted to make
room for another capture.

## Limits

Up to six checkpoints per tab, 24 per Studio session, 256 Ki UTF-16 units per
captured buffer, 2 MiB of checkpoint source bytes overall. Labels are bounded
to 60 UTF-16 units, must be nonempty and cannot contain control codes. These
are deliberate early-alpha limits. The bounded source diff has independent
line, matrix and preview limits. This is not durable backup storage.
