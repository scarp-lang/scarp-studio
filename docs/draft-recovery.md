# Local draft recovery

Draft recovery is an optional safety net for the Scarp Studio desktop editor.
It is **off by default**, does not replace Save or Auto Save, and never writes
to original source paths.

## Enable and checkpoint

1. Open Settings or select **Recovery: Off** in the status bar.
2. Read the local-storage notice and select **Enable local recovery**.
3. Continue editing and saving Scarp source files normally.
4. Use **Checkpoint now** if an immediate recovery copy is important.

The editor attempts a checkpoint 750 ms after a source change and also checks
for changed documents every four seconds during continuous editing. A
visibility change or page-hide event attempts a final checkpoint. These
timings are best effort: a sudden process termination can lose edits made
since the last successful checkpoint.

A checkpoint contains the exact current text of all dirty editor tabs and
their display basenames. Clean saved files, original absolute paths, previous
saved versions, compiler output, command history, program input and credentials
are not collected as separate metadata. Source text itself may contain
sensitive information.

## Restore after an unexpected exit

On startup with an existing checkpoint, Settings opens to the recovery
review. New automatic recovery writes pause until the prior checkpoint has
been reviewed. This prevents a new empty editor session from destroying the
only copy of earlier unsaved work.

- **Review draft names** shows names and source lengths, not source previews.
- **Restore as unsaved copies** opens all recovered sources in fresh untitled
  tabs. Existing open tabs and source files remain unchanged.
- Each restored tab has a unique recovery label. Even an empty recovered
  draft remains modified until explicitly saved or discarded.
- Use the normal Save dialog to select a destination. Recovery never uses
  the original path or silently overwrites a project file.
- **Discard previous drafts** requires an explicit removal confirmation and
  leaves the currently open editor documents untouched.

If combining prior drafts and current unsaved work exceeds the recovery
budget, save some current documents first and retry. The previous checkpoint
remains available if restoring the complete set cannot be committed.

## Storage and privacy

One versioned record is held in the desktop WebView's localStorage profile.
Recovery is unavailable in browser preview. The record is not encrypted and
is not synchronized or uploaded by this feature. Anyone with access to the
desktop profile may be able to inspect the source copies. LocalStorage can
be deleted by profile cleanup, application changes or storage restrictions.

The limits are:

| Limit | Maximum |
| --- | ---: |
| Dirty tabs | 16 |
| Aggregate source UTF-16 code units | 524,288 |
| Serialized record UTF-16 code units | 2,097,152 |
| Display basename UTF-16 code units | 120 |

All limits are checked before replacing the record. A checkpoint that cannot
fit is rejected in its entirety rather than silently truncating source or
saving a partial inventory. JSON escaping can make a valid source exceed
the encoded limit. Malformed Unicode and invalid record schemas are rejected.
There is no guarantee that a checkpoint remains available if the operating
system or storage implementation fails.

The previous complete copy is preserved when possible after a write failure.
Settings and the status bar report errors; a displayed checkpoint date is
the date of the last accepted complete copy, not a promise that newer edits
were saved. Resolve the error or save your source files normally.

The journal compares the current serialized record before changing it.
Conflicting external changes block the writer; this check is best effort,
not an atomic lock across independent desktop processes.

## Remove recovery data

Select **Turn off and remove local recovery** and confirm removal. This
removes the local record without deleting source files or open editor tabs.
If removal fails, the current writer stops and reports the failure; retry
removal after the storage problem has been resolved.

A normal exit or confirmed discard clears the current session checkpoint.
An unreviewed earlier-session checkpoint is preserved. When clearing the
current checkpoint fails, Studio asks before exiting with a copy potentially
remaining. Resetting appearance or Auto Save settings does not erase recovery
copies; removal remains a separate explicit action.

## Verification

Use disposable source files only. Automated model tests cover strict parsing,
exact Unicode preservation, source and record bounds, prior-session review,
quota failures, conflicting sessions, opt-out, and interrupted shutdown.
UI rendering tests cover opt-in, review, disabled and error states. The real
Windows desktop workflows require the manual acceptance cases in
[windows-11-acceptance.md](windows-11-acceptance.md), including a restart of
the same desktop profile after an unexpected termination.
