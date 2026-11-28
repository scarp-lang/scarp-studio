# Compare project search observations

The search workbench can record up to eight explicit observations for the
currently selected workspace. Observations are in memory only. They are
discarded when the search workbench closes or the selected workspace path
changes. No automatic capture, native read, file write, or persistence occurs.

## Record and compare

1. Choose a directory, filename filter and optional batch.
2. Run a project search and inspect its coverage.
3. Expand **Compare search observations**, then select **Record current
   search observation**.
4. Make or inspect changes normally, and rerun the same search.
5. Choose the earlier observation. The workbench compares it with the current
   completed search, not with a previous result that is no longer visible.
6. Inspect the evidence and optionally filter or page through the comparison.
7. Copy the counts-only report, or explicitly include relative labels.
8. Remove an individual observation or confirm clearing all observations.

The exact literal query, matching flags, directory selection, descendant flag,
filename filter and batch number must match. Changing any of them blocks the
comparison. Returning to the original settings and rerunning the search can
make the earlier observation usable again.

## Evidence rules

Only exact relative source labels are paired. Native paths are not retained.
The comparison does not establish that two files with the same relative label
are the same filesystem object. A renamed source is not automatically paired
with another source, and a label appearing only in one selection does not prove
that a source was created or deleted.

An exact observed match count difference is calculated only when both
observations fully scanned the paired label. A file that failed to read,
exceeded the byte budget, or was not fully scanned due to a match or candidate
limit is not comparable, even when it has some displayed matches.

A change from disk origin to open buffer (or the reverse) is separately shown,
including when the displayed count is unchanged. Counts do not establish why
content differs, whether a source was saved, or whether any semantic change
occurred.

## Limits and privacy

Each captured observation copies validated per-file coverage, bounded counts,
scope and matching settings. It does not retain match text, source snapshots,
previews, native paths, editor identifiers or execution authority. The query
and filters are retained in memory solely to check comparison compatibility.
Reports never include these settings directly; source labels are opt-in and
may themselves contain private names. Default reports contain counts and
coverage descriptions only.

Separate runs may observe different disk states. No atomic snapshot or combined
multi-batch coverage is asserted. An incomplete scope can still contain
individual fully scanned files whose observed counts can be compared.

## Manual acceptance

- Record a completed search, modify one open buffer, then search again and
  verify the count and origin differences.
- Cause an unreadable source or a match limit; verify that the affected label
  has no exact delta.
- Change the query, flags, scope and batch independently and verify that each
  incompatible comparison is blocked.
- Refresh the listing so a label is present in only one observation; verify
  neutral earlier/current selection wording.
- Record eight observations and verify that a ninth is blocked until one is
  removed. Cancel the clear confirmation and verify no data was lost.
- Check the default copied report for private query, filter and path leakage.
- Close and reopen the workbench or switch workspace paths; verify that the
  observations are no longer available.
