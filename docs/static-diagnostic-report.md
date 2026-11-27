# Static compiler diagnostic detail

For failed source Verify, project Verify and static project inspection,
the diagnostic detail panel consumes only the separate native stderr
channel. Project diagnostics require ordinary exit 1, no cancellation,
no truncation and empty stdout. Run and Run Tests output cannot acquire
diagnostic authority from text that looks like JSON.

The bounded schema-v1 parser checks the complete newline-delimited
response, every error envelope, code, message, help, primary and related
location, UTF-8 span and Unicode-scalar coordinates. Malformed, future
or oversized responses stay available as raw compiler output rather than
a partial structured inventory. Zero-width spans are insertion points.

The detail panel provides filters, counts, selected records, related
notes and an optional explicit summary. Codes/counts only by default;
messages, locations and help can contain private data. Related note rows
and their text are separately selected. Bounded reports omit complete
rows with an explicit count. Controls and directional formatting are
shown visibly, not interpreted as interface styling.

Project diagnostic rows also appear in Problems, but do not navigate
or open any compiler path. The compiler does not return content identity
for every imported source. The existing single-source verified marker
and navigation safeguards remain separate. Stale outputs suppress
structured detail. Nested-project test problem collection now compares
the actual selected manifest root rather than the parent Explorer root.
