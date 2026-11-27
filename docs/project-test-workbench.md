# Project test workbench

Studio continues to display structured test reports only after validating
the supported compiler schema, requested action and native exit code.
Discovery lists tests but does not run them. Failed tests remain distinct
from compiler invocation errors and free-form console output.

Filter a report by path, code, message or help, status, failure phase or
whether the source is present in the current Explorer listing. Group by
status, failure phase or code; order by source label or put failures first.
Pages contain at most 12 rows. Navigation still checks the exact selected
project and listed test source. Historical results cannot open sources
through this workbench.

Review the matching test report to inspect text for manual copying. It
contains relative test labels and reported outcomes. Compiler messages
and help are optional and can contain private information. The report
does not include the native project root as a field. It is bounded to
48 Ki UTF-16 units and reports omissions rather than cutting rows.

## Compare two reported runs

After a completed Run Tests command, explicitly review and capture its
outcomes as a session baseline. Only one baseline is retained, with the
selected project identity and relative test labels, statuses, failure
phases and codes. It contains no diagnostic messages, help, input or raw
output. It is not written to disk or shared. Capturing a new baseline
replaces the previous one only after confirmation.

Run tests again for the same selected project to compare outcomes.
A previously passing test that fails is shown separately from a
previously failing test that passes. Tests in only one report are
labelled as such, not assumed to have been created or deleted.
Failure phase/code changes are separate from pass/fail changes.
Discovery, historical results and a different project cannot be used
for this comparison. No comparison proves identical source, compiler,
fixtures, environment or correctness. Clearing the baseline does not
change the current results or start a command.
