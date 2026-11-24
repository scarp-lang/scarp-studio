import { sameFilePath } from './documents';
import { isScarpTestReportPath } from './projectTestReport';

/** Compiler test paths are untrusted labels, never native filesystem paths.
 * The selected workspace may contain multiple independent manifest roots.
 */
export interface TestSourceListing {
  path: string;
  files: readonly { name: string; path: string }[];
  projectRoots?: readonly { directory: string; path: string }[];
}

/** Resolve only an exact native path already listed in the selected workspace.
 * Compiler reports use tests/<file>.srp relative to their chosen project
 * root; when a project lives in basic_tuple/, translate that *display name*
 * using a manifest root that was discovered in the same folder scan.
 * Never join report-supplied paths, bypass the listing or follow aliases.
 */
export function resolveListedTestSource(
  reportPath: string,
  reportProjectFolder: string,
  selection: TestSourceListing | null,
): string | null {
  if (!selection || !isScarpTestReportPath(reportPath)) return null;
  const prefix = sameFilePath(selection.path, reportProjectFolder)
    ? ''
    : selection.projectRoots?.find(root =>
      root.directory !== '' && sameFilePath(root.path, reportProjectFolder))?.directory;
  if (prefix === undefined) return null;
  const expectedName = prefix ? prefix + '/' + reportPath : reportPath;
  const entry = selection.files.find(file => file.name === expectedName);
  return entry?.path ?? null;
}

/** Structured test results belong to the selected manifest root, not the
 * parent Explorer workspace. Preserve native Windows path alias comparisons.
 * Returning false for an absent target prevents stale reports leaking into
 * the output panel after a workspace/project selection change.
 */
export function isSelectedProjectTestReport(
  reportFolder: string, selectedProjectFolder: string | null,
): boolean {
  return selectedProjectFolder !== null &&
    sameFilePath(reportFolder, selectedProjectFolder);
}
