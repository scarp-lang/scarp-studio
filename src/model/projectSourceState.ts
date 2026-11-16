import { isDirty, type StudioDocument } from './documents';

type CanonicalParts = { kind: 'windows' | 'posix'; parts: string[] };

/** Compare already selected editor/project paths by whole path components.
 * This only helps explain stale on-disk project actions; it is not a filesystem
 * authorization check (native Scarp and Tauri retain that responsibility).
 */
function pathParts(path: string): CanonicalParts | null {
  const windows = path.replace(/\//g, '\\');
  let local = windows;
  if (/^\\\\\?\\[A-Za-z]:\\/.test(local)) {
    local = local.slice(4);
  } else if (/^\\\\\?\\UNC\\/i.test(local)) {
    local = '\\\\' + local.slice(8);
  }

  if (/^[A-Za-z]:\\/.test(local) || /^\\\\[^\\]+\\[^\\]+(?:\\|$)/.test(local)) {
    const parts = local.split('\\').filter(Boolean).map((part) => part.toLowerCase());
    if (parts.some((part) => part === '.' || part === '..')) return null;
    return { kind: 'windows', parts };
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
