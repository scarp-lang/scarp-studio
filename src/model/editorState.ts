import {
  createUntitled, isDirty, markSaved, openedDocument, updateContent,
  type StudioDocument,
} from './documents';

export interface EditorState {
  documents: StudioDocument[];
  activeId: string | null;
  nextUntitled: number;
}

export type EditorAction =
  | { type: 'new' }
  | { type: 'open'; path: string; content: string }
  | { type: 'edit'; id: string; content: string }
  | { type: 'saved'; id: string; path: string; savedContent: string }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string; snapshot: StudioDocument };

export const initialEditorState: EditorState = {
  documents: [createUntitled(1)],
  activeId: 'untitled-1',
  nextUntitled: 2,
};

/** Guard against a native close dialog racing with new keystrokes or a save. */
export function isUnchangedSnapshot(
  current: StudioDocument,
  snapshot: StudioDocument,
): boolean {
  return current.id === snapshot.id &&
    current.path === snapshot.path &&
    current.name === snapshot.name &&
    current.content === snapshot.content &&
    current.savedContent === snapshot.savedContent;
}

/** Pure transitions keep asynchronous file-open events from replacing newer tabs. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'new': {
      const created = createUntitled(state.nextUntitled);
      return {
        ...state,
        documents: [...state.documents, created],
        activeId: created.id,
        nextUntitled: state.nextUntitled + 1,
      };
    }
    case 'open': {
      const opened = openedDocument(state.documents, action.path, action.content);
      return { ...state, documents: opened.documents, activeId: opened.id };
    }
    case 'edit':
      if (!state.documents.some((document) => document.id === action.id)) return state;
      return { ...state, documents: updateContent(state.documents, action.id, action.content) };
    case 'saved':
      if (!state.documents.some((document) => document.id === action.id)) return state;
      return {
        ...state,
        documents: markSaved(state.documents, action.id, action.path, action.savedContent),
      };
    case 'activate':
      if (!state.documents.some((document) => document.id === action.id)) return state;
      return { ...state, activeId: action.id };
    case 'close': {
      const current = state.documents.find((document) => document.id === action.id);
      if (!current || !isUnchangedSnapshot(current, action.snapshot)) return state;
      // A changed saved snapshot is treated as a new edit, not an authorized discard.
      if (isDirty(current) !== isDirty(action.snapshot)) return state;
      const remaining = state.documents.filter((document) => document.id !== action.id);
      return {
        ...state,
        documents: remaining,
        activeId: state.activeId === action.id
          ? remaining.at(-1)?.id ?? null
          : state.activeId,
      };
    }
  }
}

/** Native exit dialogs must never authorize edits created after the prompt opened. */
export function sameDirtyDocuments(
  snapshot: readonly StudioDocument[],
  currentDocuments: readonly StudioDocument[],
): boolean {
  const currentDirty = currentDocuments.filter(isDirty);
  if (snapshot.length !== currentDirty.length) return false;
  return snapshot.every((expected) => {
    const current = currentDirty.find((document) => document.id === expected.id);
    return current !== undefined && isUnchangedSnapshot(current, expected);
  });
}
