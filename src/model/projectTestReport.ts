import { validateFilteredTestReport } from './projectTestSelection';
import type { ScarpProjectAction } from '../services/project';

/** Strict interpretation of Scarp's published project-test report schema v2.
 * Never parse arbitrary stdout or guess a test location from free-form text.
 */
export type ScarpTestStatus = 'discovered' | 'passed' | 'failed';

export interface ScarpTestCase {
  path: string;
  status: ScarpTestStatus;
  phase: 'compile' | 'fixture' | 'runtime' | null;
  code: string | null;
  message: string | null;
  help: string | null;
}

export interface ScarpTestReport {
  mode: 'list' | 'run';
  /** Explicit command selection, never inferred from compiler JSON. */
  filter?: string;
  discovered: number;
  passed: number;
  failed: number;
  tests: readonly ScarpTestCase[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 64;
}

export function isScarpTestReportPath(path: unknown): path is string {
  if (typeof path !== 'string' || !path.startsWith('tests/') || path.length > 512) return false;
  const name = path.slice(6);
  return name.length > 4 && name.toLowerCase().endsWith('.srp') &&
    !/[\\/:]/.test(name) && !Array.from(name).some((char) => char.charCodeAt(0) < 32);
}

/** Returns null for untrusted/mismatched/oversized test reports. The UI keeps
 * the full raw compiler output as a fallback, including unsupported schemas.
 */
export function parseScarpTestReport(json: string | null): ScarpTestReport | null {
  if (!json || json.length > 256 * 1024) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  const root = record(parsed);
  if (!root || root.schema_version !== 2 || (root.mode !== 'run' && root.mode !== 'list') ||
      !count(root.discovered) || !count(root.passed) || !count(root.failed) ||
      !Array.isArray(root.tests) || root.tests.length !== root.discovered) return null;

  const cases: ScarpTestCase[] = [];
  const seen = new Set<string>();
  for (const rawCase of root.tests as unknown[]) {
    const item = record(rawCase);
    if (!item || !isScarpTestReportPath(item.path) || seen.has(item.path)) return null;
    seen.add(item.path);
    const status: ScarpTestStatus | null = item.status === 'discovered' ||
      item.status === 'passed' || item.status === 'failed' ? item.status : null;
    if (!status || (root.mode === 'list' && status !== 'discovered') ||
        (root.mode === 'run' && status === 'discovered')) return null;
    let phase: ScarpTestCase['phase'] = null;
    let code: string | null = null;
    let message: string | null = null;
    let help: string | null = null;
    if (status === 'failed') {
      if (item.phase !== 'compile' && item.phase !== 'fixture' && item.phase !== 'runtime') return null;
      phase = item.phase;
      const diagnostic = record(item.diagnostic);
      if (!diagnostic || typeof diagnostic.message !== 'string' ||
          Array.from(diagnostic.message).length > 1600) return null;
      message = diagnostic.message;
      if (diagnostic.code !== null && diagnostic.code !== undefined) {
        if (typeof diagnostic.code !== 'string' || !/^E\d{4}$/.test(diagnostic.code)) return null;
        code = diagnostic.code;
      }
      if (diagnostic.help !== null && diagnostic.help !== undefined) {
        if (typeof diagnostic.help !== 'string' || Array.from(diagnostic.help).length > 512) return null;
        help = diagnostic.help;
      }
    }
    cases.push({ path: item.path, status, phase, code, message, help });
  }
  const passed = cases.filter((item) => item.status === 'passed').length;
  const failed = cases.filter((item) => item.status === 'failed').length;
  if (passed !== root.passed || failed !== root.failed ||
      (root.mode === 'run' && passed + failed !== root.discovered) ||
      (root.mode === 'list' && (passed !== 0 || failed !== 0))) return null;
  return { mode: root.mode, discovered: root.discovered, passed, failed, tests: cases };
}

/** Tie the structured report to the EXACT command the user requested.
 * Schema validity alone is insufficient: otherwise an unexpected 'list'
 * payload from Run Tests could be presented as if tests actually ran.
 * The native process exit code must also agree with the JSON summary: a
 * crash, CLI error or a claimed PASS accompanied by exit 1 is never a pass.
 * Unknown/non-test actions never acquire structured test results.
 * Keep raw compiler output available as the UI fallback.
 */
export function parseScarpTestReportForAction(
  json: string | null,
  action: ScarpProjectAction,
  exitCode: number | null,
  testFilter?: string,
): ScarpTestReport | null {
  const expectedMode = action === 'list-tests'
    ? 'list'
    : action === 'run-tests' ? 'run' : null;
  if (!expectedMode || !Number.isSafeInteger(exitCode)) return null;
  // Per Scarp's test CLI contract: discovery succeeds with zero; a fully
  // executed suite succeeds with zero failures (exit 0) or reports failed
  // tests (exit 1). A CLI error, crash or contradictory summary cannot
  // become a trustworthy PASS/FAIL list, even if JSON itself is schema-valid.
  if (expectedMode === 'list' && exitCode !== 0) return null;
  if (expectedMode === 'run' && exitCode !== 0 && exitCode !== 1) return null;
  const report = parseScarpTestReport(json);
  if (!report || report.mode !== expectedMode) return null;
  if (testFilter !== undefined && !validateFilteredTestReport(report, testFilter)) return null;
  if (expectedMode === 'run' && ((exitCode === 0) !== (report.failed === 0))) {
    // Native Run Tests uses --require-tests. A strict empty selection
    // is a genuine zero-case report, but not a passing run.
    if (!(testFilter !== undefined && exitCode === 1 && report.discovered === 0)) return null;
  }
  if (testFilter !== undefined && expectedMode === 'run' && report.discovered === 0 && exitCode === 0) return null;
  return testFilter === undefined ? report : { ...report, filter: testFilter };
}
