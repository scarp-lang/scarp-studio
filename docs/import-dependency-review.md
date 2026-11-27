# Open-buffer import dependency review

Expand Imports, then Review Import Dependencies. The view uses only
the existing lexical import graph from open Explorer-listed buffers.
It never reads unopened sources or resolves compiler module semantics.

Reachable dependencies and dependents use breadth-first search, giving
a shortest observed path to each distinct open source. Cyclic components
are strongly connected components, including self-imports. Repeated
alias hints identify the same literal alias appearing more than once in
one indexed file; they are not compiler scope errors.

Dependency layers collapse cyclic components into single graph vertices.
Layer zero contains components without observed outgoing edges. Layers
are not a build order, module initialization order, or proof that a
project is acyclic. Listed-but-unopened targets and unsupported/missing
imports remain unresolved frontier edges. Limited coverage is disclosed.

The graph scan has a 2 Mi UTF-16 aggregate source budget, existing
200-source and 768-edge limits, and rejects malformed lexical input.
A recognizable import header requires the literal path, as alias and
terminating semicolon. Navigation rechecks the source generation,
import header and exact unambiguous current listing entry.
The report is a bounded metadata-only text summary with relative source
labels and observed edge counts. No report is copied automatically.
