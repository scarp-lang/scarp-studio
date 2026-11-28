# Reuse project search presets

Search presets retain named literal search settings while the search workbench
is open for the selected workspace. They do not retain source snapshots,
replacement text, native paths, or compiler commands. Closing the workbench
or switching workspace paths discards the in-memory library.

## Manage presets

1. Enter a literal search query and configure matching options.
2. Choose the project directory scope, descendant flag, filename substring and
   optional numbered batch.
3. Open **Manage search presets**.
4. Enter a name and select **Add current search as preset**.
5. Select a saved preset to inspect its settings.
6. Rename it, review replacing its saved settings with the current controls,
   remove it, or explicitly confirm clearing the library.

The library supports up to 24 distinct case-insensitive preset names.
Replacing settings is an explicit review operation: changing the proposed
controls or the library before confirming invalidates the review.

## Apply a preset

Select **Review applying selected preset** to see the current and proposed
controls plus the selected eligible label count. Expand the label review
when exact membership matters.

The review is based on the current Explorer listing. An unavailable
directory, empty eligible scope, stale batch choice, or unsafe label prevents
application. Changing the controls, saved library or reviewed eligible label
membership before confirming requires a new review.

**Confirm apply search preset** only changes search settings. It invalidates
prior project results and replacement previews. The existing open-buffer
search may recompute as its ordinary controls change; no native project
search, compiler command, replacement, or file write is initiated.
Press **Search Project** explicitly to read the selected project scope.

## Portable backup

The backup is a versioned JSON text representation of names, literal queries,
case/whole-word flags, directory labels, filename substrings and optional batch
numbers. It is hidden by default. Enable **Show portable backup including
search queries and scope settings** only when you intend to copy that private
information. The backup excludes native paths, source content, replacement text,
internal library identities and compiler configuration.

To import, paste a supported backup, review the names and settings, and
explicitly select new records. Existing names are never overwritten.
An identical record is skipped; a conflicting name is left unchanged. Invalid
schemas, extra fields, malformed text, duplicate names and excessive sizes are
rejected. The selected merge is atomic within the in-memory library and is
rechecked against the reviewed backup and current capacity.

Imported directory and batch settings do not grant access to native paths.
They must pass the current listing review before they can be applied.

## Desktop acceptance

- Create two presets with different flags and scope; review one and apply it.
  Confirm the search controls change, while no native search starts.
- Start an apply review and modify the current query; confirm the stale review
  is rejected.
- Create a numbered-batch preset, change the listing so that batch is no longer
  available, and verify application is blocked.
- Review replacement, change the proposed controls, and verify that stale
  replacement cannot modify the saved record.
- Export after explicit opt-in, import a new name and an existing conflicting
  name, and confirm only selected new presets are added.
- Verify that an unsupported backup does not modify the library.
- Close the workbench and reopen it; confirm the in-memory library is empty.
