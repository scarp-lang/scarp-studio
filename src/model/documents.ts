/** State transitions are pure so they can be tested without a Tauri runtime. */
export interface StudioDocument {
  id: string;
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
}

export function isScarpPath(path: string): boolean {
  return /\.srp$/i.test(path);
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
  return documents.map((document) =>
    document.id === id ? { ...document, content } : document,
  );
}

export function openedDocument(
  documents: StudioDocument[],
  path: string,
  content: string,
): { documents: StudioDocument[]; id: string } {
  const existing = documents.find((document) => document.path === path);
  if (existing) return { documents, id: existing.id };

  const id = 'file-' + path;
  return {
    id,
    documents: [
      ...documents,
      { id, name: fileName(path), path, content, savedContent: content },
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
      ? { ...document, name: fileName(path), path, savedContent }
      : document,
  );
}
