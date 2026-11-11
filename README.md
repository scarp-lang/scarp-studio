# Scarp Studio

Scarp Studio is an Apache-2.0 desktop IDE **exclusively for the Scarp programming language** (.srp files).

**Status:** Early development toward v0.0.1-alpha.1. This branch is not yet a verified release.

## Implemented in this branch

- Tauri 2 native desktop host, Rust services boundary, React/TypeScript frontend and Monaco editor.
- Scarp syntax coloring (conservative subset of the scarp-vscode grammar), open/edit/save and Save As for .srp.
- Multi-tab editing with dirty indicators, native unsaved-change prompts, keyboard shortcuts, light/dark theme.
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

- Compiler commands, diagnostics, completion and debugging are not yet implemented. The official compiler lives at https://github.com/scarp-lang/scarp; its experimental `exec` and `verify` interfaces require version-aware, bounded native process integration before exposure in Studio.
- Folder browsing currently lists only immediate .srp children; selected-folder filesystem scope behavior needs Windows verification.
- Only user-selected files are accessible, and dialog scopes are session-local. Reopen a file or folder after restarting.
- Native Windows tests, packaging and hands-on launch/open/save/discard validation must pass before publishing any GitHub release. The CI installer is an unsigned candidate, not an official release.

**Repository:** https://github.com/scarp-lang/scarp-studio

## Experimental compiler integration branch (not included in first alpha)
The development branch `feat/scarp-compiler-run-verify` adds opt-in native Scarp compiler selection, version/capability checking, `exec`, static `verify`, Stop, and a bounded textual output panel. These features are **not in the initial editor-only candidate** until a separate PR is reviewed, validated and merged.

The user must select a trusted official `scarp.exe` on Windows. Scarp Studio invokes commands directly without a shell, limits captured output and wall-clock execution, and does not execute code automatically. Run and Verify require a saved and clean `.srp` buffer. Output is plain text; clickable diagnostics, language-server integration and interactive stdin are not yet implemented. Native compiler/runtime calls are privileged processes: do not run untrusted source or binaries.
