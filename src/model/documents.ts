/** State transitions are pure so they can be tested without a Tauri runtime. */
export interface StudioDocument {
  id: string;
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
  /** In-session generation to reject A-to-B-to-A (ABA) source edits. */
  revision: number;
}

export function isScarpPath(path: string): boolean {
  return /\.srp$/i.test(path);
}

/** Compare ordinary Windows absolute paths by case, separators, and lexical
 * dot segments. Keep device namespaces, invalid above-root traversal and
 * POSIX spelling distinct. This is only a collision guard, not filesystem
 * canonicalization; symlink/junction identity still needs native handling.
 */
export function sameFilePath(left: string, right: string): boolean {
  // Win32 accepts both separators for UNC prefixes as well as path tails.
  // The original check recognized only backslash-prefixed UNC roots, so the
  // exact same network source through //server/share and \\\\server\\share
  // could bypass dirty-tab reuse and Save As collision prevention.
  const isWindows = (path: string) =>
    /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}/.test(path);
  if (!isWindows(left) || !isWindows(right)) return left === right;

  const normalize = (original: string): string => {
    let path = original.replace(/\//g, '\\');
    let extended = false;
    // Only the well-defined drive/UNC long-path spellings may alias ordinary
    // Windows paths. Device and GLOBALROOT namespaces stay distinct.
    if (/^\\\\\?\\[A-Za-z]:\\/.test(path)) {
      extended = true;
      path = path.slice(4);
    } else if (/^\\\\\?\\UNC\\/i.test(path)) {
      extended = true;
      path = '\\\\' + path.slice(8);
    } else if (/^\\\\[?.]\\/.test(path)) {
      return 'device-namespace:' + path.toLowerCase();
    }

    const drive = /^([A-Za-z]:)\\(.*)$/.exec(path);
    const unc = drive ? null : /^\\\\([^\\]+)\\([^\\]+)(?:\\(.*))?$/.exec(path);
    // Do not infer identity for malformed, nonstandard or incomplete roots.
    if (!drive && !unc) return 'unrecognized:' + path.toLowerCase();
    const remainder = drive ? drive[2] : unc![3] ?? '';
    const parts = remainder.split('\\');
    // Extended-length paths disable normal Win32 parsing; never quietly
    // reinterpret a dot segment in that namespace as an ordinary file.
    if (extended && parts.some((part) => part === '.' || part === '..')) {
      return 'extended-literal:' + original.replace(/\//g, '\\').toLowerCase();
    }
    const segments: string[] = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        // Traversing above a drive or UNC share root is not a trustworthy
        // alias. In particular, never pop the server/share itself.
        if (!segments.length) return 'invalid-traversal:' + path.toLowerCase();
        segments.pop();
      } else {
        segments.push(part.toLowerCase());
      }
    }
    const root = drive
      ? drive[1].toLowerCase() + '\\'
      : '\\\\' + unc![1].toLowerCase() + '\\' + unc![2].toLowerCase() + '\\';
    return root + segments.join('\\');
  };
  return normalize(left) === normalize(right);
}
export function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

export function createUntitled(sequence: number): StudioDocument {
  return {
    id: 'untitled-' + sequence,
    name: 'Untitled-' + sequence + '.srp',
    path: null,
    content: '',
    savedContent: '',
    revision: 0,
  };
}

export function isDirty(document: StudioDocument): boolean {
  return document.content !== document.savedContent;
}

export function updateContent(
  documents: StudioDocument[],
  id: string,
  content: string,
): StudioDocument[] {
  if (!documents.some((doc) => doc.id === id && doc.content !== content)) return documents;
  // Monaco can fire unchanged notifications: only real changes count as edits.
  // An edit returning to older text retains a strictly newer revision.
  return documents.map((doc) => doc.id === id
    ? { ...doc, content, revision: doc.revision + 1 }
    : doc);
}

export function openedDocument(
  documents: StudioDocument[],
  path: string,
  content: string,
  // Standalone document helpers start at zero. The editor reducer supplies a
  // session-wide generation so closing/reopening an identical saved source
  // cannot resurrect stale search, Replace All or navigation snapshots.
  initialRevision = 0,
): { documents: StudioDocument[]; id: string } {
  const existing = documents.find((document) => document.path !== null && sameFilePath(document.path, path));
  if (existing) return { documents, id: existing.id };

  // Save As deliberately preserves an open tab's identity. If A.srp was
  // moved to B.srp, its old "file-A.srp" ID can remain in use while the
  // original A.srp is reopened. Allocate a distinct ID for the new tab
  // rather than letting editor actions, React keys and Save/Close collide.
  const baseId = 'file-' + path;
  const occupied = new Set(documents.map((document) => document.id));
  let id = baseId;
  for (let suffix = 2; occupied.has(id); suffix++) {
    id = baseId + '#' + suffix;
  }
  return {
    id,
    documents: [
      ...documents,
      { id, name: fileName(path), path, content, savedContent: content, revision: initialRevision },
    ],
  };
}

export function markSaved(
  documents: StudioDocument[],
  id: string,
  path: string,
  savedContent: string,
): StudioDocument[] {
  return documents.map((document) =>
    document.id === id
      ? { ...document, name: fileName(path), path, savedContent, revision: document.revision + 1 }
      : document,
  );
}
