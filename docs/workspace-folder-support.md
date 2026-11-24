# Nested Scarp practice workspaces

A single selected folder can contain multiple small Scarp projects:

    Scarp-Practice/
      basic_tuple/
        main.srp
        examples/
          tuple.srp
      conditions/
        if.srp
      empty_project/

Choose the **Scarp-Practice** parent folder once. Explorer headings include nested folders (even empty ones) and sources underneath. Select a nested .srp file, edit, then press Ctrl+S to save its original path. Quick Open also lists nested sources.

## Limits and security

- Folder selection requests a Tauri recursive *dynamic* scope for the specifically chosen root. Without `recursive: true`, Tauri can deny access to child folders even when the scanner finds them. No global filesystem scope is granted.
- Scanning is non-executing and never reads source contents. Only valid, non-symlink directory names observed from native readDir are joined under the user-selected scope.
- Hidden, dependency/build and unsafe traversal directory entries are skipped.
- At most **64 directories** (including selected root), **5 nested levels**, and **200 listed Scarp sources**, with the prior **4096-entry** ordinary inspection budget per directory. Native readDir materializes its immediate directory before these frontend limits apply.
- Unreadable nested folders are reported; accessible siblings remain visible.
- Existing editor snapshot guards, 4 MiB source limits, external-modification protection, Save As checks and post-write read-back stay intact.
- Scarp **project** compiler actions use the explicitly chosen manifest-bearing **Project target** (which can be a nested folder). To run a standalone nested practice file, open that .srp source in the editor.

## Generate a disposable Windows fixture

For a new path that does not already exist, run the repository's
`qa/windows/create-nested-practice-fixture.ps1` script with
`-Destination "C:\Temp\Scarp-Practice"` from PowerShell. The script
never deletes or overwrites existing files, executes Scarp code, or
opens a compiler. Use `-WhatIf` to preview first. Choose the created
parent folder in Scarp Studio and follow acceptance case P40.

## Windows 11 manual acceptance — NOT RUN

1. Create the folder layout above, plus another nested source named tuple2.srp.
2. Open the parent workspace; confirm empty and populated folder headings and Expand/Collapse All behavior.
3. Open basic_tuple/main.srp, edit, Ctrl+S, verify the disk bytes changed and the editor no longer shows an unsaved marker.
4. Make another local edit while independently changing that disk file. Confirm unsafe Save is refused, dirty text is retained and Save As can preserve a separate copy.
5. Check Quick Open, Search Project across nested paths (including unsaved buffer search), path filter, Refresh after file creation/rename, duplicate `main.srp` tab labels, two dirty tabs and folder switch during a slow read.
6. Check inaccessible/symlinked directories and depth/count limit warnings, including more than 63 children.

Automated checks are not evidence of actual Windows GUI acceptance.


## Nested project commands

Project commands operate on a specific manifest root, not necessarily the
Explorer workspace root. Select the parent workspace once, then use the
**Project target** selector to choose a discovered nested directory containing
a regular `scarp.project` or `Scarp.project`. The scanner checks only native
directory entry metadata; it does **not** parse or execute the manifest.
The selected compiler validates the manifest on an explicit project action.

The existing disposable P40 fixture intentionally contains standalone
Scarp files rather than claiming to create valid official project manifests.
For P41, create valid projects with the independently trusted official Scarp
compiler's `init` command, then open their common parent. Switch the project
selector and verify that project commands act on the chosen child directory,
not the parent or sibling project. Confirm any structured test source link
matches an exact currently listed test within that selected child project.

## Save As and Explorer refresh

After a successful verified first Save or changed-path Save As, Studio
re-scans the current authorized workspace and updates the Explorer listing.
Normal Ctrl+S of an existing source does not rescan. If the rescan fails, the
source remains saved but the user sees a manual **Refresh Explorer** hint.
If Save All stops after some successful new saves, the Explorer still attempts
to refresh; the original failure remains visible and later tabs remain dirty.

### Structured test report visibility

Reports from a selected nested project must appear in the compiler panel even
when the Explorer is showing a different parent workspace. Visibility and
test-source navigation use the same current project-root identity (including
safe Windows path aliases); a sibling project's report is never displayed.

### Automatic project target selection

If the selected workspace itself has a project manifest, project commands
target its root by default. If the workspace root has **no** manifest but
contains exactly one scanned manifest-bearing child, that child is selected
automatically. When two or more nested projects exist, the user must choose
the intended **Project target** explicitly. Refresh preserves a selected,
still-present project, but retires a removed project target instead of running
against its stale path.

## Automated compiler integration coverage

The Windows CI workflow creates two independent official Scarp projects
inside a shared manifest-less workspace, changes each child entrypoint to a
unique marker, and verifies **Info**, **Verify** and **Run** against each child
path. This checks pinned compiler compatibility and sibling isolation without
claiming that a headless workflow has exercised Tauri's GUI. The Windows P41
manual acceptance case remains required.

### Switch project to match the active file

When the active editor tab is an **already-listed** Scarp source belonging to
a different manifest-bearing child project, Studio offers **Use Active File's
Project** next to the project selector. It resolves the deepest containing
manifest root among the folder scanner's verified entries. This is an explicit
UI action: opening a file never silently changes the project to execute.
Unlisted paths, unsafe source labels and paths from other workspaces cannot
populate the action. Switching targets retires the previous project's
structured test results and marks prior project output as historical.

### Direct project selection from Explorer

Every discovered manifest-bearing folder shows a compact **Use Project**
control alongside its Explorer heading (or a **Project ✓** indicator when it
is already selected). This only changes the target for later, explicitly
requested project commands; it never runs code. Even an empty manifest-bearing
workspace root remains visible as an Explorer group. The existing bounded
scanner and current project-root membership are still authoritative.


## Source Insights — read-only active buffer analysis

The Explorer includes a collapsed **SOURCE INSIGHTS** section. Expand it to
analyze the active in-memory Scarp buffer. It exposes approximate line counts,
functions, pure functions, records, variants, imports, loops, branch markers,
comments and maximum brace nesting depth. Its review notes flag mixed newline
conventions, mixed tabs/spaces in indentation, trailing spaces, long lines,
unclosed strings and apparently unbalanced brace delimiters.

The panel also indexes line-comment tasks such as TODO, FIXME, BUG, REVIEW,
NOTE, HACK and XXX, optionally with a short owner. You can filter by text,
task kind, severity, sort source/priority, and page through 24 task entries at
a time. Clicking an item navigates to its exact in-memory line/column *only if
the document ID, revision and exact buffer are still current*. Text in strings
does not create fake comment tasks. The UI renders task descriptions as escaped
plain React text: task comments cannot inject executable markup or links.

**Security and scope:** This feature never runs Scarp, invokes a compiler,
reads files from disk, sends network traffic, persists task comments or
modifies source code. Large buffers are limited to 512 Ki UTF-16 units and
24,000 lexical tokens, with 200 visible tasks maximum. A partial scan is
always labeled incomplete. These insights are useful review heuristics, not
compiler diagnostics or proof of correct syntax.
