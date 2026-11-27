# Review external file changes

The open-editor management area provides an explicit multi-file disk inspection. It reads only already-open Scarp source paths, using the existing scoped native reader. At most 24 files and 8 MiB of decoded UTF-8 source are retained per review. Untitled documents are never read; inaccessible files and omitted files are reported separately.

The review distinguishes unchanged disk files, external changes to clean tabs, conflicting dirty edits, and disk content that happens to match unsaved editor text but differs from the saved baseline. The last case is deliberately not treated as saved.

Only clean tabs with external changes may be selected for reload. After acknowledgement, Studio rereads every selected file and requires its exact reviewed contents. A failure or changed file rejects the whole editor batch. The reducer independently checks the complete editor snapshots and validates the new source before replacing both editor text and its saved baseline. A source can change again after the native read; this is not an operating-system transaction or a permanent file lock.

Any editor-session mutation invalidates the review, including switching away and back. No background polling, source writes, automatic conflict merges, or automatic discards occur. Dirty conflicts must be handled individually with the existing comparison, Save As or Reload tools.
