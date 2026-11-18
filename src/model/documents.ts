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

/** Compare only Windows paths without regard to case or separator style.
 * POSIX paths remain case-sensitive to avoid colliding distinct files.
 */
export function sameFilePath(left: string, right: string): boolean {
  const isWindows = (path: string) => /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
  if (isWindows(left) && isWindows(right)) {
    const normalize = (path: string) => {
      let normalized = path.replace(/\//g, '\\');
      // std::fs::canonicalize on Windows can prepend the extended-length
      // namespace. Only strip its documented drive and UNC spellings:
      // arbitrary device namespace paths must not alias ordinary files.
      if (/^\\\\\?\\[A-Za-z]:\\/.test(normalized)) {
        normalized = normalized.slice(4);
      } else if (/^\\\\\?\\UNC\\/i.test(normalized)) {
        normalized = '\\\\' + normalized.slice(8);
      }
      return normalized.replace(/\\+/g, '\\').toLowerCase();
    };
    return normalize(left) === normalize(right);
  }
  return left === right;
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

  const id = 'file-' + path;
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
