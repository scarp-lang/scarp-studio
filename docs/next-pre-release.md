# Next Scarp Studio pre-release — verification plan

**Target:** `v0.0.2-alpha.1` (experimental Windows x64, source in draft).  
**Already published:** `v0.0.1-alpha.2` (editor-only).  
**Release status:** NOT APPROVED / NOT PUBLISHED. Source version strings and successful CI artifacts are not releases.

## 1. Review the candidate stack

The integrated Windows IDE began in [PR #55](https://github.com/scarp-lang/scarp-studio/pull/55), extended through release hardening #64, Scarp alpha.17 support #74/#75, compiler discovery #76, guarded Auto Save #77, unique tab identities #78, Replace All review #79, Downloads-priority scan #80 and Settings reset #81. The complete reviewed source is now grouped in a **single [draft PR #82 targeting protected main](https://github.com/scarp-lang/scarp-studio/pull/82)**. **Use the exact PR #82 head and its own successful Windows Actions run for testing and any eventual approved merge.** The older nested drafts remain historical code review surfaces; do not merge overlapping chains independently or use an ancestor build to claim acceptance of this complete candidate.

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

The offline candidate checker validates the exact target release version, the manual acceptance compiler version/digest, and versions in `package.json`, `package-lock.json` (top level and root package), Tauri, Cargo and Cargo.lock. Its manifest explicitly requires **manual Windows acceptance and no publication authorization**. Neither check command creates a tag, upload or release.

GitHub Actions must additionally show a successful exact-head Windows run with the SHA-pinned **official Scarp alpha.20 Windows CLI** (while retaining separate alpha.10–alpha.15 and alpha.17 backwards-compatibility checks), frontend tests, native service tests, build, installer, SHA-256 and deliberate tamper rejection. The alpha.17 gate checks fixed-array reads, preloaded boolean input and JSON v1 diagnostics; the alpha.18 gate additionally checks immutable `array_set`, no-argument `exec` selecting `src/main.srp`, native process integration and compiler discovery; the separate alpha.19 gate verifies the published official CLI version and digest, checked-in QA programs, and native execution/discovery; this does not imply Studio GUI prompt support.

## 3. Verify CI artifacts from the same run

1. Open the successful GitHub Actions run for the **intended source commit**, not an earlier passing run. Download `scarp-studio-windows-unbundled` and `scarp-studio-windows-nsis-candidate` from that run only.
   Download the separate `scarp-studio-windows-provenance` artifact when present. It identifies the checked-out commit/tree, run attempt, compiler pin and individual executable hashes. CI explicitly checks out PR head; merged-main CI must still pass separately. Keep this metadata outside the three-file verification directory. A provenance JSON file is not a signature or an independent guarantee of authenticity.
2. Extract `scarp-studio.exe`, the single `*-setup.exe` and `SHA256SUMS.txt` into one **new, empty test directory** with no extra files or subfolders.
3. In PowerShell run the existing verifier, replacing both placeholders with the *actual* source SHA and exact workflow run URL:

```powershell
./scripts/verify-windows-artifacts.ps1 `
  -ArtifactDirectory "C:\scarp-studio-candidate" `
  -SourceCommit "<EXACT_40_CHARACTER_COMMIT_SHA>" `
  -RunUrl "https://github.com/scarp-lang/scarp-studio/actions/runs/<EXACT_RUN_ID>"
```

To bind the locally calculated hashes to CI provenance, run the same verifier with `-AsJson` and save its output outside the three-file directory, then compare the two reports:

```powershell
./scripts/verify-windows-artifacts.ps1 `
  -ArtifactDirectory "C:\scarp-studio-candidate" `
  -SourceCommit "<EXACT_40_CHARACTER_COMMIT_SHA>" `
  -RunUrl "https://github.com/scarp-lang/scarp-studio/actions/runs/<EXACT_RUN_ID>" `
  -AsJson | Set-Content -Encoding utf8 C:\ScarpStudioAcceptance\verification.json
node scripts/windows-acceptance-report.mjs verify-artifacts C:\ScarpStudioAcceptance\WINDOWS-CANDIDATE-PROVENANCE.json C:\ScarpStudioAcceptance\verification.json
```

The comparison rejects a report for another commit/run, mismatched sizes or SHA-256 hashes, duplicate or missing executable entries. It strips local full paths from its output. Confirm the run and provenance independently; this is not code signing and does not prove that a local report is genuine. Reverify immediately before using the binaries.

The verifier rejects missing, extra, hidden, linked, mismatched or tampered candidates. An artifact ZIP's download checksum is **not** interchangeable with the individual EXE/installer hashes inside `SHA256SUMS.txt`. Do not mix files from different CI runs.

## 4. Perform real Windows 11 GUI acceptance

Use a disposable Scarp project and a separately installed official compiler you independently trust. Capture **actual** results, screenshots/logs and the exact tested Studio commit in `docs/windows-11-acceptance.md`.

Test at least: editor launch/WebView2 and installer/uninstaller; file Open/Save/Reload/conflicts and UTF-8; project Explorer permissions, symlinks, dirty buffers and **P34** crowded-folder / `src/main.srp` fairness; in-memory Replace All/Undo; real Run, static Verify, structured diagnostics, Stop during *both* capability probes and active execution; bounded prompt input; Project Info/Run/Verify/List Tests/Run Tests; **P28–P31 and P38** in-flight and post-completion stale result invalidation; **C15–C24** bounded and version-prioritized compiler discovery, first-Run per-session trust, stale snapshot cancellation and crowded PATH fairness; and **D15–D16** post-completion single-file output/input freshness and first-Run input revision gating; **E27–E43** opt-in Auto Save, accessible tabs, bounded project search including **E44** retained multi-hit navigation and invalidation, and external disk comparisons including background tabs, external-change rejection, Replace All review holds and Restore all defaults. Also verify E56–E64: local declaration navigation, definition lookup, parameter hints, autocomplete, output layout, keyboard palette, compact workspace chrome first-run guidance and resizable persistent workspace dimensions. Never infer these pass from CI.

Use the checked-in [Windows GUI smoke examples](../qa/windows/README.md)
for an independently reproducible Run, Verify, array, preloaded boolean-input
and invalid-diagnostic check. They are checked by CI against the published
alpha.17, alpha.18, alpha.19 and alpha.20 CLIs, but they do **not** substitute for running the actual Windows
Studio application with its exact-head build.

For a provenance-enabled build, use the read-only report helper to keep manual evidence bound to the exact build and worksheet. Save the JSON reports outside the artifact verification directory:

```powershell
node scripts/windows-acceptance-report.mjs template C:\ScarpStudioAcceptance\WINDOWS-CANDIDATE-PROVENANCE.json |
  Set-Content -Encoding utf8 C:\ScarpStudioAcceptance\manual-results.json
node scripts/windows-acceptance-report.mjs check C:\ScarpStudioAcceptance\WINDOWS-CANDIDATE-PROVENANCE.json C:\ScarpStudioAcceptance\manual-results.json
```

Record the actual Windows build and evidence for each executed case in the report. Keep unexecuted cases NOT RUN. Add `--require-pass` to the check command when reviewing release readiness; incomplete or failed cases then exit nonzero. The tool validates evidence structure, not the truth of manual observations, and never authorizes publication. Keep personal information out of evidence references.

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

- Single main-targeted complete candidate PR: https://github.com/scarp-lang/scarp-studio/pull/82
- Latest feature stack (reference only): https://github.com/scarp-lang/scarp-studio/pull/81
- Prior compiler Downloads priority draft: https://github.com/scarp-lang/scarp-studio/pull/80
- Prior Replace All and Auto Save safety draft: https://github.com/scarp-lang/scarp-studio/pull/79
- Previous tab-identity draft PR: https://github.com/scarp-lang/scarp-studio/pull/78
- Full-IDE Auto Save parent: https://github.com/scarp-lang/scarp-studio/pull/77
- Compiler discovery draft PR: https://github.com/scarp-lang/scarp-studio/pull/76
- Consolidated historic integration PR: https://github.com/scarp-lang/scarp-studio/pull/55
- Compiler probe safety PR: https://github.com/scarp-lang/scarp-studio/pull/57
- Test report freshness PR: https://github.com/scarp-lang/scarp-studio/pull/58
- Windows acceptance worksheet: `docs/windows-11-acceptance.md`
- Official compiler release: https://github.com/scarp-lang/scarp/releases/tag/v0.0.6-alpha.20

**Alpha.19 scope:** the release adds Rust embedding callable handles and host usage ledgers, not first-class Scarp source functions. It preserves alpha.18's CLI surface. The alpha.20 candidate pin never authorizes Studio publication. Alpha.19 remains an independently pinned historical gate; alpha.20 adds a new compatibility gate for the existing interpreter CLI, not the Linux native backend.

## Current UI trial milestone (historical build)

The 24 November 2026 exact-head run [45330257671](https://github.com/scarp-lang/scarp-studio/actions/runs/45330257671) for `cc8e931a5a6c866f02347a168103a677bda3843b` passed all 42 steps. It contains the grouped toolbar, accessible palette and output layout, but not later welcome/readiness changes. Use the latest exact-head successful run for final manual acceptance; this historical milestone is not publication approval.
