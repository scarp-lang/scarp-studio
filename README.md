# Scarp Studio

**Scarp Studio** is an Apache-2.0 desktop IDE for the **Scarp programming language only** (`.srp`). It is built with Tauri 2, Rust, React/TypeScript and Monaco Editor, with Windows 11 as the initial target.

## Published version vs. development work

- **Published:** [`v0.0.1-alpha.2`](https://github.com/scarp-lang/scarp-studio/releases/tag/v0.0.1-alpha.2), released 2026-11-12. This is an **experimental, unsigned Windows x64 editor-only pre-release**; it does *not* ship native Scarp Run/Verify, structured diagnostics or full project tools. Interactive Windows 11 acceptance is still incomplete. Use disposable sources and back up your files.
- **Unreleased development:** the full compiler-integrated IDE is under review in [consolidated integration PR #55](https://github.com/scarp-lang/scarp-studio/pull/55), which brings the stacked feature drafts and editor-safety improvements together against protected `main`. It remains a **draft Windows testing candidate**, not a published build or an approved stable IDE. PR #43 does not change the installer attached to the published alpha.2 release.
- **Next candidate:** the source package identifies the development target as `0.0.2-alpha.1`, but a version string in source is **not** a published release or approval to publish one.

## Features in the current development branch (not in alpha.2)

- Scarp-only Monaco editing, conservative syntax highlighting, hover, completion snippets, `funcra` outline, starter programs, multiple tabs and dirty-state preservation.
- **Current-main editor safety retained:** locally validated/persisted font size, tab size and word wrap; live Save As collision guards; serialized native confirmation dialogs; 4 MiB UTF-8 source limits and selected-folder file membership restrictions.
- **Save All (integrated draft):** Ctrl+Alt+S, toolbar and command palette save modified Scarp tabs in sequence, preserving newer edits and stopping on cancellation, external modifications or path collisions. It never auto-runs code.
- **Reload from Disk (integrated draft):** toolbar and Commands palette explicitly refresh a saved .srp tab after external edits. A dirty tab requires discard confirmation; tab switches and concurrent edits cancel stale reloads. This feature never auto-executes code.
- **Native Open dialog safety:** selecting an already-open .srp tab reuses its unsaved buffer without reading a moved, missing or externally modified file; new reads are rejected if the active tab switches **or its contents change** before completion. Save and Ctrl+W choose their targets from the latest synchronous editor state. Monotonic per-tab edit revisions reject A→B→A (ABA) races during close, Reload, Replace All/Undo, and search navigation.
- **Alpha.11 editor support:** exact `decimal` type highlighting, checked base-10 conversion/rounding/formatting help, `input_decimal` assistance and two opt-in decimal starter examples. These require a separately installed official Scarp compiler v0.0.6-alpha.11+ to run.
- **Alpha.12 editor support (unreleased draft):** syntax highlighting and completion/hover assistance for typed records, variants, exhaustive `match on`, concrete `option<T>` / `result<T,E>`, immutable `list<T>` and deterministic `map<K,V>` operations; four additional opt-in starters. These require a separately selected official [Scarp v0.0.6-alpha.12](https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.12) interpreter and are not supported by older compiler executables or experimental native aggregate backends.
- **Alpha.13 official compiler compatibility (unreleased draft):** packaged Windows CLI integration checks pin the published alpha.13 archive SHA-256 and verify both success and error propagation plus Studio's native process service. The new alpha.13 cache and workspace-generation functions are **Rust embedding APIs**, not new desktop CLI features; Studio does not claim to expose them.
- **Native exit-confirmation safety (unreleased draft):** pending discard confirmation validates all tabs, active focus, untitled-tab sequence and a monotonic editor-session revision, not just dirty tabs. Clean-tab edits, saves, close/reopen of identical saved files and focus-switch ABA invalidate stale exit approval.
- **Native-read and search freshness (unreleased draft):** Open, listed Explorer reads and Reload recheck the whole editor session after delayed native operations, including focus-switch-back ABA. A saved source reopened with identical bytes receives a new monotonic document revision; old search hits and Replace All snapshots must fail closed.
- **Safer Windows file identity (unreleased draft):** duplicate-tab and Save As collision guards now also recognize ordinary absolute drive/UNC dot-segment aliases (`.` and `..`), without crossing roots or treating device/extended-literal paths as ordinary aliases. Compiler diagnostics match bare Windows source basenames without case sensitivity; POSIX basename matching remains case-sensitive.
- **Project and outline consistency (unreleased draft):** disk-backed Run Project no longer disables for dirty untitled/unrelated tabs; the pre-execution dirty-file guard normalizes safe Windows project aliases (including `src\\..\\main.srp`) while rejecting traversal above a root. Function outline locations now use the same lone CR/LF/CRLF line rules as search and diagnostics.
- **Exact Verify snapshot identity (unreleased draft):** F8 diagnostic navigation and Monaco error underlines now require the same tab ID, saved source bytes and monotonic per-tab revision captured at explicit Verify. Editing A→B→A, saving unchanged bytes or reopening the same path cannot resurrect a stale error marker; switching focus without editing still permits navigation.
- **Verify tab-switch continuity (unreleased draft):** previous error positions now survive opening or editing *other* tabs; the editor discards the stored diagnostic snapshot only when its exact verified source changes or closes. This resolves F8 navigation loss after safe focus changes without permitting stale results.
- Ctrl+P **Quick Open** for existing tabs plus *already-listed* project sources (root, `src/`, `tests/`, `examples/`); Ctrl+Shift+P commands, Ctrl+G line navigation, Ctrl+Shift+F search across **open buffers only**, Ctrl+B Explorer, F8 for an applicable verified-source diagnostic.
- **Consistent source coordinates (unreleased draft):** search previews, UTF-16 result positions, Scarp diagnostic navigation and Monaco error underlines recognize lone CR, LF and paired CRLF exactly as editor line boundaries. Mixed line endings and Unicode text are covered by regression tests.
- **Find and Replace (new draft):** preview literal replacements in at most 32 already-open Scarp buffers; reject incomplete searches, excessive replacement text and stale snapshots. A native confirmation applies edits atomically to buffers **only**, after rechecking **every** open buffer (including tabs without initial matches). **Undo Last Replace All** can revert the entire in-memory batch only while every open tab remains unchanged; saving, closing, editing or adding a tab invalidates that undo. No on-disk project-wide replacement, automatic saving or uncontrolled filesystem traversal.
- **Exact search-result budget (unreleased draft):** a complete search with exactly 200 hits is no longer incorrectly flagged as truncated; a 201st hit triggers truncation, preserving strict all-or-nothing Replace All limits. Regression tests cover matching across multiple tabs.
- User-selected Scarp project Explorer with bounded listing (200 files, up to 4096 inspected entries per directory); no arbitrary-recursive or network project scanning. **Refresh Explorer** manually re-scans only the selected folder without a new native chooser, preserves open buffers and retains the old listing if a scan fails. Project source opens share the native file-operation gate; existing tabs activate without re-reading disk, while delayed reads cannot steal focus after a tab, folder, **or active-buffer edit** changes.
- User-selected **official Scarp compiler executable** for explicit source Run, static Verify and Stop; bounded process/output limits, version capability checks, and preloaded optional stdin/prompt input. No shell invocation, automatic execution, or arbitrary compiler discovery.
- Explicit project Info, Verify Project, Run Project, List Tests and Run Tests workflows when supported by the selected official compiler. Structured test reports are parsed only for the audited schema/capabilities and raw output is retained.
- Saved-source validation, external-change protection, **4 MiB chunk-bounded UTF-8 reads through scoped Tauri file handles**, stale diagnostic guards and safe native close prompts. Handles are always closed; a second same-handle metadata check rejects detectable changes during reading (size, modification time or regular-file status). This is best-effort consistency checking, not an atomic filesystem snapshot.

## Develop and test (Windows 11)

Install Node.js 22+, Rust stable with the MSVC toolchain, Visual Studio C++ Build Tools and the [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/). Then run:

```powershell
npm ci
npm run typecheck
npm test
npm run tauri dev
```

For local Rust validation and a development executable:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
npm run tauri build -- --no-bundle
```

Pull-request CI tests separately SHA-256-pinned official Scarp alpha.10, alpha.11, alpha.12 and alpha.13 compiler archives, builds a Windows executable and an unsigned NSIS installer **candidate**, and uploads checksums. An offline PowerShell verifier (`scripts/verify-windows-artifacts.ps1`) checks both artifacts against their exact-run checksum manifest; CI also tests that a tampered executable is rejected. This does not execute the binaries, prove remote provenance by itself, or replace Windows GUI acceptance.

For repeatable Windows GUI verification, see the [Windows 11 acceptance matrix](docs/windows-11-acceptance.md). It records actual GUI outcomes separately from automated CI; no release is authorized by that document.

## Review and safety gates

- [ ] Exact-head Windows CI must pass for the intended candidate.
- [ ] Complete hands-on Windows 11 launch, folder picking, nested source access, open/save/discard, Run/Verify/Stop, project-test workflows and prompt-input scenarios.
- [ ] Confirm Tauri filesystem permissions work for dynamically selected nested folders, including denied and symlink/junction cases.
- [ ] Verify dirty-tab safety, project switching and cancellation during in-flight source reads.
- [ ] Review the integrated [PR #55](https://github.com/scarp-lang/scarp-studio/pull/55), compare its retained current-main safeguards, and record Windows GUI acceptance before any merge/release. Never publish a tag or installer solely because a draft PR is green.

Track [M1 manual acceptance](https://github.com/scarp-lang/scarp-studio/issues/2), [M2 compiler integration](https://github.com/scarp-lang/scarp-studio/issues/3) and [M3 workspace experience](https://github.com/scarp-lang/scarp-studio/issues/4).

## Support

Optional [GitHub sponsorship](https://github.com/sponsors/sanskarIN) supports development and testing without guaranteeing access to unreleased builds.

**Source:** https://github.com/scarp-lang/scarp-studio  
**Official compiler:** https://github.com/scarp-lang/scarp
