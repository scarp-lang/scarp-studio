import { sameFilePath } from './documents';
import { isScarpTestReportPath } from './projectTestReport';

/** The Explorer lists only sources from a bounded user-selected workspace.
 * The compiler's test schema still authorizes only tests/*.srp. Treat compiler test
 * report paths as labels, never filesystem paths to join or read directly.
 */
export interface TestSourceListing {
  path: string;
  files: readonly { name: string; path: string }[];
}

/** Return the ORIGINAL path from a user-selected Explorer listing only.
 * Missing, truncated, renamed or foreign source paths provide no extra
 * filesystem capability to a compiler-provided test report.
 */
export function resolveListedTestSource(
  reportPath: string,
  reportProjectFolder: string,
  selection: TestSourceListing | null,
): string | null {
  if (!selection || !sameFilePath(selection.path, reportProjectFolder) ||
      !isScarpTestReportPath(reportPath)) return null;
  // Exact relative name matching, including Unicode spelling. Never infer
  // alternate path spellings or build a path from untrusted report content.
  const entry = selection.files.find((file) => file.name === reportPath);
  return entry?.path ?? null;
}
