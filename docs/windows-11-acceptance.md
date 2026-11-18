# Scarp Studio — Windows 11 manual acceptance (development candidate)

This is a **manual verification worksheet** for the consolidated development candidate [draft PR #55](https://github.com/scarp-lang/scarp-studio/pull/55), which integrates the older stacked drafts into one main-targeted review surface. It is not evidence that any GUI check passed. Mark each test **PASS**, **FAIL**, or **NOT RUN**, recording the build SHA and evidence before considering a merge or release.

## Test environment and provenance

- Windows 11 x64, current WebView2 runtime; use a disposable test account or virtual machine if available.
- Download the exact-head Windows executable/unsigned NSIS **candidate from the successful workflow run for the exact commit being tested** (latest stacked draft PR head), not an earlier parent build or the published alpha.2 release. Extract both artifact ZIPs into a **new dedicated folder** with exactly one `scarp-studio.exe`, one `*-setup.exe`, and the `SHA256SUMS.txt` from the same workflow run. Before launching either binary, run the repo's offline validator:
  `pwsh -File scripts/verify-windows-artifacts.ps1 -ArtifactDirectory 'C:\\ScarpStudioAcceptance\\artifacts' -SourceCommit '<exact 40-digit commit SHA>' -RunUrl 'https://github.com/scarp-lang/scarp-studio/actions/runs/<exact run ID>'`.
  This checks for missing, duplicate and modified artifacts, but **cannot prove** that a manually supplied run URL or manifest is genuine; verify provenance in GitHub first. Record the exact run URL, commit and results.
- Record: Scarp Studio source commit, CI run URL, candidate exe SHA-256, installer SHA-256, Windows build, and any code signing information. An unsigned installer is **not** a stable release. Respect Windows security warnings; investigate them rather than bypassing device protection.
- Obtain the official Scarp `v0.0.6-alpha.13` Windows compiler separately from its [GitHub release](https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.13) and verify the Windows ZIP archive SHA-256:
  `43a95c012bd04492994e338dc6070cd9af9b3d702e5bb04b10c0ca6e0e1559ce`.
- Check `scarp.exe --version` reports `scarp 0.0.6-alpha.13`. Scarp Studio must require explicit selection and trust confirmation of that compiler; it must not download or run one automatically.
- Use only disposable `.srp` files in a test directory, e.g. `C:\\ScarpStudioAcceptance`; keep backups of any data you care about. Never test overwrite handling using real projects.

## Core editor and saved file behavior

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| E01 | Launch exact-head Windows executable, create a new `.srp`, edit, Save As and reopen | Text matches exactly; only `.srp` accepted; no automatic execution | NOT RUN |
| E02 | Open two different `.srp` files, change both, use **Save All** or Ctrl+Alt+S | Both files saved, no tab lost, no overlapping Save As prompts | NOT RUN |
| E03 | Create three dirty untitled tabs, Save All, choose a path for first and cancel the second picker | First completed save remains; third tab stays unsaved; no forced closure | NOT RUN |
| E04 | Reinvoke Save All after E03, save the remaining tabs | No duplicate overwrite or skipped dirty buffer | NOT RUN |
| E05 | With a named file open, change the on-disk file externally, edit it in Studio and Save/Save All | Studio reports external changes and does **not** overwrite the external version | NOT RUN |
| E06 | Make two tabs target the same path through Save As (including case difference and ordinary `src\\..\\main.srp` path aliases on Windows) | Conflicting destination refused without overwriting another open tab | NOT RUN |
| E07 | Trigger Save All, edit a later dirty tab while an earlier native Save As chooser is open | Later tab's latest content is used when its turn begins; older content is never falsely marked saved | NOT RUN |
| E08 | Change source while an unsaved-close confirmation is open; then confirm discard | Newer edits remain protected and closing is refused until reconsidered | NOT RUN |
| E09 | Open editor settings: change font size, tab width, wrap; restart and restore defaults | Preferences persist locally, then reset correctly without changing source text | NOT RUN |
| E10 | Open native File/Folder chooser, try another picker, save, compiler selection or window exit | No stacked dialogs, no forced exit while chooser is unresolved | NOT RUN |
| E11 | Run project tests and attempt to save a source or switch the selected project folder during the operation | Studio prevents conflicting writes/folder switching until command completion or Stop | NOT RUN |
| E12 | Edit a clean saved .srp file externally and choose Reload in Studio | Source content and saved snapshot update to disk text without running code | NOT RUN |
| E13 | Modify a dirty Studio tab and its on-disk source externally, click Reload and cancel | Unsaved Studio edits remain intact | NOT RUN |
| E14 | Repeat E13, make further edits while the confirmation is open, then accept | Reload refuses stale confirmation; a fresh confirmation can reload external content | NOT RUN |
| E15 | Begin Reload, then switch tabs or change source before disk read finishes | No stale reload replaces the changed or switched tab; native dialogs do not stack | NOT RUN |
| E16 | Open a saved .srp tab, make unsaved changes, modify its still-existing on-disk source externally, then select the same file through native Open | Existing dirty tab is reactivated without rereading changed disk content; no edits discarded | NOT RUN |
| E17 | Start native Open, change the active tab **or edit its contents** before the picker or source read completes | Stale result does not activate another tab or overwrite any buffer; no overlapping file operations | NOT RUN |
| E18 | Immediately after switching tabs, press Ctrl+S or Ctrl+W | Save and Close target the currently active tab rather than the tab active before React rendered | NOT RUN |
| E19 | While a native Reload or discard prompt is open, edit the disposable source and restore its exact original text before confirming | Stale confirmation rejected due to newer edit revision even though source text matches | NOT RUN |
| E20 | During a window-exit discard confirmation, edit/save a formerly clean tab, create then close a disposable tab, **or close and reopen the exact same saved file**, then confirm exit | Whole-session revision rejects even identical-looking recreated tabs or focus-switch ABA; no newer session activity is lost | NOT RUN |
| E21 | Start a native Open file picker or dirty Reload confirmation; switch away from the active tab and back before completing the pending operation | Stale native result rejected even though active ID and source text are identical again | NOT RUN |
| E22 | Open a disposable Windows drive/UNC source through `src\\..\\main.srp` and then its ordinary equivalent; attempt Save As from another tab using the alias | Studio reuses the original unsaved tab; Save As rejects an occupied alias without overwriting; invalid above-root and device paths remain distinct | NOT RUN |
| E23 | Open a dirty source from a different Scarp project plus a dirty untitled tab, then select a clean project and use Run Project | Run Project remains enabled and operates only on the selected project's saved files; unrelated dirty buffers remain unchanged | NOT RUN |
| E24 | Open a dirty source in the selected project through a `src\\..\\main.srp` path alias and try Run Project / Verify Project / Run Tests | Studio blocks disk-backed project commands until the source is saved, even when its path contains a valid lexical alias | NOT RUN |

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
| P18 | Start opening a listed project source, type new text into the same active tab before read completes | Delayed Explorer read is rejected; no tab focus change or lost unsaved text | NOT RUN |
| P10 | While a listed project source is opening, attempt Save As, Choose Folder or Refresh Explorer | Operations do not overlap and no partially read source is opened | NOT RUN |
| P11 | Find two occurrences in two different open saved .srp files, preview a literal replacement and cancel confirmation | Neither buffers nor disk files change | NOT RUN |
| P12 | Repeat and confirm replacement; inspect original sources on disk before Save All | Only expected open buffer text changes; files remain unchanged on disk until saved | NOT RUN |
| P13 | Edit any tab (including a tab with no matches), or create another tab, while native Replace confirmation is open, then approve | All-or-nothing open-buffer snapshot check rejects the entire replacement; no other buffers are modified | NOT RUN |
| P14 | Try replacing a query returning more than 200 matches or a 257-character replacement | Preview refuses partial or oversized operation; no files modified | NOT RUN |
| P15 | Replace text across two open dirty .srp tabs, then click Undo Last Replace All without changing other tabs | Original in-memory contents and dirty flags restored together; no disk source changes | NOT RUN |
| P16 | Replace text, edit an unrelated open tab or Save one changed tab, then try Undo Last Replace All | Undo becomes unavailable; user edits and saved content are not reverted | NOT RUN |
| P17 | Replace text, switch active tabs without editing, then Undo Last Replace All | Undo remains available and preserves current tab focus | NOT RUN |
| P19 | After Replace All, edit then restore identical post-replacement text and try Undo Last Replace All | Monotonic revision invalidates stale Undo; no newer edit is silently erased | NOT RUN |
| P20 | Begin loading a listed project source, switch tabs away and back while its read is pending | Stale Explorer read never unexpectedly activates a new source | NOT RUN |
| P21 | Search or preview Replace All in a saved file, close and reopen that identical file, then try to use the old hit/preview | Reopened file has a newer generation; stale search navigation and Replace All are refused | NOT RUN |
| P22 | Open a disposable `.srp` buffer using mixed CR-only, CRLF and LF lines plus emoji; search across open buffers and navigate matching results | Search line/UTF-16 column numbers land at the actual Monaco locations; result previews do not include text from adjacent CR-only lines | NOT RUN |
| P23 | Open a `.srp` buffer with multiple `funcra` declarations separated by CR-only, CRLF and LF line endings; use the function outline to jump to each | Function outline line numbers and columns match Monaco positions, including declarations after lone CR | NOT RUN |

## Official compiler alpha.13 (interpreter CLI; alpha.12 source features remain supported)

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| C01 | Explicitly select verified official alpha.13 `scarp.exe`, accept trust prompt | Studio reports version; remains idle until explicit Run or Verify | NOT RUN |
| C02 | Create **Typed Records** starter; save, Verify, Run | Record syntax verified; result prints `Review` | NOT RUN |
| C03 | Create **Tagged Variants** starter; save, Verify, Run | Exhaustive case match executes; output contains `42` | NOT RUN |
| C04 | Create **Typed Lists and Maps** starter; save, Verify, Run | Interpreter evaluates immutable snapshots and typed map lookup | NOT RUN |
| C05 | Create **Option Propagation** starter; save, Verify, Run | Checked optional early return works; result displays `true` | NOT RUN |
| C06 | Open alpha.11 exact decimal starter with alpha.13, Verify/Run; test decimal prompt with preloaded input | Exact decimal and prompted input work in supported mode | NOT RUN |
| C07 | Try to Run an unsaved/dirty source | Studio does not execute a misleading saved-on-disk snapshot | NOT RUN |
| C08 | Stop a long-running disposable Scarp program | Native process terminates without hanging or losing source edits | NOT RUN |
| C09 | Project Info, Verify Project, Run Project, List Tests, Run Tests in disposable project | Compiler output and structured test report match actual CLI support | NOT RUN |
| C10 | Choose an older official compiler and attempt an alpha.12-only program | Unsupported syntax is reported; Studio does not claim that old CLI executed alpha.12 | NOT RUN |
| C11 | With official alpha.13, Verify/Run a result-propagation example that prints a value on Ok and forwards an Err unchanged | Exactly the expected output, no automatic execution; native Stop still available | NOT RUN |

## Diagnostics, packaging and release gate

| ID | Action | Required outcome | Result / evidence |
| --- | --- | --- | --- |
| D01 | Verify a deliberately invalid saved `.srp` source, inspect error, navigate via F8 | Error location points to the unchanged verified source only | NOT RUN |
| D02 | Verify an invalid saved source, switch to a different tab, then return to the original unchanged source and press F8 | Navigation is unavailable on the unrelated tab but remains available on the original unchanged verified tab | NOT RUN |
| D03 | Confirm source read and input size limits; record visible user errors | Oversized sources and prompt data fail closed | NOT RUN |
| D06 | Load a 4 MiB valid source, a 4 MiB + 1 byte source, then a source grown while opening; inspect file handles and UI responsiveness | Boundary accepted, oversized/growing sources refused with safe error; handle closed and no excessive allocation | NOT RUN |
| D07 | Reopen a UTF-8 Scarp source containing Hindi, emoji, BOM and CRLF; attempt an invalid UTF-8 file | Exact valid text roundtrips; malformed text is refused without corrupting an existing tab | NOT RUN |
| D08 | Verify a disposable syntax-error `.srp` source with mixed CR-only/CRLF/LF lines and non-BMP Unicode before the error location | F8 diagnostic navigation and the inline error underline target the correct Monaco line, UTF-16 column and Unicode scalar width | NOT RUN |
| D09 | With a Windows source `main.srp`, Verify an error for which the compiler emits the bare filename `MAIN.SRP`; repeat with a POSIX case-sensitive pair where possible | Windows basename diagnostic navigates to the matching open file, while distinct POSIX casing remains protected | NOT RUN |
| D10 | Verify a deliberately invalid saved `.srp`, then edit A→B→A, Save unchanged content, or close/reopen the same saved file; click the old error and press F8 | Old diagnostic navigation and error underline remain unavailable until another explicit Verify, even when the visible source text matches again | NOT RUN |
| D12 | Verify an invalid saved source, switch to another tab, edit or Save that unrelated tab, then return to the original untouched source | The original Verify diagnostic remains available and correctly underlined without rerunning Verify; unrelated text is never marked | NOT RUN |
| D11 | While opening a disposable .srp source, externally truncate or rewrite it, then retry opening when stable | Detectable size or modification-time changes during read are rejected; no mixed text silently replaces the editor buffer; file handle is closed | NOT RUN |
| D04 | Inspect unsigned NSIS candidate, installation/uninstallation, warnings, and Windows executable launch | Record observed behavior; do not treat a successful installer build as GUI acceptance | NOT RUN |
| D05 | Verify the exact-run candidate exe and NSIS installer using `scripts/verify-windows-artifacts.ps1`, then review build logs and compiler provenance | Both hashes match their trusted run manifest; duplicate, missing, corrupted or mixed-run files fail closed; no candidate binaries executed by validator | NOT RUN |

**Release decision:** Keep consolidated PR #55 and its stacked source PRs in draft while any required item is NOT RUN or FAIL. Record failures as reproducible cases (exact commit, OS build, steps, expected/actual behavior, logs/screenshots) before requesting another candidate. Do not tag, publish or claim stable readiness based only on CI success.
