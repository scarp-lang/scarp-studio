# Saved project information workbench

Info continues to run only the fixed native project info --json action
on the selected manifest-bearing root. The backend returns a separate
metadata channel only for a complete exit-zero, uncancelled, untruncated
response with no stderr. Studio validates the published schema-v1 fields,
relative entry label, type, version and manifest filename/format.
Raw compiler output is preserved on unsupported reports.

The workbench displays the six reported metadata fields, including a
legacy manifest's unspecified version. It does not edit or migrate
manifests, verify programs, or read paths supplied by the compiler.
The entry can be opened only if its exact relative label belongs to a
unique discovered manifest root and unique current Explorer entry.
Navigation uses the existing listed-file opening service; an already
open dirty buffer is focused, not overwritten or replaced with disk text.

A single explicit session-only baseline compares metadata between Info
invocations for the same project. Different roots are not compared.
Capture, replacement and removal have a confirmation step. The baseline
never authorizes a file operation. The optional summary excludes project
name and entry label by default and never includes the absolute root.
The report is a historical saved manifest snapshot, not proof of current
disk state, source compilation, or runtime behavior. Run Info again after
external manifest changes.
