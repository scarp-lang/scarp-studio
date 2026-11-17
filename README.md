# Scarp Studio

**Scarp Studio** is an Apache-2.0 desktop IDE for the **Scarp programming language only** (`.srp`). It is built with Tauri 2, Rust, React/TypeScript and Monaco Editor, with Windows 11 as the initial target.

## Published version vs. development work

- **Published:** [`v0.0.1-alpha.2`](https://github.com/scarp-lang/scarp-studio/releases/tag/v0.0.1-alpha.2), released 2026-11-12. This is an **experimental, unsigned Windows x64 editor-only pre-release**; it does *not* ship native Scarp Run/Verify, structured diagnostics or full project tools. Interactive Windows 11 acceptance is still incomplete. Use disposable sources and back up your files.
- **Unreleased development:** the full compiler-integrated IDE is under review in [integration PR #43](https://github.com/scarp-lang/scarp-studio/pull/43), which reconciles the older stacked feature drafts with the latest protected `main` editor-safety changes. It remains a **draft Windows testing candidate**, not a published build or an approved stable IDE. PR #43 does not change the installer attached to the published alpha.2 release.
- **Next candidate:** the source package identifies the development target as `0.0.2-alpha.1`, but a version string in source is **not** a published release or approval to publish one.

## Features in the current development branch (not in alpha.2)

- Scarp-only Monaco editing, conservative syntax highlighting, hover, completion snippets, `funcra` outline, starter programs, multiple tabs and dirty-state preservation.
- **Current-main editor safety retained:** locally validated/persisted font size, tab size and word wrap; live Save As collision guards; serialized native confirmation dialogs; 4 MiB UTF-8 source limits and selected-folder file membership restrictions.
- **Save All (integrated draft):** Ctrl+Alt+S, toolbar and command palette save modified Scarp tabs in sequence, preserving newer edits and stopping on cancellation, external modifications or path collisions. It never auto-runs code.
- **Reload from Disk (integrated draft):** toolbar and Commands palette explicitly refresh a saved .srp tab after external edits. A dirty tab requires discard confirmation; tab switches and concurrent edits cancel stale reloads. This feature never auto-executes code.
- **Alpha.11 editor support:** exact `decimal` type highlighting, checked base-10 conversion/rounding/formatting help, `input_decimal` assistance and two opt-in decimal starter examples. These require a separately installed official Scarp compiler v0.0.6-alpha.11+ to run.
- **Alpha.12 editor support (unreleased draft):** syntax highlighting and completion/hover assistance for typed records, variants, exhaustive `match on`, concrete `option<T>` / `result<T,E>`, immutable `list<T>` and deterministic `map<K,V>` operations; four additional opt-in starters. These require a separately selected official [Scarp v0.0.6-alpha.12](https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.12) interpreter and are not supported by older compiler executables or experimental native aggregate backends.
- Ctrl+P **Quick Open** for existing tabs plus *already-listed* project sources (root, `src/`, `tests/`, `examples/`); Ctrl+Shift+P commands, Ctrl+G line navigation, Ctrl+Shift+F search across **open buffers only**, Ctrl+B Explorer, F8 for an applicable verified-source diagnostic.
- User-selected Scarp project Explorer with bounded listing (200 files, up to 4096 inspected entries per directory); no arbitrary-recursive or network project scanning. **Refresh Explorer** manually re-scans only the selected folder without a new native chooser, preserves open buffers and retains the old listing if a scan fails.
- User-selected **official Scarp compiler executable** for explicit source Run, static Verify and Stop; bounded process/output limits, version capability checks, and preloaded optional stdin/prompt input. No shell invocation, automatic execution, or arbitrary compiler discovery.
- Explicit project Info, Verify Project, Run Project, List Tests and Run Tests workflows when supported by the selected official compiler. Structured test reports are parsed only for the audited schema/capabilities and raw output is retained.
- Saved-source validation, external-change protection, bounded source-file sizes, stale diagnostic guards and safe native close prompts.

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

Pull-request CI tests separately SHA-256-pinned official Scarp alpha.10, alpha.11 and (in this draft) alpha.12 compiler archives, builds a Windows executable and an unsigned NSIS installer **candidate**, and uploads checksums. Passing CI is not equivalent to a verified Windows desktop GUI session.

For repeatable Windows GUI verification, see the [Windows 11 acceptance matrix](docs/windows-11-acceptance.md). It records actual GUI outcomes separately from automated CI; no release is authorized by that document.

## Review and safety gates

- [ ] Exact-head Windows CI must pass for the intended candidate.
- [ ] Complete hands-on Windows 11 launch, folder picking, nested source access, open/save/discard, Run/Verify/Stop, project-test workflows and prompt-input scenarios.
- [ ] Confirm Tauri filesystem permissions work for dynamically selected nested folders, including denied and symlink/junction cases.
- [ ] Verify dirty-tab safety, project switching and cancellation during in-flight source reads.
- [ ] Review the integrated [PR #43](https://github.com/scarp-lang/scarp-studio/pull/43), compare its retained current-main safeguards, and record Windows GUI acceptance before any merge/release. Never publish a tag or installer solely because a draft PR is green.

Track [M1 manual acceptance](https://github.com/scarp-lang/scarp-studio/issues/2), [M2 compiler integration](https://github.com/scarp-lang/scarp-studio/issues/3) and [M3 workspace experience](https://github.com/scarp-lang/scarp-studio/issues/4).

## Support

Optional [GitHub sponsorship](https://github.com/sponsors/sanskarIN) supports development and testing without guaranteeing access to unreleased builds.

**Source:** https://github.com/scarp-lang/scarp-studio  
**Official compiler:** https://github.com/scarp-lang/scarp
