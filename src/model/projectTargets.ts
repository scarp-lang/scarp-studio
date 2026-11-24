import { isScarpPath, sameFilePath } from './documents';
import { safeRelativeScarpSourceName } from './folderListing';

/** Select a project target only from manifest-bearing directories found by
 * the bounded, user-authorized Explorer scan. UI selection is not permission:
 * the official native compiler validates the manifest again on execution.
 */
export interface ScannedManifestRoot {
  directory: string;
  path: string;
}

/** If the user selected a project directly, retain that root. If a parent
 * workspace contains exactly one nested manifest project, choose it so Run
 * Project / Verify Project are not left pointed at a manifest-less parent.
 * Multiple nested projects require an explicit user choice.
 */
export function preferredProjectDirectory(
  roots: readonly ScannedManifestRoot[],
): string {
  if (roots.some(root => root.directory === '')) return '';
  return roots.length === 1 ? roots[0].directory : '';
}

/** A normal Explorer refresh keeps an explicit target. If that manifest was
 * removed/renamed, fall back to the only safe discovered alternative (or root
 * placeholder); never continue targeting a stale nested directory.
 */
export function retainedProjectDirectory(
  previous: string, roots: readonly ScannedManifestRoot[],
): string {
  if (!previous || roots.some(root => root.directory === previous)) return previous;
  return preferredProjectDirectory(roots);
}

export interface ListedWorkspaceSource {
  name: string;
  path: string;
}

/** Determine the closest manifest-bearing project containing an already
 * listed editor source. Do not infer filesystem paths from source labels:
 * the original native path must first match an Explorer listing entry.
 *
 * Nested manifests win over their parent manifest, avoiding accidental Run
 * Project against a parent that also contains a different child project.
 * No project selection is changed until the user explicitly requests it.
 */
export function projectTargetForListedSource(
  sourcePath: string | null,
  listed: readonly ListedWorkspaceSource[],
  roots: readonly ScannedManifestRoot[],
): string | null {
  if (!sourcePath || !isScarpPath(sourcePath)) return null;
  const source = listed.find(entry =>
    safeRelativeScarpSourceName(entry.name) && isScarpPath(entry.path) &&
    sameFilePath(entry.path, sourcePath));
  if (!source) return null;
  const owned = roots.filter(root =>
    root.directory === '' || source.name.startsWith(root.directory + '/'));
  if (!owned.length) return null;
  owned.sort((a, b) => b.directory.length - a.directory.length);
  return owned[0].directory;
}
