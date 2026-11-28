# Scoped project search

Open **Find in open files → Configure project search scope**. Choose an
observed directory from the selected Explorer listing, optionally include
descendant directories, and optionally enter a literal filename substring.
The default scope covers the root and all listed descendants.

The filename filter is case-insensitive basename matching. It is not a
glob, regular expression or native path. Content search retains its existing
Match case and Whole word options; open-file search itself remains separate.
Review scope inventory before starting a search. Only eligible listed source
labels are shown. No file is read merely by changing scope.

Search Project scans at most 24 selected sources, using the existing bounded
read and match budgets. Open working buffers take precedence over disk text.
The scope never expands the native permission boundary, joins typed path
names, crawls unlisted directories or selects unsupported file types.
Ambiguous names and native path aliases are withheld instead of guessing.

A completed result distinguishes:

- all listed entries and the eligible candidate count,
- sources excluded by the chosen scope,
- invalid, ambiguous or uninspected entries withheld before reading,
- fully searched files and files not fully scanned,
- displayed matches, grouped by their source label and snapshot origin.

Excluded-by-scope files are not failures. Read failures, byte/match limits
and withheld entries make coverage incomplete. Even complete coverage is
limited to the listed sources, not the whole filesystem.

Review search coverage report exposes a copyable counts-only report.
Relative labels and the filename filter have separate opt-ins. The report
never contains native paths, source text or the content search query.
Review the resulting text before sharing it.

Scope and content-option changes invalidate the prior result and any
replacement plan. Existing reviewed replacement behavior still stages only
explicitly chosen visible occurrences and rechecks source snapshots before
editing in memory. No automatic save occurs.


## Per-file coverage

When the coverage report is available, the file table includes every eligible
source, even if no matching text was displayed. Filter for incomplete files or
files with displayed matches. Each file receives one state from the bounded
search operation:

- **Fully scanned:** its in-memory source was searched to completion.
- **File count limit:** it was outside the selected 24-file scan budget.
- **Read unavailable:** the existing native reader failed. This can include
  missing files, permission errors or the reader's own size/encoding guard.
- **Byte budget:** the source did not fit the remaining source-byte budget.
- **Content or match budget:** text was available but not fully searched,
  including partially searched and unstarted in-memory scans.
- **Invalid listing identity:** the entry was rejected by listing validation.

The origin identifies an open working buffer, a disk read attempt, or an
unread candidate. A source with zero displayed matches is not necessarily
free of the query unless its coverage is complete. Counts-only reports include
the state totals. With relative-label opt-in, reports include these states per
file, without exposing native reader error strings or absolute paths.
