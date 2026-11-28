# Inspect displayed project matches

Project search results now include a bounded match workbench. It operates only
on displayed hits from the current completed search; it never initiates new
reads, widens the selected scope, or changes replacement selections.

## Inspect and filter

- Expand **Review matching source overview** to see displayed match counts,
  observed line ranges, source origin and per-file scan evidence.
- Choose an exact source label, snapshot origin or coverage state.
- Filter by a literal substring of the bounded displayed context or an inclusive
  line range. Context filtering is case-insensitive and does not scan full
  source files.
- Sort by original search order, relative label and source position, or displayed
  matches per source.
- Page through the displayed results (20 occurrences per page).

A filtered count is not a new search result. Incomplete source coverage remains
visible, including when no displayed matches satisfy the filters.

## Exact context and navigation

Choose **Review context** on an occurrence to inspect its original UTF-16
coordinate and highlighted matching text. Surrounding source context is clipped
at bounded, Unicode-safe preview edges; omitted context is marked. Invisible
controls and isolated surrogate units are rendered visibly rather than changing
the actual source coordinates.

Use the previous/next review actions to traverse filtered occurrences. Select
**Open reviewed match** or click a result row to navigate. The review preserves
the original result index, even when filtered or reordered. The existing desktop
navigation handler independently rechecks the current listing and source
snapshot before changing the editor position. Stale matches require a new search.

## Reports

The displayed-match report contains only coverage and filtered result counts
by default. Relative source labels and line/column coordinates can be included
by explicit choice. Query text, filter text, matched text, surrounding source
context, native paths and full source snapshots are excluded from every report.

The workbench does not implement semantic rename or Replace All. Workspace
replacement remains a separate explicitly reviewed operation on individually
selected displayed occurrences.

## Desktop acceptance

- Search files containing CRLF, lone CR, LF and supplementary Unicode text.
  Review coordinates and verify exact Monaco navigation.
- Use a search with more than 20 results and verify page boundaries and
  adjacent review across pages.
- Combine origin, source, literal-context and line-range filters; confirm that
  displayed counts change but no additional files are read.
- Change a source after search and verify stale navigation is rejected.
- Inspect a match-limited search and confirm partial-source evidence is visible.
- Copy a counts-only report; verify that query, paths, labels and source context
  are absent. Enable locations and verify only relative labels and coordinates
  are added.
