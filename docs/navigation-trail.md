# Session navigation trail

The Explorer's Navigation Trail records explicit requests to navigate to source
insights, declarations, line/column positions, open-buffer search matches, and
current source diagnostics. It also supports marking the current editor cursor.
Ordinary typing, cursor movement, tab selection, and native project-file opens
are not tracked.

- Back and Forward select the previous or next valid recorded location.
- Selecting a list entry replays that entry without creating another record.
- A new jump after Back replaces the forward branch.
- Adjacent identical positions are deduplicated.
- At most 80 recent locations are retained; the oldest are discarded.
- An origin is recorded only when the mounted Monaco model matches the current
  open buffer. A location records a requested jump, not an asynchronous
  guarantee that a destination editor will finish mounting.

Locations use one-based UTF-16 line and column coordinates. The trail accepts
CRLF, LF and CR source line endings, and bounds position analysis to 512 Ki
UTF-16 units per source. A changed revision or closed tab disables its historical
location. Even identical text after an edit or close/reopen is not considered
a valid substitute. Back and Forward skip these locations instead of guessing
where they should now point. No source is opened from disk by replay.

The trail keeps document identifiers, display names, revisions, coordinates,
and reasons in memory. It retains no source excerpts, never persists to
localStorage, and never exports or executes a command. Review Clear Navigation
Trail to remove all records without changing source files or bookmarks.
