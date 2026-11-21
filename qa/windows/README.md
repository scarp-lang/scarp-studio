# Scarp Studio — Windows 11 candidate smoke examples

These are **disposable, source-only QA fixtures**, not examples to execute automatically.
They are intended for the **unpublished** `v0.0.2-alpha.1` candidate. The
official `Scarp v0.0.6-alpha.17` compiler is downloaded separately and
must be independently checked and explicitly approved before use.

## Prepare

1. Obtain the **exact-head** Scarp Studio candidate Windows executable and NSIS
   installer from the same successful GitHub Actions run linked by [PR #77](https://github.com/scarp-lang/scarp-studio/pull/77).
   Check the two binaries and `SHA256SUMS.txt` using
   [the offline verifier](../../scripts/verify-windows-artifacts.ps1)
   and record the source SHA + run URL. The installer is **unsigned**; do not
   assume a Windows security warning is harmless.
2. Independently obtain the official alpha.17 compiler. Its Windows ZIP SHA-256
   is `fa05e57675799d881ebe33ccd54f6eb769825632904adf99cd08c940383134b5`.
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

## Optional standalone CLI cross-check

From the repository root, substituting the exact trusted compiler path:

```powershell
$scarp = "C:\Path\To\Trusted\scarp.exe"
& $scarp verify --diagnostic-format=json -- qa/windows/01-run-square.srp
& $scarp exec --diagnostic-format=json -- qa/windows/01-run-square.srp
& $scarp verify --diagnostic-format=json -- qa/windows/02-fixed-array.srp
& $scarp exec --diagnostic-format=json -- qa/windows/02-fixed-array.srp
& $scarp exec --interactive --input-file qa/windows/03-boolean-input.stdin -- qa/windows/03-boolean-input.srp
& $scarp verify --diagnostic-format=json -- qa/windows/04-invalid-diagnostic.srp
```

The final Verify command is **expected to fail**; it tests compiler diagnostics,
not a successful source verification. This standalone check does not replace
hands-on Windows GUI acceptance.
