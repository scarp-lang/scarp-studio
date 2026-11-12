# Scarp Studio

Scarp Studio is an Apache-2.0 desktop IDE **exclusively for the Scarp programming language** (.srp files).

**Status:** [`v0.0.1-alpha.2`](https://github.com/scarp-lang/scarp-studio/releases/tag/v0.0.1-alpha.2) was published on 2026-11-12 as an **experimental, unsigned Windows x64 pre-release**. This is an editor-only maintenance update, not a stable IDE. Interactive Windows 11 GUI acceptance is still pending; use disposable test files and keep backups.

**Not in the released alpha:** Run, Verify, Stop and structured error navigation. These are under review in [draft PR #5](https://github.com/scarp-lang/scarp-studio/pull/5) and [draft PR #6](https://github.com/scarp-lang/scarp-studio/pull/6). Neither PR is merged or published.

## Implemented in this branch

- Tauri 2 native desktop host, Rust services boundary, React/TypeScript frontend and Monaco editor.
- Scarp syntax coloring (conservative subset of the scarp-vscode grammar), open/edit/save and Save As for .srp.
- Multi-tab editing with dirty indicators, native unsaved-change prompts, keyboard shortcuts, light/dark theme.
- Alpha.2 guards repeated window-close requests against concurrent unsaved-change confirmation dialogs.
- Folder picker with top-level .srp listing (recursive explorer planned).
- User-selected filesystem scopes only. No shell access and **no fake compiler execution**.

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

- The **published** `v0.0.1-alpha.2` is editor-only: compiler Run/Verify/Stop, source diagnostics, completion and debugging are **not available**. A version-aware, bounded native compiler service is implemented only on the unmerged draft PR #5, with diagnostic navigation on the stacked draft PR #6. The official Scarp compiler lives at https://github.com/scarp-lang/scarp.
- Folder browsing currently lists only immediate .srp children; selected-folder filesystem scope behavior needs Windows verification.
- Only user-selected files are accessible, and dialog scopes are session-local. Reopen a file or folder after restarting.
- Automated Windows builds and package checksum checks passed for the published experimental release, but **hands-on launch/open/save/discard validation and unsigned-installer security review remain open** in [issue #2](https://github.com/scarp-lang/scarp-studio/issues/2). Later release candidates require their own gates; successful CI is not proof of GUI correctness.
- The next compiler-integrated release is **not yet published**. Manual Windows 11 testing and review are required for PRs #5 and #6; see [issue #3](https://github.com/scarp-lang/scarp-studio/issues/3).

## Support Scarp Studio

This is an experimental open-source IDE. Optional [GitHub sponsorship](https://github.com/sponsors/sanskarIN) helps support development and testing; sponsorship does not provide early access, private repository access, or guarantees about releases.

**Repository:** https://github.com/scarp-lang/scarp-studio
