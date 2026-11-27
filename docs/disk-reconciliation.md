# Reviewed three-way reconciliation

An external edit and an unsaved local edit can coexist. Studio never resolves
that conflict by silently choosing one version. Use the active source's disk
review, then choose **Review three-way reconciliation**.

The old saved text is the common baseline. The working buffer and the reviewed
disk snapshot each contribute exact line-based edit blocks. Touching regions
are grouped conservatively, including insertions at the same boundary. Local
only, disk only and identical changes have suggested choices. Conflicting
regions require an explicit choice. Each region offers working, disk,
old-baseline or bounded manual text. Review all suggested choices if needed.

The final review reconstructs every region and displays the resulting source.
The preview does not write a file, add conflict markers, or validate Scarp
semantics. Before applying, Studio independently reads the same disk source
and rejects changes to its reviewed content or the editor session.

Application updates editor memory and the verified saved baseline together.
The working buffer remains dirty unless it equals the disk text. Auto Save is
held for a reconciled dirty buffer until user-controlled review or saving.
Undo restores the previous working text only; the independently verified
disk baseline remains in place. A later disk change can still block saving.

Bounds: 512 Ki UTF-16 units per snapshot, 64 regions, 8192 units per region
version, 96 Ki units of changed-text preview, and a 2 MiB disk recheck.
If exact comparison or complete review exceeds the budget, use Save As to
preserve the working source and reconcile manually. No repository merge or
version-control operation is performed.
