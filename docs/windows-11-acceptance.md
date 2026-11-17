# Scarp Studio — Windows 11 manual acceptance (development candidate)

This is a **manual verification worksheet** for the draft integrated IDE candidate in [PR #46](https://github.com/scarp-lang/scarp-studio/pull/46), stacked on [PR #43](https://github.com/scarp-lang/scarp-studio/pull/43). It is not evidence that any GUI check passed. Mark each test **PASS**, **FAIL**, or **NOT RUN**, recording the build SHA and evidence before considering a merge or release.

## Test environment and provenance

- Windows 11 x64, current WebView2 runtime; use a disposable test account or virtual machine if available.
- Download the exact-head Windows executable/unsigned NSIS **candidate** from the successful PR #46 GitHub Actions run, not from the published alpha.2 tag. Inspect each artifact's expected SHA-256 in the workflow-produced checksum file; record the actual hash from `Get-FileHash <path> -Algorithm SHA256`.
- Record: Scarp Studio source commit, CI run URL, candidate exe SHA-256, installer SHA-256, Windows build, and any code signing information. An unsigned installer is **not** a stable release. Respect Windows security warnings; investigate them rather than bypassing device protection.
- Obtain the official Scarp `v0.0.6-alpha.12` Windows compiler separately from its [GitHub release](https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.12) and verify the Windows ZIP archive SHA-256:
  `5e1fdd2f0f1631de170dd785ae23d9b87b9406463f8385b7454a43a00c96cd2c`.
- Check `scarp.exe --version` reports `scarp 0.0.6-alpha.12`. Scarp Studio must require explicit selection and trust confirmation of that compiler; it must not download or run one automatically.
- Use only disposable `.srp` files in a test directory, e.g. `C:\\ScarpStudioAcceptance`; keep backups of any data you care about. Never test overwrite handling using real projects.

## Core editor and saved file behavior

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| E01 | Launch exact-head Windows executable, create a new `.srp`, edit, Save As and reopen | Text matches exactly; only `.srp` accepted; no automatic execution | NOT RUN |
| E02 | Open two different `.srp` files, change both, use **Save All** or Ctrl+Alt+S | Both files saved, no tab lost, no overlapping Save As prompts | NOT RUN |
| E03 | Create three dirty untitled tabs, Save All, choose a path for first and cancel the second picker | First completed save remains; third tab stays unsaved; no forced closure | NOT RUN |
| E04 | Reinvoke Save All after E03, save the remaining tabs | No duplicate overwrite or skipped dirty buffer | NOT RUN |
| E05 | With a named file open, change the on-disk file externally, edit it in Studio and Save/Save All | Studio reports external changes and does **not** overwrite the external version | NOT RUN |
| E06 | Make two tabs target the same path through Save As (including case difference on Windows) | Conflicting destination refused without overwriting another open tab | NOT RUN |
| E07 | Trigger Save All, edit a later dirty tab while an earlier native Save As chooser is open | Later tab's latest content is used when its turn begins; older content is never falsely marked saved | NOT RUN |
| E08 | Change source while an unsaved-close confirmation is open; then confirm discard | Newer edits remain protected and closing is refused until reconsidered | NOT RUN |
| E09 | Open editor settings: change font size, tab width, wrap; restart and restore defaults | Preferences persist locally, then reset correctly without changing source text | NOT RUN |
| E10 | Open native File/Folder chooser, try another picker, save, compiler selection or window exit | No stacked dialogs, no forced exit while chooser is unresolved | NOT RUN |
| E11 | Run project tests and attempt to save a source or switch the selected project folder during the operation | Studio prevents conflicting writes/folder switching until command completion or Stop | NOT RUN |
| E12 | Edit a clean saved .srp file externally and choose Reload in Studio | Source content and saved snapshot update to disk text without running code | NOT RUN |
| E13 | Modify a dirty Studio tab and its on-disk source externally, click Reload and cancel | Unsaved Studio edits remain intact | NOT RUN |
| E14 | Repeat E13, make further edits while the confirmation is open, then accept | Reload refuses stale confirmation; a fresh confirmation can reload external content | NOT RUN |
| E15 | Begin Reload, then switch tabs or change source before disk read finishes | No stale reload replaces the changed or switched tab; native dialogs do not stack | NOT RUN |

## Project Explorer, scopes and navigation

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| P01 | Choose a disposable Scarp project with root, `src/`, `tests/` and `examples/` `.srp` files | Explorer shows listed files from these bounded locations only | NOT RUN |
| P02 | Ctrl+P, open a listed nested `.srp` source, and switch folders while a read is pending | Only current folder-listed files are opened; no stale former-project activation | NOT RUN |
| P03 | Include unrelated deep folders, a junction/symlink and inaccessible subfolder in disposable project | No unbounded walk; denied folders surfaced; links are not followed | NOT RUN |
| P04 | Fill project with more than 200 listed `.srp` candidates | UI explains truncation; never displays more than 200 sources | NOT RUN |
| P05 | Test search across open buffers, Go to Line, function outline and Ctrl+Tab | Navigation uses current buffer contents and cannot navigate to stale search offsets | NOT RUN |
| P06 | Add, rename or remove .srp files on disk while Explorer is open, then click Refresh Explorer | Current root/src/tests/examples listing updates without a folder chooser or changing open tab contents | NOT RUN |
| P07 | Deny read access to a disposable selected folder, then click Refresh Explorer | Error shown; previous Explorer entries and dirty editor contents remain intact | NOT RUN |
| P08 | Open a listed .srp tab, make unsaved edits, then delete/rename its source externally; click its Explorer row | Existing dirty tab receives focus without re-reading disk or losing edits | NOT RUN |
| P09 | Start opening a large but permitted listed .srp file, then click another tab or request app exit | Stale read never steals focus, tab changes remain intact, window exit waits for read | NOT RUN |
| P10 | While a listed project source is opening, attempt Save As, Choose Folder or Refresh Explorer | Operations do not overlap and no partially read source is opened | NOT RUN |
| P11 | Find two occurrences in two different open saved .srp files, preview a literal replacement and cancel confirmation | Neither buffers nor disk files change | NOT RUN |
| P12 | Repeat and confirm replacement; inspect original sources on disk before Save All | Only expected open buffer text changes; files remain unchanged on disk until saved | NOT RUN |
| P13 | Edit one tab while native Replace confirmation is open, then approve | All-or-nothing stale-snapshot check rejects the entire replacement; no other buffers are modified | NOT RUN |
| P14 | Try replacing a query returning more than 200 matches or a 257-character replacement | Preview refuses partial or oversized operation; no files modified | NOT RUN |

## Official compiler alpha.12 (interpreter)

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| C01 | Explicitly select verified official alpha.12 `scarp.exe`, accept trust prompt | Studio reports version; remains idle until explicit Run or Verify | NOT RUN |
| C02 | Create **Typed Records** starter; save, Verify, Run | Record syntax verified; result prints `Review` | NOT RUN |
| C03 | Create **Tagged Variants** starter; save, Verify, Run | Exhaustive case match executes; output contains `42` | NOT RUN |
| C04 | Create **Typed Lists and Maps** starter; save, Verify, Run | Interpreter evaluates immutable snapshots and typed map lookup | NOT RUN |
| C05 | Create **Option Propagation** starter; save, Verify, Run | Checked optional early return works; result displays `true` | NOT RUN |
| C06 | Open alpha.11 exact decimal starter with alpha.12, Verify/Run; test decimal prompt with preloaded input | Exact decimal and prompted input work in supported mode | NOT RUN |
| C07 | Try to Run an unsaved/dirty source | Studio does not execute a misleading saved-on-disk snapshot | NOT RUN |
| C08 | Stop a long-running disposable Scarp program | Native process terminates without hanging or losing source edits | NOT RUN |
| C09 | Project Info, Verify Project, Run Project, List Tests, Run Tests in disposable project | Compiler output and structured test report match actual CLI support | NOT RUN |
| C10 | Choose an older official compiler and attempt an alpha.12-only program | Unsupported syntax is reported; Studio does not claim that old CLI executed alpha.12 | NOT RUN |

## Diagnostics, packaging and release gate

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| D01 | Verify a deliberately invalid saved `.srp` source, inspect error, navigate via F8 | Error location points to the unchanged verified source only | NOT RUN |
| D02 | Edit or switch tabs after Verify before clicking an old error location | Stale diagnostic navigation is disabled | NOT RUN |
| D03 | Confirm source read and input size limits; record visible user errors | Oversized sources and prompt data fail closed | NOT RUN |
| D04 | Inspect unsigned NSIS candidate, installation/uninstallation, warnings, and Windows executable launch | Record observed behavior; do not treat a successful installer build as GUI acceptance | NOT RUN |
| D05 | Confirm SHA-256 checksums for both candidate artifacts; review logs, dependencies, compiler provenance | Build metadata and compiler signatures/checksums are documented | NOT RUN |

**Release decision:** Leave PR #46 and parent PR #43 as drafts while any required item is NOT RUN or FAIL. Record failures as reproducible cases (exact commit, OS build, steps, expected/actual behavior, logs/screenshots) before requesting another candidate. Do not tag, publish or claim stable readiness based only on CI success.
