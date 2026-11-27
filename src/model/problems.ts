import { sameFilePath, type StudioDocument } from './documents';
import { visibleDiagnosticText, type DiagnosticReport } from './diagnosticReport';
import { diagnosticSourcePosition, type ScarpDiagnostic } from './diagnostics';
import { isCurrentVerifiedSource, type VerifiedSourceSnapshot } from './verifiedSource';
import type { ScarpTestReport } from './projectTestReport';
import { resolveListedTestSource, type TestSourceListing } from './projectTestNavigation';

export type ProblemTarget =
  | { kind: 'source'; snapshot: VerifiedSourceSnapshot; lineNumber: number; column: number }
  | { kind: 'test'; folder: string; path: string };
export interface StudioProblem {
  id: string;
  kind: 'compiler' | 'test';
  code: string | null;
  message: string;
  help: string | null;
  location: string | null;
  target: ProblemTarget | null;
}
export interface ProblemInputs {
  diagnostic: ScarpDiagnostic | null;
  snapshot: VerifiedSourceSnapshot | null;
  documents: readonly StudioDocument[];
  testResult: { folder: string; report: ScarpTestReport } | null;
  selection: TestSourceListing | null;
  stale: boolean;
  projectDiagnosticReport?: DiagnosticReport | null;
  selectedProjectPath?: string | null;
}

export function currentDiagnosticTarget(
  diagnostic: ScarpDiagnostic | null, snapshot: VerifiedSourceSnapshot | null, documents: readonly StudioDocument[],
): Extract<ProblemTarget, { kind: 'source' }> | null {
  if (!snapshot) return null;
  const document = documents.find(item => item.id === snapshot.documentId);
  if (!document?.path || !isCurrentVerifiedSource(snapshot, document)) return null;
  const position = diagnosticSourcePosition(diagnostic, document.path, document.content);
  return position ? { kind: 'source', snapshot, ...position } : null;
}

/** Derive only current structured problems. Historical raw output is not
 * a live problem list; an unknown location remains useful text but cannot
 * grant a compiler-controlled filesystem path or unchecked editor jump. */
export function collectProblems(input: ProblemInputs): StudioProblem[] {
  if (input.stale) return [];
  const problems: StudioProblem[] = [];
  if (input.diagnostic && input.snapshot &&
      input.documents.some(doc => isCurrentVerifiedSource(input.snapshot, doc))) {
    const d = input.diagnostic;
    problems.push({
      id: 'compiler', kind: 'compiler', code: d.code, message: d.message, help: d.help,
      location: d.path && d.line !== null && d.column !== null ? d.path + ':' + d.line + ':' + d.column : null,
      target: currentDiagnosticTarget(d, input.snapshot, input.documents),
    });
  }
  if (input.projectDiagnosticReport && input.projectDiagnosticReport.action !== 'source-verify') {
    for (const row of input.projectDiagnosticReport.diagnostics) {
      problems.push({
        id: 'project-diagnostic:' + row.id, kind: 'compiler', code: row.code,
        message: visibleDiagnosticText(row.message), help: row.help === null ? null : visibleDiagnosticText(row.help),
        location: row.primary ? visibleDiagnosticText(row.primary.path) + ':' + row.primary.start.line + ':' + row.primary.start.column : null,
        target: null,
      });
    }
  }
  const tests = input.testResult;
  const selected = input.selectedProjectPath === undefined ? input.selection?.path : input.selectedProjectPath;
  if (tests && input.selection && selected && sameFilePath(tests.folder, selected) && tests.report.mode === 'run') {
    for (const test of tests.report.tests) {
      if (test.status !== 'failed') continue;
      problems.push({
        id: 'test:' + test.path, kind: 'test', code: test.code, message: test.message ?? 'Scarp test failed',
        help: test.help, location: test.path,
        target: resolveListedTestSource(test.path, tests.folder, input.selection)
          ? { kind: 'test', folder: tests.folder, path: test.path } : null,
      });
    }
  }
  return problems;
}

export type ProblemFilter = 'all' | 'compiler' | 'test';
export function filterProblems(problems: readonly StudioProblem[], filter: ProblemFilter, query: string): StudioProblem[] {
  const term = query.slice(0, 160).trim().toLowerCase();
  return problems.filter(problem => (filter === 'all' || problem.kind === filter) &&
    (!term || [problem.code, problem.message, problem.location, problem.help].some(value => value?.toLowerCase().includes(term))));
}

/** Pending jumps must match both the exact source generation and the
 * location. A later diagnostic in the same unchanged file is not enough. */
export function sameDiagnosticTarget(
  current: Extract<ProblemTarget, { kind: 'source' }>,
  expected: Extract<ProblemTarget, { kind: 'source' }>,
): boolean {
  return current.snapshot === expected.snapshot && current.lineNumber === expected.lineNumber &&
    current.column === expected.column;
}
