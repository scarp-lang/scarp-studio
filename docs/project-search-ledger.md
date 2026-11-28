# Track independent search batch coverage

A search batch ledger helps you track a large listed scope without increasing
the search read budget or pretending that several separate reads establish a
single current workspace snapshot.

## Start a ledger

1. Select the directory, descendant option and optional basename substring.
2. Choose a numbered batch, enter a literal query and set the matching flags.
3. Run **Search Project** and inspect the per-file coverage.
4. Expand **Track search batch coverage** and choose **Start ledger from
   current batch**.

The ledger records this observation and the full planned set of eligible
relative source labels. The ledger's label order is identical to the explicit
batch partition. No additional source is read while starting or recording it.

## Continue and retry

- Use **Select next pending batch** to choose the first unrecorded batch.
  When every batch has a record, it chooses the first incomplete one.
- Run **Search Project** explicitly, then record the current batch observation.
- If a batch already has a record, the action becomes **Replace recorded batch
  with current observation**. The new evidence replaces the old record rather
  than combining observations of the same labels.
- Review a batch's planned labels and recorded coverage.
- Remove an individual batch observation to return it to the unrecorded state.
- Filter the batch list and page through large plans.

Choosing a batch never triggers a filesystem read, compiler command, or
replacement. It changes the scope and retires an existing search result.

## Understand the totals

The ledger distinguishes:

- Fully scanned in an independently recorded observation.
- Recorded but not fully scanned.
- No recorded observation.
- Excluded by the directory or filename filter.
- Withheld because listing entries were invalid, ambiguous or beyond inspection
  limits.

Completing every recorded batch means each planned label was fully scanned in
its own observation. A file might have changed between searches. It does not
prove that all listed files are currently scanned, that the filesystem is
fully represented, or that a search term is absent from the workspace.

The ledger deliberately does not combine displayed match counts, match
locations or source snapshots. Workspace replacements remain independent
reviewed operations on the active search result.

## Context and privacy

The exact query, matching flags and non-batch scope must match to continue.
Changing only the batch number is permitted. The ledger also checks the
eligible relative-label inventory and the listed, excluded and withheld counts.
If those differ, start a new ledger. Exact relative labels are not filesystem
identities; replacing a file under the same label is not detected by this
inventory check.

Only explicit observations are retained in memory. They are discarded when
the search workbench closes or the workspace path changes. No persistence,
native paths or source text are retained by the ledger. The default report
contains coverage counts, not query, filters, or source labels. Relative
labels can be included only by choice.

## Desktop acceptance

- Use a scope spanning at least three batches. Start from batch two; confirm
  the next pending action selects batch one without performing a search.
- Record batch one with a failed read and confirm the incomplete count.
- Record all remaining batches, retry the incomplete batch and replace its
  observation. Verify that fully scanned and incomplete counts are not
  accumulated across retries.
- Change a filter or the query, and verify that recording and selecting
  planned batches are blocked. Restore the original settings.
- Add or remove an eligible listed source and verify the inventory warning.
- Copy the default report and check that private labels, paths and matching
  settings are absent. Enable labels only when needed.
- Cancel the clear confirmation, then confirm clearing. Reopen the workbench
  and verify that the prior ledger is gone.
