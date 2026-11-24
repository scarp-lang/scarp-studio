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
