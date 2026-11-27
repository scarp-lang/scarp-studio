# Project test failure details

Scarp alpha.3 project test JSON schema 2 embeds a schema 1 diagnostic object
for each failed case. Studio validates the nested envelope separately from
the test summary and only inside the existing action-bound test-report
channel. Ordinary program output is not a diagnostic channel.

Choose **Inspect failure diagnostics** to review full-detail coverage,
primary source coordinates, and related notes. Byte spans are UTF-8,
half-open; line and column coordinates are one-based Unicode scalar
positions. Related paths may refer to imported project files. An absent
location is distinct from an unavailable or unsupported diagnostic.

The compiler's project writer provides portable relative labels. Studio
rejects absolute labels, parent traversal, backslashes, controls and oversized
locations. These checks do not authorize opening a path. The view never
uses diagnostic coordinates for live navigation or marker placement.
The ordinary test source opener still requires current Explorer membership.

Older summary-only reports retain their original failure messages.
Malformed detail envelopes cannot supply partial locations or related
notes. The failure itself remains visible if its basic report was valid.

The bounded review export includes phases, codes and coverage by default.
Relative test names, messages/help, locations and related notes are separate
opt-in fields. Reports may contain private source text; inspect before
sharing. Whole rows are omitted when the export limit is reached.
