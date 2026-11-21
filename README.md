# Scarp Studio

Scarp Studio is an Apache-2.0 desktop IDE **exclusively for the Scarp programming language** (.srp files).

**Status:** [`v0.0.1-alpha.2`](https://github.com/scarp-lang/scarp-studio/releases/tag/v0.0.1-alpha.2) was published on 2026-11-12 as an **experimental, unsigned Windows x64 pre-release**. It is an editor-only maintenance release; Windows 11 GUI acceptance remains pending. Use disposable test files and keep backups.

**Not in the released alpha:** Run, Verify, Stop and structured error navigation. These are under review in [draft PR #5](https://github.com/scarp-lang/scarp-studio/pull/5) and [draft PR #6](https://github.com/scarp-lang/scarp-studio/pull/6). Neither PR is merged or published.

**This development branch:** The unreleased `v0.0.2-alpha.1` candidate adds explicit, bounded Scarp compiler execution. Its Windows GUI and native process safety acceptance checks are still open; no new release has been created.

## Implemented in this branch

- Tauri 2 native desktop host, Rust services boundary, React/TypeScript frontend and Monaco editor.
- Scarp syntax coloring (conservative subset of the scarp-vscode grammar), open/edit/save and Save As for .srp.
- Multi-tab editing with dirty indicators, native unsaved-change prompts, keyboard shortcuts, light/dark theme.
- The published alpha.2 added protection against overlapping native discard prompts; the development branch retains this safeguard with compiler-aware close guards.
- Folder picker with top-level .srp listing (recursive explorer planned).
- User-selected filesystem scopes only. No shell access and **no fake compiler execution**.
- Experimental compiler selection, version/capability checks, Run, Verify, Stop and bounded output are implemented on the draft compiler branch (PR #5), not in the published alpha.

## Compiler auto-discovery (additional unmerged draft)

An experimental stacked branch adds **Scan Compiler** and **Download Compiler** controls.
At startup Studio searches standard Scarp installation folders, PATH entries and a bounded
shallow scan of `Downloads/Scarp*` extracted folders. It does **not** recursively scan
the entire drive. Automatic discovery does not execute any found file.

On Windows, **Download Compiler** opens the official alpha.17 ZIP used in CI
(the action does not install or execute it). After downloading, extract it
into a `Scarp`-named folder in Downloads (or install in a standard location), then
return to Studio; it rescans on focus, and **Scan Compiler** is always available.
**Run** (Ctrl+F5) or **Verify** (Ctrl+Shift+F5) can also start a new scan if
no compiler was detected at startup. The first Run or Verify asks for explicit
executable trust confirmation and checks the compiler's version and supported
commands; further runs in that session need no file picker. Studio rechecks
the current saved file after the consent dialog, so an edit, Save As, or tab
switch during setup cannot silently execute stale source. The optional manual
compiler selection fallback remains.
There is no unattended installer, no automatic code execution and no trust
carried across restarts. This feature is **not in the published alpha.2**.

## Settings and Auto Save (additional unreleased draft)

Open **Settings** from the top toolbar or use **Ctrl+,**. Press Escape or
**Close** to return to your open source file. Preferences are local to this
device and are validated before loading; compiler executable paths are **never
stored or trusted across application restarts**.

- **Auto Save** is opt-in and **off by default**. Choose an idle delay of 1,
  3 (default) or 5 seconds. It saves *only already-saved, dirty* `.srp` files
  without opening OS dialogs, including dirty files in background tabs.
  Untitled files still require an initial manual **Save** or **Save As**.
- Auto Save uses the same on-disk comparison as manual saving: if another
  application changes a file, Studio refuses to overwrite it and reports the
  conflict. Edits made while a write completes remain dirty. Timers are
  cancelled while Run/Verify is executing to avoid changing compiler inputs.
- **Editor settings:** dark/light theme, font size (12–20 px), word wrap and
  minimap. Settings persist as local non-sensitive preferences; unavailable
  or corrupted local storage falls back to safe defaults.
- **Compiler settings:** show the full detected path, review and explicitly
  **Confirm this compiler location**, rescan, manually choose a compiler or
  open the official release download. The same path confirmation is shown on
  the first Run/Verify, before the executable is probed. No binary is executed
  on discovery, and compiler approval is session-only.

This is stacked on the **unreleased compiler discovery draft**, which itself
depends on the **unreleased Run/Verify/Stop PR #5**. No new pre-release is
approved. Windows 11 GUI/manual testing and full CI are required before merge.

## Development (Windows 11)

Install Node.js 22+, Rust stable with MSVC build tools, the Tauri 2 Windows requirements (WebView2), and run:

    npm ci
    npm run typecheck
    npm test
    npm run tauri dev

Optional: create an unbundled Windows executable with:

    npm run tauri build -- --no-bundle

CI builds an **experimental NSIS installer candidate**. Both `package-lock.json` and `src-tauri/Cargo.lock` are committed; CI uses `npm ci` and `cargo check --locked` to check reproducibility. A passing build is not a substitute for hands-on Windows file-save testing.

## Known limitations

- The **published** `v0.0.1-alpha.2` is editor-only: compiler Run/Verify/Stop, source diagnostics, completion and debugging are **not available there**. This draft development branch includes a native compiler service; structured diagnostic navigation is in the separately reviewed stacked PR #6. Completion, language-server integration and debugging remain unavailable. The official Scarp compiler lives at https://github.com/scarp-lang/scarp.
- Folder browsing currently lists only immediate .srp children; selected-folder filesystem scope behavior needs Windows verification.
- Only user-selected files are accessible, and dialog scopes are session-local. Reopen a file or folder after restarting.
- Automated Windows builds and package checksum checks passed for the published experimental release, but **hands-on launch/open/save/discard validation and unsigned-installer security review remain open** in [issue #2](https://github.com/scarp-lang/scarp-studio/issues/2). Later release candidates require their own gates; successful CI is not proof of GUI correctness.
- The next compiler-integrated release is **not yet published**. Manual Windows 11 testing and review are required for PRs #5 and #6; see [issue #3](https://github.com/scarp-lang/scarp-studio/issues/3).

**Repository:** https://github.com/scarp-lang/scarp-studio

## Experimental compiler integration (development branches only)

The `feat/scarp-compiler-run-verify` parent branch (PR #5) requires an explicitly selected trusted official `scarp.exe` on Windows, whereas this stacked draft adds opt-in automatic discovery and a direct official download link. Studio launches the compiler directly without a shell and limits execution time and captured output. Run and Verify require saved, unchanged `.srp` sources. Stop applies to the Studio-launched execution process; probing cannot yet be stopped through the same control.

The parent PR #5 CI pins Scarp `v0.0.6-alpha.8`, while this stacked draft CI pins and hashes the official Scarp `v0.0.6-alpha.17` Windows compiler archive, tests the actual `exec`/`verify` CLI surface, and checks that `assert(false)` verifies statically but fails at runtime with `E0065`. This **does not** bundle Scarp with Studio or automatically authorize another compiler binary; selection and trust confirmation remain session-specific. The editor still runs only saved standalone `.srp` files, not `scarp.project` commands or `scarp test`.

PR #5 shows compiler output as plain text. The stacked draft PR #6 adds structured JSON diagnostic navigation, guarded against stale edits and unrelated module paths. Interactive stdin (`read_line`), language-server features, and debugging remain unsupported. Do not run untrusted binaries or source.

## Support Scarp Studio

This is an experimental open-source IDE. Optional [GitHub sponsorship](https://github.com/sponsors/sanskarIN) helps support development and testing; sponsorship does not provide early access, private repository access, or guarantees about releases.

**Repository:** https://github.com/scarp-lang/scarp-studio
