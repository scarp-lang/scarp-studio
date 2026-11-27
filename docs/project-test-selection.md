# Filtered test selection

Select tests by filename in the project controls. Enter a literal case-sensitive substring, review discovery or execution, then confirm. The compiler discovers tests independently; previous report matches are a preview only. The native argument list accepts the reviewed option only on the audited Scarp 0.0.7-alpha.3 compiler, with a 128 UTF-8 byte limit and no path separators, leading dash or control characters.

A filtered result is explicitly labelled and is never eligible for a full-suite baseline or comparison. Every returned test filename must contain the requested substring. A strict empty execution (exit 1) retains a zero-case report with a visible warning; it is not a passing run. A filtered discovery (exit 0) can validly be empty. Existing unfiltered buttons retain their behavior. No command runs on input changes, opening the panel, or choosing a filter.
