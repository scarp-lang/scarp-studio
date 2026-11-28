# Search larger listed workspaces with explicit batches

Scarp Studio searches only the source files already available in the selected
Explorer listing. It does not recursively crawl additional folders when you
search. The conventional mode retains its existing bounded, directory-balanced
selection of up to 24 sources. For larger scopes, explicit batches make it
possible to search later listed candidates without raising the read limits.

## Workflow

1. Open a Scarp project or practice folder in the desktop application.
2. Open the Search workbench and enter a literal, single-line content query.
3. Expand **Configure project search scope**.
4. Choose an observed directory and optionally a literal filename substring.
5. Choose **Search batch** and select one of the numbered batches.
6. Review the scope inventory if exact membership matters.
7. Press **Search Project**. Selecting a batch does not start native reads.
8. Review the displayed matches and the per-file coverage report.
9. Use **Next search batch** or **Previous search batch**, then explicitly
   search again. The previous result is retired when the scope changes.

Batch selection is local to the current Studio session and is not persisted.
Directory, descendant and filename changes reset the selected batch to
conventional mode. Reset project scope resets every scope field.

## Membership and budgets

Batches partition eligible relative source labels in exact code-unit order,
after directory and basename filtering. They do not depend on locale sorting
or unsaved edits. Native path spelling is retained from the Explorer listing.
The current batch size is four sources: four files of 512 KiB can fit within
the existing 2 MiB aggregate read budget. The file count, byte, accepted-match
and candidate limits remain independently enforced.

A listing refresh may change membership. An out-of-range batch is rejected
rather than silently broadening a search. Recheck the inventory after adding,
renaming or removing listed files. A batch may be incomplete because of read
failures, oversized files or match limits. Search uses current open buffers
where applicable and disk snapshots otherwise.

## Interpreting coverage

The report distinguishes three different reasons for a source not being part
of the displayed matches:

- Excluded by directory or basename filtering.
- Deferred to another batch.
- Selected in the current batch but not fully scanned.

Invalid, ambiguous and uninspected Explorer entries remain separately counted.
A zero-match fully scanned batch is not evidence that the entire workspace has
no matches. Separate searches can observe different disk and buffer states;
Studio does not combine their results or assert an atomic workspace snapshot.

Reports exclude native paths, source content and the content query. Relative
labels and the filename substring are included only by explicit choice.

Workspace replacement continues to require explicitly selected displayed
occurrences and its existing exact-snapshot staging and review. Changing batch
retires the result; it never applies replacements or modifies source files.

## Acceptance checklist

- With 29 listed sources, select a batch whose members fall beyond the normal
  24-source cap; verify that the preview and displayed results identify that
  batch only.
- Search a one-source final batch and confirm deferred counts are visible even
  if there are zero matches.
- Change the filename filter and verify the selected batch resets.
- Select a batch, then alter the listing so that batch no longer exists;
  confirm that the invalid choice cannot broaden the search.
- Open and edit a file belonging to the selected batch; confirm the current
  buffer takes precedence over disk.
- Verify that changing batch invalidates any previous replacement preview.
- Copy the default report and confirm that private paths and labels are absent.
- Repeat using conventional bounded search to verify compatibility.
