# Scarp Studio — Windows 11 candidate smoke examples

These are **disposable, source-only QA fixtures**, not examples to execute automatically.
They are intended for the **unpublished** `v0.0.2-alpha.1` candidate. The
official `Scarp v0.0.6-alpha.20` compiler is downloaded separately and
must be independently checked and explicitly approved before use.

## Prepare

1. Obtain the **exact-head** Scarp Studio candidate Windows executable and NSIS
   installer from the same successful GitHub Actions run linked by [draft PR #82](https://github.com/scarp-lang/scarp-studio/pull/82).
   Also download the separate Windows provenance JSON if present and compare its checked-out commit/tree and hashes with the run. Keep it outside the three-file verification folder.
   Check the two binaries and `SHA256SUMS.txt` using
   [the offline verifier](../../scripts/verify-windows-artifacts.ps1)
   and record the source SHA + run URL. Use the verifier's `-AsJson` report and `node scripts/windows-acceptance-report.mjs verify-artifacts <provenance.json> <verification.json>` to compare both executable records with the CI provenance (see [verification plan](../../docs/next-pre-release.md)). The installer is **unsigned**; do not
   assume a Windows security warning is harmless.
2. Independently obtain the official alpha.20 compiler. Its Windows ZIP SHA-256
   is `68a5ee47f24e2e36dd7fb1fcc6257feaea291d801048f7866bff1a7e4994aca2`.
   Do not execute a detected binary until you have reviewed the exact path
   and approved the trust prompt in Studio.
3. **Copy** these `.srp` files into a disposable folder. Never use a real
   project to test Save As, Auto Save or external changes. Record results
   under [Windows acceptance](../../docs/windows-11-acceptance.md).

## GUI checks

| Source | Studio action | Expected outcome |
| --- | --- | --- |
| `01-run-square.srp` | Open, Verify, Run | Verify succeeds; Run prints `SCARP_STUDIO_GUI_RUN_OK` |
| `02-fixed-array.srp` | Open, Verify, Run | Verify succeeds; Run prints `SCARP_STUDIO_GUI_ARRAY_OK` |
| `06-while-control.srp` | Open, Verify, Run, then choose **While, Break and Continue** in Examples | Verify succeeds; Run prints `SCARP_STUDIO_GUI_WHILE_OK`; the same source appears as an editable Scarp starter template |
| `07-nested-loop.srp` | Open, Verify, Run, then choose **Nested Repeat and While** in Examples | Verify succeeds; Run prints `SCARP_STUDIO_GUI_NESTED_LOOP_OK`; the same source appears as an editable Scarp starter template |
| `08-declaration-outline.srp` | Open, Verify, Run; inspect the Declaration Outline and Monaco symbols | The sidebar lists public Task record, Lookup variant and pure is_done function. Verify succeeds and Run prints exactly `SCARP_STUDIO_GUI_DECLARATION_OK`. This fixture is tested by all four pinned official compilers |
| `09-decimal-literals.srp` | Choose **Exact Decimal Literals** in Examples, save a disposable copy, Verify/Run with alpha.20 | Exactly `SCARP_STUDIO_GUI_DECIMAL_LITERAL_OK`; exact literal hover describes the d suffix |
| `10-tuple-updates.srp` | Choose **Tuple Updates and Ordering** in Examples, save a disposable copy, Verify/Run with alpha.20 | Exactly `SCARP_STUDIO_GUI_TUPLE_UPDATE_OK`; original tuple snapshot is preserved |
| `05-array-update.srp` | Open, Verify, Run with Scarp alpha.18 or later | Verify succeeds; Run prints `SCARP_STUDIO_GUI_ARRAY_UPDATE_OK` and original fixed-array values remain unchanged |
| `03-boolean-input.srp` | Enable **prompt mode**, paste the contents of `03-boolean-input.stdin` into **Program Input**, then Run | Output includes `SCARP_STUDIO_GUI_BOOLEAN_OK`; input is preloaded, **not a live terminal** |
| `04-invalid-diagnostic.srp` | Verify, then select the diagnostic or press F8 | Verify fails with a genuine compiler error; navigation points to the unchanged offending source |

Before testing compiler integration, separately verify that Auto Save is **Off**
by default. With a named copy of `01-run-square.srp`, enable Auto Save in
Settings (Ctrl+,), test 1/3/5-second delays, an external disk conflict, tab
closure and background tabs. Auto Save must not open a filename picker or
overwrite externally changed data.

For compiler detection, click Scan Compiler after extracting the verified ZIP.
The scan must be non-executing; **first Run / Verify must ask to trust the full
compiler path** if it is not already approved for the current session.
Manual fallback selection remains available.

All expected outcomes above are **test requirements, not claimed GUI PASS
results**. Record the actual build SHA, test platform and evidence before
marking acceptance cases PASS.

## Crowded Explorer stress fixture (P34)

On Windows, create an empty test parent folder first. From the repository root,
use this command with a new, non-existing destination:

```powershell
pwsh -File qa/windows/create-crowded-explorer-fixture.ps1 `
  -Destination "C:\ScarpStudioAcceptance\P34-crowded-project"
```

The script creates 200 root `.srp` sources, 225 `src/a-*.srp` sources
plus `src/main.srp`, and one each in `tests/` and `examples/`.
It never overwrites existing directories or launches a compiler.
Select the generated project in Studio. Acceptance case P34 requires
no more than 200 displayed files, visible `src/main.srp`,
`tests/smoke.srp` and `examples/demo.srp`, a truncation notice, and
working Ctrl+P navigation. Windows CI validates only fixture generation;
actual desktop UI results must be recorded separately.

## Optional standalone CLI cross-check

From the repository root, substituting the exact trusted compiler path:

```powershell
$scarp = "C:\Path\To\Trusted\scarp.exe"
& $scarp verify --diagnostic-format=json -- qa/windows/01-run-square.srp
& $scarp exec --diagnostic-format=json -- qa/windows/01-run-square.srp
& $scarp verify --diagnostic-format=json -- qa/windows/02-fixed-array.srp
& $scarp exec --diagnostic-format=json -- qa/windows/02-fixed-array.srp
& $scarp verify --diagnostic-format=json -- qa/windows/06-while-control.srp
& $scarp exec --diagnostic-format=json -- qa/windows/06-while-control.srp
& $scarp verify --diagnostic-format=json -- qa/windows/07-nested-loop.srp
& $scarp exec --diagnostic-format=json -- qa/windows/07-nested-loop.srp
& $scarp verify --diagnostic-format=json -- qa/windows/08-declaration-outline.srp
& $scarp exec --diagnostic-format=json -- qa/windows/08-declaration-outline.srp
& $scarp verify --diagnostic-format=json -- qa/windows/05-array-update.srp
& $scarp exec --diagnostic-format=json -- qa/windows/05-array-update.srp
& $scarp exec --interactive --input-file qa/windows/03-boolean-input.stdin -- qa/windows/03-boolean-input.srp
& $scarp verify --diagnostic-format=json -- qa/windows/04-invalid-diagnostic.srp
```

The array update fixture requires alpha.18 or later and verifies a new array snapshot, not mutation.
The final Verify command is **expected to fail**; it tests compiler diagnostics,
not a successful source verification. This standalone check does not replace
hands-on Windows GUI acceptance.

The current official alpha.20 compiler retains the existing Scarp source-level CLI. The Linux native object-emission API is for Rust host embedding; Studio continues to use the interpreter CLI. Alpha.18, alpha.19 and alpha.20 are checked separately in Windows CI.

## Project-manifest compatibility (C28)

With the trusted alpha.20 compiler, test both the lowercase declarative `scarp.project` and legacy `Scarp.project` format in separate disposable folders. The native integration test exercises Project Info, static Verify and bounded Run for both formats; interactive Studio testing is still required. Neither project action rewrites the manifest.
