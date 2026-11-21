# Next Scarp Studio pre-release — verification plan

**Target:** `v0.0.2-alpha.1` (experimental Windows x64, source in draft).  
**Already published:** `v0.0.1-alpha.2` (editor-only).  
**Release status:** NOT APPROVED / NOT PUBLISHED. Source version strings and successful CI artifacts are not releases.

## 1. Review the candidate stack

The integrated Windows IDE began in [PR #55](https://github.com/scarp-lang/scarp-studio/pull/55), with additional safety changes stacked through #64. The current review-only release candidate extends that stack with alpha.17 release validation [#74](https://github.com/scarp-lang/scarp-studio/pull/74), IntelliSense [#75](https://github.com/scarp-lang/scarp-studio/pull/75), explicit-trust compiler discovery [#76](https://github.com/scarp-lang/scarp-studio/pull/76), guarded Auto Save [#77](https://github.com/scarp-lang/scarp-studio/pull/77), and independent Save As/reopen tab identities [#78](https://github.com/scarp-lang/scarp-studio/pull/78). **Use the exact topmost PR #78 head for all pre-release candidate builds and acceptance**, not an ancestor PR or already-published editor-only build. Review the complete combined diff against protected `main`; do not blindly merge the older overlapping #5/#65/#66/#71/#72/#73 drafts.

Do not create a release tag until the owner has explicitly reviewed and authorized both the source merge and the separate release publication. The old `publish-editor-alpha2.yml` workflow is restricted to `0.0.1-alpha.2` and **must not** be reused for `0.0.2-alpha.1`.

## 2. Run the read-only checks

From a checkout of the intended exact candidate commit:

```powershell
npm ci --no-audit --no-fund
npm run check:release-candidate
npm run test:release-candidate
npm run typecheck
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
```

The offline candidate checker validates versions in `package.json`, `package-lock.json` (top level and root package), Tauri, Cargo and Cargo.lock. Its manifest explicitly requires **manual Windows acceptance and no publication authorization**. Neither check command creates a tag, upload or release.

GitHub Actions must additionally show a successful exact-head Windows run with the SHA-pinned **official Scarp alpha.17 Windows CLI** (while retaining alpha.10–alpha.15 backwards-compatibility checks), frontend tests, native service tests, build, installer, SHA-256 and deliberate tamper rejection. The alpha.17 gate also checks real fixed-array intrinsics, preloaded boolean input and JSON v1 diagnostics; this does not imply Studio GUI prompt support.

## 3. Verify CI artifacts from the same run

1. Open the successful GitHub Actions run for the **intended source commit**, not an earlier passing run. Download `scarp-studio-windows-unbundled` and `scarp-studio-windows-nsis-candidate` from that run only.
2. Extract `scarp-studio.exe`, the single `*-setup.exe` and `SHA256SUMS.txt` into one **new, empty test directory** with no extra files or subfolders.
3. In PowerShell run the existing verifier, replacing both placeholders with the *actual* source SHA and exact workflow run URL:

```powershell
./scripts/verify-windows-artifacts.ps1 `
  -ArtifactDirectory "C:\scarp-studio-candidate" `
  -SourceCommit "<EXACT_40_CHARACTER_COMMIT_SHA>" `
  -RunUrl "https://github.com/scarp-lang/scarp-studio/actions/runs/<EXACT_RUN_ID>"
```

The verifier rejects missing, extra, hidden, linked, mismatched or tampered candidates. An artifact ZIP's download checksum is **not** interchangeable with the individual EXE/installer hashes inside `SHA256SUMS.txt`. Do not mix files from different CI runs.

## 4. Perform real Windows 11 GUI acceptance

Use a disposable Scarp project and a separately installed official compiler you independently trust. Capture **actual** results, screenshots/logs and the exact tested Studio commit in `docs/windows-11-acceptance.md`.

Test at least: editor launch/WebView2 and installer/uninstaller; file Open/Save/Reload/conflicts and UTF-8; project Explorer permissions, symlinks and dirty buffers; in-memory Replace All/Undo; real Run, static Verify, structured diagnostics, Stop during *both* capability probes and active execution; bounded prompt input; Project Info/Run/Verify/List Tests/Run Tests; **P28–P30** stale result invalidation; **C15–C18** bounded compiler discovery, first-Run per-session trust and stale snapshot cancellation; and **E27–E31** opt-in Auto Save including background tabs and external-change rejection. Never infer these pass from CI.

Use the checked-in [Windows GUI smoke examples](../qa/windows/README.md)
for an independently reproducible Run, Verify, array, preloaded boolean-input
and invalid-diagnostic check. They are checked by CI against the published
alpha.17 CLI, but they do **not** substitute for running the actual Windows
Studio application with its exact-head build.

If the candidate fails, record reproducible steps, fix the source on a review branch, and repeat the **exact-head** automated and affected manual checks.

## 5. Decide whether to publish

Keep this candidate unreleased until all of these hold:

- The complete review stack is approved and lands in protected `main`, without duplicate merges.
- All required checks pass for the **final merged source commit**, not only the PR head.
- Actual Windows GUI cases are recorded as PASS; blocking safety issues are resolved.
- The exact release assets and hashes are verified; unsigned Windows warnings and limitations are accurately disclosed.
- The owner **separately and explicitly approves** publication of `v0.0.2-alpha.1` from the exact source commit.

Until then, share only GitHub Actions development artifacts as **unsigned test candidates**, not a GitHub release. The release notes in `.github/release-notes/v0.0.2-alpha.1.md` are a draft, not a publication signal.

## References

- Current complete candidate draft PR: https://github.com/scarp-lang/scarp-studio/pull/78
- Full-IDE Auto Save parent: https://github.com/scarp-lang/scarp-studio/pull/77
- Compiler discovery draft PR: https://github.com/scarp-lang/scarp-studio/pull/76
- Consolidated historic integration PR: https://github.com/scarp-lang/scarp-studio/pull/55
- Compiler probe safety PR: https://github.com/scarp-lang/scarp-studio/pull/57
- Test report freshness PR: https://github.com/scarp-lang/scarp-studio/pull/58
- Windows acceptance worksheet: `docs/windows-11-acceptance.md`
- Official compiler release: https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.17
