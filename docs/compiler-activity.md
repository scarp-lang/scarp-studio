# Compiler activity history

The History view in the compiler output panel is an opt-in, session-only
journal of commands actually invoked by Studio. It does not launch commands,
replay old commands, navigate historical diagnostics or change compiler trust.
The default recording mode is Off.

## Recording modes

- Off clears retained history and prevents in-flight results from returning
  to history after it has been cleared.
- Metadata only retains the command type, target basename, start/finish
  times, elapsed wall-clock time when valid, known exit status and observed
  changes during an invocation. Switching to this mode removes old output.
- Metadata and bounded output additionally retains raw output from invocations
  started in that mode. Output can contain private source-related text, file
  paths or echoed program replies. It is never retained by default, sent
  elsewhere or persisted to local storage.

Enabling output while a metadata-only invocation is already running does
not retroactively capture that invocation's output. Downgrading to metadata
while an invocation is running removes the output permission for that record.

## Outcomes and historical provenance

Source Run and Verify currently return native output without a distinct exit
code. History therefore labels these as returned, not successful or failed.
Project commands provide a native exit code when available; exit zero and
nonzero exit are distinguished without interpreting free-form output. An
invocation error is a rejected native request, not necessarily a program
error. A recorded stop request is not proof that the process was cancelled.

The source/project and input flags describe observed changes while a command
was running. Every record remains historical, even if those flags are false.
History does not provide evidence of current compiler compatibility, current
diagnostics, source validity or a passing test suite.

## Review, filtering and retention

Filter by target or command metadata, scope, outcome, observed changes or
retained output. The search does not inspect raw output. Select a record to
inspect its metadata and explicitly reveal its output if retained. The
copyable report contains metadata only; it never includes captured output.

The session retains at most 40 records. Captured output is bounded to 32 Ki
UTF-16 units per invocation and 256 Ki overall. For large output, the middle
is omitted explicitly; older output is removed first to keep recent metadata.
No records or output are recovered on restart. Review Clear History to
discard retained records and any pending history entry without stopping
the current process or clearing the ordinary Output view.
