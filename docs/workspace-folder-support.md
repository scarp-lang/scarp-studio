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

- Scanning is non-executing and never reads source contents. Only valid, non-symlink directory names observed from native readDir are joined under the user-selected scope.
- Hidden, dependency/build and unsafe traversal directory entries are skipped.
- At most **64 directories** (including selected root), **5 nested levels**, and **200 listed Scarp sources**, with the prior **4096-entry** ordinary inspection budget per directory. Native readDir materializes its immediate directory before these frontend limits apply.
- Unreadable nested folders are reported; accessible siblings remain visible.
- Existing editor snapshot guards, 4 MiB source limits, external-modification protection, Save As checks and post-write read-back stay intact.
- Scarp **project** compiler actions still act on the selected root; to run a standalone nested practice file, open that .srp source in the editor.

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
