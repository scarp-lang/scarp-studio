import { isDirty, type StudioDocument } from './documents';

type CanonicalParts = { kind: 'windows' | 'posix'; parts: string[] };

/** Compare already selected editor/project paths by whole path components.
 * Normalize safe lexical Windows dot segments as the file collision guard does,
 * so dirty project buffers cannot escape project Run/Verify/Test warnings.
 * This is NOT a filesystem authorization or symlink/junction identity check.
 * Native Scarp and Tauri retain execution and filesystem responsibility.
 */
function pathParts(path: string): CanonicalParts | null {
  const windows = path.replace(/\//g, '\\');
  let local = windows;
  let extended = false;
  if (/^\\\\\?\\[A-Za-z]:\\/.test(local)) {
    local = local.slice(4);
    extended = true;
  } else if (/^\\\\\?\\UNC\\/i.test(local)) {
    local = '\\\\' + local.slice(8);
    extended = true;
  }
  // In extended-length namespaces dot segments have special literal behavior:
  // do not conflate them with ordinary Win32 path normalization.
  if (extended && local.split('\\').some((part) => part === '.' || part === '..')) return null;

  // Device namespaces must never be mistaken for a selected ordinary root.
  if (/^\\\\[?.]\\/.test(local)) return null;
  const drive = /^([A-Za-z]:)\\(.*)$/.exec(local);
  const unc = drive ? null : /^\\\\([^\\]+)\\([^\\]+)(?:\\(.*))?$/.exec(local);
  if (drive || unc) {
    const tail = drive ? drive[2] : unc![3] ?? '';
    const segments: string[] = [];
    for (const segment of tail.split('\\')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        // Normalize only inside a drive or UNC share, never above its root.
        if (!segments.length) return null;
        segments.pop();
      } else {
        segments.push(segment.toLowerCase());
      }
    }
    const root = drive
      ? ['drive:' + drive[1].toLowerCase()]
      : ['unc:' + unc![1].toLowerCase(), unc![2].toLowerCase()];
    return { kind: 'windows', parts: [...root, ...segments] };
  }
  if (path.startsWith('/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.some((part) => part === '.' || part === '..')) return null;
    return { kind: 'posix', parts };
  }
  return null;
}

/** Only dirty, named .srp source tabs under the selected project can make a
 * disk-backed project operation misleading. Other projects and untitled tabs
 * must not block an otherwise valid Run/Verify/Test operation.
 */
export function dirtyProjectSourceNames(
  documents: readonly StudioDocument[], folderPath: string,
): string[] {
  const root = pathParts(folderPath);
  if (!root) return [];
  return documents.filter((document) => {
    if (!isDirty(document) || !document.path) return false;
    const candidate = pathParts(document.path);
    return candidate !== null && candidate.kind === root.kind &&
      candidate.parts.length > root.parts.length &&
      root.parts.every((part, index) => candidate.parts[index] === part);
  }).map((document) => document.name);
}
