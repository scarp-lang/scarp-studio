# Recently closed sources

Scarp Studio retains a short, in-memory history of clean saved source tabs
closed during the current desktop session. This is not draft recovery,
an undo log, or a persistent list of recently opened projects.

## Reopen a saved source

1. Open a saved Scarp source and close the clean tab.
2. Use **File: Reopen Last Closed Source** in the command palette,
   press **Ctrl+Shift+T**, or expand **Recently Closed** in the sidebar.
3. To select a particular source, use its filename and full path in the list.

The history holds up to 20 distinct source paths. During a bulk clean-tab
close, the formerly active source takes precedence. Other closed sources
appear in reverse editor order. Opening a matching path by any normal route
removes it from the list, including a successful Save As to that path.

## What gets retained

Only the path and display name of previously open clean named Scarp sources
are retained. Source contents are not copied into history. Dirty documents
that were explicitly discarded, untitled buffers, and unsaved recovered
copies do not enter this history.

Reopen reads the **current disk contents**. If another application changed
the file since closing, its new contents are opened, not an old snapshot.
If the source is missing, cannot be read under the existing desktop scope,
is not valid UTF-8, or exceeds the editor's 4 MiB limit, Studio reports the
failure and leaves the history entry available for retry or removal.

## Safety and privacy

- The history uses exact previously open paths, not guessed destinations.
- No new filesystem permission is granted by reopening a history item.
- Existing open buffers are activated, not overwritten.
- A changed editor, workspace, or history entry invalidates a pending read.
- Use the remove button beside an entry, or clear all history in the sidebar.
- History is not persisted, and it disappears when Studio exits.

For unsaved work after an unexpected exit, see
[local draft recovery](draft-recovery.md). To revisit a group of clean tabs
in another session, see [remembered workspace sessions](workspace-session.md).
