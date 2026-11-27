# Structured problem review

Problems continues to present only current structured compiler diagnostics
and failed project tests. Historical output is available in Output and
Inspect, not converted into current errors. An empty list does not prove
successful verification.

The review adds filtering by available navigation, grouping by kind or
kind and diagnostic code, deterministic ordering by code or location,
and pages of 25 matching rows. Unknown codes are grouped separately
for compiler diagnostics and failed tests. Navigation still goes through
the existing exact-current-source or listed-test guards.

At most 2,000 problems are indexed. Limited review coverage is explicitly
shown; a match count cannot describe unindexed rows. The report is prepared
only by Review Matching Problem Report, includes at most 200 complete rows
and is limited to 64 Ki UTF-16 units. Omitted rows and incomplete coverage
are separately disclosed. Explicit location and help fields are off by
default, but messages may still contain private source text or paths.
Nothing is copied automatically or written to disk. New results or busy
state retire the report review.
