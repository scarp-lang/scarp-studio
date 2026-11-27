# Compare compiler inventories

After an explicit Inspect Symbols or Inspect References command, retain one session-only inventory baseline. Run the same inspection mode again for the same project and compare reported structural groups. The retained baseline is not persisted, exported automatically, or used to authorize navigation.

The comparison shares structural keys consisting of opaque definition file label, symbol kind, name and owner group. Compiler IDs are local to each response and never compared across snapshots. Repeated labels are ambiguous, including their descendants. Added and removed labels are shown separately, never inferred as renames or moves.

Unique groups compare public/mutable markers, target module labels, definition coordinates, and (for reference reports) counts by reference kind and source file. These comparisons describe reported fields; identical counts or positions do not prove identical source, types, behavior or semantic identity. Symbols-only reports are never treated as zero references. The model also compares file-level counts, with absent files distinct from zero. Filters and pagination limit rendering; an explicit bounded export omits private names and paths by default. No source files are opened, written or edited.
