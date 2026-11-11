# Scarp Studio

Scarp Studio is an Apache-2.0 desktop IDE **exclusively for the Scarp programming language** (.srp files).

**Status:** Early development toward v0.1.0-alpha.1. This branch is not yet a verified release.

## Implemented in this branch

- Tauri 2 native desktop host, Rust services boundary, React/TypeScript frontend and Monaco editor.
- Scarp syntax coloring (conservative subset of the scarp-vscode grammar), open/edit/save and Save As for .srp.
- Multi-tab editing with dirty indicators, native unsaved-change prompts, keyboard shortcuts, light/dark theme.
- Folder picker with top-level .srp listing (recursive explorer planned).
- User-selected filesystem scopes only. No shell access and **no fake compiler execution**.

## Development (Windows 11)

Install Node.js 22+, Rust stable with MSVC build tools, the Tauri 2 Windows requirements (WebView2), and run:

    npm install
    npm run typecheck
    npm test
    npm run tauri dev

Optional: create an unbundled Windows executable with:

    npm run tauri build -- --no-bundle

The app currently does not package an installer. A dependency lockfile, successful Windows CI and interactive file-save testing are required before publishing a prerelease.

## Known limitations

- Compiler commands, diagnostics, completion and debugging are not yet implemented. The evolving official Scarp compiler CLI must be audited first.
- Folder browsing currently lists only immediate .srp children; selected-folder filesystem scope behavior needs Windows verification.
- Only user-selected files are accessible, and dialog scopes are session-local. Reopen a file or folder after restarting.
- Native Windows tests and distributable packaging must pass before publishing any GitHub release.

**Repository:** https://github.com/scarp-lang/scarp-studio
