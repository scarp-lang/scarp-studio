# Project test fixture workbench

The published Scarp alpha.3 test runner accepts optional sibling files:
tests/NAME.stdin for input, tests/NAME.stdout for exact stdout comparison,
and tests/NAME.stderr for exact stderr comparison. The compiler discovers
direct lowercase .srp test files only.

Studio's explicit fixture scan reviews the selected manifest project's
immediate tests directory. It checks ordinary, nonlinked directories and
files and rejects portable case collisions. The scan is bounded to 4096
materialized directory entries and the compiler's 64-test maximum.
It does not open or execute test sources.

Inspect a regular fixture to see byte count, strict UTF-8 validity, BOM,
NUL bytes, separate CRLF/LF/CR counts, final ending, escaped text prefix
and hexadecimal byte prefix. Reads use bounded handles and stat checks,
not the source editor's newline handling. Invalid UTF-8 remains visible
as hex evidence, not replacement-character text.

Creating an absent fixture is a separate reviewed operation. Choose a
line-ending convention and whether to append a final newline. The empty
fixture is meaningful: for stdout/stderr it expects an empty stream.
Creation is limited to 64 KiB and uses an exclusive native handle.
Existing files are never intentionally overwritten. Directory membership
and the exact plan are revalidated; success requires exact readback.
Failure after an attempted creation is uncertain; inspect the directory
before retrying. No automatic deletion or rollback is attempted.

Creation invalidates earlier structured project results. No test runs
automatically. The compiler remains authoritative about test and fixture
semantics, containment and execution. Native Tauri scope remains the
filesystem permission boundary; the frontend checks are not an atomic
filesystem transaction.
