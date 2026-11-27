# Open-source disk consistency for project commands

Project Verify, Run, List Tests, Run Tests and static symbol/reference
inspection use saved disk sources. A clean editor tab can nevertheless
describe an older file if another application modifies it.

Studio now checks every already-open named Scarp source within the selected
project before launching these commands. It reads only paths already owned
by those buffers and compares exact UTF-8 text against their saved baselines.
A dirty buffer, ambiguous duplicate path, missing file, unexpected size,
read error, cancellation or changed text prevents launch. Review disk
changes, reload a clean buffer, reconcile a dirty buffer, or save as needed.

The command uses the reviewed compiler selection and project identity.
Stop during a pending preflight requests cancellation; no compiler process
is launched after that request. The read already in progress may finish
before cancellation is observed.

After the native command returns, Studio repeats the same bounded checks.
An interrupted, unavailable or changed check retains raw native output with
a historical warning and withholds fresh structured diagnostics, test
reports and inspection results. Existing editor-generation freshness
checks still apply. Project Info does not perform these source checks.

The evidence disclosure describes the before and after checks, attempted
file count and file labels. It is historical evidence, not a live filesystem
monitor. No absolute project root or source text is shown by the panel.

The inventory is limited to 32 files and 8 MiB of saved UTF-8 text, with
individual source limits still enforced. If the inventory exceeds this
budget, close some clean tabs and retry. This is not an atomic filesystem
snapshot: closed imports, fixtures, manifests, and changes occurring
between reads are not covered. It does not expand the native scope.
