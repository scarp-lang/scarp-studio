# Scarp Studio

Scarp Studio is an Apache-2.0 desktop IDE **exclusively for the Scarp programming language** (.srp files).

**Status:** [`v0.0.1-alpha.1`](https://github.com/scarp-lang/scarp-studio/releases/tag/v0.0.1-alpha.1) was published on 2026-11-11 as an **experimental, unsigned Windows pre-release**. The editor foundation is present on `main`; interactive Windows 11 GUI acceptance is still pending. Use only test files until that validation is complete.

**Not in the released alpha:** Run, Verify, Stop and structured error navigation. These are under review in [draft PR #5](https://github.com/scarp-lang/scarp-studio/pull/5) and [draft PR #6](https://github.com/scarp-lang/scarp-studio/pull/6). Neither PR is merged or published.

**This development branch:** The unreleased `v0.0.2-alpha.1` candidate adds explicit, bounded Scarp compiler execution. Its Windows GUI and native process safety acceptance checks are still open; no new release has been created.

## Implemented in this branch

- Tauri 2 native desktop host, Rust services boundary, React/TypeScript frontend and Monaco editor.
- Scarp syntax coloring (conservative subset of the scarp-vscode grammar), open/edit/save and Save As for .srp.
- Multi-tab editing with dirty indicators, native unsaved-change prompts, keyboard shortcuts, light/dark theme.
- Folder picker with top-level .srp listing (recursive explorer planned).
- User-selected filesystem scopes only. No shell access and **no fake compiler execution**.
- Experimental compiler selection, version/capability checks, Run, Verify, Stop and bounded output are implemented on the draft compiler branch (PR #5), not in the published alpha.

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

- The **published** `v0.0.1-alpha.1` is editor-only: compiler Run/Verify/Stop, source diagnostics, completion and debugging are **not available there**. This draft development branch includes a native compiler service; structured diagnostic navigation is in the separately reviewed stacked PR #6. Completion, language-server integration and debugging remain unavailable. The official Scarp compiler lives at https://github.com/scarp-lang/scarp.
- Folder browsing currently lists only immediate .srp children; selected-folder filesystem scope behavior needs Windows verification.
- Only user-selected files are accessible, and dialog scopes are session-local. Reopen a file or folder after restarting.
- Automated Windows builds and package checksum checks passed for the published experimental release, but **hands-on launch/open/save/discard validation and unsigned-installer security review remain open** in [issue #2](https://github.com/scarp-lang/scarp-studio/issues/2). Later release candidates require their own gates; successful CI is not proof of GUI correctness.
- The next compiler-integrated release is **not yet published**. Manual Windows 11 testing and review are required for PRs #5 and #6; see [issue #3](https://github.com/scarp-lang/scarp-studio/issues/3).

**Repository:** https://github.com/scarp-lang/scarp-studio

## Experimental compiler integration (development branches only)

The `feat/scarp-compiler-run-verify` branch (PR #5) requires an explicitly selected trusted official `scarp.exe` on Windows. Studio launches the compiler directly without a shell and limits execution time and captured output. Run and Verify require saved, unchanged `.srp` sources. Stop applies to the Studio-launched execution process; probing cannot yet be stopped through the same control.

PR #5 shows compiler output as plain text. The stacked draft PR #6 adds structured JSON diagnostic navigation, guarded against stale edits and unrelated module paths. Interactive stdin (`read_line`), language-server features, and debugging remain unsupported. Do not run untrusted binaries or source.
