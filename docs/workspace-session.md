# Remembered workspace tabs

The Workspace Session panel is a manual way to return to a previous set of
clean Scarp source tabs. It is separate from local draft recovery. It never
captures or restores unsaved source contents.

## Remember a workspace

1. Choose a parent or project workspace through Studio's native folder picker.
2. Open the sources you want to revisit; save any modified sources normally.
3. Expand **Workspace Session** in Explorer.
4. Review the count of clean, listed source tabs and the omissions.
5. Select **Remember current tabs**. To replace an existing list, explicitly
   confirm the replacement after reviewing the current capture.

Only tabs whose paths match one unambiguous entry in the currently selected
native listing are included. Untitled, dirty, unlisted and ambiguous tabs
are excluded and counted separately. At most the first 24 eligible tabs
are remembered in their current order. The active file is recorded only
when it belongs to that set.

## Return to a workspace

Choose the same workspace through the native folder picker again. Studio
does not open remembered folders automatically, restore filesystem access
from a stored path, or run code.

The panel previews each remembered relative filename as:

- **Ready to open**: a single currently listed source not yet open.
- **Already open** or **Open · preserve edits**: an existing editor buffer
  is retained and will not be re-read from disk.
- **Not currently listed**: the source is absent from the bounded listing.
- **Ambiguous · skipped**: multiple sources or editor tabs match the name
  or path; Studio does not choose one silently.

Select **Restore listed tabs** after reviewing this list. The editor stages
bounded sequential reads for all new sources, and appends them as one batch
only after the reads succeed. A changed listing, intervening editor change,
storage conflict, invalid source, native read failure or aggregate budget
failure cancels the staged batch. Existing tabs are never replaced or closed.

The remembered active file is focused if it is still available. If it is
missing or ambiguous, the current active tab is preserved when possible.
Restoration does not re-order existing tabs. Newly opened files are appended
in remembered order.

Refresh Explorer and retry if files are outside the current listing due to
workspace scan limits. If the workspace was moved or relative filenames were
renamed, Studio does not guess new paths; remember a new list explicitly.

## Local metadata and limits

A versioned localStorage record in the desktop WebView profile holds the
selected workspace root path, saved timestamp, ordered relative filenames
and active relative name. There are no stored source contents, compiler
output, unsaved buffers or filesystem authorization tokens. Paths and
filenames themselves may be private information.

| Resource | Limit |
| --- | ---: |
| Remembered workspaces | 8 |
| Remembered sources per workspace | 24 |
| Serialized metadata | 256 Ki UTF-16 code units |
| Workspace root | 4,096 UTF-16 code units |
| Aggregate native reads per restore | 4 MiB UTF-8 |

The store never automatically captures or evicts workspaces. If it reaches
capacity, explicitly forget a workspace before remembering another. Storage
is unavailable in browser preview. Invalid records, write failures and
conflicting external changes are surfaced, not silently overwritten.

Use **Forget this workspace** to remove the selected remembered metadata.
**Clear all remembered workspaces** removes all saved session metadata,
including an unreadable version if explicitly confirmed. Both actions leave
source files, open tabs and local draft recovery unchanged. Resetting editor
appearance does not erase remembered workspace metadata.

## Scope and verification

Stored strings are not joined to construct file paths. Every restore request
resolves exact relative names only against the current, user-selected,
bounded Explorer listing. Windows root aliases are compared using the
existing Studio path-identity helper; POSIX filenames remain case-sensitive.
The native filesystem scope remains the actual permission boundary.

Unit tests cover schema, path aliases, capture omissions, conflicts, limits,
restore staging and reducer atomicity. Native Windows interaction remains
subject to the manual acceptance worksheet. Test with disposable sources
and a dedicated profile before using the feature with important projects.
